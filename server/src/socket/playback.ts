/**
 * Socket.IO - Playback Control Handlers
 * Handles play, pause, seek events from users
 */

import { Socket, Server as SocketIOServer } from "socket.io";
import type { RoomState } from "../../../shared/types.ts";
import { SOCKET_EVENTS } from "../../../shared/constants.ts";
import { supabase } from "../lib/supabase.ts";

/**
 * Persist room state to Supabase (fire-and-forget)
 */
async function persistRoomState(room: RoomState) {
  if (!supabase) return;

  try {
    await supabase.from("rooms").upsert({
      id: room.id,
      video_url: room.videoUrl || null,
      status: room.playbackState.isPlaying ? "playing" : "paused",
      last_activity: new Date().toISOString(),
    }, { onConflict: "id" });

    await supabase.from("room_sessions").upsert({
      room_id: room.id,
      is_playing: room.playbackState.isPlaying,
      playback_time: room.playbackState.currentTime,
      last_updated_at: new Date().toISOString(),
      updated_by: room.playbackState.updatedBy,
    }, { onConflict: "room_id" });
  } catch (err: any) {
    console.warn("[DB] Room persist failed:", err?.message);
  }
}

export function setupPlaybackHandlers(
  socket: Socket,
  io: SocketIOServer,
  rooms: Map<string, RoomState>
) {
  /**
   * Handler: play
   */
  socket.on(SOCKET_EVENTS.PLAY, (data: { roomId: string; userId: string; timestamp: number }) => {
    const { roomId, userId, timestamp } = data;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
      return;
    }

    const user = room.users.find((u) => u.id === userId);
    if (!user) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "User not in room" });
      return;
    }

    // Update room playback state in memory
    room.playbackState = {
      isPlaying: true,
      currentTime: timestamp,
      lastUpdatedAt: Date.now(),
      updatedBy: userId,
    };

    // Persist to Supabase
    persistRoomState(room);

    const timestamp_ms = Date.now();

    console.log(
      `[PLAYBACK] Play event from ${userId} in room ${roomId} at ${timestamp}s`
    );

    // Broadcast to all users in room
    io.to(roomId).emit(SOCKET_EVENTS.PLAY_EVENT, {
      userId,
      timestamp,
      timestamp_ms,
    });
  });

  /**
   * Handler: pause
   */
  socket.on(SOCKET_EVENTS.PAUSE, (data: { roomId: string; userId: string; timestamp: number }) => {
    const { roomId, userId, timestamp } = data;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
      return;
    }

    const user = room.users.find((u) => u.id === userId);
    if (!user) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "User not in room" });
      return;
    }

    room.playbackState = {
      isPlaying: false,
      currentTime: timestamp,
      lastUpdatedAt: Date.now(),
      updatedBy: userId,
    };

    // Persist to Supabase
    persistRoomState(room);

    const timestamp_ms = Date.now();

    console.log(
      `[PLAYBACK] Pause event from ${userId} in room ${roomId} at ${timestamp}s`
    );

    io.to(roomId).emit(SOCKET_EVENTS.PAUSE_EVENT, {
      userId,
      timestamp,
      timestamp_ms,
    });
  });

  /**
   * Handler: seek
   */
  socket.on(SOCKET_EVENTS.SEEK, (data: { roomId: string; userId: string; timestamp: number }) => {
    const { roomId, userId, timestamp } = data;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
      return;
    }

    const user = room.users.find((u) => u.id === userId);
    if (!user) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "User not in room" });
      return;
    }

    room.playbackState = {
      ...room.playbackState,
      currentTime: timestamp,
      lastUpdatedAt: Date.now(),
      updatedBy: userId,
    };

    // Persist to Supabase
    persistRoomState(room);

    const timestamp_ms = Date.now();

    console.log(
      `[PLAYBACK] Seek event from ${userId} in room ${roomId} to ${timestamp}s`
    );

    io.to(roomId).emit(SOCKET_EVENTS.SEEK_EVENT, {
      userId,
      timestamp,
      timestamp_ms,
    });
  });

  /**
   * Handler: video-change
   * Host changes the video URL - broadcast to all users
   */
  socket.on("video-change", (data: { roomId: string; userId: string; videoUrl: string }) => {
    const { roomId, userId, videoUrl } = data;

    const room = rooms.get(roomId);
    if (!room) return;

    // Update room video URL
    room.videoUrl = videoUrl;

    // Reset playback state
    room.playbackState = {
      isPlaying: false,
      currentTime: 0,
      lastUpdatedAt: Date.now(),
      updatedBy: userId,
    };

    console.log(`[PLAYBACK] Video changed by ${userId} in room ${roomId}: ${videoUrl.substring(0, 50)}...`);

    // Persist to Supabase
    persistRoomState(room);

    // Broadcast to ALL users in room (including sender for confirmation)
    io.to(roomId).emit("video-changed", { userId, videoUrl });
  });
}
