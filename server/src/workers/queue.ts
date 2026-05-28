/**
 * Local Worker Queue
 * Simple in-memory job queue for video processing
 * Processes one job at a time (local laptop constraint)
 */

import { Server as SocketIOServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import type { ProcessingJob } from "../../../shared/types.ts";
import { SOCKET_EVENTS } from "../../../shared/constants.ts";

export type JobHandler = (job: ProcessingJob, onProgress: (progress: number) => void) => Promise<void>;

interface QueueOptions {
  io: SocketIOServer;
}

class LocalQueue {
  private jobs: ProcessingJob[] = [];
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;
  private io: SocketIOServer | null = null;

  /**
   * Initialize the queue with Socket.IO for progress events
   */
  init(options: QueueOptions): void {
    this.io = options.io;
    console.log("[QUEUE] Local worker queue initialized");
  }

  /**
   * Register a job handler for a specific type
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    console.log(`[QUEUE] Registered handler for type: ${type}`);
  }

  /**
   * Add a job to the queue
   */
  addJob(videoId: string, type: 'transcode' | 'thumbnail'): ProcessingJob {
    const job: ProcessingJob = {
      id: uuidv4(),
      videoId,
      type,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
    };

    this.jobs.push(job);
    console.log(`[QUEUE] Added job ${job.id} (${type}) for video ${videoId}`);

    // Start processing if not already running
    this.processNext();

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.find(j => j.id === jobId);
  }

  /**
   * Get all jobs for a video
   */
  getJobsForVideo(videoId: string): ProcessingJob[] {
    return this.jobs.filter(j => j.videoId === videoId);
  }

  /**
   * Get queue status
   */
  getStatus(): { pending: number; processing: number; completed: number; failed: number } {
    return {
      pending: this.jobs.filter(j => j.status === 'pending').length,
      processing: this.jobs.filter(j => j.status === 'processing').length,
      completed: this.jobs.filter(j => j.status === 'completed').length,
      failed: this.jobs.filter(j => j.status === 'failed').length,
    };
  }

  /**
   * Process the next job in the queue
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;

    const nextJob = this.jobs.find(j => j.status === 'pending');
    if (!nextJob) return;

    this.isProcessing = true;
    nextJob.status = 'processing';

    const handler = this.handlers.get(nextJob.type);
    if (!handler) {
      console.error(`[QUEUE] No handler registered for type: ${nextJob.type}`);
      nextJob.status = 'failed';
      this.isProcessing = false;
      this.processNext();
      return;
    }

    console.log(`[QUEUE] Processing job ${nextJob.id} (${nextJob.type})`);

    try {
      await handler(nextJob, (progress: number) => {
        nextJob.progress = progress;
        // Emit progress via Socket.IO
        this.emitProgress(nextJob);
      });

      nextJob.status = 'completed';
      nextJob.progress = 100;
      console.log(`[QUEUE] Job ${nextJob.id} completed`);

      // Emit completion
      if (this.io) {
        this.io.emit(SOCKET_EVENTS.PROCESSING_COMPLETE, {
          videoId: nextJob.videoId,
          jobId: nextJob.id,
          type: nextJob.type,
        });
      }
    } catch (error: any) {
      nextJob.status = 'failed';
      console.error(`[QUEUE] Job ${nextJob.id} failed:`, error.message);

      // Emit failure
      if (this.io) {
        this.io.emit(SOCKET_EVENTS.PROCESSING_FAILED, {
          videoId: nextJob.videoId,
          jobId: nextJob.id,
          type: nextJob.type,
          error: error.message,
        });
      }
    }

    this.isProcessing = false;

    // Process next job in queue
    this.processNext();
  }

  /**
   * Emit processing progress via Socket.IO
   */
  private emitProgress(job: ProcessingJob): void {
    if (!this.io) return;

    this.io.emit(SOCKET_EVENTS.PROCESSING_PROGRESS, {
      videoId: job.videoId,
      jobId: job.id,
      type: job.type,
      progress: job.progress,
      status: job.status,
    });
  }
}

// Export singleton instance
export const localQueue = new LocalQueue();
