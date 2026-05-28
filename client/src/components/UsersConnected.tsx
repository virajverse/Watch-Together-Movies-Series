"use client";

/**
 * Users Connected Component
 * Avatar stack with user info + voice/camera status (MVP3)
 */

import React from "react";
import { RoomUser } from "../../shared/types";

interface PeerMediaInfo {
  oderId: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  isSpeaking: boolean;
  isInVoice: boolean;
}

interface UsersConnectedProps {
  users: RoomUser[];
  currentUserId: string;
  mediaStates?: PeerMediaInfo[];
  localMediaState?: {
    isInVoice: boolean;
    isMicOn: boolean;
    isCameraOn: boolean;
    isSpeaking: boolean;
  };
}

// Color palette for user avatars
const AVATAR_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-600",
  "from-cyan-500 to-blue-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
];

export const UsersConnected: React.FC<UsersConnectedProps> = ({
  users,
  currentUserId,
  mediaStates = [],
  localMediaState,
}) => {
  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  const getMediaState = (userId: string): PeerMediaInfo | null => {
    if (userId === currentUserId && localMediaState) {
      return {
        oderId: userId,
        isMicOn: localMediaState.isMicOn,
        isCameraOn: localMediaState.isCameraOn,
        isSpeaking: localMediaState.isSpeaking,
        isInVoice: localMediaState.isInVoice,
      };
    }
    return mediaStates.find((m) => m.oderId === userId) || null;
  };

  return (
    <div className="glass-card rounded-2xl p-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          In Room
        </h3>
        <span className="text-xs text-gray-500 bg-dark-900/60 px-2.5 py-1 rounded-full">
          {users.length} {users.length === 1 ? "viewer" : "viewers"}
        </span>
      </div>

      {/* Avatar Stack (horizontal overlapping) */}
      <div className="flex items-center mb-4">
        <div className="flex -space-x-2">
          {users.slice(0, 5).map((user, index) => {
            const media = getMediaState(user.id);
            return (
              <div
                key={user.id}
                className={`relative w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(index)} flex items-center justify-center text-white text-xs font-bold ring-2 ${
                  media?.isSpeaking ? "ring-emerald-400 animate-pulse" : "ring-dark-800"
                } hover:ring-primary-500/50 hover:scale-110 hover:z-10 transition-all duration-200 cursor-default`}
                title={currentUserId === user.id ? "You" : `User ${user.id.substring(0, 8)}`}
              >
                {user.id.substring(0, 1).toUpperCase()}
                {/* Host crown */}
                {user.isHost && (
                  <div className="absolute -top-1.5 -right-0.5 text-[10px]">👑</div>
                )}
                {/* You indicator */}
                {currentUserId === user.id && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary-500 text-[8px] text-white px-1 rounded-full leading-tight">
                    you
                  </div>
                )}
              </div>
            );
          })}
          {users.length > 5 && (
            <div className="w-9 h-9 rounded-full bg-dark-700 border border-surface-glass-border flex items-center justify-center text-gray-400 text-xs font-medium ring-2 ring-dark-800">
              +{users.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* User List */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {users.map((user, index) => {
          const media = getMediaState(user.id);
          return (
            <div
              key={user.id}
              className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-surface-glass-hover transition-colors duration-200"
            >
              <div className="flex items-center gap-2.5">
                {/* Mini avatar with speaking indicator */}
                <div className="relative">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(index)} flex items-center justify-center text-white text-[10px] font-bold`}>
                    {user.id.substring(0, 1).toUpperCase()}
                  </div>
                  {media?.isSpeaking && (
                    <div className="absolute -inset-0.5 rounded-full border-2 border-emerald-400 animate-pulse" />
                  )}
                </div>
                {/* Name */}
                <div>
                  <p className="text-white text-sm font-medium leading-tight">
                    {currentUserId === user.id ? "You" : `User ${user.id.substring(0, 6)}`}
                  </p>
                  <p className="text-gray-500 text-[10px]">
                    {Math.round((Date.now() - user.joinedAt) / 1000)}s ago
                  </p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-1.5">
                {/* In Voice badge */}
                {media?.isInVoice && (
                  <span className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-emerald-500/20">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                    Voice
                  </span>
                )}

                {/* Mic status */}
                {media?.isInVoice && !media.isMicOn && (
                  <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center" title="Muted">
                    <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                    </svg>
                  </div>
                )}

                {/* Camera status */}
                {media?.isCameraOn && (
                  <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center" title="Camera on">
                    <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                )}

                {/* Host Badge */}
                {user.isHost && (
                  <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-amber-500/20">
                    <span>👑</span> Host
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
