/**
 * Local Folder Watcher
 * Watches LOCAL_IMPORT_FOLDER for new video files
 * When detected, creates DB record and queues FFmpeg processing
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { VIDEO_UPLOAD_CONFIG } from "../../../shared/constants.ts";
import { supabase } from "../lib/supabase.ts";
import { localQueue } from "./queue.ts";

// Track already-processed files to avoid duplicates
const processedFiles = new Set<string>();

// Import folder path
const IMPORT_FOLDER = process.env.LOCAL_IMPORT_FOLDER || "./import";

// Polling interval (30 seconds)
const POLL_INTERVAL = 30_000;

// Allowed video extensions
const ALLOWED_EXTENSIONS = [".mp4", ".mkv", ".webm", ".avi", ".mov"];

/**
 * Scan the import folder for new video files
 * Returns list of newly detected files
 */
export async function scanImportFolder(): Promise<string[]> {
  const importPath = path.resolve(process.cwd(), IMPORT_FOLDER);

  if (!existsSync(importPath)) {
    console.log(`[WATCHER] Import folder does not exist: ${importPath}`);
    return [];
  }

  const files = await fs.readdir(importPath);
  const newFiles: string[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    // Skip non-video files
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

    // Skip already processed files
    if (processedFiles.has(file)) continue;

    // Check if already in database
    if (supabase) {
      const { data } = await supabase
        .from("videos")
        .select("id")
        .eq("original_name", file)
        .single();

      if (data) {
        // Already in DB, mark as processed
        processedFiles.add(file);
        continue;
      }
    }

    // New file detected
    const filePath = path.join(importPath, file);
    const stat = await fs.stat(filePath);

    // Skip if file is still being written (modified in last 5 seconds)
    const timeSinceModified = Date.now() - stat.mtimeMs;
    if (timeSinceModified < 5000) {
      console.log(`[WATCHER] Skipping ${file} - still being written`);
      continue;
    }

    console.log(`[WATCHER] New video detected: ${file} (${(stat.size / (1024 * 1024)).toFixed(1)} MB)`);

    // Create video record in Supabase
    const videoId = uuidv4();
    const mimeType = getMimeType(ext);

    if (supabase) {
      const { error: dbError } = await supabase.from("videos").insert({
        id: videoId,
        filename: file,
        original_name: file,
        file_size: stat.size,
        mime_type: mimeType,
        status: "processing",
        stream_path: null,
        thumbnail_path: null,
      });

      if (dbError) {
        console.error(`[WATCHER] DB insert error for ${file}:`, dbError);
        continue;
      }
    }

    // Queue FFmpeg processing
    localQueue.addJob(videoId, "transcode");
    localQueue.addJob(videoId, "thumbnail");

    // Mark as processed
    processedFiles.add(file);
    newFiles.push(file);

    console.log(`[WATCHER] Queued processing for: ${file} (videoId: ${videoId})`);
  }

  return newFiles;
}

/**
 * Start the folder watcher with polling
 */
export function startWatcher(): void {
  const importPath = path.resolve(process.cwd(), IMPORT_FOLDER);

  // Ensure import folder exists
  if (!existsSync(importPath)) {
    mkdirSync(importPath, { recursive: true });
    console.log(`[WATCHER] Created import folder: ${importPath}`);
  }

  console.log(`[WATCHER] Watching folder: ${importPath} (polling every ${POLL_INTERVAL / 1000}s)`);

  // Initial scan
  scanImportFolder().then((files) => {
    if (files.length > 0) {
      console.log(`[WATCHER] Initial scan found ${files.length} new file(s)`);
    }
  });

  // Poll periodically
  setInterval(async () => {
    try {
      const files = await scanImportFolder();
      if (files.length > 0) {
        console.log(`[WATCHER] Poll found ${files.length} new file(s)`);
      }
    } catch (err: any) {
      console.error("[WATCHER] Poll error:", err.message);
    }
  }, POLL_INTERVAL);
}

/**
 * Get MIME type from extension
 */
function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
  };
  return types[ext] || "video/mp4";
}
