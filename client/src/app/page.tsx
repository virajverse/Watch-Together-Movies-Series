"use client";

/**
 * Home Page
 * Landing page with room creation options
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { socketClient } from "../lib/socket";

export default function Home() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  /**
   * Initialize socket connection on mount
   */
  useEffect(() => {
    const initSocket = async () => {
      try {
        if (!socketClient.getIsConnected()) {
          await socketClient.connect();
        }
      } catch (err) {
        console.error("[HOME] Socket connection failed:", err);
        setError("Failed to connect to server. Please refresh the page.");
      }
    };

    initSocket();
  }, []);

  /**
   * Create a new room
   */
  const handleCreateRoom = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Create new room ID and user ID
      const roomId = uuidv4();
      const userId = uuidv4();

      // Store in sessionStorage for the room page
      sessionStorage.setItem("userId", userId);
      sessionStorage.setItem("userRoomId", roomId);

      // Navigate to room page
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error("[HOME] Error creating room:", err);
      setError("Failed to create room. Please try again.");
      setIsConnecting(false);
    }
  };

  /**
   * Join room by code
   */
  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    if (!roomCode.trim()) {
      setJoinError("Please enter a room code");
      return;
    }

    // In a real app, we'd verify the code with the server first
    // For MVP, we'll just navigate to the room
    const userId = uuidv4();
    sessionStorage.setItem("userId", userId);

    // Note: In production, you'd need to lookup the room ID from the code
    // For now, we'll create a derived room ID from the code
    // This should be replaced with a proper lookup API
    alert("Join by code feature requires server implementation. Use the link instead.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      {/* Animated background particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary-400/20 rounded-full animate-float" />
        <div className="absolute top-3/4 right-1/4 w-1.5 h-1.5 bg-accent-purple/20 rounded-full animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-3/4 w-1 h-1 bg-accent-cyan/20 rounded-full animate-float" style={{ animationDelay: "4s" }} />
        <div className="absolute top-1/3 right-1/3 w-2.5 h-2.5 bg-primary-500/10 rounded-full animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-accent-pink/10 rounded-full animate-float" style={{ animationDelay: "3s" }} />
      </div>

      {/* Container */}
      <div className="max-w-lg w-full animate-fade-in">
        {/* Logo/Title */}
        <div className="text-center mb-10">
          {/* Animated logo icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-purple mb-6 shadow-glow-md animate-pulse-glow">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
            </svg>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-3 gradient-text tracking-tight">
            Watch Together
          </h1>
          <p className="text-gray-400 text-lg md:text-xl font-light">
            Stream movies in perfect sync with friends
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-card rounded-xl p-4 mb-6 border-red-500/30 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Create Room Card */}
        <div className="glass-card-hover rounded-2xl p-6 md:p-8 mb-5 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Create Room</h2>
          </div>
          <p className="text-gray-400 text-sm mb-5 leading-relaxed">
            Start a new watch party and invite friends with a shareable link
          </p>
          <button
            onClick={handleCreateRoom}
            disabled={isConnecting}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Create Watch Party
              </>
            )}
          </button>
        </div>

        {/* Join Room Card */}
        <div className="glass-card-hover rounded-2xl p-6 md:p-8 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Join Room</h2>
          </div>
          <form onSubmit={handleJoinByCode} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter room code..."
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full bg-dark-900/80 border border-surface-glass-border text-white px-4 py-3.5 rounded-xl placeholder-gray-500 focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 text-center text-lg font-mono tracking-[0.3em] uppercase"
              />
            </div>
            {joinError && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                </svg>
                {joinError}
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-green hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Join Watch Party
            </button>
          </form>
          <p className="text-gray-500 text-xs mt-4 text-center">
            Get the room code from someone already watching
          </p>
        </div>

        {/* Quick Links */}
        <div className="mt-8 flex items-center justify-center gap-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <button
            onClick={() => router.push("/upload")}
            className="text-gray-400 hover:text-primary-400 text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload
          </button>
          <span className="text-dark-600">•</span>
          <button
            onClick={() => router.push("/library")}
            className="text-gray-400 hover:text-primary-400 text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5" />
            </svg>
            Library
          </button>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <p className="text-gray-600 text-xs">Watch Together v2.0 • Real-time Sync</p>
        </div>
      </div>
    </div>
  );
}
