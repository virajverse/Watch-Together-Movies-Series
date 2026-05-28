/**
 * Stream Route (MVP2 - R2 Rewrite)
 * 
 * Since streaming happens directly from R2 public URL,
 * this route simply returns the R2 URL for a video's master.m3u8
 */

import { Router, Request, Response } from "express";
import { getPublicUrl } from "../lib/r2.ts";
import { supabase } from "../lib/supabase.ts";

const router = Router();

/**
 * GET /api/stream/:videoId
 * Returns the R2 public URL for the video's HLS master playlist
 * Client uses this URL directly with HLS.js (no proxying)
 */
router.get("/:videoId", async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    // Look up video in database
    if (supabase) {
      const { data, error } = await supabase
        .from("videos")
        .select("status, stream_path")
        .eq("id", videoId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: "Video not found",
        });
      }

      if (data.status !== "ready") {
        return res.status(202).json({
          success: false,
          error: `Video is not ready. Current status: ${data.status}`,
          status: data.status,
        });
      }

      // Return the R2 public URL
      return res.json({
        success: true,
        data: {
          videoId,
          streamUrl: data.stream_path,
          status: data.status,
        },
      });
    }

    // Fallback: construct URL directly
    const streamUrl = getPublicUrl(`videos/${videoId}/master.m3u8`);
    res.json({
      success: true,
      data: {
        videoId,
        streamUrl,
        status: "ready",
      },
    });
  } catch (error: any) {
    console.error("[STREAM] Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
