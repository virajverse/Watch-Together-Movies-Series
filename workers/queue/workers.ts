/**
 * Example Worker Implementation
 * Template for creating new workers
 *
 * To create a new worker:
 * 1. Extend this class
 * 2. Implement the process() method
 * 3. Register in workerRegistry
 *
 * Example: FFmpeg Worker
 *   - Takes video input
 *   - Transcodes to different formats
 *   - Returns path to processed video
 */

import { QueueJob } from "../../shared/types";
import { IWorker } from "./types";

export class ExampleWorker implements IWorker {
  private status: "idle" | "processing" | "error" = "idle";
  private currentJob: QueueJob | null = null;

  /**
   * Process a job
   * This is where the actual work happens
   */
  async process(job: QueueJob): Promise<any> {
    this.status = "processing";
    this.currentJob = job;

    try {
      console.log(`[WORKER] Processing job: ${job.id} (${job.type})`);

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Example result
      const result = {
        jobId: job.id,
        processedAt: Date.now(),
        inputPayload: job.payload,
        output: {
          status: "success",
          message: "Job processed successfully",
        },
      };

      console.log(`[WORKER] Job completed: ${job.id}`);

      this.status = "idle";
      this.currentJob = null;

      return result;
    } catch (error) {
      console.error(`[WORKER] Job failed: ${job.id}`, error);
      this.status = "error";
      throw error;
    }
  }

  /**
   * Get worker type
   */
  getType(): string {
    return "example-worker";
  }

  /**
   * Get worker status
   */
  getStatus(): "idle" | "processing" | "error" {
    return this.status;
  }

  /**
   * Shutdown worker
   */
  async shutdown(): Promise<void> {
    console.log("[WORKER] Shutting down worker");
    this.status = "idle";
    this.currentJob = null;
  }
}

/**
 * Worker Registry
 * Maps job types to worker instances
 */
export const workerRegistry = new Map<string, IWorker>();

// Example: Register workers
// workerRegistry.set("transcode_video", new FFmpegWorker());
// workerRegistry.set("generate_hls", new HLSWorker());
// workerRegistry.set("process_analytics", new AnalyticsWorker());
