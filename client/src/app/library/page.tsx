/**
 * Video Library Page (MVP2 - R2 Rewrite)
 * Grid of uploaded videos with status and actions
 * Thumbnails and stream URLs are now R2 public URLs
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
    // streamPath is now the full R2 public URL
    const streamUrl = video.streamPath || "";
    if (!streamUrl) {
      alert("Stream URL not available yet.");
      return;
    }
    navigator.clipboard.writeText(streamUrl);
    alert(`Stream URL copied!\n\n${streamUrl}\n\nPaste this in a Watch Room.`);
  };

  /**
   * Get status badge color
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-600 text-green-100";
      case "processing":
        return "bg-purple-600 text-purple-100";
      case "uploading":
        return "bg-blue-600 text-blue-100";
      case "failed":
        return "bg-red-600 text-red-100";
      default:
        return "bg-gray-600 text-gray-100";
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
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Video Library</h1>
            <p className="text-gray-400">
              {videos.length} video{videos.length !== 1 ? "s" : ""} uploaded
            </p>
          </div>
          <button
            onClick={() => router.push("/upload")}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
          >
            + Upload Video
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-gray-400">Loading videos...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-800 mb-6">
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => { setError(null); fetchVideos(); }}
              className="mt-2 text-sm text-red-400 hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && videos.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-xl font-medium mb-2">No videos yet</h2>
            <p className="text-gray-400 mb-6">Upload your first video to get started</p>
            <button
              onClick={() => router.push("/upload")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
            >
              Upload Video
            </button>
          </div>
        )}

        {/* Video Grid */}
        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition group"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-800">
                  {video.status === "ready" && video.thumbnailPath ? (
                    <img
                      src={video.thumbnailPath}
                      alt={video.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {video.status === "processing" && (
                        <div className="text-center">
                          <div className="animate-spin text-3xl mb-2">⚙️</div>
                          <p className="text-gray-400 text-sm">Processing...</p>
                        </div>
                      )}
                      {video.status === "uploading" && (
                        <div className="text-center">
                          <div className="animate-pulse text-3xl mb-2">📤</div>
                          <p className="text-gray-400 text-sm">Uploading...</p>
                        </div>
                      )}
                      {video.status === "failed" && (
                        <div className="text-center">
                          <div className="text-3xl mb-2">❌</div>
                          <p className="text-red-400 text-sm">Failed</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duration overlay */}
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs">
                      {formatDuration(video.duration)}
                    </span>
                  )}

                  {/* Status badge */}
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(video.status)}`}
                  >
                    {video.status}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-medium text-sm truncate mb-1" title={video.originalName}>
                    {video.originalName}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{formatSize(video.fileSize)}</span>
                    {video.qualities && video.qualities.length > 0 && (
                      <span>{video.qualities[video.qualities.length - 1]}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {video.status === "ready" && (
                      <button
                        onClick={() => handleUseInRoom(video)}
                        className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition"
                      >
                        Use in Room
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 rounded text-xs text-red-300 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            ← Back to Home
          </button>
          <button
            onClick={() => router.push("/upload")}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            Upload Video →
          </button>
        </div>
      </div>
    </div>
  );
}
