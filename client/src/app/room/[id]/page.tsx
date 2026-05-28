"use client";

/**
 * Room Page [id]
 * Main watching experience - video player with sync
 *
 * Flow:
 * 1. Connect to socket
 * 2. Get/create userId from session
 * 3. Show autoplay unlock overlay (one-time)
 * 4. Join room via socket
 * 5. After unlock, all sync events work automatically
 */

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { socketClient } from "../../../lib/socket";
import { useRoom } from "../../../hooks/useRoom";
import { useVideoSync } from "../../../hooks/useVideoSync";
import { VideoPlayer } from "../../../components/VideoPlayer";
import { RoomHeader } from "../../../components/RoomHeader";
import { UsersConnected } from "../../../components/UsersConnected";
import { AutoplayUnlock } from "../../../components/AutoplayUnlock";
import { SOCKET_EVENTS } from "../../../../shared/constants";

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = params.id as string;
  const roomCode = searchParams.get("code") || "UNKNOWN";

  // Video player ref
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // State
  const [userId, setUserId] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>(
    "https://www.w3schools.com/html/mov_bbb.mp4"
  );
  const [urlInput, setUrlInput] = useState<string>(videoUrl);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [playbackUnlocked, setPlaybackUnlocked] = useState(false);

  // Custom hooks
  const { room, users, error: roomError, isLoading, joinRoom } = useRoom({
    roomId,
    userId: userId || "",
  });

  const {
    broadcastPlay,
    broadcastPause,
    broadcastSeek,
    markPlaybackReady,
    syncReady,
    syncStatus,
  } = useVideoSync({
    roomId,
    userId: userId || "",
    playerRef: videoPlayerRef,
  });

  /**
   * Initialize on mount
   */
  useEffect(() => {
    let stored = sessionStorage.getItem("userId");
    if (!stored) {
      stored = uuidv4();
      sessionStorage.setItem("userId", stored);
    }
    setUserId(stored);

    const initSocket = async () => {
      try {
        if (!socketClient.getIsConnected()) {
          await socketClient.connect();
          setIsConnected(true);
        } else {
          setIsConnected(true);
        }
      } catch (err) {
        console.error("[ROOM] Socket connection failed:", err);
      }
    };

    initSocket();
  }, []);

  /**
   * Join room when userId and socket are ready
   */
  useEffect(() => {
    if (userId && isConnected) {
      joinRoom();
    }
  }, [userId, isConnected, joinRoom]);

  /**
   * Handle autoplay unlock success
   */
  const handlePlaybackUnlocked = () => {
    setPlaybackUnlocked(true);
    markPlaybackReady();
    console.log("[ROOM] ✅ Playback unlocked - sync is now active");
  };

  /**
   * Handle video URL update
   */
  const handleUpdateVideoUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      setVideoUrl(urlInput);
      setShowUrlInput(false);
    }
  };

  /**
   * Handle leave room
   */
  const handleLeaveRoom = () => {
    socketClient.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId, userId });
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">Connecting to room...</p>
          <div className="animate-spin text-4xl">⏳</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 p-4 md:p-6">
      {/* Autoplay Unlock Overlay - shows once */}
      {!playbackUnlocked && (
        <AutoplayUnlock
          videoRef={videoPlayerRef}
          onUnlocked={handlePlaybackUnlocked}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Room Header */}
        {room && (
          <RoomHeader
            roomId={roomId}
            roomCode={roomCode}
            userCount={users.length}
          />
        )}

        {/* Sync Status Banner */}
        {syncStatus === "playback-blocked" && (
          <div className="bg-yellow-900/20 border border-yellow-600 text-yellow-300 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            ⚠️ Playback permission lost.
            <button
              onClick={() => setPlaybackUnlocked(false)}
              className="underline font-semibold"
            >
              Re-enable sync
            </button>
          </div>
        )}

        {/* Sync Ready Indicator */}
        {playbackUnlocked && syncReady && (
          <div className="bg-green-900/20 border border-green-700 text-green-300 p-2 rounded-lg mb-4 text-xs flex items-center gap-2">
            🟢 Sync active — all playback events will sync automatically
          </div>
        )}

        {/* Error Display */}
        {roomError && (
          <div className="bg-red-900/20 border border-red-600 text-red-300 p-4 rounded-lg mb-6">
            {roomError}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <VideoPlayer
                ref={videoPlayerRef}
                videoUrl={videoUrl}
                onPlay={broadcastPlay}
                onPause={broadcastPause}
                onSeek={broadcastSeek}
              />
            </div>

            {/* Video URL Input */}
            <div>
              {!showUrlInput ? (
                <button
                  onClick={() => setShowUrlInput(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
                >
                  + Add/Change Video URL
                </button>
              ) : (
                <form onSubmit={handleUpdateVideoUrl} className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Enter video URL (MP4, WebM, M3U8)"
                    className="flex-1 bg-dark-800 border border-dark-700 text-white px-3 py-2 rounded text-sm"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>

            {/* Video Info */}
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">📹 Video Info</h3>
              <p className="text-gray-400 text-sm break-all">{videoUrl}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {room && (
              <UsersConnected users={users} currentUserId={userId} />
            )}

            <button
              onClick={handleLeaveRoom}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              Leave Room
            </button>

            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">ℹ️ How it works</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Tap "Enable Sync" once to allow playback</li>
                <li>• All play/pause/seek actions sync in real-time</li>
                <li>• Video auto-syncs if drift detected (&gt;500ms)</li>
                <li>• Share room link with friends to join</li>
                <li>• First user becomes host</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
