"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSecurityGate } from "@/components/security";

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

interface WalletManagerProps {
  selectedWallet: Wallet | null;
  onSelectWallet: (wallet: Wallet) => void;
}

export function WalletManager({ selectedWallet, onSelectWallet }: WalletManagerProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");

  // Add wallet form state
  const [nickname, setNickname] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [apiPrivateKey, setApiPrivateKey] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // Security gate for sensitive actions
  const { requireSecurity, SecurityGate } = useSecurityGate();

  useEffect(() => {
    fetchWallets();
  }, []);

  async function fetchWallets() {
    try {
      const res = await fetch("/api/wallets");
      const data = await res.json();
      if (data.success) {
        setWallets(data.wallets);
        // Auto-select default wallet
        const defaultWallet = data.wallets.find((w: Wallet) => w.isDefault);
        if (defaultWallet && !selectedWallet) {
          onSelectWallet(defaultWallet);
        }
      }
    } catch {
      setError("Failed to load wallets");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddWallet(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsAdding(true);

    try {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          walletAddress,
          apiPrivateKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add wallet");
        return;
      }

      // Refresh wallets
      await fetchWallets();
      setShowAddForm(false);
      setNickname("");
      setWalletAddress("");
      setApiPrivateKey("");
    } catch {
      setError("Network error");
    } finally {
      setIsAdding(false);
    }
  }

  function handleDeleteWallet(walletId: string) {
    // Store the wallet ID and trigger security verification
    setPendingDeleteId(walletId);
    requireSecurity("delete_wallet", () => performDeleteWallet(walletId));
  }

  async function performDeleteWallet(walletId: string) {
    setDeletingId(walletId);
    setPendingDeleteId(null);
    setError("");

    try {
      const res = await fetch(`/api/wallets/${walletId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to delete wallet");
        return;
      }

      // Refresh wallets
      await fetchWallets();

      // Clear selection if deleted wallet was selected
      if (selectedWallet?.id === walletId) {
        const remaining = wallets.filter(w => w.id !== walletId);
        if (remaining.length > 0) {
          onSelectWallet(remaining[0]);
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetDefault(walletId: string) {
    setSettingDefaultId(walletId);
    setError("");

    try {
      const res = await fetch(`/api/wallets/${walletId}/set-default`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to set default wallet");
        return;
      }

      // Refresh wallets to show updated default
      await fetchWallets();
    } catch {
      setError("Network error");
    } finally {
      setSettingDefaultId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-800 rounded w-28"></div>
          <div className="h-16 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <h3 className="font-semibold text-gray-100">Wallets</h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showAddForm
              ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
              : "bg-blue-600 text-white hover:bg-blue-500"
          }`}
        >
          {showAddForm ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Wallet
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 border-b border-gray-800 bg-gray-800/30">
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="e.g., Main Trading Account"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Wallet Address</label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="0x..."
                required
              />
              <p className="mt-1.5 text-xs text-gray-500">Your Hyperliquid/Ethereum wallet address</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">API Wallet Private Key</label>
              <input
                type="password"
                value={apiPrivateKey}
                onChange={(e) => setApiPrivateKey(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your API wallet private key"
                required
              />
              <p className="mt-1.5 text-xs text-gray-500">
                API wallets can only trade - they cannot withdraw funds
              </p>
            </div>

            {/* Security Notice */}
            <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-300">Encrypted & Secure</p>
                  <p className="text-xs text-blue-400/70 mt-0.5">
                    Your key is encrypted and stored securely. Only accessible when you&apos;re logged in.
                  </p>
                </div>
              </div>
            </div>

            {/* Setup Instructions */}
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-300 transition-colors">
                <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                How to create an API wallet
              </summary>
              <ol className="mt-3 ml-6 space-y-2 text-xs text-gray-500">
                <li className="flex gap-2">
                  <span className="text-blue-400 font-medium">1.</span>
                  Go to app.hyperliquid.xyz
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400 font-medium">2.</span>
                  Click your address in the top right
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400 font-medium">3.</span>
                  Select &quot;API Wallets&quot;
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400 font-medium">4.</span>
                  Create a new API wallet and copy the private key
                </li>
              </ol>
            </details>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Connect Wallet
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Wallet List */}
      <div className="p-4">
        {wallets.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm mb-2">No wallets connected</p>
            <p className="text-gray-600 text-xs mb-4">Add a wallet to start trading</p>
            <Link
              href="/setup-guide"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View setup guide
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className={`group relative p-4 rounded-lg transition-all cursor-pointer ${
                  selectedWallet?.id === wallet.id
                    ? "bg-blue-900/30 border-2 border-blue-600 shadow-lg shadow-blue-900/20"
                    : "bg-gray-800/50 border-2 border-transparent hover:border-gray-700 hover:bg-gray-800"
                }`}
                onClick={() => onSelectWallet(wallet)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Wallet Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedWallet?.id === wallet.id ? "bg-blue-600" : "bg-gray-700"
                    }`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>

                    {/* Wallet Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-100">{wallet.nickname}</span>
                        {wallet.isDefault && (
                          <span className="text-[10px] uppercase tracking-wider bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded font-medium">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {wallet._count.trades} trades
                    </div>
                    <div className="text-xs text-gray-600">
                      {wallet._count.bots} bots
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Set as Default Button */}
                  {!wallet.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(wallet.id);
                      }}
                      disabled={settingDefaultId === wallet.id}
                      className="p-1.5 rounded-md hover:bg-blue-900/30 text-gray-500 hover:text-blue-400 transition-all disabled:opacity-50"
                      title="Set as default wallet"
                    >
                      {settingDefaultId === wallet.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWallet(wallet.id);
                    }}
                    disabled={deletingId === wallet.id}
                    className="p-1.5 rounded-md hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-all disabled:opacity-50"
                    title="Delete wallet"
                  >
                    {deletingId === wallet.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Selected Indicator */}
                {selectedWallet?.id === wallet.id && (
                  <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Gate Modal */}
      <SecurityGate />
    </div>
  );
}
