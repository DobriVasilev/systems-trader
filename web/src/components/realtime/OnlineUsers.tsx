"use client";

import { PresenceMember } from "@/lib/realtime";

interface OnlineUsersProps {
  users: PresenceMember[];
  isConnected: boolean;
}

export function OnlineUsers({ users, isConnected }: OnlineUsersProps) {
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="w-2 h-2 rounded-full bg-gray-500" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span>Only you</span>
      </div>
    );
  }

  const displayUsers = users.slice(0, 5);
  const remainingCount = users.length - 5;

  return (
    <div className="flex items-center gap-2">
      {/* Connection indicator */}
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />

      {/* User avatars */}
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <div
            key={user.id}
            className="relative group"
            title={user.name || user.email}
          >
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || ""}
                className="w-6 h-6 rounded-full border-2 border-gray-900"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-gray-900 flex items-center justify-center text-xs font-medium text-white">
                {(user.name || user.email || "?")[0].toUpperCase()}
              </div>
            )}
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {user.name || user.email}
            </div>
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs text-gray-300">
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Count */}
      <span className="text-xs text-gray-400">
        {users.length + 1} online
      </span>
    </div>
  );
}
