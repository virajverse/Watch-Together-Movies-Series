"use client";

/**
 * Autoplay Unlock Overlay
 * 
 * This component solves the browser autoplay restriction problem.
 * 
 * How it works:
 * 1. Shows overlay with "Tap to Start Watching" button
 * 2. On tap (user gesture), it:
 *    a. Gets the video element from parent via ref
 *    b. Does: video.muted = true → video.play() → video.pause() → video.muted = false
 *    c. This registers the user gesture with the browser
 *    d. After this, ALL future programmatic video.play() calls will work
 * 3. Calls onUnlocked() to notify parent
 * 4. Parent then syncs to room state (seek + play if needed)
 * 
 * This only needs to happen ONCE per page load.
 * After unlock, remote play/pause/seek events work automatically.
 */

import React, { useState } from "react";

interface AutoplayUnlockProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onUnlocked: () => void;
}

export const AutoplayUnlock: React.FC<AutoplayUnlockProps> = ({ videoRef, onUnlocked }) => {
  const [status, setStatus] = useState<"idle" | "unlocking" | "failed">("idle");

  const handleUnlock = async () => {
    setStatus("unlocking");

    const video = videoRef.current;

    if (video) {
      try {
        // Step 1: Mute and play (this ALWAYS works with user gesture)
        video.muted = true;
        await video.play();

        // Step 2: Immediately pause
        video.pause();

        // Step 3: Unmute for future plays
        video.muted = false;

        // SUCCESS: Browser now allows programmatic play() on this video element
        console.log("[AUTOPLAY] ✅ Browser autoplay unlocked via user gesture");
        onUnlocked();
        return;
      } catch (e) {
        console.warn("[AUTOPLAY] Video play failed, trying AudioContext fallback");
      }
    }

    // Fallback: Unlock via AudioContext (works even without video element)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        oscillator.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.001); // Tiny sound
        await ctx.close();
      }
      console.log("[AUTOPLAY] ✅ AudioContext unlocked as fallback");
      onUnlocked();
    } catch {
      // Last resort: just unlock anyway — user tapped, gesture is registered
      console.log("[AUTOPLAY] ⚠️ Fallback unlock — gesture registered");
      onUnlocked();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-dark-950/95 backdrop-blur-xl animate-fade-in">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-sm w-full mx-6 text-center relative z-10 animate-scale-in">
        {/* Play Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary-500/20 to-accent-purple/20 border border-primary-500/30 flex items-center justify-center animate-pulse-glow relative">
            <div className="absolute inset-0 rounded-full border-2 border-primary-400/20 animate-ping" />
            <svg className="w-12 h-12 text-primary-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-2 gradient-text">
          Tap to Start Watching
        </h2>

        {/* Subtitle */}
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          This enables synced playback with everyone in the room.
          <br />
          <span className="text-gray-500 text-xs">You only need to do this once.</span>
        </p>

        {/* Error state */}
        {status === "failed" && (
          <p className="text-red-400 text-xs mb-4">Playback permission required. Tap again.</p>
        )}

        {/* Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={status === "unlocking"}
          className="w-full bg-gradient-to-r from-primary-600 via-primary-500 to-accent-purple text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 shadow-glow-md"
        >
          {status === "unlocking" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Enabling...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start Watching
            </span>
          )}
        </button>

        <p className="text-gray-600 text-[10px] mt-5">
          Browser requires one tap to allow video playback
        </p>
      </div>
    </div>
  );
};
