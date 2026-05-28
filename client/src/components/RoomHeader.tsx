/**
 * Room Header Component
 * Compact header bar with room info, copy link, user count
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
    <div className="glass-card rounded-2xl p-4 md:p-5 mb-5 animate-slide-down">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: Room Code Badge */}
        <div className="flex items-center gap-4">
          {/* Room code chip */}
          <button
            onClick={copyToClipboard}
            className="group flex items-center gap-2.5 bg-dark-900/60 hover:bg-dark-900/80 border border-surface-glass-border hover:border-primary-500/30 rounded-xl px-4 py-2.5 transition-all duration-200"
            title="Click to copy room link"
          >
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Room</span>
            <span className="text-primary-400 font-mono font-bold text-lg tracking-wider">{roomCode}</span>
            {/* Copy icon */}
            <svg
              className={`w-4 h-4 transition-all duration-200 ${copied ? "text-emerald-400" : "text-gray-500 group-hover:text-primary-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {copied ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              )}
            </svg>
          </button>

          {/* Copied toast */}
          {copied && (
            <span className="text-emerald-400 text-xs font-medium animate-fade-in">
              Link copied!
            </span>
          )}
        </div>

        {/* Right: User count + Sync indicator */}
        <div className="flex items-center gap-4">
          {/* Sync indicator */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
              <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
            </div>
            <span className="text-emerald-400 text-xs font-medium hidden sm:inline">Synced</span>
          </div>

          {/* User count */}
          <div className="flex items-center gap-2 bg-dark-900/60 border border-surface-glass-border rounded-xl px-3.5 py-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="text-white font-semibold text-sm">{userCount}</span>
            <span className="text-gray-500 text-xs hidden sm:inline">watching</span>
          </div>
        </div>
      </div>
    </div>
  );
};
