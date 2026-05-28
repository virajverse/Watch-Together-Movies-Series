/**
 * Video Library API Routes (MVP2 - R2 Rewrite)
 * CRUD operations for uploaded videos
 * Delete now removes files from R2
 */

import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.ts";
import { deletePrefix } from "../lib/r2.ts";
import { localQueue } from "../workers/queue.ts";

// Helper to check if supabase is available
function requireSupabase(res: Response): boolean {
  if (!supabase) {
    res.status(503).json({ success: false, error: "Database not configured" });
    return false;
  }
  return true;
}

const router = Router();

/**
 * GET /api/videos
 * List all uploaded videos
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    if (!requireSupabase(res)) return;

    const { data, error } = await supabase!
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[VIDEOS] List error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch videos" });
    }

    // Map database rows to VideoFile interface
    const videos = (data || []).map(row => ({
      id: row.id,
      filename: row.filename,
      originalName: row.original_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      duration: row.duration,
      width: row.width,
      height: row.height,
      status: row.status,
      thumbnailPath: row.thumbnail_path,
      streamPath: row.stream_path,
      qualities: row.qualities,
      uploadedBy: row.uploaded_by,
      createdAt: new Date(row.created_at).getTime(),
      errorMessage: row.error_message,
    }));

    res.json({ success: true, data: videos });
  } catch (error: any) {
    console.error("[VIDEOS] List error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/videos/:id
 * Get video details + processing status
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!requireSupabase(res)) return;

    const { data, error } = await supabase!
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "Video not found" });
    }

    // Get processing jobs status
    const jobs = localQueue.getJobsForVideo(id);

    const video = {
      id: data.id,
      filename: data.filename,
      originalName: data.original_name,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      duration: data.duration,
      width: data.width,
      height: data.height,
      status: data.status,
      thumbnailPath: data.thumbnail_path,
      streamPath: data.stream_path,
      qualities: data.qualities,
      uploadedBy: data.uploaded_by,
      createdAt: new Date(data.created_at).getTime(),
      errorMessage: data.error_message,
      processingJobs: jobs,
    };

    res.json({ success: true, data: video });
  } catch (error: any) {
    console.error("[VIDEOS] Get error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/videos/:id
 * Delete video + all associated files from R2
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!requireSupabase(res)) return;

    // Get video info from database
    const { data, error } = await supabase!
      .from("videos")
      .select("filename")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "Video not found" });
    }

    // Delete all R2 objects under videos/{videoId}/
    try {
      await deletePrefix(`videos/${id}/`);
    } catch (r2Error: any) {
      console.warn(`[VIDEOS] R2 delete warning for ${id}:`, r2Error.message);
    }

    // Delete the uploaded source file from R2 (uploads/{videoId}.ext)
    try {
      const ext = data.filename ? "." + data.filename.split(".").pop() : "";
      if (ext) {
        await deletePrefix(`uploads/${id}`);
      }
    } catch (r2Error: any) {
      console.warn(`[VIDEOS] R2 upload delete warning for ${id}:`, r2Error.message);
    }

    // Delete from database
    const { error: deleteError } = await supabase!
      .from("videos")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[VIDEOS] Delete DB error:", deleteError);
    }

    console.log(`[VIDEOS] Deleted video ${id} (R2 + DB)`);
    res.json({ success: true, message: "Video deleted successfully" });
  } catch (error: any) {
    console.error("[VIDEOS] Delete error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
