"use client";

/**
 * Room Page [id] — Ready Check Architecture
 *
 * Flow:
 * 1. Connect to socket → join room
 * 2. room-joined received → set videoUrl from room.videoUrl
 * 3. VideoPlayer loads the URL
 * 4. Host clicks play → their video plays (user gesture ✅)
 * 5. Socket broadcasts play-event to guests
 * 6. Guest sees "▶ Tap to sync" pill overlay on video
 * 7. Guest taps pill → video.currentTime + video.play() (user gesture ✅)
 * 8. Pill disappears → video plays in sync
 * 9. Pause/seek work automatically (no gesture needed)
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
import { CameraBubbles } from "../../../components/CameraBubbles";
import { MediaControls } from "../../../components/MediaControls";
import { ChatPanel } from "../../../components/ChatPanel";
import { EmojiReactions } from "../../../components/EmojiReactions";
import { VideoPickerModal } from "../../../components/VideoPickerModal";
import { SOCKET_EVENTS } from "../../../../shared/constants";

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = params.id as string;
  const roomCode = searchParams.get("code") || roomId.substring(0, 6).toUpperCase();

  // Video player ref
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string>("");
  const [username, setUsername] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("username") || "";
    }
    return "";
  });
  const [usernameInput, setUsernameInput] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`room_${roomId}_videoUrl`);
      if (saved) return saved;
    }
    return "https://www.w3schools.com/html/mov_bbb.mp4";
  });
  const [urlInput, setUrlInput] = useState<string>(videoUrl);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<"chat" | "reactions" | "members">("chat");
  const [showInviteCopied, setShowInviteCopied] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // ─── Custom hooks ───────────────────────────────────────────────────────────
  const { room, users, error: roomError, isLoading, joinRoom } = useRoom({
    roomId,
    userId: userId || "",
  });

  // Derive isHost from room users
  const isHost = users.find((u) => u.id === userId)?.isHost ?? false;

  const {
    broadcastPlay,
    broadcastPause,
    broadcastSeek,
    syncPermission,
    grantPermission,
    denyPermission,
    revokePermission,
  } = useVideoSync({
    roomId,
    userId: userId || "",
    isHost,
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

  // ─── Track unread messages ──────────────────────────────────────────────────
  useEffect(() => {
    if (mobileTab !== "chat" && messages.length > 0) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mobileTab === "chat") {
      setUnreadCount(0);
    }
  }, [mobileTab]);

  // ─── Track video play/pause state for bottom bar icon ───────────────────────
  useEffect(() => {
    const video = videoPlayerRef.current;
    if (!video) return;
    const onPlay = () => setIsVideoPlaying(true);
    const onPause = () => setIsVideoPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  });

  // ─── Initialize on mount ────────────────────────────────────────────────────
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

  // ─── Join room when userId and socket are ready AND username set ──────────
  useEffect(() => {
    if (userId && isConnected && username) {
      joinRoom();
      setHasJoined(true);
    }
  }, [userId, isConnected, username, joinRoom]);

  // ─── Video URL sync: ONE simple effect ──────────────────────────────────────
  useEffect(() => {
    if (room?.videoUrl && room.videoUrl !== videoUrl) {
      setVideoUrl(room.videoUrl);
      setUrlInput(room.videoUrl);
      sessionStorage.setItem(`room_${roomId}_videoUrl`, room.videoUrl);
    }
  }, [room?.videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Listen for video change from other users ───────────────────────────────
  useEffect(() => {
    const handleVideoChanged = (data: { userId: string; videoUrl: string }) => {
      if (data.userId !== userId) {
        console.log(`[ROOM] Video changed by ${data.userId.substring(0, 6)} to: ${data.videoUrl}`);
        setVideoUrl(data.videoUrl);
        setUrlInput(data.videoUrl);
        sessionStorage.setItem(`room_${roomId}_videoUrl`, data.videoUrl);
      }
    };

    socketClient.on("video-changed" as any, handleVideoChanged);
    return () => {
      socketClient.off("video-changed" as any, handleVideoChanged);
    };
  }, [userId, roomId]);

  // ─── Handle video URL update — broadcast to all users ───────────────────────
  const handleUpdateVideoUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      setVideoUrl(urlInput);
      setShowUrlInput(false);
      socketClient.emit("video-change" as any, { roomId, userId, videoUrl: urlInput });
      sessionStorage.setItem(`room_${roomId}_videoUrl`, urlInput);
    }
  };

  // ─── Handle leave room ──────────────────────────────────────────────────────
  const handleLeaveRoom = () => {
    if (isInVoice) {
      leaveVoice();
    }
    socketClient.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId, userId });
    router.push("/");
  };

  // ─── Copy invite link ───────────────────────────────────────────────────────
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

  // ─── Toggle play/pause (host only via MediaControls) ────────────────────────
  const handleTogglePlayPause = () => {
    const video = videoPlayerRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  // ─── Force sync (re-broadcast seek) ────────────────────────────────────────
  const handleForceSync = () => {
    broadcastSeek();
  };

  // ─── Handle username submit ──────────────────────────────────────────────
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim().length >= 2) {
      const name = usernameInput.trim();
      setUsername(name);
      sessionStorage.setItem("username", name);
    }
  };

  // ─── Handle kick user (host only) ──────────────────────────────────────────
  const handleKickUser = (targetUserId: string) => {
    if (!isHost) return;
    socketClient.emit("kick-user" as any, { roomId, userId, targetUserId });
  };

  // ─── Listen for kick event ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKicked = () => {
      alert("You have been removed from the room by the host.");
      router.push("/");
    };
    socketClient.on("kicked" as any, handleKicked);
    return () => { socketClient.off("kicked" as any, handleKicked); };
  }, [router]);

  // ─── Username entry screen ───────────────────────────────────────────────
  if (!username) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center animate-fade-in">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Enter your name</h2>
          <p className="text-gray-400 text-sm mb-6">This will be shown to others in the room</p>
          <form onSubmit={handleUsernameSubmit} className="space-y-3">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Your name..."
              maxLength={20}
              autoFocus
              className="w-full bg-dark-800/80 border border-surface-glass-border text-white text-center text-lg px-4 py-3 rounded-xl placeholder-gray-500 focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 outline-none"
            />
            <button
              type="submit"
              disabled={usernameInput.trim().length < 2}
              className="w-full py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-primary-600 to-primary-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Join Room
            </button>
          </form>
          <p className="text-gray-600 text-[10px] mt-4">Minimum 2 characters</p>
        </div>
      </div>
    );
  }
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

  // Sync Permission Prompt — shown once, saved to localStorage
  const SyncPermissionPrompt = () => {
    if (syncPermission !== "pending") return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-dark-950/90 backdrop-blur-md animate-fade-in">
        <div className="max-w-sm w-full mx-6 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Allow Sync Playback?</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Allow the host to control video playback for everyone in this room.
            <br />
            <span className="text-gray-500 text-xs">Play, pause, and seek will sync automatically.</span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={denyPermission}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-gray-400 bg-dark-700/80 hover:bg-dark-600 border border-surface-glass-border transition-colors"
            >
              Not now
            </button>
            <button
              onClick={grantPermission}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 shadow-glow-sm transition-all active:scale-95"
            >
              Allow
            </button>
          </div>
          <p className="text-gray-600 text-[10px] mt-4">You can revoke this anytime</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Sync Permission Prompt — one-time, saved to localStorage */}
      <SyncPermissionPrompt />

      {/* ===== SINGLE RESPONSIVE LAYOUT ===== */}
      <div className="flex flex-col h-screen overflow-hidden max-w-4xl mx-auto">
        {/* 1. HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-glass-border bg-dark-900/80 backdrop-blur-md sticky top-0 z-50">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-glass-hover transition-colors"
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="flex-1 text-center">
            <h1 className="text-white font-semibold text-sm truncate">
              Movie Night 🎬
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className="text-emerald-400 text-xs font-medium">{users.length} watching</span>
            </div>
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-glass-hover transition-colors"
              title="Change video URL"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.556a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.69" />
              </svg>
            </button>
            <button
              onClick={() => { setShowUrlInput(false); setShowVideoPicker(true); }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-glass-hover transition-colors"
              title="Pick from library"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5" />
              </svg>
            </button>
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

        {/* Video URL Input (mobile) */}
        {showUrlInput && (
          <div className="px-3 py-2 border-b border-surface-glass-border bg-dark-900/60 animate-slide-down">
            <form onSubmit={handleUpdateVideoUrl} className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste video URL or HLS link..."
                className="flex-1 bg-dark-800/80 border border-surface-glass-border text-white text-xs px-3 py-2 rounded-lg placeholder-gray-500 focus:border-primary-500/50 outline-none"
              />
              <button type="submit" className="px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-semibold transition-colors">
                Load
              </button>
              <button
                type="button"
                onClick={() => { setShowUrlInput(false); setShowVideoPicker(true); }}
                className="px-3 py-2 bg-dark-700 hover:bg-dark-600 border border-surface-glass-border text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Pick from library"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5" />
                </svg>
                Library
              </button>
              <button type="button" onClick={() => setShowUrlInput(false)} className="px-2 py-2 text-gray-400 hover:text-white rounded-lg text-xs transition-colors">
                ✕
              </button>
            </form>
          </div>
        )}

        {/* Video Picker Modal */}
        {showVideoPicker && (
          <VideoPickerModal
            onSelect={(streamUrl) => {
              setVideoUrl(streamUrl);
              setUrlInput(streamUrl);
              setShowVideoPicker(false);
              socketClient.emit("video-change" as any, { roomId, userId, videoUrl: streamUrl });
              sessionStorage.setItem(`room_${roomId}_videoUrl`, streamUrl);
            }}
            onClose={() => setShowVideoPicker(false)}
          />
        )}

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
        <div className="relative w-full flex-shrink-0">
          <VideoPlayer
            ref={videoPlayerRef}
            videoUrl={videoUrl}
            onPlay={broadcastPlay}
            onPause={broadcastPause}
            onSeek={broadcastSeek}
            isHost={isHost}
          />
          <EmojiReactions reactions={reactions} />
        </div>

        {/* Error banner */}
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
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === "chat" && (
            <div className="h-full flex flex-col">
              <ChatPanel
                messages={messages}
                currentUserId={userId}
                onSendMessage={sendMessage}
                onSendReaction={sendReaction}
                embedded
              />
            </div>
          )}

          {mobileTab === "reactions" && (
            <div className="p-4 space-y-4 overflow-y-auto h-full">
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

          {mobileTab === "members" && (
            <div className="p-4 space-y-2 overflow-y-auto h-full">
              {/* Room playback status */}
              {room && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${room.playbackState.isPlaying ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
                    <span className="text-white text-xs font-medium">
                      {room.playbackState.isPlaying ? "▶ Playing" : "⏸ Paused"}
                    </span>
                  </div>
                  <span className="text-primary-300 text-xs font-mono">
                    {Math.floor(room.playbackState.currentTime / 60)}:{Math.floor(room.playbackState.currentTime % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              )}
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
                      <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${
                        ["from-blue-500 to-indigo-600", "from-purple-500 to-pink-600", "from-emerald-500 to-teal-600", "from-orange-500 to-red-600", "from-cyan-500 to-blue-600"][index % 5]
                      } flex items-center justify-center text-white text-sm font-bold`}>
                        {user.id.substring(0, 1).toUpperCase()}
                        {mediaState?.isSpeaking && (
                          <div className="absolute -inset-0.5 rounded-full border-2 border-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium flex items-center gap-1.5">
                          {isMe ? username || "You" : `User ${user.id.substring(0, 6)}`}
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
                      {/* Kick button (host only, not self) */}
                      {isHost && !isMe && (
                        <button
                          onClick={() => handleKickUser(user.id)}
                          className="w-6 h-6 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                          title="Kick user"
                        >
                          <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
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
          isVideoPlaying={isVideoPlaying}
          isHost={isHost}
        />
      </div>

    </div>
  );
}
