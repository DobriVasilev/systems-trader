"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { AppHeader } from "@/components/layout/AppHeader";

// Toggle switch component
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        relative w-11 h-6 rounded-full transition-colors
        ${checked ? "bg-blue-600" : "bg-gray-700"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span
        className={`
          absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
          ${checked ? "left-6" : "left-1"}
        `}
      />
    </button>
  );
}

// Select component
function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm
        focus:outline-none focus:border-blue-500 transition-colors
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "trading" | "integrations" | "data">("profile");
  const {
    preferences,
    isLoading: prefsLoading,
    isSaving,
    error: prefsError,
    updatePreference,
    resetPreferences,
  } = usePreferences();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (status === "unauthenticated") {
    redirect("/auth/login");
  }

  const handleExport = async () => {
    setExportStatus("loading");
    try {
      const response = await fetch("/api/user/export");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `systems-trader-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportStatus("done");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch (err) {
      console.error("Export error:", err);
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    try {
      const response = await fetch("/api/user/delete", { method: "DELETE" });
      if (response.ok) {
        signOut({ callbackUrl: "/" });
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const symbolOptions = [
    { value: "BTC", label: "BTC" },
    { value: "ETH", label: "ETH" },
    { value: "SOL", label: "SOL" },
    { value: "DOGE", label: "DOGE" },
    { value: "XRP", label: "XRP" },
    { value: "AVAX", label: "AVAX" },
    { value: "LINK", label: "LINK" },
  ];

  const timeframeOptions = [
    { value: "1m", label: "1 minute" },
    { value: "5m", label: "5 minutes" },
    { value: "15m", label: "15 minutes" },
    { value: "30m", label: "30 minutes" },
    { value: "1h", label: "1 hour" },
    { value: "4h", label: "4 hours" },
    { value: "1d", label: "1 day" },
  ];

  const swingModeOptions = [
    { value: "wicks", label: "Wicks (High/Low)" },
    { value: "closes", label: "Candle Closes (Open/Close)" },
  ];

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <AppHeader title="Account Settings" />

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || ""}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-medium">
                {session?.user?.name?.charAt(0) || "U"}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{session?.user?.name}</h1>
              <p className="text-gray-400">{session?.user?.email}</p>
              <p className="text-sm text-gray-500 mt-1">Signed in with Google</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "profile"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("preferences")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "preferences"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Preferences
          </button>
          <button
            onClick={() => setActiveTab("trading")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "trading"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Trading
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "integrations"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "data"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Data & Privacy
          </button>
        </div>

        {/* Error display */}
        {prefsError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {prefsError}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "profile" && (
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-semibold">Profile Information</h2>
              <p className="text-sm text-gray-500">
                Your profile information is managed through your Google account.
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                <div className="px-3 py-2 bg-gray-800 rounded-lg text-gray-300">
                  {session?.user?.name || "-"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                <div className="px-3 py-2 bg-gray-800 rounded-lg text-gray-300">
                  {session?.user?.email || "-"}
                </div>
              </div>
              <p className="text-xs text-gray-500">
                To change your profile information, update your Google account settings.
              </p>
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="space-y-4">
            {/* Chart Preferences */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Chart Preferences</h2>
                <p className="text-sm text-gray-500">Configure your default chart settings</p>
              </div>
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Default Symbol</div>
                    <div className="text-sm text-gray-500">Symbol shown when creating new sessions</div>
                  </div>
                  {prefsLoading ? (
                    <div className="w-24 h-10 bg-gray-800 rounded-lg animate-pulse" />
                  ) : (
                    <Select
                      value={preferences.defaultSymbol}
                      onChange={(v) => updatePreference("defaultSymbol", v)}
                      options={symbolOptions}
                      disabled={isSaving}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Default Timeframe</div>
                    <div className="text-sm text-gray-500">Timeframe shown when creating new sessions</div>
                  </div>
                  {prefsLoading ? (
                    <div className="w-28 h-10 bg-gray-800 rounded-lg animate-pulse" />
                  ) : (
                    <Select
                      value={preferences.defaultTimeframe}
                      onChange={(v) => updatePreference("defaultTimeframe", v)}
                      options={timeframeOptions}
                      disabled={isSaving}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Show Volume</div>
                    <div className="text-sm text-gray-500">Display volume bars on chart</div>
                  </div>
                  {prefsLoading ? (
                    <div className="w-11 h-6 bg-gray-800 rounded-full animate-pulse" />
                  ) : (
                    <Toggle
                      checked={preferences.showVolume}
                      onChange={(v) => updatePreference("showVolume", v)}
                      disabled={isSaving}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Detection Preferences */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Detection Preferences</h2>
                <p className="text-sm text-gray-500">Configure how patterns are detected</p>
              </div>
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Swing Detection Mode</div>
                    <div className="text-sm text-gray-500">
                      <span className="text-blue-400">Wicks</span>: Uses candle high/low for swing points
                      <br />
                      <span className="text-purple-400">Closes</span>: Uses candle open/close for swing points
                    </div>
                  </div>
                  {prefsLoading ? (
                    <div className="w-44 h-10 bg-gray-800 rounded-lg animate-pulse" />
                  ) : (
                    <Select
                      value={preferences.swingDetectionMode}
                      onChange={(v) => updatePreference("swingDetectionMode", v as "wicks" | "closes")}
                      options={swingModeOptions}
                      disabled={isSaving}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Notification Preferences</h2>
              </div>
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-sm text-gray-500">Receive email updates about your sessions</div>
                  </div>
                  {prefsLoading ? (
                    <div className="w-11 h-6 bg-gray-800 rounded-full animate-pulse" />
                  ) : (
                    <Toggle
                      checked={preferences.emailNotifications}
                      onChange={(v) => updatePreference("emailNotifications", v)}
                      disabled={isSaving}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Collaboration Alerts</div>
                    <div className="text-sm text-gray-500">Get notified when someone joins your session</div>
                  </div>
                  {prefsLoading ? (
                    <div className="w-11 h-6 bg-gray-800 rounded-full animate-pulse" />
                  ) : (
                    <Toggle
                      checked={preferences.collaborationAlerts}
                      onChange={(v) => updatePreference("collaborationAlerts", v)}
                      disabled={isSaving}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end">
              <button
                onClick={resetPreferences}
                disabled={isSaving || prefsLoading}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Reset to Defaults
              </button>
            </div>

            {/* Saving indicator */}
            {isSaving && (
              <div className="fixed bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </div>
            )}
          </div>
        )}

        {activeTab === "trading" && (
          <div className="space-y-4">
            {/* Wallets */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Wallets & Extension</h2>
                <p className="text-sm text-gray-500">Manage wallets and TradingView extension API keys</p>
              </div>
              <div className="p-4 flex gap-3">
                <Link
                  href="/trading"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Manage Wallets
                </Link>
                <Link
                  href="/trading/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Extension Keys
                </Link>
              </div>
            </div>

            {/* Advanced Trading Settings */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Advanced Settings</h2>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <span className="text-sm">Auto-adjust leverage for balance</span>
                  <Toggle checked={false} onChange={() => {}} disabled />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <span className="text-sm">Auto-retry unfilled orders</span>
                  <Toggle checked={false} onChange={() => {}} disabled />
                </label>
              </div>
            </div>

            {/* Liquidation Warnings */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Liquidation Warnings</h2>
                <p className="text-sm text-gray-500">Alert distances from liquidation price</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Warning Distance ($)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                      placeholder="300"
                      step="50"
                      min="50"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Danger Distance ($)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                      placeholder="100"
                      step="10"
                      min="10"
                      disabled
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PNL Verification */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">PNL Verification</h2>
                <p className="text-sm text-gray-500">Risk and fee calculation parameters</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tolerance (%)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                      placeholder="10"
                      step="1"
                      min="1"
                      max="50"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Max Risk (x)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                      placeholder="2.0"
                      step="0.5"
                      min="1"
                      max="5"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Fee Buffer (%)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                      placeholder="5"
                      step="1"
                      min="0"
                      max="20"
                      disabled
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Position sized to account for fees and slippage</p>
              </div>
            </div>

            {/* Unfilled Orders */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Unfilled Orders</h2>
              </div>
              <div className="p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Wait Time (seconds)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                    placeholder="30"
                    step="5"
                    min="5"
                    max="120"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Other Settings */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Additional Options</h2>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <span className="text-sm">Live entry price on confirm modal</span>
                  <Toggle checked={false} onChange={() => {}} disabled />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <span className="text-sm">Copy trade report to clipboard on execute</span>
                  <Toggle checked={false} onChange={() => {}} disabled />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <span className="text-sm">Enable console debug logging</span>
                  <Toggle checked={false} onChange={() => {}} disabled />
                </label>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-400">
                💡 These settings are currently view-only. Full configuration coming soon. For now, settings can be adjusted per-trade on the Trading page.
              </p>
            </div>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-4">
            {/* Google Sheets Section */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Google Sheets Integration</h2>
                <p className="text-sm text-gray-500">Auto-export trades to your personal trading log spreadsheet</p>
              </div>
              <div className="p-4">
                <div className="text-sm text-gray-400 mb-4">
                  Connect your Google account to automatically log trades to a Google Sheets trading journal with formulas for P&L tracking, risk analysis, and performance metrics.
                </div>
                <Link
                  href="/trading"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Configure Google Sheets
                </Link>
              </div>
            </div>

            {/* Future Integrations */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">More Integrations</h2>
                <p className="text-sm text-gray-500">Connect with other platforms and tools</p>
              </div>
              <div className="p-4">
                <div className="text-sm text-gray-500">
                  Additional integrations coming soon...
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Your Data</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">Export Your Data</div>
                    <div className="text-sm text-gray-500">Download all your sessions and corrections</div>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={exportStatus === "loading"}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      exportStatus === "done"
                        ? "bg-green-600 text-white"
                        : exportStatus === "error"
                        ? "bg-red-600 text-white"
                        : "bg-gray-800 hover:bg-gray-700 text-white"
                    }`}
                  >
                    {exportStatus === "loading" && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {exportStatus === "done" && "Downloaded!"}
                    {exportStatus === "error" && "Error"}
                    {exportStatus === "idle" && "Export"}
                    {exportStatus === "loading" && "Exporting..."}
                  </button>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-red-400">Delete Account</div>
                      <div className="text-sm text-gray-500">
                        Permanently delete your account and all associated data
                      </div>
                    </div>
                    <button
                      onClick={handleDelete}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        deleteConfirm
                          ? "bg-red-600 text-white"
                          : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                      }`}
                    >
                      {deleteConfirm ? "Click Again to Confirm" : "Delete"}
                    </button>
                  </div>
                  {deleteConfirm && (
                    <p className="mt-2 text-sm text-red-400">
                      This action cannot be undone. Click the button again to permanently delete your account.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Privacy</h2>
              </div>
              <div className="p-4 space-y-3">
                <Link
                  href="/privacy"
                  className="flex items-center justify-between py-2 text-gray-300 hover:text-white transition-colors"
                >
                  <span>Privacy Policy</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/terms"
                  className="flex items-center justify-between py-2 text-gray-300 hover:text-white transition-colors"
                >
                  <span>Terms of Service</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Sign Out */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
}
