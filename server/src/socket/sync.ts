/**
 * Socket.IO - Sync & Heartbeat Handlers — Simplified
 *
 * Heartbeat handler:
 * - Updates user's lastSeen
 * - Stores playback state from host (currentTime, isPlaying)
 * - Sends room-state-updated ONLY to the requesting socket (not broadcast)
 * - NEVER triggers force-sync from heartbeat
 *
 * Removed: playback-ready, playback-blocked handlers (not needed)
 */

import { Socket, Server as SocketIOServer } from "socket.io";
import type { RoomState } from "../../../shared/types.ts";
import { SOCKET_EVENTS, SYNC_CONFIG } from "../../../shared/constants.ts";

export function setupSyncHandlers(
  socket: Socket,
  io: SocketIOServer,
  rooms: Map<string, RoomState>
) {
  /**
   * Handler: heartbeat
   * Client sends current playback state periodically.
   * - Update user's lastSeen
   * - If from host, store playback state
   * - Reply with room state to requesting socket only
   */
  socket.on(
    SOCKET_EVENTS.HEARTBEAT,
    (data: { roomId: string; userId: string; currentTime?: number; isPlaying?: boolean }) => {
      const { roomId, userId, currentTime, isPlaying } = data;

      const room = rooms.get(roomId);
      if (!room) return;

      // Update user's last seen time
      const user = room.users.find((u) => u.id === userId);
      if (!user) return;
      user.lastSeen = Date.now();

      // If this user is the host, store their playback state
      if (user.isHost && currentTime !== undefined && isPlaying !== undefined) {
        room.playbackState = {
          isPlaying,
          currentTime,
          lastUpdatedAt: Date.now(),
          updatedBy: userId,
        };
      }

      // Send room state ONLY to the requesting socket (not broadcast)
      socket.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    }
  );

  /**
   * Handler: sync-time
   * Client sends its current video timestamp.
   * Server calculates drift and responds — no force-sync from heartbeat.
   */
  socket.on(
    SOCKET_EVENTS.SYNC_TIME,
    (data: { roomId: string; userId: string; timestamp: number }) => {
      const { roomId, userId, timestamp } = data;

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
        return;
      }

      const drift = Math.abs(timestamp - room.playbackState.currentTime);

      // Only force-sync if drift > 1 second (not 500ms)
      if (drift > 1) {
        console.log(
          `[SYNC] Drift detected for ${userId} in ${roomId}: ${drift.toFixed(2)}s`
        );
        // Send force-sync only to the drifted client
        socket.emit(SOCKET_EVENTS.FORCE_SYNC, room.playbackState);
      }

      // Send back server time for client to calculate latency
      socket.emit(SOCKET_EVENTS.SYNC_TIME_EVENT, {
        timestamp: room.playbackState.currentTime,
        roomTime: room.playbackState.currentTime,
        userId,
      });
    }
  );
}

/**
 * Start heartbeat server - periodic broadcast to all rooms
 * Only sends server-heartbeat for monitoring, no playback mutations
 */
export function startHeartbeatServer(io: SocketIOServer, rooms: Map<string, RoomState>) {
  setInterval(() => {
    rooms.forEach((room, roomId) => {
      if (room.users.length > 0) {
        io.to(roomId).emit("server-heartbeat", {
          serverTime: Date.now(),
          roomId,
          userCount: room.users.length,
        });
      }
    });
  }, SYNC_CONFIG.HEARTBEAT_INTERVAL);

  console.log(`[HEARTBEAT] Heartbeat server started (interval: ${SYNC_CONFIG.HEARTBEAT_INTERVAL}ms)`);
}
