/**
 * Autoplay Unlock Overlay
 * Shows once when user joins a room to unlock browser autoplay restrictions.
 * After one tap, programmatic video.play() works for the rest of the session.
 */

"use client";

import React, { useState, useEffect } from "react";

interface AutoplayUnlockProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onUnlocked: () => void;
}

const STORAGE_KEY = "watch_together_autoplay_unlocked";

export const AutoplayUnlock: React.FC<AutoplayUnlockProps> = ({ videoRef, onUnlocked }) => {
  const [visible, setVisible] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try silent unlock first (works if user has interacted with site before)
    attemptSilentUnlock();
  }, []);

  /**
   * Attempt silent unlock without user interaction
   * Works if browser already trusts the origin or user has interacted previously
   */
  const attemptSilentUnlock = async () => {
    const video = videoRef.current;
    if (!video) {
      // Video not ready yet, show overlay
      setVisible(true);
      return;
    }

    try {
      // Try muted autoplay (almost always allowed)
      const wasMuted = video.muted;
      const wasVolume = video.volume;
      video.muted = true;
      video.volume = 0;

      await video.play();
      video.pause();

      // Restore state
      video.muted = wasMuted;
      video.volume = wasVolume;

      // Success - browser allows playback
      markUnlocked();
      onUnlocked();
    } catch {
      // Silent unlock failed - need user interaction
      setVisible(true);
    }
  };

  /**
   * User taps the unlock button
   * This counts as user interaction, enabling future programmatic play()
   */
  const handleUnlock = async () => {
    setUnlocking(true);
    setError(null);

    const video = videoRef.current;
    if (!video) {
      setError("Video player not ready. Please wait...");
      setUnlocking(false);
      return;
    }

    try {
      // Step 1: Muted play (guaranteed to work after user gesture)
      video.muted = true;
      await video.play();

      // Step 2: Immediately pause (we just needed the gesture)
      video.pause();

      // Step 3: Unmute
      video.muted = false;

      // Step 4: Try unmuted play to fully unlock
      await video.play();
      video.pause();

      // Success!
      markUnlocked();
      setVisible(false);
      onUnlocked();
    } catch (err: any) {
      // Fallback: at least muted play worked
      try {
        video.muted = true;
        await video.play();
        video.pause();
        video.muted = false;

        // Partial success - muted autoplay works
        markUnlocked();
        setVisible(false);
        onUnlocked();
      } catch {
        setError("Could not enable playback. Please try again.");
        setUnlocking(false);
      }
    }
  };

  const markUnlocked = () => {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // localStorage not available, continue anyway
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4 text-center">
        {/* Icon */}
        <div className="mb-6 animate-pulse">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-600/20 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-blue-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-white text-2xl font-bold mb-2">
          Enable Watch Sync
        </h2>

        {/* Subtitle */}
        <p className="text-gray-400 text-sm mb-8">
          This allows synced playback with your friends.
          <br />
          You only need to do this once.
        </p>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all transform hover:scale-105 active:scale-95"
        >
          {unlocking ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Enabling...
            </span>
          ) : (
            "▶ Tap to Enable Sync Playback"
          )}
        </button>

        {/* Info */}
        <p className="text-gray-500 text-xs mt-4">
          Browser requires one tap to allow video playback
        </p>
      </div>
    </div>
  );
};
