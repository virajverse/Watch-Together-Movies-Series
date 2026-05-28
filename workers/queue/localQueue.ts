/**
 * Local Queue Implementation
 * In-memory queue for MVP and local development
 *
 * Future: Replace with Redis or Bull for production
 */

import { QueueJob, ApiResponse } from "../../shared/types";
import { v4 as uuidv4 } from "uuid";
import { IQueue } from "./types";

export class LocalQueue implements IQueue {
  private pending: Map<string, QueueJob> = new Map();
  private processing: Map<string, QueueJob> = new Map();
  private completed: Map<string, QueueJob> = new Map();
  private failed: Map<string, QueueJob> = new Map();

  /**
   * Add job to queue
   */
  async enqueue(job: Partial<QueueJob>): Promise<string> {
    const jobId = uuidv4();
    const fullJob: QueueJob = {
      id: jobId,
      type: job.type || "unknown",
      payload: job.payload || {},
      priority: job.priority || "normal",
      status: "pending",
      retries: 0,
      maxRetries: job.maxRetries || 3,
      createdAt: Date.now(),
    };

    this.pending.set(jobId, fullJob);
    console.log(`[QUEUE] Job enqueued: ${jobId} (${job.type})`);

    return jobId;
  }

  /**
   * Get job by ID
   */
  async getJob(id: string): Promise<QueueJob | null> {
    return (
      this.pending.get(id) ||
      this.processing.get(id) ||
      this.completed.get(id) ||
      this.failed.get(id) ||
      null
    );
  }

  /**
   * Get next job to process (simple FIFO, could be enhanced with priority)
   */
  async dequeue(): Promise<QueueJob | null> {
    // Sort by priority
    const sorted = Array.from(this.pending.values()).sort((a, b) => {
      const priorityMap = { high: 3, normal: 2, low: 1 };
      return (
        priorityMap[b.priority] - priorityMap[a.priority] ||
        a.createdAt - b.createdAt
      );
    });

    if (sorted.length === 0) {
      return null;
    }

    const job = sorted[0];
    this.pending.delete(job.id);
    job.status = "processing";
    job.startedAt = Date.now();
    this.processing.set(job.id, job);

    console.log(`[QUEUE] Job dequeued: ${job.id}`);

    return job;
  }

  /**
   * Mark job as completed
   */
  async completeJob(id: string, result: any): Promise<void> {
    const job = this.processing.get(id);
    if (!job) {
      throw new Error(`Job not found in processing: ${id}`);
    }

    job.status = "completed";
    job.completedAt = Date.now();
    job.result = result;

    this.processing.delete(id);
    this.completed.set(id, job);

    console.log(`[QUEUE] Job completed: ${id}`);
  }

  /**
   * Mark job as failed
   */
  async failJob(id: string, error: string): Promise<void> {
    const job = this.processing.get(id);
    if (!job) {
      throw new Error(`Job not found in processing: ${id}`);
    }

    job.status = "failed";
    job.error = error;
    job.retries++;

    if (job.retries < job.maxRetries) {
      // Re-queue for retry
      console.log(
        `[QUEUE] Job failed, retrying: ${id} (${job.retries}/${job.maxRetries})`
      );
      job.status = "pending";
      this.processing.delete(id);
      this.pending.set(id, job);
    } else {
      // Give up
      console.log(`[QUEUE] Job failed permanently: ${id}`);
      this.processing.delete(id);
      this.failed.set(id, job);
    }
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return {
      pending: this.pending.size,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
    };
  }

  /**
   * Cleanup old completed jobs
   */
  async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();

    for (const [id, job] of this.completed.entries()) {
      if (job.completedAt && now - job.completedAt > olderThanMs) {
        this.completed.delete(id);
        console.log(`[QUEUE] Cleaned up old job: ${id}`);
      }
    }

    for (const [id, job] of this.failed.entries()) {
      if (job.completedAt && now - job.completedAt > olderThanMs) {
        this.failed.delete(id);
      }
    }
  }
}

/**
 * Export singleton instance
 */
export const localQueue = new LocalQueue();
