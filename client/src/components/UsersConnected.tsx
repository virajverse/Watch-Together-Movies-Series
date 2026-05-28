/**
 * Users Connected Component
 * Avatar stack with user info
 */

import React from "react";
import { RoomUser } from "../../shared/types";

interface UsersConnectedProps {
  users: RoomUser[];
  currentUserId: string;
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

export const UsersConnected: React.FC<UsersConnectedProps> = ({ users, currentUserId }) => {
  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

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
          {users.slice(0, 5).map((user, index) => (
            <div
              key={user.id}
              className={`relative w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(index)} flex items-center justify-center text-white text-xs font-bold ring-2 ring-dark-800 hover:ring-primary-500/50 hover:scale-110 hover:z-10 transition-all duration-200 cursor-default`}
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
          ))}
          {users.length > 5 && (
            <div className="w-9 h-9 rounded-full bg-dark-700 border border-surface-glass-border flex items-center justify-center text-gray-400 text-xs font-medium ring-2 ring-dark-800">
              +{users.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* User List */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {users.map((user, index) => (
          <div
            key={user.id}
            className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-surface-glass-hover transition-colors duration-200"
          >
            <div className="flex items-center gap-2.5">
              {/* Mini avatar */}
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(index)} flex items-center justify-center text-white text-[10px] font-bold`}>
                {user.id.substring(0, 1).toUpperCase()}
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

            {/* Host Badge */}
            {user.isHost && (
              <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-amber-500/20">
                <span>👑</span> Host
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
