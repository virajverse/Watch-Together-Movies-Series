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
 * - HLS.js integration for .m3u8 streams
 * - Quality selector for adaptive streaming
 */

"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { QualitySelector } from "./QualitySelector";

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
    const hlsRef = useRef<Hls | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHLS, setIsHLS] = useState(false);
    const [qualities, setQualities] = useState<string[]>([]);
    const [currentQuality, setCurrentQuality] = useState("auto");
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
     * Initialize HLS.js or native video based on URL
     */
    useEffect(() => {
      const video = internalRef.current;
      if (!video || !videoUrl) return;

      // Cleanup previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isM3U8 = videoUrl.endsWith(".m3u8");
      setIsHLS(isM3U8);

      if (isM3U8 && Hls.isSupported()) {
        // Use HLS.js for .m3u8 streams
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: -1, // Auto quality
          capLevelToPlayerSize: true,
        });

        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          // Extract available qualities
          const levels = data.levels.map((level) => {
            return `${level.height}p`;
          });
          setQualities([...new Set(levels)]);
          console.log("[HLS] Available qualities:", levels);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const level = hls.levels[data.level];
          if (level) {
            console.log(`[HLS] Quality switched to: ${level.height}p`);
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error("[HLS] Fatal error:", data.type, data.details);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (isM3U8 && video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        video.src = videoUrl;
        setQualities([]);
      } else {
        // Regular video file (mp4, webm, etc.)
        video.src = videoUrl;
        setQualities([]);
        setIsHLS(false);
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [videoUrl]);

    /**
     * Handle quality change
     */
    const handleQualityChange = useCallback((quality: string) => {
      setCurrentQuality(quality);

      if (!hlsRef.current) return;

      if (quality === "auto") {
        hlsRef.current.currentLevel = -1; // Auto
      } else {
        // Find the level index matching the quality
        const targetHeight = parseInt(quality.replace("p", ""));
        const levelIndex = hlsRef.current.levels.findIndex(
          (level) => level.height === targetHeight
        );
        if (levelIndex !== -1) {
          hlsRef.current.currentLevel = levelIndex;
        }
      }
    }, []);

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
      if (!isFinite(seconds)) return "00:00";
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
          if (containerRef.current.requestFullscreen) {
            await containerRef.current.requestFullscreen();
          } else if ((containerRef.current as any).webkitRequestFullscreen) {
            await (containerRef.current as any).webkitRequestFullscreen();
          }
          setIsFullscreen(true);
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
          setIsFullscreen(false);
        }
      } catch (err) {
        console.error("[VIDEO] Fullscreen error:", err);
      }
    };

    return (
      <div
        ref={containerRef}
        className={`relative w-full bg-dark-900 rounded-lg overflow-hidden ${
          isFullscreen ? "fixed inset-0 z-50" : ""
        }`}
      >
        {/* Video Element */}
        <video
          ref={internalRef}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={() => onSeek?.()}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full h-full"
          playsInline
          preload="auto"
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
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
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

            {/* Right: Quality + Fullscreen */}
            <div className="flex items-center gap-2">
              {/* Quality Selector (only for HLS) */}
              {isHLS && qualities.length > 0 && (
                <QualitySelector
                  qualities={qualities}
                  currentQuality={currentQuality}
                  onQualityChange={handleQualityChange}
                />
              )}

              {/* Fullscreen */}
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
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
