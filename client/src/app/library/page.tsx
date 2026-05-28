/**
 * Video Library Page (MVP2 - R2 Rewrite)
 * Netflix-style grid with premium cards
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { VideoFile } from "../../../shared/types";

export default function LibraryPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

  /**
   * Fetch videos from API
   */
  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/videos`);
      const data = await res.json();
      if (data.success) {
        setVideos(data.data);
      } else {
        setError(data.error || "Failed to fetch videos");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchVideos();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchVideos, 5000);
    return () => clearInterval(interval);
  }, [fetchVideos]);

  /**
   * Delete a video
   */
  const handleDelete = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;

    try {
      const res = await fetch(`${API_URL}/api/videos/${videoId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setVideos((prev) => prev.filter((v) => v.id !== videoId));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  /**
   * Copy stream URL to clipboard for use in a room
   */
  const handleUseInRoom = (video: VideoFile) => {
    const streamUrl = video.streamPath || "";
    if (!streamUrl) {
      alert("Stream URL not available yet.");
      return;
    }
    navigator.clipboard.writeText(streamUrl);
    alert(`Stream URL copied!\n\n${streamUrl}\n\nPaste this in a Watch Room.`);
  };

  /**
   * Get status badge styles
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "processing":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "uploading":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  /**
   * Format file size
   */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  /**
   * Format duration
   */
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-1">Video Library</h1>
            <p className="text-gray-400 text-sm">
              {videos.length} video{videos.length !== 1 ? "s" : ""} uploaded
            </p>
          </div>
          <button
            onClick={() => router.push("/upload")}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Upload Video
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
            <p className="text-gray-400 text-sm">Loading your library...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-card rounded-2xl p-5 border-red-500/20 mb-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
              <button
                onClick={() => { setError(null); fetchVideos(); }}
                className="text-red-400 hover:text-red-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && videos.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-dark-700/50 border border-surface-glass-border flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No videos yet</h2>
            <p className="text-gray-400 text-sm mb-6">Upload your first video to start streaming with friends</p>
            <button
              onClick={() => router.push("/upload")}
              className="btn-primary text-sm"
            >
              Upload Video
            </button>
          </div>
        )}

        {/* Video Grid - Netflix style */}
        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="glass-card rounded-2xl overflow-hidden group hover:border-primary-500/30 hover:shadow-glow-sm transition-all duration-300 hover:scale-[1.02] animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-dark-900 overflow-hidden">
                  {video.status === "ready" && video.thumbnailPath ? (
                    <img
                      src={video.thumbnailPath}
                      alt={video.originalName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-dark-800 to-dark-900">
                      {video.status === "processing" && (
                        <div className="text-center">
                          <svg className="w-8 h-8 text-purple-400 mx-auto mb-2 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L6.75 2.906m12.058 14.96l-1.149-.964M5.106 6.214l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514" />
                          </svg>
                          <p className="text-gray-400 text-xs">Processing...</p>
                        </div>
                      )}
                      {video.status === "uploading" && (
                        <div className="text-center">
                          <svg className="w-8 h-8 text-blue-400 mx-auto mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          <p className="text-gray-400 text-xs">Uploading...</p>
                        </div>
                      )}
                      {video.status === "failed" && (
                        <div className="text-center">
                          <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          <p className="text-red-400 text-xs">Failed</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gradient overlay at bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-dark-900/90 to-transparent pointer-events-none" />

                  {/* Duration badge */}
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-medium text-white border border-white/10">
                      {formatDuration(video.duration)}
                    </span>
                  )}

                  {/* Status badge */}
                  <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge(video.status)}`}>
                    {video.status}
                  </span>

                  {/* Play button overlay on hover */}
                  {video.status === "ready" && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={() => handleUseInRoom(video)}
                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all duration-200"
                      >
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-medium text-sm text-white truncate mb-1.5" title={video.originalName}>
                    {video.originalName}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatSize(video.fileSize)}</span>
                    {video.qualities && video.qualities.length > 0 && (
                      <span className="text-primary-400 font-medium">{video.qualities[video.qualities.length - 1]}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3.5">
                    {video.status === "ready" && (
                      <button
                        onClick={() => handleUseInRoom(video)}
                        className="flex-1 px-3 py-2 bg-primary-600/20 hover:bg-primary-600/30 border border-primary-500/20 hover:border-primary-500/40 rounded-xl text-xs font-medium text-primary-300 transition-all duration-200"
                      >
                        Use in Room
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="px-3 py-2 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl text-xs text-gray-500 hover:text-red-400 transition-all duration-200"
                      title="Delete video"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-center gap-6">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            Home
          </button>
          <span className="text-dark-600">•</span>
          <button
            onClick={() => router.push("/upload")}
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
