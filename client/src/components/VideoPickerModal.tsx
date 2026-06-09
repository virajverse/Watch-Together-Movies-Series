"use client";

/**
 * VideoPickerModal
 * Shows uploaded R2 videos (status=ready) so user can select one for the room
 */

import React, { useEffect, useState, useCallback } from "react";
import type { VideoFile } from "../../shared/types";

interface VideoPickerModalProps {
  onSelect: (streamUrl: string) => void;
  onClose: () => void;
}

const API_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
    : "http://localhost:3001";

function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function VideoPickerModal({ onSelect, onClose }: VideoPickerModalProps) {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/videos`);
      const data = await res.json();
      if (data.success) {
        // Only show ready videos
        setVideos((data.data as VideoFile[]).filter((v) => v.status === "ready"));
      } else {
        setError(data.error || "Failed to load videos");
      }
    } catch {
      setError("Cannot reach server. Make sure server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-dark-950/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
      onClick={handleBackdrop}
    >
      <div className="w-full sm:max-w-lg bg-dark-900 border border-surface-glass-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-glass-border flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">Select Video</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {loading ? "Loading..." : `${videos.length} video${videos.length !== 1 ? "s" : ""} ready`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-glass-hover text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
              <p className="text-gray-400 text-sm">Loading library...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="p-5">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-red-300 text-sm mb-3">{error}</p>
                <button
                  onClick={fetchVideos}
                  className="text-xs text-red-400 hover:text-red-300 font-medium underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && videos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-dark-800 border border-surface-glass-border flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5" />
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-medium mb-1">No videos ready yet</p>
                <p className="text-gray-500 text-xs">
                  Upload a video from the Library page and wait for processing to complete.
                </p>
              </div>
            </div>
          )}

          {/* Video List */}
          {!loading && !error && videos.length > 0 && (
            <div className="p-3 space-y-2">
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => {
                    if (video.streamPath) {
                      onSelect(video.streamPath);
                    }
                  }}
                  disabled={!video.streamPath}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-800/60 hover:bg-dark-700/80 border border-surface-glass-border hover:border-primary-500/40 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-12 rounded-lg overflow-hidden bg-dark-900 flex-shrink-0 relative">
                    {video.thumbnailPath ? (
                      <img
                        src={video.thumbnailPath}
                        alt={video.originalName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                    )}
                    {/* Play icon overlay on hover */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg">
                      <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate leading-tight">
                      {video.originalName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500 text-[11px]">{formatSize(video.fileSize)}</span>
                      {video.duration && (
                        <>
                          <span className="text-dark-600 text-[10px]">•</span>
                          <span className="text-gray-500 text-[11px]">{formatDuration(video.duration)}</span>
                        </>
                      )}
                      {video.qualities && video.qualities.length > 0 && (
                        <>
                          <span className="text-dark-600 text-[10px]">•</span>
                          <span className="text-primary-400 text-[11px] font-medium">
                            {video.qualities[video.qualities.length - 1]}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-primary-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
