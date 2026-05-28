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
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      {/* Container */}
      <div className="max-w-md w-full">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">👥 Watch Together</h1>
          <p className="text-gray-400">Watch videos in real-time sync with friends</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-600 text-red-300 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Create Room Card */}
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Room</h2>
          <button
            onClick={handleCreateRoom}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {isConnecting ? "Creating..." : "🎬 Create Room"}
          </button>
          <p className="text-gray-400 text-sm mt-3">
            Create a new room and share the link with friends to start watching together
          </p>
        </div>

        {/* Join Room Card */}
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Join Room</h2>
          <form onSubmit={handleJoinByCode} className="space-y-3">
            <input
              type="text"
              placeholder="Enter room code..."
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg placeholder-gray-600 focus:ring-2 focus:ring-blue-500"
            />
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              Join Room
            </button>
          </form>
          <p className="text-gray-400 text-sm mt-3">
            Get the room code from someone already in the room
          </p>
        </div>

        {/* Info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>MVP 1.0 - Real-time Video Sync</p>
        </div>
      </div>
    </div>
  );
}
