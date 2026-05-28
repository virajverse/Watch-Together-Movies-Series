/**
 * Video Player Component
 * Custom wrapper around HTML5 video with sync controls
 *
 * Features:
 * - Play/Pause with broadcast
 * - Seek with broadcast
 * - Time display
 * - Volume control
 * - Fullscreen toggle
 */

import React, { useRef, useEffect, useState } from "react";

interface VideoPlayerProps {
  videoUrl?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  isPlaying?: boolean;
  currentTime?: number;
}

export const VideoPlayer = React.forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    {
      videoUrl,
      onPlay,
      onPause,
      onSeek,
      onTimeUpdate,
      isPlaying: externalIsPlaying,
      currentTime: externalCurrentTime,
    },
    ref
  ) => {
    const internalRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Merge refs
    useEffect(() => {
      if (typeof ref === "function") {
        ref(internalRef.current);
      } else if (ref) {
        ref.current = internalRef.current;
      }
    }, [ref]);

    /**
     * Sync with external playback state
     */
    useEffect(() => {
      if (externalCurrentTime !== undefined && internalRef.current) {
        const diff = Math.abs(internalRef.current.currentTime - externalCurrentTime);
        if (diff > 0.1) {
          // Only update if difference is significant
          internalRef.current.currentTime = externalCurrentTime;
        }
      }
    }, [externalCurrentTime]);

    /**
     * Handle play
     */
    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    /**
     * Handle pause
     */
    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    /**
     * Handle seek
     */
    const handleSeek = (time: number) => {
      if (internalRef.current) {
        internalRef.current.currentTime = time;
        setCurrentTime(time);
        onSeek?.();
      }
    };

    /**
     * Handle time update
     */
    const handleTimeUpdate = () => {
      if (internalRef.current) {
        const time = internalRef.current.currentTime;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }
    };

    /**
     * Handle metadata loaded
     */
    const handleLoadedMetadata = () => {
      if (internalRef.current) {
        setDuration(internalRef.current.duration);
      }
    };

    /**
     * Format time to MM:SS
     */
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    /**
     * Toggle fullscreen
     */
    const toggleFullscreen = async () => {
      if (!containerRef.current) return;

      try {
        if (!isFullscreen) {
          await containerRef.current.requestFullscreen?.() ||
            (containerRef.current as any).webkitRequestFullscreen?.() ||
            (containerRef.current as any).mozRequestFullScreen?.() ||
            (containerRef.current as any).msRequestFullscreen?.();
          setIsFullscreen(true);
        } else {
          await document.exitFullscreen?.() ||
            (document as any).webkitExitFullscreen?.() ||
            (document as any).mozCancelFullScreen?.() ||
            (document as any).msExitFullscreen?.();
          setIsFullscreen(false);
        }
      } catch (err) {
        console.error("[VIDEO] Fullscreen error:", err);
      }
    };

    return (
      <div
        ref={containerRef}
        className={`w-full bg-dark-900 rounded-lg overflow-hidden ${
          isFullscreen ? "fixed inset-0" : ""
        }`}
      >
        {/* Video Element */}
        <video
          ref={internalRef}
          src={videoUrl}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full h-full"
        />

        {/* Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div
              className="bg-gray-700 h-1 rounded cursor-pointer hover:h-2 transition-all"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                handleSeek(percent * duration);
              }}
            >
              <div
                className="bg-red-500 h-full rounded"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between">
            {/* Left: Play/Pause */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (internalRef.current) {
                    if (isPlaying) {
                      internalRef.current.pause();
                    } else {
                      internalRef.current.play();
                    }
                  }
                }}
                className="text-white hover:bg-white/20 p-2 rounded transition"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-1">
                <span className="text-white text-sm">🔊</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (internalRef.current) {
                      internalRef.current.volume = val;
                    }
                  }}
                  className="w-20"
                />
              </div>

              {/* Time Display */}
              <span className="text-white text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right: Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 p-2 rounded transition"
              title="Fullscreen"
            >
              {isFullscreen ? "🗗" : "⛶"}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
