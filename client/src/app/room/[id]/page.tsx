"use client";

/**
 * Room Page [id]
 * Main watching experience - cinema-style layout
 *
 * Flow:
 * 1. Connect to socket
 * 2. Get/create userId from session
 * 3. Show autoplay unlock overlay (one-time)
 * 4. Join room via socket
 * 5. After unlock, all sync events work automatically
 * 6. MVP3: Voice/video chat, live chat, emoji reactions
 */

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { socketClient } from "../../../lib/socket";
import { useRoom } from "../../../hooks/useRoom";
import { useVideoSync } from "../../../hooks/useVideoSync";
import { useWebRTC } from "../../../hooks/useWebRTC";
import { useChat } from "../../../hooks/useChat";
import { VideoPlayer } from "../../../components/VideoPlayer";
import { RoomHeader } from "../../../components/RoomHeader";
import { UsersConnected } from "../../../components/UsersConnected";
import { AutoplayUnlock } from "../../../components/AutoplayUnlock";
import { CameraBubbles } from "../../../components/CameraBubbles";
import { MediaControls } from "../../../components/MediaControls";
import { ChatPanel } from "../../../components/ChatPanel";
import { EmojiReactions } from "../../../components/EmojiReactions";
import { SOCKET_EVENTS } from "../../../../shared/constants";

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = params.id as string;
  const roomCode = searchParams.get("code") || roomId.substring(0, 6).toUpperCase();

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<"chat" | "people" | "none">("none");
  const [isVideoSticky, setIsVideoSticky] = useState(false);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

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

  // MVP3 - WebRTC voice/video
  const {
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    isSpeaking,
    isInVoice,
    peers,
    localStream,
    permissionError,
  } = useWebRTC({ roomId, userId: userId || "" });

  // MVP3 - Chat & reactions
  const { messages, sendMessage, sendReaction, reactions } = useChat({
    roomId,
    userId: userId || "",
  });

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset unread when chat opens
  useEffect(() => {
    if (isChatOpen || mobileTab === "chat") {
      setUnreadCount(0);
    }
  }, [isChatOpen, mobileTab]);

  // Sticky video detection on mobile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      if (videoWrapperRef.current) {
        const rect = videoWrapperRef.current.getBoundingClientRect();
        setIsVideoSticky(rect.top <= 0);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
   * Listen for video change from other users
   */
  useEffect(() => {
    const handleVideoChanged = (data: { userId: string; videoUrl: string }) => {
      if (data.userId !== userId) {
        console.log(`[ROOM] Video changed by ${data.userId.substring(0, 6)} to: ${data.videoUrl}`);
        setVideoUrl(data.videoUrl);
        setUrlInput(data.videoUrl);
      }
    };

    socketClient.on("video-changed" as any, handleVideoChanged);
    return () => {
      socketClient.off("video-changed" as any, handleVideoChanged);
    };
  }, [userId]);

  /**
   * Handle autoplay unlock success
   */
  const handlePlaybackUnlocked = () => {
    setPlaybackUnlocked(true);
    markPlaybackReady();
    console.log("[ROOM] ✅ Playback unlocked - sync is now active");
  };

  /**
   * Handle video URL update - broadcast to all users in room
   */
  const handleUpdateVideoUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      setVideoUrl(urlInput);
      setShowUrlInput(false);
      // Broadcast video change to all users
      socketClient.emit("video-change" as any, { roomId, userId, videoUrl: urlInput });
    }
  };

  /**
   * Handle leave room
   */
  const handleLeaveRoom = () => {
    // Leave voice if in voice
    if (isInVoice) {
      leaveVoice();
    }
    socketClient.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId, userId });
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
          <p className="text-gray-300 text-lg font-medium">Connecting to room...</p>
          <p className="text-gray-500 text-sm mt-2">Setting up sync</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 md:p-5 lg:p-6">
      {/* Autoplay Unlock Overlay - shows once */}
      {!playbackUnlocked && (
        <AutoplayUnlock
          videoRef={videoPlayerRef}
          onUnlocked={handlePlaybackUnlocked}
        />
      )}

      <div className="max-w-[1600px] mx-auto">
        {/* Room Header */}
        {room && (
          <RoomHeader
            roomId={roomId}
            roomCode={roomCode}
            userCount={users.length}
          />
        )}

        {/* Sync Status Banners */}
        {syncStatus === "playback-blocked" && (
          <div className="glass-card rounded-xl p-3 mb-4 border-amber-500/20 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-amber-300 text-sm flex-1">Playback permission lost.</p>
              <button
                onClick={() => setPlaybackUnlocked(false)}
                className="text-amber-400 hover:text-amber-300 text-sm font-semibold px-3 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
              >
                Re-enable
              </button>
            </div>
          </div>
        )}

        {playbackUnlocked && syncReady && (
          <div className="glass-card rounded-xl p-2.5 mb-4 border-emerald-500/20 animate-fade-in">
            <div className="flex items-center gap-2.5 px-2">
              <div className="relative">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" />
              </div>
              <p className="text-emerald-400 text-xs font-medium">Sync active — playback events sync in real-time</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {roomError && (
          <div className="glass-card rounded-xl p-4 mb-5 border-red-500/20 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-red-300 text-sm">{roomError}</p>
            </div>
          </div>
        )}

        {/* Main Content - Cinema Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 pb-20 lg:pb-0">
          {/* Video Player Area */}
          <div className="space-y-4">
            {/* Sticky Video Wrapper (mobile) */}
            <div
              ref={videoWrapperRef}
              className={`video-sticky-wrapper ${isVideoSticky ? "is-sticky" : ""}`}
            >
              <div className="relative">
                <VideoPlayer
                  ref={videoPlayerRef}
                  videoUrl={videoUrl}
                  onPlay={broadcastPlay}
                  onPause={broadcastPause}
                  onSeek={broadcastSeek}
                />

              {/* Camera Bubbles - top right over video */}
              <CameraBubbles
                peers={peers.map((p) => ({
                  peerId: p.peerId,
                  stream: p.stream,
                  isMicOn: p.isMicOn,
                  isCameraOn: p.isCameraOn,
                }))}
                localStream={localStream}
                isCameraOn={isCameraOn}
                currentUserId={userId}
              />

              {/* Emoji Reactions Overlay */}
              <EmojiReactions reactions={reactions} />
              </div>
            </div>

            {/* Media Controls - Voice/Camera */}
            <MediaControls
              isInVoice={isInVoice}
              isMicOn={isMicOn}
              isCameraOn={isCameraOn}
              isSpeaking={isSpeaking}
              onJoinVoice={joinVoice}
              onLeaveVoice={leaveVoice}
              onToggleMic={toggleMic}
              onToggleCamera={toggleCamera}
              permissionError={permissionError}
            />

            {/* Video URL Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {!showUrlInput ? (
                <>
                  <button
                    onClick={() => setShowUrlInput(true)}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary-400 text-sm font-medium transition-colors px-3 py-2 rounded-xl hover:bg-surface-glass-hover"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.556a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.69" />
                    </svg>
                    Paste URL
                  </button>
                  <button
                    onClick={async () => {
                      const API_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
                      try {
                        const res = await fetch(`${API_URL}/api/videos`);
                        const data = await res.json();
                        if (data.success && data.data.length > 0) {
                          const readyVideos = data.data.filter((v: any) => v.status === "ready");
                          if (readyVideos.length === 0) {
                            alert("No videos ready yet. Upload and process a video first.");
                            return;
                          }
                          const names = readyVideos.map((v: any, i: number) => `${i + 1}. ${v.originalName}`).join("\n");
                          const choice = prompt(`Select a video (enter number):\n\n${names}`);
                          if (choice) {
                            const idx = parseInt(choice) - 1;
                            if (idx >= 0 && idx < readyVideos.length) {
                              setVideoUrl(readyVideos[idx].streamPath);
                              setUrlInput(readyVideos[idx].streamPath);
                              // Broadcast video change to all users
                              socketClient.emit("video-change" as any, { roomId, userId, videoUrl: readyVideos[idx].streamPath });
                            }
                          }
                        } else {
                          alert("No videos in library. Go to /upload to add videos.");
                        }
                      } catch {
                        alert("Could not fetch video library. Is the server running?");
                      }
                    }}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary-400 text-sm font-medium transition-colors px-3 py-2 rounded-xl hover:bg-surface-glass-hover"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125" />
                    </svg>
                    Browse Library
                  </button>
                </>
              ) : (
                <form onSubmit={handleUpdateVideoUrl} className="flex gap-2 flex-1 animate-slide-up">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Enter video URL (MP4, WebM, M3U8)"
                    className="flex-1 bg-dark-900/80 border border-surface-glass-border text-white px-4 py-2.5 rounded-xl text-sm placeholder-gray-500 focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(false)}
                    className="px-3 py-2.5 text-gray-400 hover:text-white hover:bg-surface-glass-hover rounded-xl text-sm transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Chat Toggle Button (mobile-friendly) */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`w-full flex items-center justify-between py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                isChatOpen
                  ? "bg-primary-600/20 text-primary-400 border border-primary-500/30"
                  : "glass-card text-gray-300 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                {isChatOpen ? "Hide Chat" : "Show Chat"}
              </span>
              {!isChatOpen && unreadCount > 0 && (
                <span className="bg-primary-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Chat Panel - toggleable */}
            {isChatOpen && (
              <ChatPanel
                messages={messages}
                currentUserId={userId}
                onSendMessage={sendMessage}
                onSendReaction={sendReaction}
              />
            )}

            {/* Users */}
            {room && (
              <UsersConnected
                users={users}
                currentUserId={userId}
                mediaStates={peers.map((p) => ({
                  oderId: p.peerId,
                  isMicOn: p.isMicOn,
                  isCameraOn: p.isCameraOn,
                  isSpeaking: p.isSpeaking,
                  isInVoice: true,
                }))}
                localMediaState={{
                  isInVoice,
                  isMicOn,
                  isCameraOn,
                  isSpeaking,
                }}
              />
            )}

            {/* Leave Room - subtle */}
            <button
              onClick={handleLeaveRoom}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 bg-surface-glass hover:bg-red-500/10 border border-surface-glass-border hover:border-red-500/20 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Leave Room
            </button>

            {/* How it works */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                How it works
              </h3>
              <ul className="text-gray-400 text-xs space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">•</span>
                  Tap &quot;Start Watching&quot; once to enable sync
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">•</span>
                  All play/pause/seek actions sync in real-time
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">•</span>
                  Join Voice to talk with friends while watching
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">•</span>
                  Use Chat to send messages and emoji reactions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">•</span>
                  Share room link with friends to join
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="mobile-tab-bar lg:hidden">
        <div className="flex items-center justify-around">
          {/* Voice Button */}
          <button
            onClick={isInVoice ? leaveVoice : joinVoice}
            className={`tab-btn ${isInVoice ? "active" : ""}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            <span>{isInVoice ? "In Voice" : "Voice"}</span>
          </button>

          {/* Chat Button */}
          <button
            onClick={() => setMobileTab(mobileTab === "chat" ? "none" : "chat")}
            className={`tab-btn relative ${mobileTab === "chat" ? "active" : ""}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span>Chat</span>
            {unreadCount > 0 && mobileTab !== "chat" && (
              <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Emoji Reactions */}
          <div className="flex items-center gap-1">
            {["😂", "❤️", "🔥", "😱"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-lg p-1.5 hover:scale-125 active:scale-90 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* People Button */}
          <button
            onClick={() => setMobileTab(mobileTab === "people" ? "none" : "people")}
            className={`tab-btn ${mobileTab === "people" ? "active" : ""}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span>{users.length}</span>
          </button>
        </div>
      </div>

      {/* Mobile Chat Panel (slides up from bottom) */}
      {mobileTab === "chat" && (
        <div className="chat-mobile-panel lg:hidden">
          <ChatPanel
            messages={messages}
            currentUserId={userId}
            onSendMessage={sendMessage}
            onSendReaction={sendReaction}
          />
        </div>
      )}

      {/* Mobile People Panel */}
      {mobileTab === "people" && (
        <div className="chat-mobile-panel lg:hidden">
          <div className="p-4">
            {room && (
              <UsersConnected
                users={users}
                currentUserId={userId}
                mediaStates={peers.map((p) => ({
                  oderId: p.peerId,
                  isMicOn: p.isMicOn,
                  isCameraOn: p.isCameraOn,
                  isSpeaking: p.isSpeaking,
                  isInVoice: true,
                }))}
                localMediaState={{
                  isInVoice,
                  isMicOn,
                  isCameraOn,
                  isSpeaking,
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
