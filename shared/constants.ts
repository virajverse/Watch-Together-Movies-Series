/**
 * Shared Constants
 */

// Sync Configuration
export const SYNC_CONFIG = {
  // If time difference exceeds this, force sync (milliseconds)
  FORCE_SYNC_THRESHOLD: 500,

  // Heartbeat interval for periodic sync checks
  HEARTBEAT_INTERVAL: 3000,

  // Socket.IO connection timeout
  SOCKET_TIMEOUT: 5000,

  // Maximum allowed clock drift between client and server
  MAX_CLOCK_DRIFT: 1000,
};

// Event Names
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: "connect",
  DISCONNECT: "disconnect",

  // Room Management
  JOIN_ROOM: "join-room",
  LEAVE_ROOM: "leave-room",
  ROOM_JOINED: "room-joined",
  USER_JOINED: "user-joined",
  USER_LEFT: "user-left",
  ROOM_STATE_UPDATED: "room-state-updated",
  HOST_CHANGED: "host-changed",

  // Playback Control
  PLAY: "play",
  PAUSE: "pause",
  SEEK: "seek",
  PLAY_EVENT: "play-event",
  PAUSE_EVENT: "pause-event",
  SEEK_EVENT: "seek-event",

  // Sync
  SYNC_TIME: "sync-time",
  SYNC_TIME_EVENT: "sync-time-event",
  HEARTBEAT: "heartbeat",
  FORCE_SYNC: "force-sync",

  // Errors
  ERROR: "error",
  ROOM_ERROR: "room-error",
};

// Status Messages
export const STATUS_MESSAGES = {
  ROOM_CREATED: "Room created successfully",
  ROOM_JOINED: "Joined room successfully",
  USER_JOINED: "User joined the room",
  USER_LEFT: "User left the room",
  PLAYBACK_SYNCED: "Playback synchronized",
  FORCE_SYNC_TRIGGERED: "Forcing playback sync due to time drift",
};

// Error Messages
export const ERROR_MESSAGES = {
  ROOM_NOT_FOUND: "Room not found",
  INVALID_ROOM_ID: "Invalid room ID",
  ROOM_CODE_INVALID: "Invalid room code",
  USER_NOT_IN_ROOM: "User not in room",
  INVALID_VIDEO_URL: "Invalid video URL",
  SOCKET_CONNECT_FAILED: "Failed to connect to server",
  INTERNAL_ERROR: "Internal server error",
};

// Video Constraints
export const VIDEO_CONFIG = {
  MAX_URL_LENGTH: 2048,
  SUPPORTED_FORMATS: ["mp4", "webm", "ogg", "m3u8"],
  DEFAULT_QUALITY: "auto",
};

// Room Settings
export const ROOM_CONFIG = {
  // Room code length
  CODE_LENGTH: 6,

  // Maximum users per room
  MAX_USERS: 50,

  // Inactivity timeout (minutes)
  INACTIVITY_TIMEOUT: 30,

  // Room cleanup interval
  CLEANUP_INTERVAL: 60000, // 1 minute
};
