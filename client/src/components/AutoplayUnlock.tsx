/**
 * Autoplay Unlock Overlay
 * ALWAYS shows when user joins a room.
 * User MUST tap once to unlock browser autoplay.
 * After one tap, all sync events work automatically.
 */

"use client";

import React, { useState } from "react";

interface AutoplayUnlockProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onUnlocked: () => void;
}

export const AutoplayUnlock: React.FC<AutoplayUnlockProps> = ({ videoRef, onUnlocked }) => {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * User taps the unlock button
   * This user gesture enables future programmatic play() calls
   */
  const handleUnlock = async () => {
    setUnlocking(true);
    setError(null);

    const video = videoRef.current;
    if (!video) {
      // Video not mounted yet - still unlock via a dummy audio context
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          await ctx.resume();
          ctx.close();
        }
        onUnlocked();
      } catch {
        setError("Video not ready. Please wait and try again.");
        setUnlocking(false);
      }
      return;
    }

    try {
      // Step 1: Muted play (always works after user gesture)
      video.muted = true;
      await video.play();

      // Step 2: Pause immediately
      video.pause();

      // Step 3: Unmute for future plays
      video.muted = false;
      video.currentTime = 0;

      // Success - browser now trusts this page for playback
      onUnlocked();
    } catch {
      // Fallback: try AudioContext unlock
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          await ctx.resume();
          ctx.close();
        }
        // Even if video play failed, the gesture is registered
        onUnlocked();
      } catch {
        setError("Could not enable playback. Tap again.");
        setUnlocking(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="max-w-sm w-full mx-6 text-center">
        {/* Play Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-blue-600/30 border-2 border-blue-500 flex items-center justify-center animate-pulse">
            <svg
              className="w-12 h-12 text-blue-400 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-white text-2xl font-bold mb-3">
          Enable Watch Sync
        </h2>

        {/* Subtitle */}
        <p className="text-gray-400 text-base mb-8 leading-relaxed">
          Tap below to allow synced playback with your friends.
          <br />
          <span className="text-gray-500 text-sm">You only need to do this once per session.</span>
        </p>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-900/20 p-3 rounded-lg">{error}</p>
        )}

        {/* BIG Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white font-bold py-5 px-8 rounded-2xl text-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-600/30"
        >
          {unlocking ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Enabling...
            </span>
          ) : (
            "▶  Tap to Start Watching"
          )}
        </button>

        {/* Info */}
        <p className="text-gray-600 text-xs mt-6">
          Browser requires one tap to allow video playback
        </p>
      </div>
    </div>
  );
};
