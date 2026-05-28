/**
 * Socket.IO - WebRTC Signaling Handlers
 * Handles WebRTC peer-to-peer signaling for voice/video calls
 * Server only relays signals - actual media is peer-to-peer
 */

import { Socket, Server as SocketIOServer } from "socket.io";
import type { RoomState } from "../../../shared/types.ts";
import { SOCKET_EVENTS } from "../../../shared/constants.ts";

export function setupWebRTCHandlers(
  socket: Socket,
  io: SocketIOServer,
  rooms: Map<string, RoomState>
) {
  /**
   * Handler: webrtc-join
   * User wants to join voice/video in a room
   * Notify all other users in the room so they can initiate peer connections
   */
  socket.on(SOCKET_EVENTS.WEBRTC_JOIN, (data: { roomId: string; userId: string }) => {
    const { roomId, userId } = data;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
      return;
    }

    console.log(`[WEBRTC] User ${userId.substring(0, 6)} joined voice in room ${roomId.substring(0, 8)}`);

    // Broadcast to all OTHER users in the room that this user joined voice
    socket.to(roomId).emit(SOCKET_EVENTS.WEBRTC_JOIN, { userId, socketId: socket.id });
  });

  /**
   * Handler: webrtc-leave
   * User leaves voice/video
   */
  socket.on(SOCKET_EVENTS.WEBRTC_LEAVE, (data: { roomId: string; userId: string }) => {
    const { roomId, userId } = data;

    console.log(`[WEBRTC] User ${userId.substring(0, 6)} left voice in room ${roomId.substring(0, 8)}`);

    // Broadcast to all OTHER users in the room
    socket.to(roomId).emit(SOCKET_EVENTS.WEBRTC_LEAVE, { userId, socketId: socket.id });
  });

  /**
   * Handler: webrtc-offer
   * Forward SDP offer to target peer
   */
  socket.on(SOCKET_EVENTS.WEBRTC_OFFER, (data: {
    roomId: string;
    userId: string;
    targetSocketId: string;
    signal: any;
  }) => {
    const { roomId, userId, targetSocketId, signal } = data;

    console.log(`[WEBRTC] Offer from ${userId.substring(0, 6)} to socket ${targetSocketId.substring(0, 8)}`);

    // Forward the offer to the target peer
    io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
      userId,
      socketId: socket.id,
      signal,
    });
  });

  /**
   * Handler: webrtc-answer
   * Forward SDP answer to target peer
   */
  socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, (data: {
    roomId: string;
    userId: string;
    targetSocketId: string;
    signal: any;
  }) => {
    const { roomId, userId, targetSocketId, signal } = data;

    console.log(`[WEBRTC] Answer from ${userId.substring(0, 6)} to socket ${targetSocketId.substring(0, 8)}`);

    // Forward the answer to the target peer
    io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
      userId,
      socketId: socket.id,
      signal,
    });
  });

  /**
   * Handler: webrtc-ice-candidate
   * Forward ICE candidate to target peer
   */
  socket.on(SOCKET_EVENTS.WEBRTC_ICE, (data: {
    roomId: string;
    userId: string;
    targetSocketId: string;
    candidate: any;
  }) => {
    const { roomId, userId, targetSocketId, candidate } = data;

    // Forward ICE candidate to target peer
    io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ICE, {
      userId,
      socketId: socket.id,
      candidate,
    });
  });

  /**
   * Handler: mic-toggle
   * Broadcast mic mute/unmute status to room
   */
  socket.on(SOCKET_EVENTS.MIC_TOGGLE, (data: {
    roomId: string;
    userId: string;
    isMicOn: boolean;
  }) => {
    const { roomId, userId, isMicOn } = data;

    console.log(`[WEBRTC] Mic ${isMicOn ? "on" : "off"} for ${userId.substring(0, 6)}`);

    // Broadcast to all users in room (including sender for confirmation)
    io.to(roomId).emit(SOCKET_EVENTS.MIC_TOGGLE, { userId, isMicOn });
  });

  /**
   * Handler: camera-toggle
   * Broadcast camera on/off status to room
   */
  socket.on(SOCKET_EVENTS.CAMERA_TOGGLE, (data: {
    roomId: string;
    userId: string;
    isCameraOn: boolean;
  }) => {
    const { roomId, userId, isCameraOn } = data;

    console.log(`[WEBRTC] Camera ${isCameraOn ? "on" : "off"} for ${userId.substring(0, 6)}`);

    // Broadcast to all users in room (including sender for confirmation)
    io.to(roomId).emit(SOCKET_EVENTS.CAMERA_TOGGLE, { userId, isCameraOn });
  });
}
