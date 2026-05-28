/**
 * Socket.IO - Chat Handlers
 * Handles real-time chat messages and emoji reactions
 */

import { Socket, Server as SocketIOServer } from "socket.io";
import type { RoomState, ChatMessage, EmojiReaction } from "../../../shared/types.ts";
import { SOCKET_EVENTS } from "../../../shared/constants.ts";

export function setupChatHandlers(
  socket: Socket,
  io: SocketIOServer,
  rooms: Map<string, RoomState>
) {
  /**
   * Handler: chat-message
   * Broadcast a chat message to all users in the room
   */
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data: {
    roomId: string;
    userId: string;
    text: string;
  }) => {
    const { roomId, userId, text } = data;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
      return;
    }

    // Validate message
    if (!text || text.trim().length === 0) return;
    if (text.length > 500) return; // Max message length

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId,
      text: text.trim(),
      timestamp: Date.now(),
    };

    console.log(`[CHAT] Message from ${userId.substring(0, 6)} in room ${roomId.substring(0, 8)}: ${text.substring(0, 30)}`);

    // Broadcast to all users in room (including sender)
    io.to(roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE, message);
  });

  /**
   * Handler: emoji-reaction
   * Broadcast a floating emoji reaction to all users in the room
   */
  socket.on(SOCKET_EVENTS.EMOJI_REACTION, (data: {
    roomId: string;
    userId: string;
    emoji: string;
  }) => {
    const { roomId, userId, emoji } = data;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
      return;
    }

    // Validate emoji (only allow our predefined set)
    const allowedEmojis = ["😂", "❤️", "😱", "🔥", "👍"];
    if (!allowedEmojis.includes(emoji)) return;

    const reaction: EmojiReaction = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId,
      emoji,
      timestamp: Date.now(),
    };

    console.log(`[CHAT] Reaction ${emoji} from ${userId.substring(0, 6)} in room ${roomId.substring(0, 8)}`);

    // Broadcast to all users in room (including sender)
    io.to(roomId).emit(SOCKET_EVENTS.EMOJI_REACTION, reaction);
  });
}
