/**
 * Users Connected Component
 * Display list of users in the room
 */

import React from "react";
import { RoomUser } from "../../shared/types";

interface UsersConnectedProps {
  users: RoomUser[];
  currentUserId: string;
}

export const UsersConnected: React.FC<UsersConnectedProps> = ({ users, currentUserId }) => {
  return (
    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        👥 Connected Users ({users.length})
      </h3>

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between bg-dark-900 p-3 rounded border border-dark-700"
          >
            <div className="flex items-center gap-2">
              {/* User Badge */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {user.id.substring(0, 1).toUpperCase()}
              </div>

              {/* User Info */}
              <div className="flex-1">
                <p className="text-white text-sm font-medium">
                  {currentUserId === user.id ? "You" : `User ${user.id.substring(0, 8)}`}
                </p>
                <p className="text-gray-500 text-xs">
                  Joined {Math.round((Date.now() - user.joinedAt) / 1000)}s ago
                </p>
              </div>
            </div>

            {/* Host Badge */}
            {user.isHost && (
              <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded font-semibold">
                HOST
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
