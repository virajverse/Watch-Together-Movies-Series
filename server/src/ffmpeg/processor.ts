/**
 * FFmpeg Video Processor (MVP2 - R2 Rewrite)
 * 
 * Downloads source from R2 (or reads from local import folder),
 * transcodes to HLS with multiple qualities,
 * uploads all HLS files + thumbnail to R2,
 * updates Supabase with R2 public URLs.
 */

import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import type { ProcessingJob } from "../../../shared/types.ts";
import { HLS_CONFIG } from "../../../shared/constants.ts";
import { localQueue } from "../workers/queue.ts";
import { supabase } from "../lib/supabase.ts";
import {
  uploadFile,
  downloadFile,
  getPublicUrl,
  getContentType,
} from "../lib/r2.ts";

// Temp processing directory
const TEMP_DIR = path.resolve(process.cwd(), "storage/temp");
const IMPORT_FOLDER = path.resolve(process.cwd(), process.env.LOCAL_IMPORT_FOLDER || "./import");

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Get video metadata using ffprobe
 */
export function getVideoMetadata(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
      });
    });
  });
}

/**
 * Determine which qualities to generate based on source resolution
 */
function getTargetQualities(sourceHeight: number) {
  const qualities = HLS_CONFIG.QUALITIES.filter(q => q.height <= sourceHeight);
  if (qualities.length === 0) {
    // If source is smaller than 360p, just use 360p settings
    return [HLS_CONFIG.QUALITIES[0]];
  }
  return qualities;
}

/**
 * Get the input file path for a video.
 * - For presigned uploads: download from R2 to temp
 * - For local imports: use file directly from import folder
 */
async function getInputFilePath(videoId: string): Promise<string> {
  // Check if file exists in local import folder first
  if (existsSync(IMPORT_FOLDER)) {
    const importFiles = await fs.readdir(IMPORT_FOLDER);

    // Check DB for the filename associated with this videoId
    if (supabase) {
      const { data } = await supabase
        .from("videos")
        .select("filename, original_name")
        .eq("id", videoId)
        .single();

      if (data) {
        // Check if the file is in the import folder
        const localFile = importFiles.find(
          f => f === data.filename || f === data.original_name
        );
        if (localFile) {
          const localPath = path.join(IMPORT_FOLDER, localFile);
          if (existsSync(localPath)) {
            console.log(`[FFMPEG] Using local import file: ${localPath}`);
            return localPath;
          }
        }
      }
    }
  }

  // Not a local file - download from R2
  // Find the upload key in R2 (uploads/{videoId}.ext)
  let r2Key = "";
  if (supabase) {
    const { data } = await supabase
      .from("videos")
      .select("filename")
      .eq("id", videoId)
      .single();

    if (data) {
      const ext = path.extname(data.filename);
      r2Key = `uploads/${videoId}${ext}`;
    }
  }

  if (!r2Key) {
    throw new Error(`Cannot determine source file for video ${videoId}`);
  }

  // Download from R2 to temp
  const tempPath = path.join(TEMP_DIR, `${videoId}${path.extname(r2Key)}`);
  console.log(`[FFMPEG] Downloading from R2: ${r2Key}`);
  await downloadFile(r2Key, tempPath);

  return tempPath;
}

/**
 * Upload all HLS files from a directory to R2
 */
async function uploadHLSToR2(localDir: string, r2Prefix: string): Promise<void> {
  const entries = await fs.readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories (quality folders)
      await uploadHLSToR2(localPath, `${r2Prefix}${entry.name}/`);
    } else {
      // Upload file
      const r2Key = `${r2Prefix}${entry.name}`;
      const contentType = getContentType(entry.name);
      await uploadFile(r2Key, localPath, contentType);
    }
  }
}

/**
 * Generate HLS streams for a video
 * 1. Get input file (local or download from R2)
 * 2. Transcode to HLS with multiple qualities
 * 3. Upload all HLS files to R2
 * 4. Update Supabase with R2 public URL
 * 5. Clean up temp files
 */
async function transcodeToHLS(
  job: ProcessingJob,
  onProgress: (progress: number) => void
): Promise<void> {
  const videoId = job.videoId;
  const tempOutputDir = path.join(TEMP_DIR, videoId);

  try {
    // Step 1: Get input file
    onProgress(2);
    const inputPath = await getInputFilePath(videoId);

    // Step 2: Get source metadata
    const metadata = await getVideoMetadata(inputPath);
    const qualities = getTargetQualities(metadata.height);

    // Update duration in DB
    if (supabase && metadata.duration) {
      await supabase
        .from("videos")
        .update({
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
        })
        .eq("id", videoId);
    }

    // Create temp output directory
    if (!existsSync(tempOutputDir)) {
      mkdirSync(tempOutputDir, { recursive: true });
    }

    onProgress(5);

    // Step 3: Process each quality level
    const totalQualities = qualities.length;
    const qualityNames: string[] = [];

    for (let i = 0; i < qualities.length; i++) {
      const quality = qualities[i];
      const qualityDir = path.join(tempOutputDir, quality.name);

      if (!existsSync(qualityDir)) {
        mkdirSync(qualityDir, { recursive: true });
      }

      // Progress: 5-80% for transcoding
      const baseProgress = 5 + (i / totalQualities) * 75;
      const qualityWeight = 75 / totalQualities;

      await new Promise<void>((resolve, reject) => {
        const segmentPattern = path.join(qualityDir, "segment_%03d.ts");
        const playlistOutput = path.join(qualityDir, "playlist.m3u8");

        const command = ffmpeg(inputPath)
          .outputOptions([
            `-vf`, `scale=${quality.width}:${quality.height}:force_original_aspect_ratio=decrease,pad=${quality.width}:${quality.height}:(ow-iw)/2:(oh-ih)/2`,
            `-c:v`, `libx264`,
            `-b:v`, `${quality.bitrate}`,
            `-c:a`, `aac`,
            `-b:a`, `128k`,
            `-hls_time`, `${HLS_CONFIG.SEGMENT_DURATION}`,
            `-hls_list_size`, `0`,
            `-hls_segment_filename`, segmentPattern,
            `-f`, `hls`,
          ])
          .output(playlistOutput)
          .on("progress", (info) => {
            const qualityProgress = info.percent || 0;
            const totalProgress = baseProgress + (qualityProgress / 100) * qualityWeight;
            onProgress(Math.min(Math.round(totalProgress), 80));
          })
          .on("end", () => {
            qualityNames.push(quality.name);
            resolve();
          })
          .on("error", (err) => {
            reject(err);
          });

        command.run();
      });
    }

    // Step 4: Generate master playlist
    const masterPlaylist = generateMasterPlaylist(qualities);
    await fs.writeFile(path.join(tempOutputDir, "master.m3u8"), masterPlaylist);

    onProgress(82);

    // Step 5: Upload all HLS files to R2
    console.log(`[FFMPEG] Uploading HLS files to R2 for video ${videoId}...`);
    const r2Prefix = `videos/${videoId}/`;
    await uploadHLSToR2(tempOutputDir, r2Prefix);

    onProgress(95);

    // Step 6: Update Supabase with R2 public URL
    const streamUrl = getPublicUrl(`videos/${videoId}/master.m3u8`);

    if (supabase) {
      await supabase
        .from("videos")
        .update({
          status: "ready",
          stream_path: streamUrl,
          qualities: qualityNames,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);
    }

    onProgress(100);
    console.log(`[FFMPEG] Transcode complete for ${videoId}. Stream: ${streamUrl}`);
  } finally {
    // Step 7: Clean up temp files
    if (existsSync(tempOutputDir)) {
      await fs.rm(tempOutputDir, { recursive: true, force: true });
    }

    // Clean up downloaded source file from temp (if it was downloaded from R2)
    const tempSourceFiles = await fs.readdir(TEMP_DIR);
    for (const f of tempSourceFiles) {
      if (f.startsWith(videoId) && !f.includes("/")) {
        await fs.unlink(path.join(TEMP_DIR, f)).catch(() => {});
      }
    }
  }
}

/**
 * Generate HLS master playlist with all quality variants
 */
function generateMasterPlaylist(qualities: typeof HLS_CONFIG.QUALITIES): string {
  let playlist = "#EXTM3U\n#EXT-X-VERSION:3\n\n";

  for (const quality of qualities) {
    const bandwidth = parseInt(quality.bitrate) * 1000;
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height},NAME="${quality.name}"\n`;
    playlist += `${quality.name}/playlist.m3u8\n\n`;
  }

  return playlist;
}

/**
 * Generate thumbnail at 10% mark of the video
 * Uploads to R2 and updates Supabase
 */
async function generateThumbnail(
  job: ProcessingJob,
  onProgress: (progress: number) => void
): Promise<void> {
  const videoId = job.videoId;
  const tempThumbDir = path.join(TEMP_DIR, `thumb_${videoId}`);

  try {
    // Get input file
    const inputPath = await getInputFilePath(videoId);

    // Get duration to calculate 10% mark
    const metadata = await getVideoMetadata(inputPath);
    const thumbnailTime = Math.max(metadata.duration * 0.1, 1);

    onProgress(20);

    // Create temp directory for thumbnail
    if (!existsSync(tempThumbDir)) {
      mkdirSync(tempThumbDir, { recursive: true });
    }

    // Generate thumbnail
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [thumbnailTime],
          filename: "thumbnail.jpg",
          folder: tempThumbDir,
          size: "640x360",
        })
        .on("end", () => {
          onProgress(60);
          resolve();
        })
        .on("error", (err) => {
          reject(err);
        });
    });

    // Upload thumbnail to R2
    const thumbPath = path.join(tempThumbDir, "thumbnail.jpg");
    const r2Key = `videos/${videoId}/thumbnail.jpg`;

    if (existsSync(thumbPath)) {
      await uploadFile(r2Key, thumbPath, "image/jpeg");
      const thumbnailUrl = getPublicUrl(r2Key);

      // Update Supabase with thumbnail URL
      if (supabase) {
        await supabase
          .from("videos")
          .update({
            thumbnail_path: thumbnailUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", videoId);
      }

      console.log(`[FFMPEG] Thumbnail uploaded for ${videoId}: ${thumbnailUrl}`);
    }

    onProgress(100);
  } finally {
    // Clean up temp thumbnail directory
    if (existsSync(tempThumbDir)) {
      await fs.rm(tempThumbDir, { recursive: true, force: true });
    }
  }
}

/**
 * Register processing handlers with the local queue
 */
export function registerProcessingHandlers(): void {
  localQueue.registerHandler("transcode", transcodeToHLS);
  localQueue.registerHandler("thumbnail", generateThumbnail);
  console.log("[FFMPEG] Processing handlers registered (R2 mode)");
}
