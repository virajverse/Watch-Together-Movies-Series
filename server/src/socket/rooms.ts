/**
 * Socket.IO - Room Management Handlers
 * Handles user joining and leaving rooms
 */

import { Socket, Server as SocketIOServer } from "socket.io";
import type { RoomState, RoomUser } from "../../../shared/types.ts";
import { SOCKET_EVENTS } from "../../../shared/constants.ts";

/**
 * Setup room-related socket handlers
 */
export function setupRoomHandlers(
  socket: Socket,
  io: SocketIOServer,
  rooms: Map<string, RoomState>
) {
  /**
   * Handler: join-room
   * User joins a room or creates if doesn't exist
   */
  socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { roomId: string; userId: string }) => {
    const { roomId, userId } = data;

    console.log(`[ROOM] User ${userId} attempting to join room ${roomId}`);

    // Get or create room
    let room = rooms.get(roomId);

    if (!room) {
      // Create new room in memory
      room = {
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
      rooms.set(roomId, room);
      console.log(`[ROOM] Created new room: ${roomId}`);
    }

    // Check if user already in room (reconnect scenario)
    const existingUser = room.users.find((u) => u.id === userId);
    if (existingUser) {
      // Update socket ID for reconnected user
      existingUser.socketId = socket.id;
      existingUser.lastSeen = Date.now();

      // Join socket.io room
      socket.join(roomId);

      // Send full room state
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, room);
      return;
    }

    // Create user object
    const user: RoomUser = {
      id: userId,
      socketId: socket.id,
      isHost: room.users.length === 0, // First user becomes host
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    // Add user to room
    room.users.push(user);

    // Join socket.io room (for broadcasting)
    socket.join(roomId);

    console.log(
      `[ROOM] User ${userId} joined room ${roomId}. Total users: ${room.users.length}`
    );

    // Broadcast to all users in room
    io.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, user);

    // Send full room state to new user
    socket.emit(SOCKET_EVENTS.ROOM_JOINED, room);
  });

  /**
   * Handler: leave-room
   * User leaves a room
   */
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data: { roomId: string; userId: string }) => {
    const { roomId, userId } = data;

    const room = rooms.get(roomId);
    if (!room) {
      console.warn(`[ROOM] Room not found for leave: ${roomId}`);
      return;
    }

    // Find and remove user
    const userIndex = room.users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      console.warn(`[ROOM] User not found in room: ${userId} in ${roomId}`);
      return;
    }

    const removedUser = room.users[userIndex];
    room.users.splice(userIndex, 1);

    // If host left, promote next user
    if (removedUser.isHost && room.users.length > 0) {
      room.users[0].isHost = true;
      io.to(roomId).emit("host-changed", {
        newHostId: room.users[0].id,
        previousHostId: removedUser.id,
      });
    }

    // Leave socket.io room
    socket.leave(roomId);

    console.log(
      `[ROOM] User ${userId} left room ${roomId}. Total users: ${room.users.length}`
    );

    // Broadcast to remaining users
    io.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, {
      userId,
      userCount: room.users.length,
    });

    // Clean up empty rooms after timeout
    if (room.users.length === 0) {
      setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (currentRoom && currentRoom.users.length === 0) {
          rooms.delete(roomId);
          console.log(`[ROOM] Deleted empty room: ${roomId}`);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
  });

  /**
   * Handle disconnect - auto leave room
   */
  socket.on("disconnect", () => {
    // Find which room this socket was in and remove them
    for (const [roomId, room] of rooms.entries()) {
      const userIndex = room.users.findIndex((u) => u.socketId === socket.id);
      if (userIndex !== -1) {
        const removedUser = room.users[userIndex];
        room.users.splice(userIndex, 1);

        // If host left, promote next user
        if (removedUser.isHost && room.users.length > 0) {
          room.users[0].isHost = true;
          // Notify all users about host change
          io.to(roomId).emit("host-changed", {
            newHostId: room.users[0].id,
            previousHostId: removedUser.id,
          });
        }

        console.log(
          `[ROOM] User ${removedUser.id} disconnected from room ${roomId}. Total users: ${room.users.length}`
        );

        // Broadcast to remaining users
        io.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, {
          userId: removedUser.id,
          userCount: room.users.length,
        });

        break;
      }
    }
  });
}
