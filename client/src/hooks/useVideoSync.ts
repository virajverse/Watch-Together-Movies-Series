/**
 * Video Sync Hook
 * Manages real-time video synchronization
 *
 * Anti-loop protection:
 * - Ignore events from own socket
 * - Track if action was triggered remotely (skip re-broadcast)
 * - Debounce seek events
 * - Throttle updates
 */

import { useEffect, useRef, useCallback } from "react";
import { socketClient } from "../lib/socket";
import { PlaybackState } from "../../shared/types";
import { SYNC_CONFIG, SOCKET_EVENTS } from "../../shared/constants";

interface UseVideoSyncOptions {
  roomId: string;
  userId: string;
  playerRef: React.RefObject<HTMLVideoElement | null>;
}

export function useVideoSync({ roomId, userId, playerRef }: UseVideoSyncOptions) {
  const isRemoteActionRef = useRef(false); // Prevents echo/loop
  const lastSeekTimeRef = useRef(0); // Debounce seeks
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  const getCurrentTime = useCallback(() => {
    return playerRef.current?.currentTime ?? 0;
  }, [playerRef]);

  /**
   * Perform sync with room state
   */
  const syncWithRoom = useCallback((playbackState: PlaybackState) => {
    const currentTime = getCurrentTime();
    const drift = Math.abs(currentTime - playbackState.currentTime);

    if (drift > SYNC_CONFIG.FORCE_SYNC_THRESHOLD / 1000) {
      console.log(
        `[VIDEO SYNC] Syncing: drift ${drift.toFixed(2)}s exceeds threshold`
      );

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = playbackState.currentTime;

        if (playbackState.isPlaying && playerRef.current.paused) {
          playerRef.current.play().catch(console.error);
        } else if (!playbackState.isPlaying && !playerRef.current.paused) {
          playerRef.current.pause();
        }

        setTimeout(() => { isRemoteActionRef.current = false; }, 300);
      }
    }
  }, [getCurrentTime, playerRef]);

  /**
   * Handle play event from other users
   */
  const handlePlayEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (data.userId === userId) return;

      console.log(`[VIDEO SYNC] Play from ${data.userId.substring(0, 8)} at ${data.timestamp}s`);

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = data.timestamp;
        playerRef.current.play().catch(console.error);
        setTimeout(() => { isRemoteActionRef.current = false; }, 300);
      }
    },
    [userId, playerRef]
  );

  /**
   * Handle pause event from other users
   */
  const handlePauseEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (data.userId === userId) return;

      console.log(`[VIDEO SYNC] Pause from ${data.userId.substring(0, 8)} at ${data.timestamp}s`);

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = data.timestamp;
        playerRef.current.pause();
        setTimeout(() => { isRemoteActionRef.current = false; }, 300);
      }
    },
    [userId, playerRef]
  );

  /**
   * Handle seek event from other users
   */
  const handleSeekEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (data.userId === userId) return;

      console.log(`[VIDEO SYNC] Seek from ${data.userId.substring(0, 8)} to ${data.timestamp}s`);

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = data.timestamp;
        setTimeout(() => { isRemoteActionRef.current = false; }, 300);
      }
    },
    [userId, playerRef]
  );

  /**
   * Handle force sync from server
   */
  const handleForceSync = useCallback(
    (playbackState: PlaybackState) => {
      console.log("[VIDEO SYNC] Force sync triggered by server");
      syncWithRoom(playbackState);
    },
    [syncWithRoom]
  );

  /**
   * Broadcast play - with anti-loop check
   */
  const broadcastPlay = useCallback(() => {
    if (isRemoteActionRef.current) return; // Skip if triggered by remote event
    const currentTime = getCurrentTime();
    socketClient.emit("play", { roomId, userId, timestamp: currentTime });
  }, [roomId, userId, getCurrentTime]);

  /**
   * Broadcast pause - with anti-loop check
   */
  const broadcastPause = useCallback(() => {
    if (isRemoteActionRef.current) return;
    const currentTime = getCurrentTime();
    socketClient.emit("pause", { roomId, userId, timestamp: currentTime });
  }, [roomId, userId, getCurrentTime]);

  /**
   * Broadcast seek - with debounce (300ms)
   */
  const broadcastSeek = useCallback(() => {
    if (isRemoteActionRef.current) return;

    const now = Date.now();
    if (now - lastSeekTimeRef.current < 300) return; // Debounce 300ms
    lastSeekTimeRef.current = now;

    const currentTime = getCurrentTime();
    socketClient.emit("seek", { roomId, userId, timestamp: currentTime });
  }, [roomId, userId, getCurrentTime]);

  /**
   * Send heartbeat
   */
  const sendHeartbeat = useCallback(() => {
    socketClient.emit("heartbeat", { roomId, userId });
  }, [roomId, userId]);

  /**
   * Setup socket listeners
   */
  useEffect(() => {
    socketClient.on(SOCKET_EVENTS.PLAY_EVENT, handlePlayEvent);
    socketClient.on(SOCKET_EVENTS.PAUSE_EVENT, handlePauseEvent);
    socketClient.on(SOCKET_EVENTS.SEEK_EVENT, handleSeekEvent);
    socketClient.on(SOCKET_EVENTS.FORCE_SYNC, handleForceSync);

    return () => {
      socketClient.off(SOCKET_EVENTS.PLAY_EVENT, handlePlayEvent);
      socketClient.off(SOCKET_EVENTS.PAUSE_EVENT, handlePauseEvent);
      socketClient.off(SOCKET_EVENTS.SEEK_EVENT, handleSeekEvent);
      socketClient.off(SOCKET_EVENTS.FORCE_SYNC, handleForceSync);
    };
  }, [handlePlayEvent, handlePauseEvent, handleSeekEvent, handleForceSync]);

  /**
   * Setup heartbeat interval
   */
  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, SYNC_CONFIG.HEARTBEAT_INTERVAL);
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [sendHeartbeat]);

  return {
    broadcastPlay,
    broadcastPause,
    broadcastSeek,
    sendHeartbeat,
  };
}
