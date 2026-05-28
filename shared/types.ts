/**
 * Shared Types and Interfaces
 * Used across frontend and backend for type safety
 */

// User representation in a room
export interface RoomUser {
  id: string;
  socketId: string;
  isHost: boolean;
  joinedAt: number;
  lastSeen: number;
}

// Room state - persisted while users are connected
export interface RoomState {
  id: string;
  createdAt: number;
  users: RoomUser[];
  playbackState: PlaybackState;
  videoUrl?: string;
}

// Current playback state - synced across all clients
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedAt: number;
  updatedBy: string; // userId who triggered the update
}

// Socket Events - Incoming
export interface SocketEvents {
  // Room management
  "join-room": (data: { roomId: string; userId: string }) => void;
  "leave-room": (data: { roomId: string; userId: string }) => void;

  // Playback control
  "play": (data: { roomId: string; userId: string; timestamp: number }) => void;
  "pause": (data: { roomId: string; userId: string; timestamp: number }) => void;
  "seek": (data: { roomId: string; userId: string; timestamp: number }) => void;

  // Sync messages
  "sync-time": (data: { roomId: string; userId: string; timestamp: number }) => void;
  "heartbeat": (data: { roomId: string; userId: string }) => void;
}

// Socket Events - Outgoing to clients
export interface SocketEmitEvents {
  // Room updates
  "room-joined": (data: RoomState) => void;
  "user-joined": (data: RoomUser) => void;
  "user-left": (data: { userId: string; userCount: number }) => void;
  "room-state-updated": (data: RoomState) => void;

  // Playback events - broadcast to all users
  "play-event": (data: {
    userId: string;
    timestamp: number;
    timestamp_ms: number;
  }) => void;
  "pause-event": (data: {
    userId: string;
    timestamp: number;
    timestamp_ms: number;
  }) => void;
  "seek-event": (data: {
    userId: string;
    timestamp: number;
    timestamp_ms: number;
  }) => void;

  // Sync events
  "sync-time-event": (data: {
    timestamp: number;
    roomTime: number;
    userId: string;
  }) => void;
  "force-sync": (data: PlaybackState) => void;

  // Errors
  "error": (data: { message: string; code?: string }) => void;
  "room-error": (data: { message: string; code?: string }) => void;
}

// HTTP API Responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface RoomCreationResponse {
  roomId: string;
  roomCode: string;
  joinUrl: string;
}

// Worker Event - Future use
export interface WorkerEvent {
  id: string;
  type: "ffmpeg" | "hls" | "transcode" | "process";
  payload: any;
  createdAt: number;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
}

// Queue Job - Future worker architecture
export interface QueueJob {
  id: string;
  type: string;
  payload: any;
  priority: "low" | "normal" | "high";
  status: "pending" | "processing" | "completed" | "failed";
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ============================================================================
// MVP2 - Video Upload & Streaming Types
// ============================================================================

export interface VideoFile {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  thumbnailPath?: string;
  streamPath?: string;
  qualities?: string[];
  uploadedBy?: string;
  createdAt: number;
  errorMessage?: string;
}

export interface UploadProgress {
  videoId: string;
  progress: number; // 0-100
  stage: 'uploading' | 'processing' | 'complete' | 'error';
  message?: string;
}

export interface ProcessingJob {
  id: string;
  videoId: string;
  type: 'transcode' | 'thumbnail';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
}
