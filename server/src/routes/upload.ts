/**
 * Upload API Routes (MVP2 - R2 Rewrite)
 * 
 * Method 1: Presigned URL upload (browser → R2 direct)
 *   POST /api/upload/presign  → get presigned PUT URL
 *   POST /api/upload/complete → mark upload done, queue processing
 * 
 * Method 2: Local admin import
 *   POST /api/import/scan → scan local import folder for new videos
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { VIDEO_UPLOAD_CONFIG, SOCKET_EVENTS } from "../../../shared/constants.ts";
import { getPresignedUploadUrl, getPublicUrl } from "../lib/r2.ts";
import { localQueue } from "../workers/queue.ts";
import { supabase } from "../lib/supabase.ts";

const router = Router();

/**
 * Create upload router with Socket.IO reference for progress events
 */
export function createUploadRouter(io: SocketIOServer): Router {
  /**
   * POST /api/upload/presign
   * Generate a presigned PUT URL for direct browser upload to R2
   */
  router.post("/presign", async (req: Request, res: Response) => {
    try {
      const { filename, contentType, fileSize } = req.body;

      // Validate required fields
      if (!filename || !contentType || !fileSize) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: filename, contentType, fileSize",
        });
      }

      // Validate file type
      const ext = path.extname(filename).toLowerCase();
      const isValidExt = VIDEO_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(ext);
      const isValidMime = VIDEO_UPLOAD_CONFIG.ALLOWED_TYPES.includes(contentType);

      if (!isValidExt && !isValidMime) {
        return res.status(400).json({
          success: false,
          error: `Invalid file type. Allowed: ${VIDEO_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(", ")}`,
        });
      }

      // Validate file size
      if (fileSize > VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          error: `File too large. Maximum: ${(VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(0)}GB`,
        });
      }

      // Generate video ID and R2 key
      const videoId = uuidv4();
      const r2Key = `uploads/${videoId}${ext}`;

      // Get presigned URL
      const uploadUrl = await getPresignedUploadUrl(r2Key, contentType, 300);
      const publicUrl = getPublicUrl(r2Key);

      // Create video record in Supabase with status "uploading"
      if (supabase) {
        const { error: dbError } = await supabase.from("videos").insert({
          id: videoId,
          filename: `${videoId}${ext}`,
          original_name: filename,
          file_size: fileSize,
          mime_type: contentType,
          status: "uploading",
          stream_path: null,
          thumbnail_path: null,
        });

        if (dbError) {
          console.error("[UPLOAD] Database insert error:", dbError);
        }
      }

      console.log(`[UPLOAD] Presigned URL generated for: ${filename} → ${r2Key}`);

      res.json({
        success: true,
        data: {
          videoId,
          uploadUrl,
          publicUrl,
          r2Key,
        },
      });
    } catch (error: any) {
      console.error("[UPLOAD] Presign error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/upload/complete
   * Called after browser finishes uploading to R2
   * Updates status and queues FFmpeg processing
   */
  router.post("/complete", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.body;

      if (!videoId) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: videoId",
        });
      }

      // Update status to "processing"
      if (supabase) {
        const { error: dbError } = await supabase
          .from("videos")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", videoId);

        if (dbError) {
          console.error("[UPLOAD] Database update error:", dbError);
        }
      }

      // Queue FFmpeg transcode and thumbnail jobs
      localQueue.addJob(videoId, "transcode");
      localQueue.addJob(videoId, "thumbnail");

      // Emit processing started via Socket.IO
      io.emit(SOCKET_EVENTS.PROCESSING_PROGRESS, {
        videoId,
        progress: 0,
        type: "transcode",
        status: "processing",
      });

      console.log(`[UPLOAD] Upload complete for ${videoId}, queued processing`);

      res.json({
        success: true,
        data: { videoId, status: "processing" },
      });
    } catch (error: any) {
      console.error("[UPLOAD] Complete error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default router;
