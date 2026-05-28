/**
 * Socket.IO - Playback Control Handlers
 * Handles play, pause, seek events from users
 */

import { Socket, Server as SocketIOServer } from "socket.io";
import type { RoomState, PlaybackState } from "../../../shared/types.ts";
import { SOCKET_EVENTS } from "../../../shared/constants.ts";

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
}
