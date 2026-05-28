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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-dark-950/95 backdrop-blur-xl animate-fade-in">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-sm w-full mx-6 text-center relative z-10 animate-scale-in">
        {/* Play Icon with pulse */}
        <div className="mb-8">
          <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-primary-500/20 to-accent-purple/20 border border-primary-500/30 flex items-center justify-center animate-pulse-glow relative">
            {/* Outer ring animation */}
            <div className="absolute inset-0 rounded-full border-2 border-primary-400/20 animate-ping" />
            <svg
              className="w-14 h-14 text-primary-400 ml-1.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold mb-3 gradient-text">
          Enable Watch Sync
        </h2>

        {/* Subtitle */}
        <p className="text-gray-400 text-base mb-8 leading-relaxed">
          Tap below to allow synced playback with your friends
          <br />
          <span className="text-gray-500 text-sm">One tap per session is all it takes</span>
        </p>

        {/* Error */}
        {error && (
          <div className="glass-card rounded-xl p-3 mb-5 border-red-500/20 animate-slide-up">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* BIG Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="w-full bg-gradient-to-r from-primary-600 via-primary-500 to-accent-purple text-white font-bold py-5 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-glow-lg active:scale-95 disabled:opacity-60 disabled:cursor-wait disabled:transform-none shadow-glow-md"
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
            <span className="flex items-center justify-center gap-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start Watching
            </span>
          )}
        </button>

        {/* Info */}
        <p className="text-gray-600 text-xs mt-6">
          Browser requires one interaction to allow video playback
        </p>
      </div>
    </div>
  );
};
