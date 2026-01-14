"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { BotCard } from "@/components/bots/BotCard";
import { AppHeader } from "@/components/layout/AppHeader";

interface Bot {
  id: string;
  name: string;
  symbol: string;
  strategyType: string;
  status: string;
  statusMessage?: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  lastRunAt: string | null;
  wallet: {
    id: string;
    nickname: string;
    address: string;
  };
}

export default function BotsPage() {
  const { data: session, status } = useSession();
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [passwordModal, setPasswordModal] = useState<{ botId: string; action: "start" | "stop" } | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      fetchBots();
    }
  }, [status]);

  async function fetchBots() {
    try {
      const res = await fetch("/api/bots");
      const data = await res.json();
      if (data.success) {
        setBots(data.bots);
      } else {
        setError(data.error || "Failed to load bots");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStart(botId: string) {
    setPasswordModal({ botId, action: "start" });
  }

  async function handleStop(botId: string) {
    setActionLoading(botId);
    try {
      const res = await fetch(`/api/bots/${botId}/stop`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        await fetchBots();
      } else {
        setError(data.error || "Failed to stop bot");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStartWithPassword() {
    if (!passwordModal) return;

    setActionLoading(passwordModal.botId);
    try {
      const res = await fetch(`/api/bots/${passwordModal.botId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchBots();
        setPasswordModal(null);
        setPassword("");
      } else {
        setError(data.error || "Failed to start bot");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/auth/login");
  }

  const runningBots = bots.filter((b) => b.status === "running");
  const stoppedBots = bots.filter((b) => b.status !== "running");

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader title="Bots" />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats and Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-400">
            <span className="text-green-400 font-semibold">{runningBots.length} running</span>
            <span className="mx-2">/</span>
            <span>{bots.length} total bots</span>
          </div>
          <Link
            href="/bots/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Bot
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 text-red-300 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {bots.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 mb-4">No bots yet</div>
            <p className="text-gray-600 mb-6">
              Create your first trading bot to automate your strategies
            </p>
            <Link
              href="/bots/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Bot
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Running Bots */}
            {runningBots.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                  Running ({runningBots.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {runningBots.map((bot) => (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      onStart={handleStart}
                      onStop={handleStop}
                      isLoading={actionLoading === bot.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Stopped Bots */}
            {stoppedBots.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                  Stopped ({stoppedBots.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {stoppedBots.map((bot) => (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      onStart={handleStart}
                      onStop={handleStop}
                      isLoading={actionLoading === bot.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Enter Wallet Password</h3>
            <p className="text-gray-400 text-sm mb-4">
              Your wallet password is needed to start the bot and sign transactions.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wallet encryption password"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg mb-4"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleStartWithPassword()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPasswordModal(null);
                  setPassword("");
                }}
                className="flex-1 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartWithPassword}
                disabled={!password || actionLoading !== null}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Starting..." : "Start Bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
