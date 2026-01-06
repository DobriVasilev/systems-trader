"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UserData {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
  createdAt?: string;
  _count?: {
    corrections?: number;
    comments?: number;
  };
}

interface UserHoverCardProps {
  userId: string;
  children: React.ReactNode;
  onViewProfile?: (userId: string) => void;
}

export function UserHoverCard({
  userId,
  children,
  onViewProfile,
}: UserHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (userData) return; // Already loaded
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      if (data.success) {
        setUserData(data.data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userData]);

  // Handle mouse enter on trigger
  const handleTriggerMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    hoverTimeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
        });
      }
      setIsOpen(true);
      fetchUserData();
    }, 500);
  }, [fetchUserData]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  }, []);

  // Handle mouse enter on card (keep it open)
  const handleCardMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>

      {isOpen && (
        <div
          ref={cardRef}
          className="fixed z-50 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full" />
            </div>
          ) : userData ? (
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                {userData.image ? (
                  <img
                    src={userData.image}
                    alt=""
                    className="w-12 h-12 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center text-xl font-bold text-gray-400">
                    {(userData.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-200 truncate">
                    {userData.name || "Anonymous"}
                  </div>
                  {userData.username && (
                    <div className="text-sm text-gray-400 truncate">
                      @{userData.username}
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              {userData.bio && (
                <p className="mt-3 text-sm text-gray-300 line-clamp-2">
                  {userData.bio}
                </p>
              )}

              {/* Stats */}
              {userData._count && (
                <div className="mt-3 flex items-center gap-4 text-sm">
                  {userData._count.corrections !== undefined && (
                    <div className="text-gray-400">
                      <span className="font-medium text-gray-200">
                        {userData._count.corrections}
                      </span>{" "}
                      corrections
                    </div>
                  )}
                  {userData._count.comments !== undefined && (
                    <div className="text-gray-400">
                      <span className="font-medium text-gray-200">
                        {userData._count.comments}
                      </span>{" "}
                      comments
                    </div>
                  )}
                </div>
              )}

              {/* Join date */}
              {userData.createdAt && (
                <div className="mt-2 text-xs text-gray-500">
                  Joined{" "}
                  {new Date(userData.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}

              {/* Actions */}
              {onViewProfile && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <button
                    onClick={() => onViewProfile(userId)}
                    className="w-full px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors text-center"
                  >
                    View Profile
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">
              User not found
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Also export a hook for programmatic hover card positioning
export function useUserHoverCard() {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showCard = useCallback((userId: string, element: HTMLElement) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    const rect = element.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
    });
    setActiveUserId(userId);
  }, []);

  const hideCard = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveUserId(null);
    }, 300);
  }, []);

  const keepCardOpen = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  return {
    activeUserId,
    position,
    showCard,
    hideCard,
    keepCardOpen,
  };
}
