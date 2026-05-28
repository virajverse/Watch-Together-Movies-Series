# Watch Together - Real-Time Video Sync MVP 1

**Watch videos in real-time sync with friends across the internet with ultra-low latency.**

## 🎯 Overview

Watch Together is an MVP web application that enables multiple users to watch the same video in perfect synchronization. Built with modern web technologies and designed with a worker-friendly architecture for future scalability without expensive servers.

### Key Features (MVP 1)

- ✅ **Create & Join Rooms** - Generate unique room codes to share with friends
- ✅ **Real-Time Video Sync** - Play, pause, and seek actions sync instantly
- ✅ **Low Latency** - WebSocket-based sync with <500ms sync threshold
- ✅ **Auto-Resync** - Automatic synchronization if time drift detected
- ✅ **Mobile Responsive** - Works great on desktop, tablet, and mobile
- ✅ **Modern Dark UI** - Clean, minimal interface with Tailwind CSS
- ✅ **Room State Persistence** - Room state maintained while users connected

## 🏗️ Architecture

### Worker-Friendly Design

This architecture is specifically designed to support local background workers without relying on expensive cloud services:

```
┌─────────────────────────────────────────┐
│          Next.js Frontend               │
│   (Socket.IO Real-time Sync)            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     Express + Socket.IO Backend         │
│    (Room Management & Sync Logic)       │
└─────────────────────────────────────────┘
                    ↓
    ┌───────────────────────────┬───────────────────────────┐
    ↓                           ↓
┌──────────────────┐    ┌──────────────────────┐
│  Local Queue     │    │  Cloudflare Tunnel   │
│  (MVP)           │    │  (Future)            │
└──────────────────┘    └──────────────────────┘
    ↓                           ↓
┌──────────────────┐    ┌──────────────────────┐
│  Local Workers   │    │  Cloudflare Workers  │
│  (FFmpeg, HLS)   │    │  (Distributed Jobs)  │
└──────────────────┘    └──────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Socket.IO Client

**Backend:**
- Node.js
- Express
- Socket.IO
- TypeScript

**Infrastructure:**
- Local development server
- Cloudflare-ready (no vendor lock-in)
- Worker queue system (local → distributed)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Git

### Installation

1. **Clone and Setup**

```bash
# Install all dependencies
npm run install-all

# Or manually:
npm install
npm install -w client
npm install -w server
```

2. **Environment Configuration**

```bash
# Client
cp client/.env.local.example client/.env.local

# Server
cp server/.env.local.example server/.env.local
```

3. **Start Development**

```bash
# Terminal 1: Frontend (http://localhost:3000)
npm run client

# Terminal 2: Backend (http://localhost:3001)
npm run server

# Or in one terminal:
npm run dev  # runs both
```

4. **Open Browser**

Navigate to `http://localhost:3000`

## 📱 Usage

### Create a Room

1. Click **"🎬 Create Room"**
2. You'll be automatically assigned a unique room code (e.g., "ABC123")
3. Share the room code or copy the link with friends

### Join a Room

1. Share the **room link** OR **room code** with friends
2. Friends click the link or enter the code
3. Once joined, video playback syncs automatically

### Watch Together

- **Play/Pause**: Click play button - syncs to all users
- **Seek**: Click on progress bar - everyone jumps to that time
- **Volume**: Individual volume control (not synced)
- **Fullscreen**: Individual fullscreen toggle

## 🔄 Real-Time Sync Architecture

### How Sync Works

```
1. User Action (Play/Pause/Seek)
        ↓
2. Broadcast via Socket.IO to Server
        ↓
3. Server Updates Room State + Timestamp
        ↓
4. Server Broadcasts to All Other Users
        ↓
5. Each Client Receives Event + Server Timestamp
        ↓
6. Client Validates Timestamp Drift
        ↓
7a. If drift < 500ms: Apply action normally
7b. If drift > 500ms: Force sync to server time
```

### Sync Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `play` | Client → Server → Clients | User clicked play |
| `pause` | Client → Server → Clients | User clicked pause |
| `seek` | Client → Server → Clients | User seeked to time |
| `heartbeat` | Client → Server | Periodic sync check (3s) |
| `force-sync` | Server → Clients | Emergency sync if drift detected |
| `sync-time` | Client → Server | Manual drift detection |

### Timing Strategy

- **Client Timestamp**: When user action happens (for event ordering)
- **Server Timestamp**: When server processes (for drift detection)
- **Heartbeat**: Every 3 seconds for consistency check
- **Force Sync Threshold**: 500ms (configurable)

## 📁 Project Structure

```
watch-together/
├── client/                          # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Home/Create Room
│   │   │   ├── room/[id]/page.tsx  # Room Watching Page
│   │   │   ├── layout.tsx          # Root Layout
│   │   │   └── globals.css         # Global Styles
│   │   ├── components/
│   │   │   ├── VideoPlayer.tsx     # Video Player
│   │   │   ├── RoomHeader.tsx      # Room Info
│   │   │   └── UsersConnected.tsx  # User List
│   │   ├── hooks/
│   │   │   ├── useVideoSync.ts     # Sync Logic
│   │   │   └── useRoom.ts          # Room Management
│   │   ├── lib/
│   │   │   └── socket.ts           # Socket Client
│   │   └── types/
│   ├── tailwind.config.js
│   ├── next.config.js
│   └── package.json
│
├── server/                          # Express Backend
│   ├── src/
│   │   ├── index.ts                # Entry Point
│   │   ├── socket/
│   │   │   ├── rooms.ts            # Room Handlers
│   │   │   ├── playback.ts         # Playback Events
│   │   │   └── sync.ts             # Sync & Heartbeat
│   │   └── types/
│   └── package.json
│
├── shared/                          # Shared Types & Constants
│   ├── types.ts                    # TypeScript Interfaces
│   └── constants.ts                # App Constants
│
├── workers/                         # Background Workers (Future)
│   ├── types.ts                    # Worker Interfaces
│   ├── queue/
│   │   ├── localQueue.ts           # Local Queue (MVP)
│   │   └── workers.ts              # Example Worker
│   └── README.md                   # Worker Documentation
│
└── package.json                    # Root Package
```

## 🔧 Configuration

### Sync Tuning

Edit `shared/constants.ts`:

```typescript
export const SYNC_CONFIG = {
  // If time difference exceeds this, force sync
  FORCE_SYNC_THRESHOLD: 500, // milliseconds

  // Heartbeat interval for periodic checks
  HEARTBEAT_INTERVAL: 3000, // milliseconds

  // Socket connection timeout
  SOCKET_TIMEOUT: 5000, // milliseconds
};
```

### Server Configuration

Edit `server/.env.local`:

```bash
PORT=3001
NODE_ENV=development
WS_ORIGIN=http://localhost:3000

# Enable local workers (future)
ENABLE_LOCAL_WORKERS=true
WORKERS_QUEUE_TYPE=local
```

## 🎥 Supported Video Formats

- **MP4** (.mp4)
- **WebM** (.webm)
- **Ogg** (.ogv)
- **HLS** (.m3u8) - Live streaming compatible

## 📊 Performance & Limitations

### Current Performance

- **Latency**: <100ms (typically 20-50ms local)
- **Sync Accuracy**: ±500ms (auto-corrects)
- **Max Users Per Room**: 50 (in-memory limit)
- **Room Timeout**: 30 minutes inactivity
- **Browser Support**: All modern browsers (Chrome, Firefox, Safari, Edge)

### Known Limitations

1. **No Video Upload**: Currently uses external URLs only
2. **No User Accounts**: Based on session IDs only
3. **No Persistence**: Room data lost on server restart
4. **No Recording**: Watch-only (no screen recording features)
5. **No Access Control**: Anyone with room code can join

## 🔮 MVP 2 Roadmap

The architecture is designed to support:

- [ ] **FFmpeg Integration**
  - Background video transcoding
  - Format conversion (MP4 → WebM, HLS)
  - Thumbnail extraction

- [ ] **HLS Streaming**
  - Live streaming support
  - Adaptive bitrate
  - Segment generation

- [ ] **Cloudflare Integration**
  - Cloudflare Workers for processing
  - R2 storage for videos
  - Tunnel for secure communication

- [ ] **Advanced Features**
  - Video upload and storage
  - User accounts and history
  - Watch party chat
  - Video recommendations

## 🛠️ Worker System (Future)

### Queue Job Example

```typescript
// Enqueue a video transcoding job
const jobId = await localQueue.enqueue({
  type: "transcode_video",
  priority: "normal",
  maxRetries: 3,
  payload: {
    inputUrl: "https://example.com/video.mp4",
    outputFormat: "hls",
    quality: "high",
    roomId: "room-123",
  },
});

// Worker picks up job and processes
const worker = new FFmpegWorker();
const result = await worker.process(job);

// Result returned and job marked complete
await localQueue.completeJob(jobId, result);
```

### Local Worker Setup (MVP 2)

```bash
# Start worker process (runs locally on your laptop)
npm run worker

# Monitor queue status
npm run queue:status

# View worker logs
npm run queue:logs
```

## 📚 Development Guide

### Adding a New Socket Event

1. **Define in types** (`shared/types.ts`)
2. **Add to constants** (`shared/constants.ts`)
3. **Implement handler** (`server/src/socket/`)
4. **Use in component** (`client/src/`)

Example:

```typescript
// 1. Add to types
export interface SocketEvents {
  "my-new-event": (data: { roomId: string }) => void;
}

// 2. Add to constants
export const SOCKET_EVENTS = {
  MY_NEW_EVENT: "my-new-event",
};

// 3. Implement handler
socket.on(SOCKET_EVENTS.MY_NEW_EVENT, (data) => {
  // Handle event
});

// 4. Emit from client
socketClient.emit(SOCKET_EVENTS.MY_NEW_EVENT, { roomId });
```

### Debugging

**Server Logs:**
- Socket connection: `[SOCKET]`
- Room management: `[ROOM]`
- Playback: `[PLAYBACK]`
- Sync events: `[SYNC]`

**Client Logs:**
- Socket connection: `[SOCKET]`
- Video sync: `[VIDEO SYNC]`
- Room state: `[ROOM]`

## 🚨 Troubleshooting

### "Failed to connect to server"

```bash
# Check server is running on port 3001
netstat -an | grep 3001

# Check environment variables
cat client/.env.local
cat server/.env.local
```

### "Video not playing in sync"

1. Check browser console for errors
2. Verify `FORCE_SYNC_THRESHOLD` in constants
3. Check network latency
4. Try force refresh (Ctrl+Shift+R)

### "Socket disconnects randomly"

1. Check `SOCKET_TIMEOUT` setting
2. Verify firewall isn't blocking WebSocket
3. Check network stability
4. Increase `pingInterval` in server/src/index.ts

## 📝 Code Style

- TypeScript for type safety
- Functional components with hooks
- Comments explaining sync logic
- Error handling for socket events
- Console logging for debugging

## 📄 License

MIT

## 🤝 Contributing

This is an MVP. Future contributions welcome for:

- Worker system implementation
- Cloudflare integration
- Enhanced UI/UX
- Performance optimizations
- Additional video formats

## 📞 Support

For issues and questions:
1. Check server/client logs
2. Verify environment configuration
3. Test with single client first
4. Review sync constants

---

**Built with ❤️ for watching together**
