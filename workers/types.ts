/**
 * Worker Architecture
 * Base structure for future background task processing
 *
 * MVP 2 will use this for:
 * - FFmpeg video conversion
 * - HLS streaming generation
 * - Video optimization
 * - Analytics processing
 *
 * Architecture Pattern:
 * 1. Jobs are queued in a local queue system
 * 2. Workers pick up jobs and process them
 * 3. Results are stored and indexed
 * 4. Webhooks notify the main server of completion
 *
 * Future Integration Points:
 * - Cloudflare Workers for distributed processing
 * - Cloudflare R2 for storage
 * - Local laptop worker for development
 */

import { QueueJob } from "../../shared/types";

export interface WorkerConfig {
  // Queue type: 'local', 'redis', 'bull'
  type: "local" | "redis" | "bull";

  // Worker concurrency
  concurrency: number;

  // Job timeout (ms)
  timeout: number;

  // Retry configuration
  maxRetries: number;
  retryDelay: number;

  // Storage configuration
  storage: {
    type: "memory" | "fs" | "redis";
    path?: string;
  };
}

/**
 * Queue Interface
 * Defines the contract for queue implementations
 */
export interface IQueue {
  // Add job to queue
  enqueue(job: QueueJob): Promise<string>;

  // Get job by ID
  getJob(id: string): Promise<QueueJob | null>;

  // Get next job to process
  dequeue(): Promise<QueueJob | null>;

  // Mark job as completed
  completeJob(id: string, result: any): Promise<void>;

  // Mark job as failed
  failJob(id: string, error: string): Promise<void>;

  // Get queue stats
  getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }>;
}

/**
 * Worker Interface
 * Defines the contract for worker implementations
 */
export interface IWorker {
  // Process a job
  process(job: QueueJob): Promise<any>;

  // Get worker type
  getType(): string;

  // Get worker status
  getStatus(): "idle" | "processing" | "error";

  // Shutdown worker
  shutdown(): Promise<void>;
}

/**
 * Job Types for Future Use
 */
export enum JobType {
  // Video processing
  TRANSCODE_VIDEO = "transcode_video",
  GENERATE_HLS = "generate_hls",
  EXTRACT_THUMBNAIL = "extract_thumbnail",

  // Analytics
  PROCESS_ANALYTICS = "process_analytics",
  GENERATE_REPORT = "generate_report",

  // Maintenance
  CLEANUP_STORAGE = "cleanup_storage",
  OPTIMIZE_VIDEOS = "optimize_videos",
}

/**
 * Example Job Payloads
 */

export interface TranscodeJobPayload {
  inputUrl: string;
  outputFormat: "mp4" | "webm" | "hls";
  quality: "low" | "medium" | "high";
  roomId: string;
}

export interface HLSGenerationPayload {
  videoUrl: string;
  segmentDuration: number;
  roomId: string;
  outputPath: string;
}

export interface AnalyticsPayload {
  roomId: string;
  startTime: number;
  endTime: number;
  metrics: string[];
}
