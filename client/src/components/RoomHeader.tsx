/**
 * Room Header Component
 * Display room info and copy link button
 */

import React, { useState } from "react";

interface RoomHeaderProps {
  roomId: string;
  roomCode: string;
  userCount: number;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({ roomId, roomCode, userCount }) => {
  const [copied, setCopied] = useState(false);

  const roomUrl = `${window.location.origin}/room/${roomId}?code=${roomCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[ROOM] Failed to copy:", err);
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-white text-xl font-bold">Room Code</h2>
          <p className="text-3xl font-mono font-bold text-blue-400 my-2">{roomCode}</p>
          <p className="text-gray-400 text-sm">Room ID: {roomId.substring(0, 8)}...</p>
        </div>

        <div className="text-right">
          <p className="text-gray-400 text-sm mb-2">Connected Users</p>
          <p className="text-3xl font-bold text-green-400">{userCount}</p>
        </div>
      </div>

      {/* Copy Link Button */}
      <button
        onClick={copyToClipboard}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
      >
        {copied ? "✓ Copied!" : "📋 Copy Room Link"}
      </button>

      {/* Shareable Link Display */}
      <div className="mt-3 bg-dark-900 p-3 rounded border border-dark-700 text-gray-400 text-xs break-all">
        {roomUrl}
      </div>
    </div>
  );
};
