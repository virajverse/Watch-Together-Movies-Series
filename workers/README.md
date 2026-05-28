# Worker System Documentation

## Overview

The worker system is a queue-based job processing system designed to handle background tasks without expensive cloud servers. It's built to integrate with local laptop workers, Cloudflare Workers, and other distributed processing systems.

## Architecture

### Local Queue (MVP)

The `LocalQueue` class implements an in-memory queue suitable for MVP development:

```typescript
// Enqueue a job
const jobId = await localQueue.enqueue({
  type: "transcode_video",
  priority: "normal",
  payload: { /* job data */ },
  maxRetries: 3,
});

// Get job status
const job = await localQueue.getJob(jobId);

// Dequeue for processing
const job = await localQueue.dequeue();

// Complete or fail
await localQueue.completeJob(jobId, result);
await localQueue.failJob(jobId, errorMessage);
```

### Worker Interface

All workers implement `IWorker`:

```typescript
interface IWorker {
  process(job: QueueJob): Promise<any>;
  getType(): string;
  getStatus(): "idle" | "processing" | "error";
  shutdown(): Promise<void>;
}
```

## Job Types (MVP 2)

### Video Processing

#### TranscodeVideo
```typescript
{
  type: "transcode_video",
  payload: {
    inputUrl: "https://example.com/video.mp4",
    outputFormat: "hls" | "mp4" | "webm",
    quality: "low" | "medium" | "high",
    roomId: "room-123"
  }
}
```

#### GenerateHLS
```typescript
{
  type: "generate_hls",
  payload: {
    videoUrl: "https://...",
    segmentDuration: 10,
    roomId: "room-123",
    outputPath: "/storage/hls/"
  }
}
```

## Future Integration Points

### Cloudflare Workers

Workers can be distributed to Cloudflare:

```typescript
// In MVP 2: Deploy worker to Cloudflare
// The queue system will route jobs appropriately

export async function handleVideoJob(job: QueueJob) {
  // Cloudflare Worker code
  const { inputUrl, outputFormat } = job.payload;
  
  // Process on Cloudflare's edge
  const result = await transcode(inputUrl, outputFormat);
  
  // Webhook back to main server
  await fetch("https://api.example.com/worker-result", {
    method: "POST",
    body: JSON.stringify({ jobId: job.id, result }),
  });
}
```

### Cloudflare R2 Storage

Store processed videos in R2:

```typescript
import { S3Client } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});
```

## Local Worker Development (MVP 2)

### Set Up Local Worker

```bash
# Create worker runner
npm run worker

# Watch queue
npm run queue:status

# View logs
npm run queue:logs
```

### Example FFmpeg Worker

```typescript
import { IWorker } from "./types";
import { exec } from "child_process";
import { promisify } from "util";

export class FFmpegWorker implements IWorker {
  async process(job: QueueJob): Promise<any> {
    const { inputUrl, outputFormat, quality } = job.payload;
    
    // Download video
    const input = await downloadVideo(inputUrl);
    
    // Transcode with FFmpeg
    const output = await this.transcode(input, outputFormat, quality);
    
    // Upload result
    const url = await uploadToR2(output);
    
    return { url, format: outputFormat };
  }
  
  private async transcode(
    input: string,
    format: string,
    quality: string
  ): Promise<string> {
    const bitrateMap = { low: "500k", medium: "2000k", high: "5000k" };
    const cmd = `ffmpeg -i ${input} -b:v ${bitrateMap[quality]} output.${format}`;
    
    const exec = promisify(require("child_process").exec);
    await exec(cmd);
    
    return `output.${format}`;
  }
  
  getType(): string { return "ffmpeg"; }
  getStatus() { return "idle"; }
  async shutdown() { /* cleanup */ }
}
```

## Webhook Integration

### Job Completion Webhook

When a worker completes a job, notify the server:

```typescript
// Worker sends webhook
const response = await fetch(
  `${process.env.SERVER_URL}/api/jobs/${jobId}/complete`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WORKER_TOKEN}` },
    body: JSON.stringify({ result, timeTaken: Date.now() - job.startedAt }),
  }
);

// Server endpoint
app.post("/api/jobs/:id/complete", (req, res) => {
  const { id } = req.params;
  const { result } = req.body;
  
  // Update job status
  // Notify clients if relevant
  // Store result
  
  res.json({ success: true });
});
```

## Environment Variables (Future)

```bash
# Worker Configuration
WORKERS_ENABLED=true
WORKERS_QUEUE_TYPE=redis|bull|cloudflare

# Cloudflare Integration
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_TUNNEL_TOKEN=xxx
CLOUDFLARE_WORKERS_ENABLED=true

# R2 Storage
R2_BUCKET_NAME=watch-together
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx

# FFmpeg Configuration
FFMPEG_PATH=/usr/bin/ffmpeg
FFMPEG_CONCURRENT_JOBS=2

# Storage
STORAGE_PATH=/tmp/watch-together/
MAX_STORAGE_SIZE=100GB
```

## Monitoring & Metrics

### Queue Stats

```typescript
const stats = await localQueue.getStats();
console.log(stats);
// { pending: 5, processing: 2, completed: 142, failed: 3 }
```

### Worker Status

```typescript
const worker = workerRegistry.get("ffmpeg");
console.log(worker.getStatus()); // "idle" | "processing" | "error"
```

### Logging

All worker operations are logged with prefixes:
- `[QUEUE]` - Queue operations
- `[WORKER]` - Worker execution
- `[FFMPEG]` - FFmpeg specific
- `[R2]` - R2 storage operations

## Best Practices

1. **Always set maxRetries** - Don't let jobs fail silently
2. **Use appropriate priority** - Route urgent jobs first
3. **Add error handling** - Workers should never crash
4. **Clean up old jobs** - Prevent memory leaks
5. **Log extensively** - Debugging is crucial
6. **Monitor queue depth** - Alert if queue backs up

## Migration Path

### MVP (Current)
- LocalQueue + In-Memory

### MVP 2 (Planned)
- Redis Queue + FFmpeg Worker locally

### Production (Future)
- Bull Queue + Cloudflare Workers + R2 Storage
- Horizontal scaling with multiple worker nodes
- Load balancing across regions

---

For questions about worker implementation, see the main README.md
