/**
 * Backend Server Entry Point
 * Express server with Socket.IO for real-time sync
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { existsSync, mkdirSync } from "fs";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Import socket handlers
import { setupRoomHandlers } from "./socket/rooms.ts";
import { setupPlaybackHandlers } from "./socket/playback.ts";
import { setupSyncHandlers, startHeartbeatServer } from "./socket/sync.ts";

// Import MVP2 modules
import { createUploadRouter } from "./routes/upload.ts";
import importRouter from "./routes/import.ts";
import streamRouter from "./routes/stream.ts";
import videosRouter from "./routes/videos.ts";
import { localQueue } from "./workers/queue.ts";
import { registerProcessingHandlers } from "./ffmpeg/processor.ts";
import { startWatcher } from "./workers/watcher.ts";

import type { RoomState } from "../../shared/types.ts";
import { ROOM_CONFIG } from "../../shared/constants.ts";

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
const WS_ORIGIN = process.env.WS_ORIGIN || "http://localhost:3000";

// ============================================================================
// Ensure required directories exist
// ============================================================================

const IMPORT_DIR = path.resolve(process.cwd(), process.env.LOCAL_IMPORT_FOLDER || "./import");
const TEMP_DIR = path.resolve(process.cwd(), "storage/temp");

[IMPORT_DIR, TEMP_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`[INIT] Created directory: ${dir}`);
  }
});

// ============================================================================
// Room Storage - In-Memory (MVP1)
// ============================================================================

export const rooms = new Map<string, RoomState>();
export const roomCodes = new Map<string, string>(); // code → roomId mapping

/**
 * Generate a short room code (6 characters)
 */
export function generateRoomCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 3; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return code;
}

/**
 * Create a new room
 */
export function createRoom(): { roomId: string; roomCode: string } {
  const roomId = uuidv4();
  const roomCode = generateRoomCode();

  const newRoom: RoomState = {
    id: roomId,
    createdAt: Date.now(),
    users: [],
    playbackState: {
      isPlaying: false,
      currentTime: 0,
      lastUpdatedAt: Date.now(),
      updatedBy: "system",
    },
  };

  rooms.set(roomId, newRoom);
  roomCodes.set(roomCode, roomId); // Store code → ID mapping
  console.log(`[ROOM] Created new room: ${roomId} with code: ${roomCode}`);
  return { roomId, roomCode };
}

/**
 * Get room from memory
 */
export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

// ============================================================================
// Express & Socket.IO Setup
// ============================================================================

const app = express();
const httpServer = createServer(app);

// CORS configuration - allow multiple origins
const allowedOrigins = WS_ORIGIN.split(",").map(o => o.trim());
const corsOrigin = allowedOrigins.includes("*") ? true : allowedOrigins;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(express.json());

// ============================================================================
// Socket.IO Server Setup
// ============================================================================

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
  serveClient: false,
});

/**
 * Connection event - when a client connects
 */
io.on("connection", (socket) => {
  console.log(`[SOCKET] User connected: ${socket.id}`);

  // Setup all socket event handlers
  setupRoomHandlers(socket, io, rooms);
  setupPlaybackHandlers(socket, io, rooms);
  setupSyncHandlers(socket, io, rooms);

  // Error handler
  socket.on("error", (error) => {
    console.error(`[SOCKET ERROR] ${socket.id}:`, error);
  });
});

// Start heartbeat server
startHeartbeatServer(io, rooms);

// ============================================================================
// MVP2 - Initialize Worker Queue & FFmpeg Handlers
// ============================================================================

localQueue.init({ io });
registerProcessingHandlers();

// ============================================================================
// MVP2 - Start Local Folder Watcher
// ============================================================================

startWatcher();

// ============================================================================
// REST API Routes
// ============================================================================

/**
 * GET /api/rooms/:id - Get room state
 */
app.get("/api/rooms/:id", (req, res) => {
  const { id } = req.params;
  const room = rooms.get(id);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json(room);
});

/**
 * POST /api/rooms - Create a new room
 */
app.post("/api/rooms", (_req, res) => {
  const { roomId, roomCode } = createRoom();

  res.json({
    success: true,
    data: {
      roomId,
      roomCode,
      joinUrl: `/room/${roomId}?code=${roomCode}`,
    },
  });
});

/**
 * GET /api/rooms/code/:code - Lookup room by code
 */
app.get("/api/rooms/code/:code", (req, res) => {
  const { code } = req.params;
  const roomId = roomCodes.get(code.toUpperCase());

  if (!roomId) {
    return res.status(404).json({ success: false, error: "Room not found with this code" });
  }

  res.json({ success: true, data: { roomId, code } });
});

/**
 * GET /api/health - Health check
 */
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    rooms: rooms.size,
    queue: localQueue.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// MVP2 - Mount Upload, Import, Stream, and Video Routes
// ============================================================================

app.use("/api/upload", createUploadRouter(io));
app.use("/api/import", importRouter);
app.use("/api/stream", streamRouter);
app.use("/api/videos", videosRouter);

// ============================================================================
// Periodic Cleanup
// ============================================================================

setInterval(() => {
  const now = Date.now();
  const timeout = ROOM_CONFIG.INACTIVITY_TIMEOUT * 60 * 1000;

  for (const [roomId, room] of rooms.entries()) {
    if (room.users.length === 0 && now - room.playbackState.lastUpdatedAt > timeout) {
      rooms.delete(roomId);
      console.log(`[CLEANUP] Removed inactive room: ${roomId}`);
    }
  }
}, ROOM_CONFIG.CLEANUP_INTERVAL);

// ============================================================================
// Server Start
// ============================================================================

httpServer.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════╗
║       Watch Together - Server          ║
╠═════════════════════════════════════════╣
║ Port: ${PORT}
║ Environment: ${NODE_ENV}
║ Allowed Origins: ${WS_ORIGIN}
║ MVP2: R2 Upload & HLS Streaming ✓
║ Import Folder: ${IMPORT_DIR}
╚═════════════════════════════════════════╝
  `);
});

// Graceful Shutdown
process.on("SIGTERM", () => {
  console.log("[SERVER] Shutting down...");
  httpServer.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[SERVER] Shutting down...");
  httpServer.close(() => process.exit(0));
});
