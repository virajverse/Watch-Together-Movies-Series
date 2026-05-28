/**
 * Socket.IO - Sync & Heartbeat Handlers
 * Maintains real-time sync across clients
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
   * Handler: sync-time
   * Client sends its current video timestamp
   * Server calculates drift and responds with correction
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

      // Check if drift exceeds threshold
      if (drift > SYNC_CONFIG.FORCE_SYNC_THRESHOLD) {
        console.log(
          `[SYNC] Drift detected for ${userId} in ${roomId}: ${drift}ms (threshold: ${SYNC_CONFIG.FORCE_SYNC_THRESHOLD}ms)`
        );

        // Force sync all clients in room
        io.to(roomId).emit(SOCKET_EVENTS.FORCE_SYNC, room.playbackState);
      }

      // Send back server time for client to calculate latency
      socket.emit(SOCKET_EVENTS.SYNC_TIME_EVENT, {
        timestamp: room.playbackState.currentTime,
        roomTime: room.playbackState.currentTime,
        userId,
      });
    }
  );

  /**
   * Handler: heartbeat
   * Periodic sync from client (every few seconds)
   */
  socket.on(SOCKET_EVENTS.HEARTBEAT, (data: { roomId: string; userId: string }) => {
    const { roomId, userId } = data;

    const room = rooms.get(roomId);
    if (!room) return;

    // Update user's last seen time
    const user = room.users.find((u) => u.id === userId);
    if (user) {
      user.lastSeen = Date.now();
    }

    // Send full room state for consistency
    socket.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
  });
}

/**
 * Start heartbeat server - broadcasts to all rooms periodically
 */
export function startHeartbeatServer(io: SocketIOServer, rooms: Map<string, RoomState>) {
  setInterval(() => {
    rooms.forEach((room, roomId) => {
      if (room.users.length > 0) {
        io.to(roomId).emit("server-heartbeat", {
          serverTime: Date.now(),
          roomId,
          userCount: room.users.length,
          playbackState: room.playbackState,
        });
      }
    });
  }, SYNC_CONFIG.HEARTBEAT_INTERVAL);

  console.log(`[HEARTBEAT] Heartbeat server started (interval: ${SYNC_CONFIG.HEARTBEAT_INTERVAL}ms)`);
}
