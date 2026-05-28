/**
 * Project Structure Documentation
 * 
 * This file documents the complete project structure
 * and explains the purpose of each directory and file
 */

watch-together/
├── 📄 README.md                    # Main project documentation
├── 📄 QUICKSTART.md                # 5-minute setup guide
├── 📄 DEPLOYMENT.md                # Production deployment guide
├── 📄 package.json                 # Root workspace config
├── 📄 .gitignore                   # Git ignore rules
├── 📄 .prettierrc                  # Code formatting config
│
├── 🎨 client/                      # Next.js Frontend Application
│   ├── src/
│   │   ├── 📄 app/
│   │   │   ├── 📄 layout.tsx       # Root layout (HTML structure)
│   │   │   ├── 📄 globals.css      # Global styles & Tailwind
│   │   │   ├── 📄 page.tsx         # Home page (/ route)
│   │   │   └── 📄 room/
│   │   │       ├── 📄 layout.tsx   # Room layout wrapper
│   │   │       └── 📄 [id]/
│   │   │           └── 📄 page.tsx # Room watching page (/room/[id])
│   │   │
│   │   ├── 📄 components/          # Reusable React components
│   │   │   ├── 📄 VideoPlayer.tsx  # HTML5 video player component
│   │   │   ├── 📄 RoomHeader.tsx   # Room info & copy link button
│   │   │   └── 📄 UsersConnected.tsx # User list display
│   │   │
│   │   ├── 📄 hooks/               # Custom React hooks
│   │   │   ├── 📄 useVideoSync.ts  # Real-time video sync logic
│   │   │   └── 📄 useRoom.ts       # Room state management
│   │   │
│   │   ├── 📄 lib/                 # Utility libraries
│   │   │   └── 📄 socket.ts        # Socket.IO client singleton
│   │   │
│   │   └── 📄 types/               # TypeScript type definitions
│   │
│   ├── 📄 package.json             # Frontend dependencies
│   ├── 📄 tsconfig.json            # TypeScript config
│   ├── 📄 tsconfig.node.json       # TypeScript Node config
│   ├── 📄 tailwind.config.js       # Tailwind CSS config
│   ├── 📄 postcss.config.js        # PostCSS plugins
│   ├── 📄 next.config.js           # Next.js config
│   ├── 📄 .env.local.example       # Environment template
│   └── 📄 .env.local               # Local environment (DO NOT COMMIT)
│
├── 🔧 server/                      # Express + Socket.IO Backend
│   ├── src/
│   │   ├── 📄 index.ts             # Entry point & Express setup
│   │   │                           # - HTTP REST API endpoints
│   │   │                           # - Socket.IO connection setup
│   │   │                           # - Room storage & management
│   │   │
│   │   ├── 📄 socket/              # Socket.IO event handlers
│   │   │   ├── 📄 rooms.ts         # Room join/leave logic
│   │   │   │                       # - User management
│   │   │   │                       # - Room state updates
│   │   │   │                       # - Broadcasting user events
│   │   │   │
│   │   │   ├── 📄 playback.ts      # Play/pause/seek handlers
│   │   │   │                       # - Playback state updates
│   │   │   │                       # - Event broadcasting
│   │   │   │                       # - Timestamp tracking
│   │   │   │
│   │   │   └── 📄 sync.ts          # Sync & heartbeat handlers
│   │   │                           # - Drift detection
│   │   │                           # - Force sync triggers
│   │   │                           # - Heartbeat emissions
│   │   │
│   │   ├── 📄 routes/              # HTTP route handlers (future)
│   │   │
│   │   └── 📄 types/               # TypeScript types
│   │
│   ├── 📄 package.json             # Backend dependencies
│   ├── 📄 tsconfig.json            # TypeScript config
│   ├── 📄 .env.local.example       # Environment template
│   └── 📄 .env.local               # Local environment (DO NOT COMMIT)
│
├── 📦 shared/                      # Shared Code & Types
│   ├── 📄 types.ts                 # TypeScript interfaces
│   │                              # - RoomState, RoomUser
│   │                              # - PlaybackState, SocketEvents
│   │                              # - API response types
│   │                              # - Worker job types
│   │
│   └── 📄 constants.ts             # App constants
│                                  # - Sync configuration
│                                  # - Event names
│                                  # - Error messages
│                                  # - Room settings
│
├── 🤖 workers/                     # Background Job Processing (Future)
│   ├── 📄 README.md                # Worker system documentation
│   ├── 📄 types.ts                 # Worker interfaces
│   │                              # - IQueue, IWorker
│   │                              # - JobType enum
│   │                              # - Job payload types
│   │
│   └── 📄 queue/
│       ├── 📄 localQueue.ts        # In-memory queue (MVP)
│       │                          # - Job enqueueing
│       │                          # - FIFO processing
│       │                          # - Priority sorting
│       │
│       └── 📄 workers.ts           # Worker implementations
│                                  # - ExampleWorker base class
│                                  # - Worker registry
│
├── 🔄 docker-compose.yml           # Docker multi-container setup
│
└── 📚 .github/                     # GitHub configuration (future)
    └── workflows/                 # CI/CD workflows (future)

═══════════════════════════════════════════════════════════════

## Core Data Flows

### 1. User Join Flow
   User clicks → Room page
   ↓
   useRoom hook connects
   ↓
   Socket emits "join-room"
   ↓
   Server: room.ts handler receives
   ↓
   Server updates RoomState, broadcasts "user-joined"
   ↓
   All clients receive, useRoom hook updates UI
   ↓
   Users list updated in real-time

### 2. Video Play Flow
   User clicks Play button
   ↓
   VideoPlayer component detects "play" event
   ↓
   useVideoSync.broadcastPlay() called
   ↓
   Socket emits "play" with timestamp
   ↓
   Server: playback.ts handler receives
   ↓
   Server updates playbackState, broadcasts "play-event"
   ↓
   All clients receive "play-event"
   ↓
   useVideoSync.handlePlayEvent() called
   ↓
   Video player plays at received timestamp
   ↓
   All users see video playing in sync ✓

### 3. Sync Check Flow (Heartbeat)
   Timer triggers every 3 seconds
   ↓
   useVideoSync.sendHeartbeat() called
   ↓
   Socket emits "heartbeat"
   ↓
   Server: sync.ts handler receives
   ↓
   Server broadcasts "room-state-updated"
   ↓
   Client receives full room state
   ↓
   If drift > 500ms detected:
      - Force sync triggered by server
      - Client updates video timestamp
      - Video resynchronizes

═══════════════════════════════════════════════════════════════

## Key Directories Explained

### src/app/
Next.js App Router pages. Each page.tsx becomes a route.
- page.tsx = / (home)
- room/[id]/page.tsx = /room/:id (watching page)

### src/components/
Reusable UI components. Extracted from pages for readability.
- VideoPlayer: HTML5 video with custom controls
- RoomHeader: Displays room code and user count
- UsersConnected: List of connected users

### src/hooks/
Custom React hooks for business logic isolation.
- useVideoSync: Handles all video synchronization
- useRoom: Manages room state and user updates

### src/lib/
Utility modules and single-instance services.
- socket.ts: Singleton Socket.IO client

### server/src/socket/
Socket event handlers organized by feature.
- rooms.ts: Room lifecycle (join, leave)
- playback.ts: Video playback events (play, pause, seek)
- sync.ts: Synchronization logic (drift detection, heartbeat)

### workers/
Job queue and worker implementations for MVP 2+.
- types.ts: Worker/Queue interfaces
- queue/localQueue.ts: In-memory queue for MVP
- queue/workers.ts: Example worker template

═══════════════════════════════════════════════════════════════

## Environment Files

.env.local files should NOT be committed to git.
Use .env.local.example as template.

Development .env.local:
- Points to localhost servers
- ENABLE_LOCAL_WORKERS=true

Production .env.local:
- Points to deployed services
- Cloudflare credentials configured
- Redis enabled
- Worker system scaled

═══════════════════════════════════════════════════════════════

## Adding New Features

### Add a Socket Event

1. Define in shared/types.ts
   ```typescript
   export interface SocketEvents {
     "my-event": (data: { foo: string }) => void;
   }
   ```

2. Add constant in shared/constants.ts
   ```typescript
   MY_EVENT: "my-event",
   ```

3. Add handler in server/src/socket/[feature].ts
   ```typescript
   socket.on(SOCKET_EVENTS.MY_EVENT, (data) => {
     // Handle event
   });
   ```

4. Use in client component
   ```typescript
   socketClient.emit(SOCKET_EVENTS.MY_EVENT, { foo: "bar" });
   ```

### Add a New Route

1. Create file: client/src/app/[feature]/page.tsx
2. Use Next.js page conventions
3. Use existing hooks for socket/room logic

### Add a Worker

1. Extend ExampleWorker class
2. Implement process() method
3. Register in workerRegistry
4. Enqueue jobs via API or server events

═══════════════════════════════════════════════════════════════

For detailed setup instructions, see QUICKSTART.md
For deployment options, see DEPLOYMENT.md
