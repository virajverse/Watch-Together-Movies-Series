# Architecture Deep Dive

## System Design Philosophy

The Watch Together architecture is built on three core principles:

1. **Worker-Friendly**: Everything is designed to run locally without expensive cloud servers
2. **Cloudflare-Ready**: Uses standard web technologies compatible with Cloudflare Workers
3. **Scalable from Day 1**: Can grow from MVP to enterprise without major rewrites

## Real-Time Sync Strategy

### The Sync Problem

Multiple users watching a video creates timing challenges:
- Network latency varies (20-100ms typically)
- Browser clock drift accumulates over time
- Users may skip or pause at slightly different times
- We need all users seeing the SAME video at the SAME time

### The Solution: Multi-Layer Sync

```
LAYER 1: Event Broadcasting
  - User action (play/pause/seek) captured
  - Sent to server with client timestamp
  - Server adds server timestamp
  - Broadcast to all users with both timestamps

LAYER 2: Drift Detection
  - Client calculates difference between sent and room state
  - If difference > 500ms: trigger force sync
  - Server can also detect client drift

LAYER 3: Heartbeat (Fallback)
  - Every 3 seconds, server sends full room state
  - Clients validate their state against room state
  - Acts as safety net if events are lost

LAYER 4: Force Sync (Emergency)
  - If drift exceeds threshold despite heartbeats
  - Server forces all clients to exact room timestamp
  - Ensures no permanent desync occurs
```

### Example: User Clicks Play

```
Client                          Server                    Other Clients
│                                │                              │
├─ User clicks Play             │                              │
│                                │                              │
├─ VideoPlayer emits "play"     │                              │
│                                │                              │
├─ broadcastPlay() called       │                              │
│ ├─ Get current video time     │                              │
│ ├─ Create event: {             │                              │
│ │   roomId, userId,            │                              │
│ │   timestamp: 23.4s            │                              │
│ │ }                             │                              │
│ └─ Emit via socket.io         │                              │
│                                │                              │
├─ Socket sends to server      ─┼──────────────────────────>   │
│                                │                              │
│                      Server receives                          │
│                      ├─ Find room                            │
│                      ├─ Update playbackState:               │
│                      │ ├─ isPlaying: true                   │
│                      │ ├─ currentTime: 23.4                 │
│                      │ ├─ lastUpdatedAt: <server_time>     │
│                      │ └─ updatedBy: userId                 │
│                      ├─ Broadcast "play-event" to room      │
│                      │   with server_timestamp added        │
│                                │                              │
│                                ├──────> Broadcast to all <───┼
│                                │                              │
│                                │                    Event received
│                                │                    ├─ Extract timestamp: 23.4
│                                │                    ├─ Set video.currentTime = 23.4
│                                │                    ├─ Call video.play()
│                                │                    ├─ Calculate drift:
│                                │                    │   drift = |client_time - room_time|
│                                │                    ├─ If drift < 500ms: OK
│                                │                    └─ If drift > 500ms: trigger force sync
│                                │                              │
│ Event also received            │                              │
│ (from own broadcast)           │                              │
│ ├─ Check sender: is it me?     │                              │
│ ├─ If yes: ignore (prevent     │                              │
│ │  feedback loop)              │                              │
│ └─ Continue playing            │                              │
```

## Timestamp Synchronization

### Why Two Timestamps?

```
CLIENT TIMESTAMP                 SERVER TIMESTAMP
├─ When: User action time       ├─ When: Server received time
├─ Use: Event ordering          ├─ Use: Drift detection
├─ Example: 23.4s               ├─ Example: 1705316400000ms
└─ Sent by: Client             └─ Added by: Server
```

### Clock Drift Detection

```
Scenario: Client system clock is running 2 seconds fast

Timeline:
1. Client has video at 23s
2. Server has video at 21s  (2s behind)
3. Client sends event: "play at 23s"
4. Server receives, updates to 23s
5. Server broadcasts: "play at 23s"
6. Other clients receive: play at 23s
7. Other clients' video jumps from 21s to 23s
8. Their clock: now correct with room ✓

BUT if only Layer 1 existed:
- Continuous small skips would accumulate
- Video would gradually desync over time
- After 10 minutes: could be 5-10 seconds off

WITH Heartbeat (Layer 3):
- Every 3 seconds, full state sent
- Small drifts corrected automatically
- Never gets > 500ms off before reset
```

## Network Latency Handling

```
Average Latency: 50ms
├─ Client sends event
├─ Network: 25ms
├─ Server processes: 5ms
├─ Network back: 25ms
└─ Total round trip: 55ms

Result:
- Client at 23.0s sends "play"
- By the time broadcast arrives: 23.055s
- Other clients are only 55ms behind
- Within acceptable margin ✓

Scenario: High Latency Network (200ms)
├─ Same steps but 200ms each way
├─ Client at 23.0s sends "play"
├─ Other clients receive: 23.4s
├─ Time jump seems noticeable
├─ BUT: With Plyr/Video.js:
│  └─ Video smoothly transitions
│  └─ Not jarring to user
└─ Next heartbeat syncs if needed
```

## Memory Management (Room Storage)

### Current Implementation (MVP)

```typescript
const rooms = new Map<string, RoomState>();

// Room state structure
{
  id: "uuid-1234",
  createdAt: 1705316400000,
  users: [
    { id, socketId, isHost, joinedAt, lastSeen },
    { id, socketId, isHost, joinedAt, lastSeen }
  ],
  playbackState: {
    isPlaying: true,
    currentTime: 23.4,
    lastUpdatedAt: 1705316450000,
    updatedBy: "user-123"
  }
}
```

### Cleanup Strategy

```
When last user leaves room:
├─ Remove user from room.users
├─ If room.users.length === 0:
│  ├─ Schedule cleanup timer (5 minutes)
│  ├─ After 5 minutes:
│  │  ├─ Check if room still empty
│  │  ├─ If yes: delete room
│  │  └─ If no: user rejoined, keep room
│  └─ Room is deleted
└─ Memory freed ✓

Benefit:
- Temporary network issues don't lose rooms
- But abandoned rooms eventually cleaned up
- No memory leak from unused rooms
```

### Future: Redis Upgrade (MVP 2)

```typescript
// Replace Map with Redis
const rooms = new Redis();

await rooms.set(
  `room:${roomId}`,
  JSON.stringify(roomState),
  "EX",
  1800  // Expire after 30 minutes
);

// Benefits:
// - Persistent across server restarts
// - Shared across multiple server instances
// - Automatic expiration
// - No manual cleanup needed
```

## Socket.IO Configuration

### Why WebSocket + Polling?

```typescript
transports: ["websocket", "polling"],

WebSocket Benefits:
├─ Bidirectional communication
├─ Lower latency (~50-100ms)
├─ Uses port 80/443
└─ Modern browsers all support

Polling Benefits (Fallback):
├─ Works in restrictive networks
├─ Corporate firewalls sometimes block WS
├─ Slower but better than nothing
└─ Socket.IO auto-detects and switches
```

### Connection Settings

```typescript
pingInterval: 25000,    // Send ping every 25s
pingTimeout: 60000,     // Disconnect if no pong in 60s

// Effect:
// - Detects dead connections quickly
// - Allows automatic reconnection
// - Keeps connection alive through proxies
```

## Worker System Design (MVP 2)

### Job Flow

```
┌─────────────────────────────────┐
│   Event from Client              │
│   (e.g., upload video)           │
└──────────────┬──────────────────┘
               │
               v
        Server receives
        ├─ Enqueue job
        └─ Respond with job ID
               │
               v
        Local Queue (or Redis)
        ├─ Job added: status=pending
        └─ Persisted on disk
               │
               v
        Worker picks up job
        ├─ status=processing
        ├─ Process (FFmpeg, HLS)
        └─ Generate results
               │
               v
        Job Complete
        ├─ Upload result to R2
        ├─ Update job: status=completed
        └─ Webhook to main server
               │
               v
        Notify Clients
        ├─ Update UI: "Ready!"
        └─ Provide download link
```

### Worker Environment Variables (Future)

```bash
# Local Development (On Laptop)
WORKERS_TYPE=local
FFMPEG_PATH=/usr/local/bin/ffmpeg
STORAGE_PATH=/tmp/watch-together/

# Production
WORKERS_TYPE=cloudflare
R2_BUCKET=watch-together
CLOUDFLARE_ACCOUNT_ID=xxx
```

### Local Worker Execution

```bash
# Terminal 1: Main server
npm run server

# Terminal 2: Local worker
npm run worker

# Worker continuously:
1. Polls queue for pending jobs
2. Picks up job
3. Processes (FFmpeg)
4. Stores result
5. Updates server
6. Loops back to 1
```

## Cloudflare Integration Readiness

### Why Cloudflare?

```
✓ Free tier available
✓ Low latency globally
✓ No server management
✓ Scales automatically
✓ Affordable pricing

Current MVP:
- Not using Cloudflare yet

MVP 1.5:
- Cloudflare Tunnel for backend access
- Free backend exposure (no Ngrok needed)

MVP 2:
- Cloudflare Workers for processing
- R2 for video storage
- Pages for static frontend

MVP 3:
- Full Cloudflare stack
- Zero infrastructure management
```

### Cloudflare Tunnel Example

```bash
# On local laptop, expose backend publicly
cloudflared tunnel run watch-together
# → Backend now at https://watch-together.example.com
# → No exposed IP address
# → Can shutdown laptop, restart whenever
# → Automatic reconnection
```

## Monitoring & Debugging

### Server Logs

```
[SOCKET] User connected: abc123
[ROOM] Created new room: room-uuid with code: ABC123
[ROOM] User user-123 attempting to join room room-uuid
[SOCKET] User connected: def456
[ROOM] User user-456 joined room room-uuid. Total users: 2
[PLAYBACK] Play event from user-123 in room room-uuid at 23.4s
[PLAYBACK] Pause event from user-456 in room room-uuid at 45.2s
[SYNC] Drift detected for user-456 in room-uuid: 750ms (threshold: 500ms)
[ROOM] User user-123 left room room-uuid. Total users: 1
[ROOM] Room room-uuid is empty, scheduling cleanup
```

### Client Logs

```
[SOCKET] Connected: socket-id-xyz
[ROOM] Joined room: room-data
[ROOM] User joined: user-456
[VIDEO SYNC] Play event from user-123 at 23.4s
[VIDEO SYNC] Syncing: drift 450ms exceeds threshold 500ms
[VIDEO SYNC] Seek event from user-456 to 45.2s
[SOCKET] Disconnected
```

---

For implementation details, see the source code comments.
For deployment, see DEPLOYMENT.md
