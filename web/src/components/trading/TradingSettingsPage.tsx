"use client";

import { useState, useEffect } from "react";

export function TradingSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Basic Settings
  const [leverage, setLeverage] = useState(25);
  const [risk, setRisk] = useState(1.0);
  const [defaultAsset, setDefaultAsset] = useState("BTC");

  // Advanced Settings
  const [autoAdjustLeverage, setAutoAdjustLeverage] = useState(true);
  const [autoRetryUnfilled, setAutoRetryUnfilled] = useState(false);
  const [unfilledWaitTime, setUnfilledWaitTime] = useState(30);
  const [maxRiskMultiplier, setMaxRiskMultiplier] = useState(2.0);
  const [feeBuffer, setFeeBuffer] = useState(0.05);
  const [updateEntryOnConfirm, setUpdateEntryOnConfirm] = useState(false);
  const [copyReportToClipboard, setCopyReportToClipboard] = useState(false);
  const [liqWarningDistance, setLiqWarningDistance] = useState(300);
  const [liqDangerDistance, setLiqDangerDistance] = useState(100);
  const [pnlTolerance, setPnlTolerance] = useState(0.10);
  const [extensionSkipConfirm, setExtensionSkipConfirm] = useState(true);
  const [extensionEnabled, setExtensionEnabled] = useState(true);

  // Google Sheets
  const [sheetsAuthorized, setSheetsAuthorized] = useState(false);
  const [sheetsEmail, setSheetsEmail] = useState("");
  const [authorizingSheets, setAuthorizingSheets] = useState(false);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/user/settings");
        const data = await res.json();
        if (data.success && data.data) {
          setLeverage(data.data.defaultLeverage || 25);
          setRisk(data.data.defaultRisk || 1.0);
          setDefaultAsset(data.data.defaultAsset || "BTC");
          setAutoAdjustLeverage(data.data.autoAdjustLeverage ?? true);
          setAutoRetryUnfilled(data.data.autoRetryUnfilled ?? false);
          setUnfilledWaitTime(data.data.unfilledWaitTime || 30);
          setMaxRiskMultiplier(data.data.maxRiskMultiplier || 2.0);
          setFeeBuffer(data.data.feeBuffer || 0.05);
          setUpdateEntryOnConfirm(data.data.updateEntryOnConfirm ?? false);
          setCopyReportToClipboard(data.data.copyReportToClipboard ?? false);
          setLiqWarningDistance(data.data.liqWarningDistance || 300);
          setLiqDangerDistance(data.data.liqDangerDistance || 100);
          setPnlTolerance(data.data.pnlTolerance || 0.10);
          setExtensionSkipConfirm(data.data.extensionSkipConfirm ?? true);
          setExtensionEnabled(data.data.extensionEnabled ?? true);
          const googleSheets = data.data.googleSheets || {};
          setSheetsAuthorized(!!googleSheets.refreshToken);
          setSheetsEmail(googleSheets.email || "");
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultLeverage: leverage,
          defaultRisk: risk,
          defaultAsset: defaultAsset,
          autoAdjustLeverage,
          autoRetryUnfilled,
          unfilledWaitTime,
          maxRiskMultiplier,
          feeBuffer,
          updateEntryOnConfirm,
          copyReportToClipboard,
          liqWarningDistance,
          liqDangerDistance,
          pnlTolerance,
          extensionSkipConfirm,
          extensionEnabled,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } else {
        throw new Error(data.error || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorizeSheets = async () => {
    setAuthorizingSheets(true);
    try {
      const res = await fetch("/api/user/google-sheets/authorize");
      const data = await res.json();
      if (data.success && data.data?.authUrl) {
        window.open(data.data.authUrl, "_blank", "width=600,height=700");
        setTimeout(() => window.location.reload(), 3000);
      } else {
        throw new Error(data.error || "Failed to get authorization URL");
      }
    } catch (error) {
      console.error("Authorization error:", error);
      alert("Failed to start authorization. Please try again.");
      setAuthorizingSheets(false);
    }
  };

  const handleDisconnectSheets = async () => {
    if (!confirm("Disconnect Google Sheets integration?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/google-sheets", { method: "DELETE" });
      if (res.ok) {
        setSheetsAuthorized(false);
        setSheetsEmail("");
        alert("Google Sheets disconnected");
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
      alert("Failed to disconnect Google Sheets");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Subtle dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(255 255 255) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">Trading Settings</h1>
          <p className="text-gray-400 text-lg">Configure your trading parameters, automation, and integrations</p>
        </div>

        {/* Save Button - Sticky */}
        <div className="sticky top-6 z-20 flex justify-end mb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-0.5"
          >
            {saving ? "Saving..." : showSuccess ? "Saved!" : "Save All Settings"}
          </button>
        </div>

        {/* Grid Layout - Bento Style */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Default Leverage - Spans 2 columns */}
          <div className="lg:col-span-2 group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-gray-700/50 transition-all hover:-translate-y-0.5">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[length:24px_24px]" />
            </div>
            <div className="relative">
              <h3 className="text-xl font-semibold text-white mb-2">Default Leverage</h3>
              <p className="text-gray-400 text-sm mb-8">Set your preferred leverage multiplier for new positions</p>

              <div className="flex items-center gap-6">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="flex-1 h-3 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex items-center gap-2 bg-gray-800/50 px-6 py-4 rounded-xl min-w-[120px] justify-center border border-gray-700/50">
                  <span className="text-3xl font-bold text-white">{leverage}</span>
                  <span className="text-xl text-gray-400 font-medium">x</span>
                </div>
              </div>
            </div>
          </div>

          {/* Default Risk */}
          <div className="group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-gray-700/50 transition-all hover:-translate-y-0.5">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[length:24px_24px]" />
            </div>
            <div className="relative">
              <h3 className="text-xl font-semibold text-white mb-2">Default Risk</h3>
              <p className="text-gray-400 text-sm mb-8">Max loss per trade</p>

              <div className="flex items-center gap-3 bg-gray-800/50 px-6 py-5 rounded-xl border border-gray-700/50">
                <span className="text-2xl text-gray-400">$</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={risk}
                  onChange={(e) => setRisk(parseFloat(e.target.value) || 0.1)}
                  className="flex-1 bg-transparent text-3xl font-bold text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Default Asset */}
          <div className="group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-gray-700/50 transition-all hover:-translate-y-0.5">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[length:24px_24px]" />
            </div>
            <div className="relative">
              <h3 className="text-xl font-semibold text-white mb-2">Default Asset</h3>
              <p className="text-gray-400 text-sm mb-8">Preferred trading pair</p>

              <div className="grid grid-cols-2 gap-3">
                {['BTC', 'ETH', 'SOL', 'DOGE'].map((asset) => (
                  <button
                    key={asset}
                    onClick={() => setDefaultAsset(asset)}
                    className={`py-4 rounded-xl text-base font-bold transition-all ${
                      defaultAsset === asset
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 border border-gray-700/50'
                    }`}
                  >
                    {asset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Google Sheets - Spans 2 columns */}
          <div className="lg:col-span-2 group relative bg-gradient-to-br from-emerald-900/20 to-gray-900/50 border border-emerald-800/30 rounded-2xl p-8 hover:border-emerald-700/40 transition-all hover:-translate-y-0.5">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[length:24px_24px]" />
            </div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">Google Sheets Export</h3>
              </div>

              {sheetsAuthorized ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-emerald-900/30 border border-emerald-800/50 rounded-xl">
                    <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-semibold text-emerald-400">Connected</p>
                      <p className="text-sm text-gray-400">{sheetsEmail}</p>
                    </div>
                  </div>
                  <p className="text-gray-400">All trades automatically synced to your spreadsheet</p>
                  <button
                    onClick={handleDisconnectSheets}
                    disabled={saving}
                    className="px-6 py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-400 font-semibold rounded-xl transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-300">Auto-export trades to Google Sheets with one click</p>
                  <button
                    onClick={handleAuthorizeSheets}
                    disabled={authorizingSheets}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:-translate-y-0.5"
                  >
                    {authorizingSheets ? "Authorizing..." : "Connect Google Sheets"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Trading Automation - Full width */}
          <div className="lg:col-span-3 group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-gray-700/50 transition-all">
            <div className="relative">
              <h3 className="text-2xl font-semibold text-white mb-6">Trading Automation</h3>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-all border border-gray-700/30">
                  <input
                    type="checkbox"
                    checked={autoAdjustLeverage}
                    onChange={(e) => setAutoAdjustLeverage(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600"
                  />
                  <span className="text-sm font-medium text-white">Auto-adjust Leverage</span>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-all border border-gray-700/30">
                  <input
                    type="checkbox"
                    checked={autoRetryUnfilled}
                    onChange={(e) => setAutoRetryUnfilled(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600"
                  />
                  <span className="text-sm font-medium text-white">Auto-retry Unfilled</span>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-all border border-gray-700/30">
                  <input
                    type="checkbox"
                    checked={updateEntryOnConfirm}
                    onChange={(e) => setUpdateEntryOnConfirm(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600"
                  />
                  <span className="text-sm font-medium text-white">Update Entry on Confirm</span>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-all border border-gray-700/30">
                  <input
                    type="checkbox"
                    checked={copyReportToClipboard}
                    onChange={(e) => setCopyReportToClipboard(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600"
                  />
                  <span className="text-sm font-medium text-white">Copy Report</span>
                </label>
              </div>

              {autoRetryUnfilled && (
                <div className="mt-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Wait Time (seconds)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={unfilledWaitTime}
                    onChange={(e) => setUnfilledWaitTime(parseInt(e.target.value) || 30)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Risk Management - Full width */}
          <div className="lg:col-span-3 group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-gray-700/50 transition-all">
            <div className="relative">
              <h3 className="text-2xl font-semibold text-white mb-6">Risk Management</h3>

              <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <label className="block text-xs font-medium text-gray-400 mb-2">Max Risk Multiplier</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={maxRiskMultiplier}
                    onChange={(e) => setMaxRiskMultiplier(parseFloat(e.target.value) || 2.0)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white font-semibold"
                  />
                </div>

                <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <label className="block text-xs font-medium text-gray-400 mb-2">Fee Buffer (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={feeBuffer}
                    onChange={(e) => setFeeBuffer(parseFloat(e.target.value) || 0.05)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white font-semibold"
                  />
                </div>

                <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <label className="block text-xs font-medium text-gray-400 mb-2">PnL Tolerance (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={pnlTolerance}
                    onChange={(e) => setPnlTolerance(parseFloat(e.target.value) || 0.10)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white font-semibold"
                  />
                </div>

                <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <label className="block text-xs font-medium text-gray-400 mb-2">Liq Warning ($)</label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={liqWarningDistance}
                    onChange={(e) => setLiqWarningDistance(parseInt(e.target.value) || 300)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white font-semibold"
                  />
                </div>

                <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <label className="block text-xs font-medium text-gray-400 mb-2">Liq Danger ($)</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={liqDangerDistance}
                    onChange={(e) => setLiqDangerDistance(parseInt(e.target.value) || 100)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Extension Settings */}
          <div className="lg:col-span-3 group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-gray-700/50 transition-all">
            <div className="relative">
              <h3 className="text-2xl font-semibold text-white mb-6">TradingView Extension</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-all border border-gray-700/30">
                  <input
                    type="checkbox"
                    checked={extensionEnabled}
                    onChange={(e) => setExtensionEnabled(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600"
                  />
                  <span className="text-sm font-medium text-white">Extension Enabled</span>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-all border border-gray-700/30">
                  <input
                    type="checkbox"
                    checked={extensionSkipConfirm}
                    onChange={(e) => setExtensionSkipConfirm(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600"
                  />
                  <span className="text-sm font-medium text-white">Skip Confirmation</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
