"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

interface AppHeaderProps {
  title?: string;
  showNav?: boolean;
  showBackButton?: boolean;
}

export function AppHeader({ title, showNav = true, showBackButton = false }: AppHeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user?.role === "admin";
  const isDevTeam = session?.user?.role === "dev_team";

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/trading", label: "Trading" },
    { href: "/bots", label: "Bots" },
    { href: "/sessions", label: "Sessions" },
    { href: "/chat", label: "Chat" },
    ...(isAdmin || isDevTeam ? [{ href: "/implementations", label: "Implementations" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            {showBackButton && (
              <button
                onClick={() => window.history.back()}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <Link href="/dashboard" className="flex items-center gap-2">
              <img
                src="https://pub-5cc5403568f5455a945da44f4db19f23.r2.dev/systems_trader_logo.png"
                alt="Systems Trader Logo"
                className="w-8 h-8 rounded-lg"
              />
              <span className="font-semibold text-white hidden sm:block">
                Systems Trader
              </span>
            </Link>
            {title && (
              <>
                <span className="text-gray-500 hidden sm:block">/</span>
                <h1 className="text-lg font-semibold text-white hidden sm:block">
                  {title}
                </h1>
              </>
            )}
          </div>

          {/* Navigation */}
          {showNav && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* User Dropdown */}
          {session?.user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-800 transition-colors border border-gray-800"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-white">
                    {session.user.name || "User"}
                  </div>
                  {isAdmin && (
                    <div className="text-xs text-blue-400 font-medium">Admin</div>
                  )}
                  {isDevTeam && (
                    <div className="text-xs text-purple-400 font-medium">Dev Team</div>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    showDropdown ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-700">
                    <div className="text-sm font-medium text-white">
                      {session.user.name || "User"}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {session.user.email}
                    </div>
                    {isAdmin && (
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">
                        Admin
                      </div>
                    )}
                    {isDevTeam && (
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-600 text-white">
                        Dev Team
                      </div>
                    )}
                  </div>

                  {/* Mobile Navigation */}
                  <div className="md:hidden py-1 border-b border-gray-700">
                    {navItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setShowDropdown(false)}
                          className={`block px-4 py-2 text-sm ${
                            isActive
                              ? "bg-blue-600 text-white font-medium"
                              : "text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href="/account"
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Account Settings
                      </div>
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="py-1 border-t border-gray-700">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
