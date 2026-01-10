"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

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
    selectedWalletId,
    walletAddress,
    tradingEnabled,
    activeTab,
    setSelectedWalletId,
    setWalletAddress,
    setTradingEnabled,
    setActiveTab,
    setError: setAppError,
    setSuccess: setAppSuccess,
  } = useAppStore();

  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [unlockError, setUnlockError] = useState("");

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

  const handleUnlock = async () => {
    if (!selectedWallet || !password) return;

    setUnlockError("");
    setIsLoadingAccount(true);

    try {
      // Fetch account info
      const accountRes = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: selectedWallet.id, password }),
      });

      const accountData = await accountRes.json();

      if (!accountRes.ok) {
        setUnlockError(accountData.error || "Failed to unlock wallet");
        setIsLoadingAccount(false);
        return;
      }

      setAccount(accountData.account);

      // Fetch positions
      const positionsRes = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: selectedWallet.id, password }),
      });

      const positionsData = await positionsRes.json();

      if (positionsRes.ok) {
        setPositions(positionsData.positions || []);
        setOpenOrders(positionsData.openOrders || []);
      }

      // Update app store
      setSelectedWalletId(selectedWallet.id);
      setWalletAddress(selectedWallet.address);
      setTradingEnabled(true);
      setIsUnlocked(true);
    } catch (err) {
      setUnlockError("Network error");
    } finally {
      setIsLoadingAccount(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedWallet || !password || !isUnlocked) return;

    setIsLoadingAccount(true);

    try {
      const [accountRes, positionsRes] = await Promise.all([
        fetch("/api/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletId: selectedWallet.id, password }),
        }),
        fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletId: selectedWallet.id, password }),
        }),
      ]);

      const [accountData, positionsData] = await Promise.all([
        accountRes.json(),
        positionsRes.json(),
      ]);

      if (accountRes.ok) setAccount(accountData.account);
      if (positionsRes.ok) {
        setPositions(positionsData.positions || []);
        setOpenOrders(positionsData.openOrders || []);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsLoadingAccount(false);
    }
  };

  const handleClosePosition = async (symbol: string) => {
    if (!selectedWallet || !password) return;

    try {
      const res = await fetch("/api/trade/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: selectedWallet.id, password, symbol }),
      });

      if (res.ok) {
        await handleRefresh();
      }
    } catch (err) {
      console.error("Close position error:", err);
    }
  };

  const handleCancelOrder = async (symbol: string, orderId: number) => {
    if (!selectedWallet || !password) return;

    try {
      const res = await fetch("/api/trade/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: selectedWallet.id, password, symbol, orderId }),
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
    setIsUnlocked(false);
    setPassword("");
    setAccount(null);
    setPositions([]);
    setOpenOrders([]);
    setUnlockError("");
    setTradingEnabled(false);
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
              <span className="text-sm text-gray-500">
                {selectedWallet.nickname} ({selectedWallet.address.slice(0, 6)}...{selectedWallet.address.slice(-4)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isUnlocked && (
              <button
                onClick={handleRefresh}
                disabled={isLoadingAccount}
                className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              >
                {isLoadingAccount ? "Refreshing..." : "Refresh"}
              </button>
            )}
            <div className="flex items-center gap-2">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm text-gray-400">{session.user?.name}</span>
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

            {/* Unlock Form */}
            {selectedWallet && !isUnlocked && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="font-semibold text-gray-200 mb-3">Unlock Wallet</h3>
                {unlockError && (
                  <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
                    {unlockError}
                  </div>
                )}
                <div className="space-y-3">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Wallet password"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  />
                  <button
                    onClick={handleUnlock}
                    disabled={!password || isLoadingAccount}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {isLoadingAccount ? "Unlocking..." : "Unlock & Connect"}
                  </button>
                </div>
              </div>
            )}

            {/* Account Overview */}
            {isUnlocked && (
              <AccountOverview account={account} isLoading={isLoadingAccount} />
            )}
          </div>

          {/* Center - Positions & Orders */}
          <div className="lg:col-span-5">
            {isUnlocked ? (
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
                <div className="text-gray-500 mb-2">
                  {selectedWallet
                    ? "Unlock your wallet to view positions"
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
            {isUnlocked && selectedWallet ? (
              <TradingFormPnl
                walletId={selectedWallet.id}
                password={password}
                availableBalance={account?.withdrawable || 0}
                onTradeComplete={handleRefresh}
              />
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
                <div className="text-gray-500 mb-2">
                  Unlock wallet to trade
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
