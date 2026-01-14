"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";

import { WalletManager } from "@/components/trading/WalletManager";
import { AccountOverview } from "@/components/trading/AccountOverview";
import { TradingFormPnl } from "@/components/trading/TradingFormPnl";
import { PositionsList } from "@/components/trading/PositionsList";
import { useAppStore } from "@/stores/appStore";

interface Wallet {
  id: string;
  nickname: string;
  address: string;
  isDefault: boolean;
  lastUsedAt: string | null;
  _count: {
    bots: number;
    trades: number;
  };
}

interface AccountInfo {
  accountValue: number;
  totalMarginUsed: number;
  totalRawUsd: number;
  withdrawable: number;
}

interface Position {
  symbol: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  liquidationPrice: number | null;
  leverage: number;
  marginUsed: number;
}

interface OpenOrder {
  symbol: string;
  side: string;
  size: number;
  price: number;
  orderId: number;
  orderType: string;
}

export default function TradingPage() {
  const { data: session, status } = useSession();

  // App store state
  const {
    activeTab,
    setSelectedWalletId,
    setWalletAddress,
    setTradingEnabled,
    setActiveTab,
  } = useAppStore();

  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  // Fetch account data when wallet is selected
  const fetchAccountData = useCallback(async (walletId: string) => {
    setIsLoading(true);
    setConnectionError("");

    try {
      const [accountRes, positionsRes] = await Promise.all([
        fetch("/api/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletId }),
        }),
        fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletId }),
        }),
      ]);

      const [accountData, positionsData] = await Promise.all([
        accountRes.json(),
        positionsRes.json(),
      ]);

      if (!accountRes.ok) {
        setConnectionError(accountData.error || "Failed to connect to wallet");
        setIsConnected(false);
        return;
      }

      setAccount(accountData.account);

      if (positionsRes.ok) {
        setPositions(positionsData.positions || []);
        setOpenOrders(positionsData.openOrders || []);
      }

      setIsConnected(true);
    } catch {
      setConnectionError("Network error - please try again");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-connect when wallet is selected
  useEffect(() => {
    if (selectedWallet) {
      fetchAccountData(selectedWallet.id);
      setSelectedWalletId(selectedWallet.id);
      setWalletAddress(selectedWallet.address);
      setTradingEnabled(true);
    }
  }, [selectedWallet, fetchAccountData, setSelectedWalletId, setWalletAddress, setTradingEnabled]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/auth/login");
  }

  const handleRefresh = async () => {
    if (!selectedWallet) return;
    await fetchAccountData(selectedWallet.id);
  };

  const handleClosePosition = async (symbol: string) => {
    if (!selectedWallet) return;

    try {
      const res = await fetch("/api/trade/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: selectedWallet.id, symbol }),
      });

      if (res.ok) {
        await handleRefresh();
      }
    } catch (err) {
      console.error("Close position error:", err);
    }
  };

  const handleCancelOrder = async (symbol: string, orderId: number) => {
    if (!selectedWallet) return;

    try {
      const res = await fetch("/api/trade/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: selectedWallet.id, symbol, orderId }),
      });

      if (res.ok) {
        await handleRefresh();
      }
    } catch (err) {
      console.error("Cancel order error:", err);
    }
  };

  const handleWalletSelect = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setIsConnected(false);
    setAccount(null);
    setPositions([]);
    setOpenOrders([]);
    setConnectionError("");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">Trading</h1>
            {selectedWallet && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {selectedWallet.nickname}
                </span>
                <span className="text-xs text-gray-600 font-mono">
                  ({selectedWallet.address.slice(0, 6)}...{selectedWallet.address.slice(-4)})
                </span>
                {isConnected && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                    Connected
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/trading/settings"
              className="text-gray-400 hover:text-white"
              title="Extension Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            {isConnected && (
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            )}
            <div className="relative group">
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-800 transition-colors">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || ""}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium">
                    {session?.user?.name?.charAt(0) || "U"}
                  </div>
                )}
              </button>
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 rounded-lg shadow-xl border border-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-3 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{session?.user?.name}</span>
                    {session?.user?.role === "admin" && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-red-900/50 text-red-300 rounded">ADMIN</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{session?.user?.email}</div>
                </div>
                <div className="p-1">
                  {session?.user?.role === "admin" && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Admin Panel
                    </Link>
                  )}
                  <Link
                    href="/trading/settings"
                    className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Trading Settings
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Wallets & Account */}
          <div className="lg:col-span-3 space-y-4">
            <WalletManager
              selectedWallet={selectedWallet}
              onSelectWallet={handleWalletSelect}
            />

            {/* Connection Error */}
            {connectionError && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-red-400">{connectionError}</p>
                    <button
                      onClick={handleRefresh}
                      className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Connecting State */}
            {isLoading && !isConnected && selectedWallet && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-sm text-gray-400">Connecting to Hyperliquid...</span>
                </div>
              </div>
            )}

            {/* Account Overview */}
            {isConnected && (
              <AccountOverview account={account} isLoading={isLoading} />
            )}
          </div>

          {/* Center - Positions & Orders */}
          <div className="lg:col-span-5">
            {isConnected ? (
              <div className="space-y-4">
                {/* Tab Switcher */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("positions")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === "positions"
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Positions ({positions.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === "orders"
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Orders ({openOrders.length})
                  </button>
                </div>

                <PositionsList
                  walletId={selectedWallet?.id || null}
                  positions={positions}
                  openOrders={openOrders}
                  onRefresh={handleRefresh}
                  onClose={handleClosePosition}
                  onCancelOrder={handleCancelOrder}
                  activeTab={activeTab}
                />
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="text-gray-400 mb-2">
                  {selectedWallet
                    ? "Connecting to wallet..."
                    : "Select a wallet to get started"}
                </div>
                <div className="text-xs text-gray-600">
                  Your positions and orders will appear here
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Trading Form */}
          <div className="lg:col-span-4">
            {isConnected && selectedWallet ? (
              <TradingFormPnl
                walletId={selectedWallet.id}
                availableBalance={account?.withdrawable || 0}
                onTradeComplete={handleRefresh}
              />
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="text-gray-400 mb-2">
                  Connect wallet to trade
                </div>
                <div className="text-xs text-gray-600">
                  PNL-based position sizing
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
