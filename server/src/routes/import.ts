/**
 * Import API Route
 * POST /api/import/scan - manually trigger scan of local import folder
 */

import { Router, Request, Response } from "express";
import { scanImportFolder } from "../workers/watcher.ts";

const router = Router();

/**
 * POST /api/import/scan
 * Manually trigger a scan of the local import folder
 */
router.post("/scan", async (_req: Request, res: Response) => {
  try {
    const newFiles = await scanImportFolder();

    res.json({
      success: true,
      data: {
        filesFound: newFiles.length,
        files: newFiles,
      },
    });
  } catch (error: any) {
    console.error("[IMPORT] Scan error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
