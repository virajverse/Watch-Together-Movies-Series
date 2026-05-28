/**
 * Video Player Component
 * Premium player with hover controls, sleek progress bar, HLS support
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
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Merge refs
    useEffect(() => {
      if (typeof ref === "function") {
        ref(internalRef.current);
      } else if (ref) {
        ref.current = internalRef.current;
      }
    }, [ref]);

    /**
     * Auto-hide controls
     */
    const resetControlsTimeout = useCallback(() => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    }, [isPlaying]);

    const handleMouseMove = () => {
      resetControlsTimeout();
    };

    const handleMouseLeave = () => {
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 1000);
      }
    };

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
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: -1,
          capLevelToPlayerSize: true,
        });

        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          const levels = data.levels.map((level) => `${level.height}p`);
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
        video.src = videoUrl;
        setQualities([]);
      } else {
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
        hlsRef.current.currentLevel = -1;
      } else {
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
          internalRef.current.currentTime = externalCurrentTime;
        }
      }
    }, [externalCurrentTime]);

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
      onPause?.();
    };

    const handleSeek = (time: number) => {
      if (internalRef.current) {
        internalRef.current.currentTime = time;
        setCurrentTime(time);
        onSeek?.();
      }
    };

    const handleTimeUpdate = () => {
      if (internalRef.current) {
        const time = internalRef.current.currentTime;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }
    };

    const handleLoadedMetadata = () => {
      if (internalRef.current) {
        setDuration(internalRef.current.duration);
      }
    };

    const formatTime = (seconds: number) => {
      if (!isFinite(seconds)) return "0:00";
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

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

    const toggleMute = () => {
      if (internalRef.current) {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        internalRef.current.muted = newMuted;
      }
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full bg-black rounded-2xl overflow-hidden group ${
          isFullscreen ? "fixed inset-0 z-50 rounded-none" : "aspect-video"
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
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          className="w-full h-full object-contain"
          playsInline
          preload="auto"
        />

        {/* Buffering Spinner */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-12 h-12 border-3 border-white/20 border-t-primary-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Center Play Button (when paused) */}
        {!isPlaying && !isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => internalRef.current?.play()}
              className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all duration-300 group/play"
            >
              <svg className="w-8 h-8 md:w-10 md:h-10 text-white ml-1 group-hover/play:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}

        {/* Quality Badge (top-right) */}
        {isHLS && currentQuality !== "auto" && (
          <div className={`absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
            {currentQuality}
          </div>
        )}

        {/* Controls Overlay */}
        <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          {/* Gradient background */}
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-4 px-4 md:px-5">
            {/* Progress Bar */}
            <div className="mb-3 group/progress">
              <div
                className="relative bg-white/20 h-1 group-hover/progress:h-1.5 rounded-full cursor-pointer transition-all duration-200"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  handleSeek(percent * duration);
                }}
              >
                {/* Buffered (could be added) */}
                {/* Progress fill */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
                {/* Scrubber dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity duration-200"
                  style={{ left: `calc(${progressPercent}% - 6px)` }}
                />
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between gap-3">
              {/* Left Controls */}
              <div className="flex items-center gap-2 md:gap-3">
                {/* Play/Pause */}
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
                  className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-all duration-200"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Volume */}
                <div className="flex items-center gap-1.5 group/vol">
                  <button
                    onClick={toggleMute}
                    className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                  >
                    {isMuted || volume === 0 ? (
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                      </svg>
                    ) : (
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      setIsMuted(val === 0);
                      if (internalRef.current) {
                        internalRef.current.volume = val;
                        internalRef.current.muted = val === 0;
                      }
                    }}
                    className="w-0 group-hover/vol:w-20 opacity-0 group-hover/vol:opacity-100 transition-all duration-300 cursor-pointer"
                  />
                </div>

                {/* Time Display */}
                <span className="text-white/80 text-xs md:text-sm font-medium tabular-nums">
                  {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
                </span>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1.5 md:gap-2">
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
                  className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                  title="Fullscreen"
                >
                  {isFullscreen ? (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
