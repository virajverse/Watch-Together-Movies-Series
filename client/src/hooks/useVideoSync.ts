/**
 * Video Sync Hook
 * Manages real-time video synchronization
 *
 * Anti-loop protection:
 * - isRemoteActionRef prevents re-broadcasting received events
 * - Debounce seek events (300ms)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { socketClient } from "../lib/socket";
import { PlaybackState } from "../../shared/types";
import { SYNC_CONFIG, SOCKET_EVENTS } from "../../shared/constants";

interface UseVideoSyncOptions {
  roomId: string;
  userId: string;
  playerRef: React.RefObject<HTMLVideoElement | null>;
}

export function useVideoSync({ roomId, userId, playerRef }: UseVideoSyncOptions) {
  const isRemoteActionRef = useRef(false);
  const lastSeekTimeRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const [syncStatus, setSyncStatus] = useState<string>("");

  const getCurrentTime = useCallback(() => {
    return playerRef.current?.currentTime ?? 0;
  }, [playerRef]);

  /**
   * Safe play - handles autoplay restrictions
   */
  const safePlay = useCallback(async (player: HTMLVideoElement) => {
    try {
      await player.play();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        console.warn("[VIDEO SYNC] Autoplay blocked - user interaction needed");
        setSyncStatus("Click video to enable sync");
        // Mute and try again (muted autoplay is usually allowed)
        player.muted = true;
        try {
          await player.play();
          // Unmute after a short delay
          setTimeout(() => { player.muted = false; }, 100);
        } catch {
          console.error("[VIDEO SYNC] Even muted play failed");
        }
      } else {
        console.error("[VIDEO SYNC] Play failed:", err);
      }
    }
  }, []);

  /**
   * Sync with room state (force sync)
   */
  const syncWithRoom = useCallback((playbackState: PlaybackState) => {
    const currentTime = getCurrentTime();
    const drift = Math.abs(currentTime - playbackState.currentTime);

    if (drift > 0.5) { // 500ms = 0.5 seconds
      console.log(`[VIDEO SYNC] Force sync: drift ${drift.toFixed(2)}s`);

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = playbackState.currentTime;

        if (playbackState.isPlaying && playerRef.current.paused) {
          safePlay(playerRef.current);
        } else if (!playbackState.isPlaying && !playerRef.current.paused) {
          playerRef.current.pause();
        }

        setTimeout(() => { isRemoteActionRef.current = false; }, 500);
      }
    }
  }, [getCurrentTime, playerRef, safePlay]);

  /**
   * Handle play event from other users
   */
  const handlePlayEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (data.userId === userId) return;

      console.log(`[VIDEO SYNC] ▶ Play from ${data.userId.substring(0, 6)} at ${data.timestamp.toFixed(1)}s`);

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = data.timestamp;
        safePlay(playerRef.current);
        setTimeout(() => { isRemoteActionRef.current = false; }, 500);
      }
    },
    [userId, playerRef, safePlay]
  );

  /**
   * Handle pause event from other users
   */
  const handlePauseEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (data.userId === userId) return;

      console.log(`[VIDEO SYNC] ⏸ Pause from ${data.userId.substring(0, 6)} at ${data.timestamp.toFixed(1)}s`);

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = data.timestamp;
        playerRef.current.pause();
        setTimeout(() => { isRemoteActionRef.current = false; }, 500);
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

      console.log(`[VIDEO SYNC] ⏩ Seek from ${data.userId.substring(0, 6)} to ${data.timestamp.toFixed(1)}s`);

      if (playerRef.current) {
        isRemoteActionRef.current = true;
        playerRef.current.currentTime = data.timestamp;
        setTimeout(() => { isRemoteActionRef.current = false; }, 500);
      }
    },
    [userId, playerRef]
  );

  /**
   * Handle force sync from server
   */
  const handleForceSync = useCallback(
    (playbackState: PlaybackState) => {
      console.log("[VIDEO SYNC] 🔄 Force sync from server");
      syncWithRoom(playbackState);
    },
    [syncWithRoom]
  );

  /**
   * Broadcast play - with anti-loop check
   */
  const broadcastPlay = useCallback(() => {
    if (isRemoteActionRef.current) return;
    const currentTime = getCurrentTime();
    console.log(`[VIDEO SYNC] Broadcasting play at ${currentTime.toFixed(1)}s`);
    socketClient.emit("play", { roomId, userId, timestamp: currentTime });
  }, [roomId, userId, getCurrentTime]);

  /**
   * Broadcast pause - with anti-loop check
   */
  const broadcastPause = useCallback(() => {
    if (isRemoteActionRef.current) return;
    const currentTime = getCurrentTime();
    console.log(`[VIDEO SYNC] Broadcasting pause at ${currentTime.toFixed(1)}s`);
    socketClient.emit("pause", { roomId, userId, timestamp: currentTime });
  }, [roomId, userId, getCurrentTime]);

  /**
   * Broadcast seek - with debounce (300ms)
   */
  const broadcastSeek = useCallback(() => {
    if (isRemoteActionRef.current) return;

    const now = Date.now();
    if (now - lastSeekTimeRef.current < 300) return;
    lastSeekTimeRef.current = now;

    const currentTime = getCurrentTime();
    console.log(`[VIDEO SYNC] Broadcasting seek to ${currentTime.toFixed(1)}s`);
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
    syncStatus,
  };
}
