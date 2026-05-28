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
  const [mobileTab, setMobileTab] = useState<"chat" | "reactions" | "members">("chat");
  const [isVideoSticky, setIsVideoSticky] = useState(false);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const [showInviteCopied, setShowInviteCopied] = useState(false);

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
      socketClient.emit("video-change" as any, { roomId, userId, videoUrl: urlInput });
    }
  };

  /**
   * Handle leave room
   */
  const handleLeaveRoom = () => {
    if (isInVoice) {
      leaveVoice();
    }
    socketClient.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId, userId });
    router.push("/");
  };

  /**
   * Copy invite link
   */
  const handleCopyInvite = async () => {
    const roomUrl = `${window.location.origin}/room/${roomId}?code=${roomCode}`;
    try {
      await navigator.clipboard.writeText(roomUrl);
      setShowInviteCopied(true);
      setTimeout(() => setShowInviteCopied(false), 2000);
    } catch (err) {
      console.error("[ROOM] Failed to copy:", err);
    }
  };

  /**
   * Toggle play/pause on video
   */
  const handleTogglePlayPause = () => {
    const video = videoPlayerRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  /**
   * Force sync
   */
  const handleForceSync = () => {
    // Re-broadcast current time to force everyone to sync
    broadcastSeek();
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

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="min-h-screen">
      {/* Autoplay Unlock Overlay - shows once */}
      {!playbackUnlocked && (
        <AutoplayUnlock
          videoRef={videoPlayerRef}
          onUnlocked={handlePlaybackUnlocked}
        />
      )}

      {/* ===== MOBILE LAYOUT (< lg) ===== */}
      <div className="lg:hidden flex flex-col min-h-screen">
        {/* 1. HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-glass-border bg-dark-900/80 backdrop-blur-md sticky top-0 z-50">
          {/* Back button */}
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-glass-hover transition-colors"
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Title */}
          <div className="flex-1 text-center">
            <h1 className="text-white font-semibold text-sm truncate">
              Movie Night 🎬
            </h1>
          </div>

          {/* Right: watching count + invite */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className="text-emerald-400 text-xs font-medium">{users.length} watching</span>
            </div>
            <button
              onClick={handleCopyInvite}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-600/20 hover:bg-primary-600/30 border border-primary-500/30 transition-colors"
            >
              {showInviteCopied ? (
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 2. CAMERA BUBBLES ROW */}
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
          layout="horizontal"
        />

        {/* 3. VIDEO PLAYER */}
        <div ref={videoWrapperRef} className="relative w-full">
          <VideoPlayer
            ref={videoPlayerRef}
            videoUrl={videoUrl}
            onPlay={broadcastPlay}
            onPause={broadcastPause}
            onSeek={broadcastSeek}
          />
          {/* Emoji Reactions Overlay */}
          <EmojiReactions reactions={reactions} />
        </div>

        {/* Sync Status Banner (compact) */}
        {syncStatus === "playback-blocked" && (
          <div className="mx-3 mt-2 glass-card rounded-lg p-2 border-amber-500/20">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-xs">⚠️ Playback blocked</span>
              <button
                onClick={() => setPlaybackUnlocked(false)}
                className="text-amber-400 text-xs font-semibold ml-auto"
              >
                Fix
              </button>
            </div>
          </div>
        )}

        {roomError && (
          <div className="mx-3 mt-2 glass-card rounded-lg p-2 border-red-500/20">
            <p className="text-red-300 text-xs">{roomError}</p>
          </div>
        )}

        {/* 4. TAB BAR */}
        <div className="flex items-center border-b border-surface-glass-border bg-dark-900/60 px-2">
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors relative ${
              mobileTab === "chat" ? "text-primary-400" : "text-gray-400"
            }`}
          >
            💬 Chat
            {unreadCount > 0 && mobileTab !== "chat" && (
              <span className="absolute top-1 right-4 bg-primary-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            {mobileTab === "chat" && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setMobileTab("reactions")}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors relative ${
              mobileTab === "reactions" ? "text-primary-400" : "text-gray-400"
            }`}
          >
            😊 Reactions
            {mobileTab === "reactions" && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setMobileTab("members")}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors relative ${
              mobileTab === "members" ? "text-primary-400" : "text-gray-400"
            }`}
          >
            👥 Members ({users.length})
            {mobileTab === "members" && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary-500 rounded-full" />
            )}
          </button>
        </div>

        {/* 5. TAB CONTENT */}
        <div className="flex-1 overflow-y-auto pb-20">
          {/* Chat Tab */}
          {mobileTab === "chat" && (
            <ChatPanel
              messages={messages}
              currentUserId={userId}
              onSendMessage={sendMessage}
              onSendReaction={sendReaction}
              embedded
            />
          )}

          {/* Reactions Tab */}
          {mobileTab === "reactions" && (
            <div className="p-4 space-y-4">
              {/* Quick reaction grid */}
              <div className="grid grid-cols-4 gap-3">
                {["😂", "❤️", "🔥", "😱", "👍", "😍", "🎉", "😢", "💯", "🙌", "👏", "🤯"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-dark-800/60 hover:bg-dark-700/80 border border-surface-glass-border hover:border-primary-500/30 transition-all active:scale-90"
                  >
                    <span className="text-2xl">{emoji}</span>
                  </button>
                ))}
              </div>

              {/* Recent reactions */}
              {reactions.length > 0 && (
                <div>
                  <h4 className="text-gray-400 text-xs font-medium mb-2">Recent Reactions</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {reactions.slice(-10).reverse().map((r) => (
                      <div key={r.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-dark-800/40">
                        <span className="text-lg">{r.emoji}</span>
                        <span className="text-gray-300 text-xs">
                          {r.userId === userId ? "You" : `User ${r.userId.substring(0, 6)}`}
                        </span>
                        <span className="text-gray-600 text-[10px] ml-auto">
                          {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Members Tab */}
          {mobileTab === "members" && (
            <div className="p-4 space-y-2">
              {users.map((user, index) => {
                const isMe = user.id === userId;
                const peerMedia = peers.find((p) => p.peerId === user.id);
                const mediaState = isMe
                  ? { isMicOn, isCameraOn, isSpeaking, isInVoice }
                  : peerMedia
                  ? { isMicOn: peerMedia.isMicOn, isCameraOn: peerMedia.isCameraOn, isSpeaking: peerMedia.isSpeaking, isInVoice: true }
                  : null;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-dark-800/40 border border-surface-glass-border"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${
                        ["from-blue-500 to-indigo-600", "from-purple-500 to-pink-600", "from-emerald-500 to-teal-600", "from-orange-500 to-red-600", "from-cyan-500 to-blue-600"][index % 5]
                      } flex items-center justify-center text-white text-sm font-bold`}>
                        {user.id.substring(0, 1).toUpperCase()}
                        {mediaState?.isSpeaking && (
                          <div className="absolute -inset-0.5 rounded-full border-2 border-emerald-400 animate-pulse" />
                        )}
                      </div>
                      {/* Name + badges */}
                      <div>
                        <p className="text-white text-sm font-medium flex items-center gap-1.5">
                          {isMe ? "You" : `User ${user.id.substring(0, 6)}`}
                          {isMe && (
                            <span className="text-[9px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded-full">you</span>
                          )}
                          {user.isHost && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">👑 Host</span>
                          )}
                        </p>
                        <p className="text-gray-500 text-[10px]">
                          {mediaState?.isInVoice ? "In voice" : "Watching"}
                        </p>
                      </div>
                    </div>
                    {/* Media status icons */}
                    <div className="flex items-center gap-1.5">
                      {mediaState?.isInVoice && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${mediaState.isMicOn ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                          <svg className={`w-3.5 h-3.5 ${mediaState.isMicOn ? "text-emerald-400" : "text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                      )}
                      {mediaState?.isCameraOn && (
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. BOTTOM CONTROL BAR */}
        <MediaControls
          isInVoice={isInVoice}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          isSpeaking={isSpeaking}
          onJoinVoice={joinVoice}
          onLeaveVoice={leaveVoice}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onTogglePlayPause={handleTogglePlayPause}
          onForceSync={handleForceSync}
          onLeaveRoom={handleLeaveRoom}
          permissionError={permissionError}
          layout="bottom-bar"
          videoRef={videoPlayerRef}
        />
      </div>

      {/* ===== DESKTOP LAYOUT (lg+) ===== */}
      <div className="hidden lg:block p-3 md:p-5 lg:p-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* Video Player Area */}
            <div className="space-y-4">
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
                    <button type="submit" className="px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-semibold transition-colors">
                      Load
                    </button>
                    <button type="button" onClick={() => setShowUrlInput(false)} className="px-3 py-2.5 text-gray-400 hover:text-white hover:bg-surface-glass-hover rounded-xl text-sm transition-colors">
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
              {/* Chat Toggle Button */}
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

              {/* Leave Room */}
              <button
                onClick={handleLeaveRoom}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 bg-surface-glass hover:bg-red-500/10 border border-surface-glass-border hover:border-red-500/20 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Leave Room
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
