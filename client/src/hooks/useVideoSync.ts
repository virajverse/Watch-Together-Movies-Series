"use client";

/**
 * Video Sync Hook — Permission-Based Architecture
 *
 * Flow:
 * 1. User joins room → sees "Allow sync?" prompt (one-time)
 * 2. User clicks "Allow" → this IS the user gesture that unlocks autoplay
 * 3. Inside the Allow handler: video.muted=true → video.play() → video.pause() → video.muted=false
 * 4. Permission saved to localStorage → never asked again
 * 5. From now on: ALL remote play/pause/seek work automatically
 *
 * Why this works:
 * - The "Allow" click is a user gesture
 * - We do video.play() inside that gesture → browser registers it
 * - After that, programmatic video.play() from socket events works
 * - Chrome is happy because gesture was registered on the video element
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { socketClient } from "../lib/socket";
import { PlaybackState } from "../../shared/types";
import { SOCKET_EVENTS, SYNC_CONFIG } from "../../shared/constants";

interface UseVideoSyncOptions {
  roomId: string;
  userId: string;
  isHost: boolean;
  playerRef: React.RefObject<HTMLVideoElement | null>;
}

const PERMISSION_KEY = "watch_together_sync_permission";

export function useVideoSync({
  roomId,
  userId,
  isHost,
  playerRef,
}: UseVideoSyncOptions) {
  const isRemoteActionRef = useRef(false);
  const lastSeekTimeRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Permission state
  const [syncPermission, setSyncPermission] = useState<"pending" | "granted" | "denied">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(PERMISSION_KEY);
      if (saved === "granted") return "granted";
    }
    return "pending";
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentTime = useCallback(() => {
    return playerRef.current?.currentTime ?? 0;
  }, [playerRef]);

  const getIsPlaying = useCallback(() => {
    return playerRef.current ? !playerRef.current.paused : false;
  }, [playerRef]);

  // ─── Grant permission (called from UI on user tap) ────────────────────────

  const grantPermission = useCallback(async () => {
    const video = playerRef.current;

    if (video) {
      try {
        // THIS is the user gesture that unlocks autoplay
        // Do muted play → pause → unmute to register gesture on video element
        video.muted = true;
        await video.play();
        video.pause();
        video.muted = false;
        video.currentTime = 0;
        console.log("[SYNC] ✅ Autoplay unlocked via permission grant gesture");
      } catch {
        // Even if play fails, the gesture is registered on the page
        console.log("[SYNC] ⚠️ Muted play failed, but gesture registered");
      }
    }

    // Save permission
    localStorage.setItem(PERMISSION_KEY, "granted");
    setSyncPermission("granted");
  }, [playerRef]);

  // ─── Deny permission ──────────────────────────────────────────────────────

  const denyPermission = useCallback(() => {
    setSyncPermission("denied");
    // Don't save to localStorage — ask again next time
  }, []);

  // ─── Revoke permission ────────────────────────────────────────────────────

  const revokePermission = useCallback(() => {
    localStorage.removeItem(PERMISSION_KEY);
    setSyncPermission("pending");
  }, []);

  // ─── Auto-unlock for returning users (permission already granted) ─────────

  useEffect(() => {
    if (syncPermission !== "granted") return;

    const video = playerRef.current;
    if (!video) return;

    // Try to silently unlock (may work if user has interacted with page before)
    const tryUnlock = async () => {
      try {
        video.muted = true;
        await video.play();
        video.pause();
        video.muted = false;
        video.currentTime = 0;
        console.log("[SYNC] ✅ Auto-unlocked for returning user");
      } catch {
        // Silent unlock failed — will work on next user interaction
        console.log("[SYNC] ⚠️ Auto-unlock failed — will unlock on next interaction");
      }
    };

    // Small delay to let video element mount
    const timer = setTimeout(tryUnlock, 500);
    return () => clearTimeout(timer);
  }, [syncPermission, playerRef]);

  // ─── Broadcast functions (host-only) ──────────────────────────────────────

  const broadcastPlay = useCallback(() => {
    if (!isHost) return;
    if (isRemoteActionRef.current) return;

    const currentTime = getCurrentTime();
    console.log(`[SYNC] 📡 Host broadcasting play at ${currentTime.toFixed(1)}s`);
    socketClient.emit("play", { roomId, userId, timestamp: currentTime });
  }, [isHost, roomId, userId, getCurrentTime]);

  const broadcastPause = useCallback(() => {
    if (!isHost) return;
    if (isRemoteActionRef.current) return;

    const currentTime = getCurrentTime();
    console.log(`[SYNC] 📡 Host broadcasting pause at ${currentTime.toFixed(1)}s`);
    socketClient.emit("pause", { roomId, userId, timestamp: currentTime });
  }, [isHost, roomId, userId, getCurrentTime]);

  const broadcastSeek = useCallback(() => {
    if (!isHost) return;
    if (isRemoteActionRef.current) return;

    const now = Date.now();
    if (now - lastSeekTimeRef.current < 300) return;
    lastSeekTimeRef.current = now;

    const currentTime = getCurrentTime();
    console.log(`[SYNC] 📡 Host broadcasting seek to ${currentTime.toFixed(1)}s`);
    socketClient.emit("seek", { roomId, userId, timestamp: currentTime });
  }, [isHost, roomId, userId, getCurrentTime]);

  // ─── Remote event handlers ────────────────────────────────────────────────

  const handlePlayEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (syncPermission !== "granted") return;
      if (data.userId === userId) return;

      const video = playerRef.current;
      if (!video) return;

      console.log(`[SYNC] ▶ Remote play at ${data.timestamp.toFixed(1)}s`);

      isRemoteActionRef.current = true;

      // Only seek if drift > 1 second
      if (Math.abs(video.currentTime - data.timestamp) > 1) {
        video.currentTime = data.timestamp;
      }

      // Try to play — if it fails, that's OK. User can tap the video play button.
      // Do NOT use muted fallback (causes double audio)
      video.play().catch(() => {
        // Play blocked — video stays paused, user needs to tap play button on video
        console.log("[SYNC] Play blocked by browser — user needs to tap play on video");
      });

      setTimeout(() => { isRemoteActionRef.current = false; }, 500);
    },
    [syncPermission, userId, playerRef]
  );

  const handlePauseEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (syncPermission !== "granted") return;
      if (data.userId === userId) return;

      const video = playerRef.current;
      if (!video) return;

      console.log(`[SYNC] ⏸ Remote pause at ${data.timestamp.toFixed(1)}s`);

      isRemoteActionRef.current = true;
      if (Math.abs(video.currentTime - data.timestamp) > 1) {
        video.currentTime = data.timestamp;
      }
      video.pause();
      setTimeout(() => { isRemoteActionRef.current = false; }, 500);
    },
    [syncPermission, userId, playerRef]
  );

  const handleSeekEvent = useCallback(
    (data: { userId: string; timestamp: number; timestamp_ms: number }) => {
      if (syncPermission !== "granted") return;
      if (data.userId === userId) return;

      const video = playerRef.current;
      if (!video) return;

      // Only apply if drift > 1 second
      if (Math.abs(video.currentTime - data.timestamp) > 1) {
        console.log(`[SYNC] ⏩ Remote seek to ${data.timestamp.toFixed(1)}s`);
        isRemoteActionRef.current = true;
        video.currentTime = data.timestamp;
        setTimeout(() => { isRemoteActionRef.current = false; }, 500);
      }
    },
    [syncPermission, userId, playerRef]
  );

  const handleForceSync = useCallback(
    (playbackState: PlaybackState) => {
      if (syncPermission !== "granted") return;

      const video = playerRef.current;
      if (!video) return;

      const drift = Math.abs(video.currentTime - playbackState.currentTime);
      if (drift <= 1) return;

      console.log(`[SYNC] 🔄 Force sync: drift ${drift.toFixed(2)}s`);

      isRemoteActionRef.current = true;
      video.currentTime = playbackState.currentTime;

      if (playbackState.isPlaying && video.paused) {
        // Try play — if blocked, user taps play button
        video.play().catch(() => {});
      } else if (!playbackState.isPlaying && !video.paused) {
        video.pause();
      }

      setTimeout(() => { isRemoteActionRef.current = false; }, 500);
    },
    [syncPermission, playerRef]
  );

  // ─── Socket listeners ─────────────────────────────────────────────────────

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

  // ─── Heartbeat (report-only) ──────────────────────────────────────────────

  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      socketClient.emit("heartbeat", {
        roomId,
        userId,
        currentTime: getCurrentTime(),
        isPlaying: getIsPlaying(),
      });
    }, SYNC_CONFIG.HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [roomId, userId, getCurrentTime, getIsPlaying]);

  return {
    broadcastPlay,
    broadcastPause,
    broadcastSeek,
    syncPermission,
    grantPermission,
    denyPermission,
    revokePermission,
  };
}
