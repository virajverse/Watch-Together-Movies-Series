/**
 * Room Hook
 * Manages room state, user management, and reconnection
 */

import { useState, useEffect, useCallback } from "react";
import { socketClient } from "../lib/socket";
import { RoomState, RoomUser } from "../../shared/types";
import { SOCKET_EVENTS } from "../../shared/constants";

interface UseRoomOptions {
  roomId: string;
  userId: string;
}

export function useRoom({ roomId, userId }: UseRoomOptions) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Join the room
   */
  const joinRoom = useCallback(() => {
    if (!roomId || !userId) return;
    setIsLoading(true);
    socketClient.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, userId });
  }, [roomId, userId]);

  /**
   * Leave the room
   */
  const leaveRoom = useCallback(() => {
    socketClient.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId, userId });
  }, [roomId, userId]);

  /**
   * Setup socket listeners
   */
  useEffect(() => {
    const handleRoomJoined = (roomData: RoomState) => {
      console.log("[ROOM] Joined room:", roomData.id);
      setRoom(roomData);
      setUsers(roomData.users);
      setError(null);
      setIsLoading(false);
    };

    const handleUserJoined = (user: RoomUser) => {
      console.log("[ROOM] User joined:", user.id.substring(0, 8));
      setUsers((prev) => {
        // Prevent duplicates
        if (prev.find(u => u.id === user.id)) return prev;
        return [...prev, user];
      });
    };

    const handleUserLeft = (data: { userId: string; userCount: number }) => {
      console.log("[ROOM] User left:", data.userId.substring(0, 8));
      setUsers((prev) => prev.filter((u) => u.id !== data.userId));
    };

    const handleRoomStateUpdated = (roomData: RoomState) => {
      setRoom(roomData);
      setUsers(roomData.users);
    };

    const handleError = (data: { message: string; code?: string }) => {
      console.error("[ROOM] Error:", data.message);
      setError(data.message);
      setIsLoading(false);
    };

    // Reconnect handler - rejoin room on reconnect
    const handleReconnect = () => {
      console.log("[ROOM] Reconnected, rejoining room...");
      if (roomId && userId) {
        socketClient.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, userId });
      }
    };

    socketClient.on(SOCKET_EVENTS.ROOM_JOINED, handleRoomJoined);
    socketClient.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socketClient.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    socketClient.on(SOCKET_EVENTS.ROOM_STATE_UPDATED, handleRoomStateUpdated);
    socketClient.on(SOCKET_EVENTS.ERROR, handleError);
    socketClient.on("connect" as any, handleReconnect);

    return () => {
      socketClient.off(SOCKET_EVENTS.ROOM_JOINED, handleRoomJoined);
      socketClient.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socketClient.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      socketClient.off(SOCKET_EVENTS.ROOM_STATE_UPDATED, handleRoomStateUpdated);
      socketClient.off(SOCKET_EVENTS.ERROR, handleError);
      socketClient.off("connect" as any, handleReconnect);
    };
  }, [roomId, userId]);

  return {
    room,
    users,
    error,
    isLoading,
    joinRoom,
    leaveRoom,
  };
}
