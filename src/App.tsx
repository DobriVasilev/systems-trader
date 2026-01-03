import { useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { ethers } from "ethers";
import { load } from "@tauri-apps/plugin-store";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { writeTextFile, writeFile, mkdir, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Exchange abstraction
import {
  ExchangeType,
  Exchange,
  EXCHANGE_CONFIGS,
  createExchange,
} from "./exchanges";

// Zustand stores
import {
  useExchangeStore,
  useSettingsStore,
  useTradeStore,
  useAppStore,
  type TVPositionData,
  type TradeHistoryItem,
} from "./stores";

interface TVTradeRequest {
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit: number | null;
  risk: number;
  leverage: number;
}

// ==================== LOGGING SYSTEM ====================
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 500;

const formatTimestamp = () => new Date().toISOString();

const log = {
  debug: (context: string, message: string, data?: unknown) => {
    const entry: LogEntry = { timestamp: formatTimestamp(), level: "debug", context, message, data };
    logHistory.push(entry);
    if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();
    console.debug(`[${entry.timestamp}] [DEBUG] [${context}] ${message}`, data ?? "");
  },
  info: (context: string, message: string, data?: unknown) => {
    const entry: LogEntry = { timestamp: formatTimestamp(), level: "info", context, message, data };
    logHistory.push(entry);
    if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();
    console.info(`[${entry.timestamp}] [INFO] [${context}] ${message}`, data ?? "");
  },
  warn: (context: string, message: string, data?: unknown) => {
    const entry: LogEntry = { timestamp: formatTimestamp(), level: "warn", context, message, data };
    logHistory.push(entry);
    if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();
    console.warn(`[${entry.timestamp}] [WARN] [${context}] ${message}`, data ?? "");
  },
  error: (context: string, message: string, error?: unknown) => {
    const errorData = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    const entry: LogEntry = { timestamp: formatTimestamp(), level: "error", context, message, data: errorData };
    logHistory.push(entry);
    if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();
    console.error(`[${entry.timestamp}] [ERROR] [${context}] ${message}`, errorData ?? "");
  },
  getHistory: () => [...logHistory],
  exportLogs: () => JSON.stringify(logHistory, null, 2),
};

// Make logger globally accessible for debugging
(window as any).__appLogs = log;

// Helper to extract error message
const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  return String(e);
};

const HYPERLIQUID_INFO_API = "https://api.hyperliquid.xyz/info";

// GitHub URL for TradingView Bridge extension download
// TODO: Update YOUR_USERNAME/YOUR_REPO when you create the GitHub repo
const TV_BRIDGE_BASE_URL = "https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/tradingview-bridge";
// Extension files to download
const TV_BRIDGE_FILES = ["manifest.json", "content.js", "icon16.png", "icon48.png", "icon128.png"];
const TV_BRIDGE_FOLDER = "tradingview-bridge";
const STORE_PATH = "vault.json";

// Keychain result types from Rust
interface KeychainResult {
  success: boolean;
  error?: string;
}

interface KeychainGetResult {
  success: boolean;
  password?: string;
  error?: string;
}

// AES-256-GCM encryption using Web Crypto API
async function encryptData(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    "raw", passwordBuffer, "PBKDF2", false, ["deriveBits", "deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBuffer
  );

  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...result));
}

async function decryptData(encryptedData: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encrypted = data.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw", passwordBuffer, "PBKDF2", false, ["deriveBits", "deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

// Hash password for verification
async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    "raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
}

// AccountInfo is imported from exchanges/types via useExchangeStore

interface Position {
  symbol: string;
  size: string;
  entryPrice: string;
  unrealizedPnl: string;
  leverage: string;
  liquidationPrice: string;
  side: "long" | "short";
}

interface OpenOrder {
  symbol: string;
  side: "buy" | "sell";
  size: string;
  price: string;
  orderType: string;
  timestamp: number;
  oid: number | string;
}

interface AssetInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  assetId: number | string;
}

// TradeHistoryItem, UnfilledOrder types, and AppState are now imported from stores

// Icon Components
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const FingerprintIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04c.054-.024.108-.057.162-.091a9.88 9.88 0 0 0 3.83-4.655M12 11c0-1.657-1.343-3-3-3s-3 1.343-3 3 1.343 3 3 3m5.197-.917A9.97 9.97 0 0 0 18 11c0-3.314-2.686-6-6-6a5.99 5.99 0 0 0-4.668 2.228M12 11c0 .68-.042 1.348-.124 2" />
    <circle cx="12" cy="11" r="1" fill="currentColor" />
  </svg>
);

const TrendingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// Rolex-style luxury logo - elegant serif H
const LogoIcon = () => (
  <svg viewBox="0 0 32 40" width="28" height="35" style={{ marginRight: '2px' }}>
    <defs>
      <linearGradient id="luxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e0e7ff" />
        <stop offset="100%" stopColor="#a5b4fc" />
      </linearGradient>
    </defs>
    {/* Elegant italic serif H - Rolex/luxury style */}
    <text
      x="16"
      y="32"
      textAnchor="middle"
      fontFamily="Georgia, 'Times New Roman', serif"
      fontSize="38"
      fontStyle="italic"
      fontWeight="400"
      fill="url(#luxGrad)"
      letterSpacing="-1"
    >
      H
    </text>
  </svg>
);

// Auth Layout Component
const AuthLayout = ({
  children,
  title,
  subtitle,
  heroTitle,
  heroHighlight,
  heroDescription,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  heroTitle?: string;
  heroHighlight?: string;
  heroDescription?: string;
}) => (
  <div className="auth-layout">
    {/* Left Panel - Desktop Only */}
    <div className="auth-left-panel">
      <div className="auth-bg">
        <div className="auth-bg-image" />
        <div className="auth-bg-tint" />
        <div className="auth-bg-gradient" />
        <div className="auth-bg-vignette" />
        <div className="auth-bg-edge-fade" />
      </div>

      <div className="auth-left-content">
        <div className="auth-logo">
          <LogoIcon />
          <span className="auth-logo-text">Hyperliquid Trader</span>
        </div>

        <div className="auth-hero">
          <div className="auth-badge">
            <span className="auth-badge-dot" />
            Secure Trading Platform
          </div>
          <h1>
            {heroTitle || "Trade smarter,"}<br />
            <span>{heroHighlight || "trade safer."}</span>
          </h1>
          <p>
            {heroDescription || "Military-grade encryption protects your keys. Touch ID unlocks your vault. Your data never leaves your device."}
          </p>
        </div>

        <div className="auth-features">
          <div className="security-card">
            <div className="security-card-title">
              <ShieldIcon />
              Bank-Level Security
            </div>
            <div className="security-list">
              <div className="security-item">
                <div className="security-item-icon"><CheckIcon /></div>
                AES-256 encryption for all sensitive data
              </div>
              <div className="security-item">
                <div className="security-item-icon"><CheckIcon /></div>
                Touch ID / Face ID biometric protection
              </div>
              <div className="security-item">
                <div className="security-item-icon"><CheckIcon /></div>
                100% local storage - nothing sent to servers
              </div>
              <div className="security-item">
                <div className="security-item-icon"><CheckIcon /></div>
                API wallets can trade but never withdraw
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Right Panel - Form */}
    <div className="auth-right-panel">
      <div className="auth-card">
        <div className="auth-card-header">
          <h2 className="auth-card-title">{title}</h2>
          <p className="auth-card-subtitle">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  </div>
);

// Dashboard icons (defined outside App to prevent recreation on re-renders)
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const FlipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" />
  </svg>
);

const TrendingIconSmall = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Helper: Determine if an open order is a Take Profit or Stop Loss based on position
function getOrderLabel(order: OpenOrder, positions: Position[]): { label: string; type: 'tp' | 'sl' | 'buy' | 'sell' } {
  const position = positions.find(p => p.symbol === order.symbol);
  if (!position) {
    // No matching position - just show side
    return { label: order.side.toUpperCase(), type: order.side as 'buy' | 'sell' };
  }

  const orderPrice = parseFloat(order.price);
  const entryPrice = parseFloat(position.entryPrice);

  if (position.side === 'long') {
    // Long position: SELL order above entry = TP, below entry = SL
    if (order.side === 'sell') {
      if (orderPrice > entryPrice) {
        return { label: 'Take Profit', type: 'tp' };
      } else {
        return { label: 'Stop Loss', type: 'sl' };
      }
    }
  } else {
    // Short position: BUY order below entry = TP, above entry = SL
    if (order.side === 'buy') {
      if (orderPrice < entryPrice) {
        return { label: 'Take Profit', type: 'tp' };
      } else {
        return { label: 'Stop Loss', type: 'sl' };
      }
    }
  }

  // Default: just show the side
  return { label: order.side.toUpperCase(), type: order.side as 'buy' | 'sell' };
}

function App() {
  // App state - from Zustand store
  const {
    appState, setAppState,
    sessionPassword, setSessionPassword,
    biometricAvailable, setBiometricAvailable,
    biometricFailed, setBiometricFailed,
    passwordInput, setPasswordInput,
    confirmPasswordInput, setConfirmPasswordInput,
    showPassword, setShowPassword,
    showConfirmPassword, setShowConfirmPassword,
    showApiKey, setShowApiKey,
    walletAddress, setWalletAddress,
    apiPrivateKey, setApiPrivateKey,
    apiWalletAddress: _apiWalletAddress, setApiWalletAddress,
    tradingEnabled, setTradingEnabled,
    loading, setLoading,
    tradingLoading, setTradingLoading,
    error, setError,
    success, setSuccess,
    activeTab, setActiveTab,
    showSettings, setShowSettings,
    tvPosition, setTvPosition,
    tvOverlayVisible, setTvOverlayVisible,
    pendingExtensionTrade, setPendingExtensionTrade,
    tradeHistory, setTradeHistory,
    updateAvailable, setUpdateAvailable,
    isUpdating, setIsUpdating,
    showVpnWarning, setShowVpnWarning,
    vpnWarningDismissed, setVpnWarningDismissed,
  } = useAppStore();

  // Exchange selection - from Zustand store
  const { selectedExchange, setSelectedExchange } = useSettingsStore();
  const exchangeRef = useRef<Exchange | null>(null);

  // Account data - from Zustand store
  const {
    prices, setPrices,
    accountInfo, setAccountInfo,
    positions, setPositions,
    openOrders, setOpenOrders,
    assets, setAssets,
    assetIds: _assetIds, setAssetIds,
  } = useExchangeStore();

  // Trading inputs - from Zustand store
  const {
    selectedAsset, setSelectedAsset,
    riskAmount, setRiskAmount,
    entryPrice, setEntryPrice,
    stopLoss, setStopLoss,
    takeProfit, setTakeProfit,
    leverage, setLeverage,
    autoUpdateEntry, setAutoUpdateEntry,
    orderType, setOrderType,
    showConfirmModal, setShowConfirmModal,
    direction, setDirection,
    // Calculations
    calculatedQty, setCalculatedQty,
    calculatedMargin, setCalculatedMargin,
    calculatedLiquidation, setCalculatedLiquidation,
    estimatedPnl, setEstimatedPnl,
    rrRatio, setRrRatio,
    slDistance, setSlDistance,
    tpDistance, setTpDistance,
    // Warnings
    liqWarning, setLiqWarning,
    minOrderWarning, setMinOrderWarning,
    balanceWarning, setBalanceWarning,
    priceOrderError, setPriceOrderError,
    // Execution
    isExecuting, setIsExecuting,
    executionStatus, setExecutionStatus,
    showRetryModal, setShowRetryModal,
    retryEntryPrice, setRetryEntryPrice,
    unfilledOrder, setUnfilledOrder,
  } = useTradeStore();
  const tradeHistoryRef = useRef<TradeHistoryItem[]>([]);
  // Ref for deduplicating trade requests (survives React StrictMode double-mount)
  const lastTradeTimestampRef = useRef<number>(0);
  // Ref for content-based deduplication (prevents retries from extension)
  const lastTradeParamsRef = useRef<string>("");

  // Advanced settings - from Zustand store
  const {
    sidebarPosition, setSidebarPosition,
    googleSheetsUrl, setGoogleSheetsUrl,
    autoAdjustLeverage, setAutoAdjustLeverage,
    autoRetryUnfilled, setAutoRetryUnfilled,
    liqWarningDistance, setLiqWarningDistance,
    liqDangerDistance, setLiqDangerDistance,
    pnlTolerance, setPnlTolerance,
    updateEntryOnConfirm, setUpdateEntryOnConfirm,
    copyReportToClipboard, setCopyReportToClipboard,
    debugLogging, setDebugLogging,
    unfilledWaitTime, setUnfilledWaitTime,
    maxRiskMultiplier, setMaxRiskMultiplier,
    feeBuffer, setFeeBuffer,
    settingsLoaded, setSettingsLoaded,
    extensionSkipConfirm, setExtensionSkipConfirm,
    extensionEnabled, setExtensionEnabled,
  } = useSettingsStore();

  // App update state & TradingView Bridge state now come from useAppStore above

  // VPN Warning - detect if user is in the US based on timezone only
  // (not locale - many non-US users have en-US locale)
  useEffect(() => {
    if (vpnWarningDismissed) return;

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Only specific US timezones trigger warning
      const usTimezones = [
        "America/New_York", "America/Chicago", "America/Denver",
        "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
        "America/Honolulu", "America/Detroit", "America/Indiana",
        "America/Kentucky", "America/Boise", "America/Juneau",
        "Pacific/Honolulu",
      ];

      const isUSTimezone = usTimezones.some(tz => timezone.startsWith(tz));

      if (isUSTimezone) {
        setShowVpnWarning(true);
        log.info("VPN", "Detected US timezone", { timezone });
      }
    } catch (e) {
      log.warn("VPN", "Failed to detect timezone", e);
    }
  }, [vpnWarningDismissed, setShowVpnWarning]);

  // Debug: Log overlay visibility changes
  useEffect(() => {
    console.log("[TVBridge DEBUG] tvOverlayVisible changed to:", tvOverlayVisible, "tvPosition:", tvPosition);
  }, [tvOverlayVisible, tvPosition]);

  // Settings interface for persistence
  interface ProfileSettings {
    riskAmount: string;
    leverage: string;
    selectedAsset: string;
    orderType: "market" | "limit";
    autoUpdateEntry: boolean;
    sidebarPosition: "left" | "right";
    googleSheetsUrl: string;
    autoAdjustLeverage: boolean;
    autoRetryUnfilled: boolean;
    liqWarningDistance: number;
    liqDangerDistance: number;
    pnlTolerance: number;
    updateEntryOnConfirm: boolean;
    copyReportToClipboard: boolean;
    debugLogging: boolean;
    unfilledWaitTime: number;
    maxRiskMultiplier: number;
    feeBuffer: number;
    extensionSkipConfirm: boolean;
    extensionEnabled: boolean;
  }

  // Ref to track pending save timeout for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to hold current settings values (avoids recreating callback on every change)
  const settingsRef = useRef({
    riskAmount, leverage, selectedAsset, orderType, autoUpdateEntry,
    sidebarPosition, googleSheetsUrl, autoAdjustLeverage, autoRetryUnfilled,
    liqWarningDistance, liqDangerDistance, pnlTolerance, updateEntryOnConfirm,
    copyReportToClipboard, debugLogging, unfilledWaitTime, maxRiskMultiplier, feeBuffer,
    extensionSkipConfirm, extensionEnabled,
  });

  // Keep ref in sync
  settingsRef.current = {
    riskAmount, leverage, selectedAsset, orderType, autoUpdateEntry,
    sidebarPosition, googleSheetsUrl, autoAdjustLeverage, autoRetryUnfilled,
    liqWarningDistance, liqDangerDistance, pnlTolerance, updateEntryOnConfirm,
    copyReportToClipboard, debugLogging, unfilledWaitTime, maxRiskMultiplier, feeBuffer,
    extensionSkipConfirm, extensionEnabled,
  };

  // Save settings to store (stable callback, reads from ref)
  const saveSettings = useCallback(async () => {
    if (!walletAddress || !settingsLoaded) return;
    try {
      const store = await load(STORE_PATH);
      const settings: ProfileSettings = settingsRef.current;
      await store.set(`settings_${walletAddress}`, settings);
      await store.save();
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }, [walletAddress, settingsLoaded]);

  // Load settings from store
  const loadSettings = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const store = await load(STORE_PATH);
      const settings = await store.get<ProfileSettings>(`settings_${walletAddress}`);
      if (settings) {
        setRiskAmount(settings.riskAmount ?? "1.00");
        setLeverage(settings.leverage ?? "25");
        setSelectedAsset(settings.selectedAsset ?? "BTC");
        setOrderType(settings.orderType ?? "limit");
        // Always start with autoUpdateEntry enabled (don't persist this setting)
        setAutoUpdateEntry(true);
        setSidebarPosition(settings.sidebarPosition ?? "right");
        setGoogleSheetsUrl(settings.googleSheetsUrl ?? "");
        setAutoAdjustLeverage(settings.autoAdjustLeverage ?? true);
        setAutoRetryUnfilled(settings.autoRetryUnfilled ?? false);
        setLiqWarningDistance(settings.liqWarningDistance ?? 300);
        setLiqDangerDistance(settings.liqDangerDistance ?? 100);
        setPnlTolerance(settings.pnlTolerance ?? 0.10);
        setUpdateEntryOnConfirm(settings.updateEntryOnConfirm ?? false);
        setCopyReportToClipboard(settings.copyReportToClipboard ?? false);
        setDebugLogging(settings.debugLogging ?? false);
        setUnfilledWaitTime(settings.unfilledWaitTime ?? 30000);
        setMaxRiskMultiplier(settings.maxRiskMultiplier ?? 2.0);
        setFeeBuffer(settings.feeBuffer ?? 0.05);
        setExtensionSkipConfirm(settings.extensionSkipConfirm ?? true);
        setExtensionEnabled(settings.extensionEnabled ?? true);
      }

      // Load persisted open trades
      const storedTrades = await store.get<TradeHistoryItem[]>(`openTrades_${walletAddress}`);
      if (storedTrades && storedTrades.length > 0) {
        setTradeHistory(storedTrades);
        log.info("Storage", "Loaded persisted trades", { count: storedTrades.length });
      }

      setSettingsLoaded(true);
    } catch (e) {
      console.error("Failed to load settings:", e);
      setSettingsLoaded(true);
    }
  }, [walletAddress]);

  // Check for app updates on mount
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update?.available) {
          setUpdateAvailable({
            version: update.version,
            notes: update.body || "New version available",
          });
        }
      } catch (e) {
        // Silently fail - updates are not critical
        console.log("Update check failed:", e);
      }
    };

    // Check after a short delay to not block startup
    const timeout = setTimeout(checkForUpdates, 3000);
    return () => clearTimeout(timeout);
  }, []);

  // Install update function
  const installUpdate = async () => {
    try {
      setIsUpdating(true);
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      console.error("Update failed:", e);
      setIsUpdating(false);
    }
  };

  // Auto-save settings when they change (debounced)
  useEffect(() => {
    if (!settingsLoaded || !walletAddress) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 500ms
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    settingsLoaded, walletAddress, saveSettings,
    riskAmount, leverage, selectedAsset, orderType, autoUpdateEntry,
    sidebarPosition, googleSheetsUrl, autoAdjustLeverage, autoRetryUnfilled,
    liqWarningDistance, liqDangerDistance, pnlTolerance, updateEntryOnConfirm,
    copyReportToClipboard, debugLogging, unfilledWaitTime, maxRiskMultiplier, feeBuffer,
    extensionSkipConfirm, extensionEnabled
  ]);

  // Sync settings with TradingView Bridge backend
  useEffect(() => {
    const risk = parseFloat(riskAmount) || 1;
    const lev = parseInt(leverage) || 25;
    const currentPrice = prices.get(selectedAsset) ? parseFloat(prices.get(selectedAsset)!) : 0;
    invoke("update_bridge_settings", {
      risk,
      leverage: lev,
      asset: selectedAsset,
      price: currentPrice
    }).catch(() => {});
  }, [riskAmount, leverage, selectedAsset, prices]);

  // Load settings when wallet is available
  useEffect(() => {
    if (walletAddress && appState === "dashboard" && !settingsLoaded) {
      loadSettings();
    }
  }, [walletAddress, appState, settingsLoaded, loadSettings]);

  // Trade execution state & calculated values now come from useTradeStore above

  // Constants (Hyperliquid defaults)
  const TAKER_FEE_RATE = 0.00035; // 0.035% taker fee on Hyperliquid
  const MAINTENANCE_MARGIN = 0.005; // 0.5% maintenance margin

  // Unlock with password (from keychain or manual entry)
  const unlockWithPassword = useCallback(async (password: string) => {
    try {
      const store = await load(STORE_PATH);

      const saltBase64 = await store.get<string>("passwordSalt");
      const storedHash = await store.get<string>("passwordHash");

      if (!saltBase64 || !storedHash) {
        throw new Error("Vault corrupted");
      }

      const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
      const inputHash = await hashPassword(password, salt);

      if (inputHash !== storedHash) {
        throw new Error("Wrong password");
      }

      setSessionPassword(password);

      const encryptedWallet = await store.get<string>("encryptedWallet");

      if (encryptedWallet) {
        const decrypted = await decryptData(encryptedWallet, password);
        const data = JSON.parse(decrypted);

        setWalletAddress(data.walletAddress);
        setApiPrivateKey(data.apiPrivateKey || "");

        // Load exchange type (default to hyperliquid for backwards compatibility)
        const exchangeType: ExchangeType = data.exchangeType || "hyperliquid";
        setSelectedExchange(exchangeType);

        if (data.apiPrivateKey) {
          // Initialize exchange with credentials
          try {
            const exchange = createExchange(exchangeType, false);
            await exchange.initialize({
              walletAddress: data.walletAddress,
              privateKey: data.apiPrivateKey,
            });
            exchangeRef.current = exchange;

            // Set API wallet address from private key
            const wallet = new ethers.Wallet(data.apiPrivateKey);
            setApiWalletAddress(wallet.address);
            setTradingEnabled(true);

            log.info("Exchange", `Restored connection to ${exchangeType}`);
          } catch (e) {
            log.error("Exchange", "Failed to restore exchange connection", e);
          }
        }

        // Fetch initial data using exchange if available
        if (exchangeRef.current) {
          try {
            const [accountData, positionsData, ordersData] = await Promise.all([
              exchangeRef.current.getAccountInfo(),
              exchangeRef.current.getPositions(),
              exchangeRef.current.getOpenOrders(),
            ]);
            setAccountInfo(accountData);
            setPositions(positionsData);
            setOpenOrders(ordersData);
          } catch (e) {
            log.warn("Exchange", "Failed to fetch data on unlock", e);
            // Fallback to legacy fetch
            await fetchUserState(data.walletAddress);
          }
        } else {
          // No exchange initialized, try legacy fetch
          await fetchUserState(data.walletAddress);
        }

        setAppState("dashboard");
      } else {
        setAppState("setup_keys");
      }

      return true;
    } catch (e) {
      log.error("Auth", "Unlock failed", e);
      throw e;
    }
  }, []);

  // Fetch actual position data for a specific asset
  // Returns the REAL entry price and size after order fill
  const fetchActualPosition = async (
    address: string,
    asset: string,
    maxAttempts: number = 5,
    delayMs: number = 500
  ): Promise<{ actualEntry: number; actualSize: number } | null> => {
    // Use the Hyperliquid API directly
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(HYPERLIQUID_INFO_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "clearinghouseState",
            user: address,
          }),
        });
        const data = await response.json();

        if (data.assetPositions) {
          const position = data.assetPositions.find(
            (p: any) => p.position.coin === asset && parseFloat(p.position.szi) !== 0
          );
          if (position) {
            return {
              actualEntry: parseFloat(position.position.entryPx),
              actualSize: Math.abs(parseFloat(position.position.szi)),
            };
          }
        }
      } catch (e) {
        log.warn("Trading", `Attempt ${attempt + 1} to fetch position failed`, e);
      }

      // Wait before next attempt
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return null;
  };

  // Fetch actual fill price from Hyperliquid for a closed position
  // Returns the most recent fill price for the given asset
  const fetchActualFillPrice = async (
    address: string,
    asset: string,
    direction: "long" | "short",
    afterTimestamp?: number
  ): Promise<{ fillPrice: number; fillTime: number } | null> => {
    try {
      const response = await fetch(HYPERLIQUID_INFO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "userFills",
          user: address,
        }),
      });
      const fills = await response.json();

      if (!Array.isArray(fills) || fills.length === 0) return null;

      // Filter fills for this asset that are closing trades (opposite side)
      // For a long position closing, we look for a sell fill
      // For a short position closing, we look for a buy fill
      const closingSide = direction === "long" ? "A" : "B"; // A = sell, B = buy in Hyperliquid

      const relevantFills = fills.filter((fill: any) => {
        const isRightAsset = fill.coin === asset;
        const isClosingTrade = fill.side === closingSide || fill.dir === "Close Long" || fill.dir === "Close Short";
        const isAfterTimestamp = afterTimestamp ? fill.time > afterTimestamp : true;
        return isRightAsset && isClosingTrade && isAfterTimestamp;
      });

      if (relevantFills.length === 0) {
        // Try alternative: just get the most recent fill for this asset
        const assetFills = fills.filter((fill: any) => fill.coin === asset);
        if (assetFills.length > 0) {
          const mostRecent = assetFills.reduce((latest: any, fill: any) =>
            fill.time > latest.time ? fill : latest
          );
          return {
            fillPrice: parseFloat(mostRecent.px),
            fillTime: mostRecent.time,
          };
        }
        return null;
      }

      // Get the most recent relevant fill
      const mostRecent = relevantFills.reduce((latest: any, fill: any) =>
        fill.time > latest.time ? fill : latest
      );

      return {
        fillPrice: parseFloat(mostRecent.px),
        fillTime: mostRecent.time,
      };
    } catch (e) {
      log.error("Trading", "Failed to fetch fill price", e);
      return null;
    }
  };

  // Fetch user state
  const fetchUserState = useCallback(async (address: string) => {
    try {
      // Fetch clearinghouse state (positions + account info)
      const response = await fetch(HYPERLIQUID_INFO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "clearinghouseState",
          user: address,
        }),
      });
      const data = await response.json();

      if (data.marginSummary) {
        setAccountInfo({
          balance: parseFloat(data.marginSummary.accountValue).toFixed(2),
          available: parseFloat(data.withdrawable).toFixed(2),
          totalMarginUsed: parseFloat(data.marginSummary.totalMarginUsed).toFixed(2),
          totalPositionValue: parseFloat(data.marginSummary.totalNtlPos).toFixed(2),
        });
      }

      if (data.assetPositions) {
        const positionList: Position[] = data.assetPositions
          .filter((p: any) => parseFloat(p.position.szi) !== 0)
          .map((p: any) => ({
            symbol: p.position.coin,
            size: p.position.szi,
            entryPrice: parseFloat(p.position.entryPx).toFixed(2),
            unrealizedPnl: parseFloat(p.position.unrealizedPnl).toFixed(2),
            leverage: p.position.leverage?.value || "1",
            liquidationPrice: p.position.liquidationPx
              ? parseFloat(p.position.liquidationPx).toFixed(2)
              : "N/A",
            side: parseFloat(p.position.szi) > 0 ? "long" : "short",
          }));
        setPositions(positionList);
      }

      // Fetch open orders
      const ordersResponse = await fetch(HYPERLIQUID_INFO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "openOrders",
          user: address,
        }),
      });
      const ordersData = await ordersResponse.json();

      if (Array.isArray(ordersData)) {
        const ordersList: OpenOrder[] = ordersData.map((o: any) => ({
          symbol: o.coin,
          side: o.side === "B" ? "buy" : "sell",
          size: o.sz,
          price: o.limitPx,
          orderType: o.orderType || "limit",
          timestamp: o.timestamp,
          oid: o.oid,
        }));
        setOpenOrders(ordersList);
      }
    } catch (e) {
      log.error("API", "Failed to fetch user state", e);
      throw e;
    }
  }, []);

  // Check vault and try biometric unlock on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        const store = await load(STORE_PATH);
        const hasVault = await store.get<boolean>("hasVault");

        if (!hasVault) {
          setAppState("setup_password");
          return;
        }

        // Check if Touch ID is available
        try {
          const biometricCheck = await invoke<{ success: boolean; available: boolean; error?: string }>("check_biometric_available");

          if (biometricCheck.available) {
            setAppState("biometric_prompt");
            setBiometricAvailable(true);

            // Try Touch ID authentication
            log.info("Auth", "Attempting Touch ID authentication");
            const authResult = await invoke<{ success: boolean; available: boolean; error?: string }>("authenticate_biometric", {
              reason: "Unlock Hyperliquid Trader"
            });

            if (authResult.success) {
              log.info("Auth", "Touch ID successful, loading keychain");
              const result = await invoke<KeychainGetResult>("keychain_load");

              if (result.success && result.password) {
                log.info("Auth", "Keychain load successful, unlocking vault");
                await unlockWithPassword(result.password);
              } else {
                log.warn("Auth", "Keychain load failed after Touch ID", { error: result.error });
                setBiometricFailed(true);
                setAppState("unlock");
              }
            } else {
              log.warn("Auth", "Touch ID failed", { error: authResult.error });
              setBiometricFailed(true);
              setAppState("unlock");
            }
          } else {
            // No biometrics available, go straight to password
            log.info("Auth", "Biometrics not available, using password");
            setAppState("unlock");
          }
        } catch (e) {
          log.error("Auth", "Biometric check failed", e);
          setAppState("unlock");
        }
      } catch (e) {
        log.error("App", "Error initializing app", e);
        setAppState("setup_password");
      }
    };

    initApp();
  }, [unlockWithPassword]);

  // Fetch asset metadata
  const fetchMeta = useCallback(async () => {
    try {
      const response = await fetch(HYPERLIQUID_INFO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
      });
      const data = await response.json();

      const assetMap = new Map<string, AssetInfo>();
      const idMap = new Map<string, number>();
      if (data.universe) {
        data.universe.forEach((asset: any, index: number) => {
          assetMap.set(asset.name, {
            name: asset.name,
            szDecimals: asset.szDecimals,
            maxLeverage: asset.maxLeverage,
            assetId: index,
          });
          idMap.set(asset.name, index);
        });
      }
      setAssets(assetMap);
      setAssetIds(idMap);
    } catch (e) {
      console.error("Failed to fetch meta:", e);
    }
  }, []);

  // Fetch prices - no dependencies to avoid stale closures with setInterval
  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch(HYPERLIQUID_INFO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "allMids" }),
      });
      const data = await response.json();

      const priceMap = new Map<string, string>();
      Object.entries(data).forEach(([symbol, price]) => {
        priceMap.set(symbol, price as string);
      });
      setPrices(priceMap);
    } catch (e) {
      console.error("Failed to fetch prices:", e);
    }
  }, []);

  // Sign and place order (uses exchange abstraction)
  const placeOrder = async (isBuy: boolean, size: string, price: string, isMarket: boolean = false) => {
    if (!exchangeRef.current || !tradingEnabled) {
      setError("Exchange not connected");
      return;
    }

    setTradingLoading(true);
    setError("");
    setSuccess("");

    try {
      log.debug("Trading", "Order details", {
        exchange: selectedExchange,
        asset: selectedAsset,
        isBuy,
        price,
        size,
        isMarket,
      });

      const result = await exchangeRef.current.placeOrder({
        asset: selectedAsset,
        isBuy,
        size: parseFloat(size),
        price: parseFloat(price),
        postOnly: !isMarket,
      });

      if (result.success) {
        setSuccess(`Order placed! ${isBuy ? "LONG" : "SHORT"} ${size} ${selectedAsset} @ $${price}`);
        // Refresh data
        if (exchangeRef.current) {
          const [accountData, positionsData, ordersData] = await Promise.all([
            exchangeRef.current.getAccountInfo(),
            exchangeRef.current.getPositions(),
            exchangeRef.current.getOpenOrders(),
          ]);
          setAccountInfo(accountData);
          setPositions(positionsData);
          setOpenOrders(ordersData);
        }
      } else {
        throw new Error(result.error || "Order failed");
      }
    } catch (e) {
      log.error("Trading", "Order failed", e);
      setError(`Order failed: ${getErrorMessage(e)}`);
      throw e; // Re-throw so caller knows order failed
    } finally {
      setTradingLoading(false);
    }
  };

  // Place stop loss (uses exchange abstraction)
  const placeStopLoss = async (isBuy: boolean, size: string, triggerPrice: string) => {
    if (!exchangeRef.current || !tradingEnabled) return;

    try {
      // Use exchange-specific stop loss method
      const exchange = exchangeRef.current as any; // Cast to access placeStopLoss
      if (typeof exchange.placeStopLoss === "function") {
        const result = await exchange.placeStopLoss(
          selectedAsset,
          isBuy,
          parseFloat(size),
          parseFloat(triggerPrice)
        );
        if (!result.success) {
          log.warn("Trading", "Stop loss failed", result.error);
        }
      } else {
        log.warn("Trading", "Exchange does not support stop loss orders");
      }
    } catch (e) {
      log.error("Trading", "Stop loss failed", e);
    }
  };

  // Initial fetch - NO MORE POLLING! Prices fetched on-demand only
  useEffect(() => {
    fetchMeta();
    // Fetch prices once on mount, then only on-demand
    fetchPrices();
  }, [fetchMeta, fetchPrices]);

  // Refresh data function - call this on-demand instead of polling
  const refreshExchangeData = useCallback(async () => {
    if (!exchangeRef.current) return;
    try {
      const [accountData, positionsData, ordersData, pricesData] = await Promise.all([
        exchangeRef.current.getAccountInfo(),
        exchangeRef.current.getPositions(),
        exchangeRef.current.getOpenOrders(),
        exchangeRef.current.getMarketPrices(),
      ]);
      setAccountInfo(accountData);
      setPositions(positionsData);
      setOpenOrders(ordersData);
      const priceMap = new Map<string, string>();
      for (const [asset, price] of Object.entries(pricesData)) {
        priceMap.set(asset, price.toString());
      }
      setPrices(priceMap);
    } catch (e) {
      log.warn("Dashboard", "Failed to refresh data", e);
      // Fallback to legacy fetch for Hyperliquid
      if (selectedExchange === "hyperliquid") {
        fetchUserState(walletAddress);
        fetchPrices();
      }
    }
  }, [selectedExchange, walletAddress, fetchUserState, fetchPrices]);

  // Initial dashboard data fetch (once, not polling)
  useEffect(() => {
    if (appState !== "dashboard" || !walletAddress) return;
    refreshExchangeData();
  }, [appState, walletAddress, refreshExchangeData]);

  // TradingView Bridge listener
  useEffect(() => {
    let unlistenPosition: (() => void) | null = null;
    let unlistenClosed: (() => void) | null = null;
    let unlistenExecute: (() => void) | null = null;

    const setupListeners = async () => {
      console.log("[TVBridge] Setting up event listeners...");
      unlistenPosition = await listen<TVPositionData>("tradingview-position", (event) => {
        console.log("[TVBridge] *** RECEIVED POSITION ***", event.payload);
        log.info("TVBridge", "Received position data", event.payload);
        setTvPosition(event.payload);
        setTvOverlayVisible(true);
      });
      console.log("[TVBridge] Position listener ready");

      unlistenClosed = await listen("tradingview-position-closed", () => {
        console.log("[TVBridge] *** POSITION CLOSED ***");
        log.info("TVBridge", "Position closed");
        setTvOverlayVisible(false);
        setTvPosition(null);
      });

      // Execute trade from TradingView Bridge extension
      // Deduplication uses ref to survive React StrictMode double-mount
      unlistenExecute = await listen<TVTradeRequest>("tradingview-execute-trade", (event) => {
        const now = Date.now();

        // Time-based deduplication: ignore if received within 2 seconds
        if (now - lastTradeTimestampRef.current < 2000) {
          console.log("[TVBridge] Ignoring duplicate trade request (within 2s)");
          return;
        }

        // Content-based deduplication: ignore if same trade params within 60 seconds
        // This prevents TradingView extension retries from creating duplicate trades
        const tradeParams = JSON.stringify({
          direction: event.payload.direction,
          entry: event.payload.entry,
          stopLoss: event.payload.stopLoss,
          takeProfit: event.payload.takeProfit,
        });
        if (tradeParams === lastTradeParamsRef.current && now - lastTradeTimestampRef.current < 60000) {
          console.log("[TVBridge] Ignoring retry - same trade params within 60s");
          // Report success to stop extension from retrying
          invoke("report_trade_result", { success: true, error: null }).catch(() => {});
          return;
        }

        lastTradeTimestampRef.current = now;
        lastTradeParamsRef.current = tradeParams;

        console.log("[TVBridge] *** EXECUTE TRADE ***", event.payload);
        log.info("TVBridge", "Execute trade request", event.payload);

        // Check if extension is enabled
        if (!settingsRef.current.extensionEnabled) {
          console.log("[TVBridge] Extension disabled - ignoring trade request");
          // Report back that extension is disabled
          invoke("report_trade_result", { success: false, error: "Extension disabled in app settings" }).catch(() => {});
          return;
        }

        const { direction, entry, stopLoss, takeProfit, risk, leverage: lev } = event.payload;

        // Fill in the form values
        setDirection(direction as "long" | "short");
        setEntryPrice(entry.toString());
        setStopLoss(stopLoss.toString());
        setTakeProfit(takeProfit ? takeProfit.toString() : "");
        setRiskAmount(risk.toString());
        setLeverage(lev.toString());

        // Auto-disable entry update since we have a specific entry
        setAutoUpdateEntry(false);

        // Check if we should skip confirmation (execute directly)
        if (settingsRef.current.extensionSkipConfirm) {
          console.log("[TVBridge] Skipping confirmation - auto-executing trade");
          // Set flag to trigger auto-execution after state updates
          setPendingExtensionTrade(true);
        } else {
          // Show the confirmation modal
          setShowConfirmModal(true);
        }
      });
      console.log("[TVBridge] Execute trade listener ready");

      console.log("[TVBridge] All listeners ready");
    };

    setupListeners();

    return () => {
      if (unlistenPosition) unlistenPosition();
      if (unlistenClosed) unlistenClosed();
      if (unlistenExecute) unlistenExecute();
    };
  }, []);

  // Position close detection - uses ref to avoid infinite loop
  const previousPositionsRef = useRef<Position[]>([]);
  const offlineCheckDoneRef = useRef(false);

  // Keep tradeHistoryRef in sync with tradeHistory state
  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
  }, [tradeHistory]);

  // Persist trade history to storage (for offline close detection and history)
  useEffect(() => {
    if (!walletAddress || !settingsLoaded) return;
    if (tradeHistory.length === 0) return;

    const persistTrades = async () => {
      try {
        const store = await load(STORE_PATH);
        await store.set(`openTrades_${walletAddress}`, tradeHistory);
        await store.save();
        const openCount = tradeHistory.filter(t => t.sheetsLogged && t.status === "filled").length;
        log.info("Storage", "Persisted trades", { total: tradeHistory.length, open: openCount });
      } catch (e) {
        log.error("Storage", "Failed to persist trades", e);
      }
    };

    persistTrades();
  }, [tradeHistory, walletAddress, settingsLoaded]);

  // Check for trades that closed while app was offline
  useEffect(() => {
    if (!walletAddress || !googleSheetsUrl || offlineCheckDoneRef.current) return;
    if (positions.length === 0 && previousPositionsRef.current.length === 0) return;

    const checkOfflineCloses = async () => {
      try {
        const store = await load(STORE_PATH);
        const storedTrades = await store.get<TradeHistoryItem[]>(`openTrades_${walletAddress}`);

        if (!storedTrades || storedTrades.length === 0) {
          offlineCheckDoneRef.current = true;
          return;
        }

        // Filter for open trades that were logged to sheets
        const openTrades = storedTrades.filter(t => t.sheetsLogged && t.status === "filled");
        if (openTrades.length === 0) {
          offlineCheckDoneRef.current = true;
          return;
        }

        log.info("Storage", "Checking for offline closes", { openCount: openTrades.length });

        // Find trades that are no longer in positions (closed while offline)
        const closedOffline = openTrades.filter(trade => {
          const stillOpen = positions.some(
            pos => pos.symbol === trade.symbol &&
                   ((trade.direction === "long" && parseFloat(pos.size) > 0) ||
                    (trade.direction === "short" && parseFloat(pos.size) < 0))
          );
          return !stillOpen;
        });

        if (closedOffline.length > 0) {
          log.info("Trading", "Found trades closed while offline", { count: closedOffline.length });

          // Process offline closes with actual fill prices
          const processedCloses: Array<{
            trade: TradeHistoryItem;
            closePrice: number;
            pnl: number;
            result: "win" | "loss" | "breakeven";
          }> = [];

          for (const trade of closedOffline) {
            // Fetch ACTUAL fill price from Hyperliquid
            const fillData = await fetchActualFillPrice(
              walletAddress,
              trade.symbol,
              trade.direction,
              trade.timestamp
            );

            const closePrice = fillData?.fillPrice ?? parseFloat(prices.get(trade.symbol) || "0");
            const pnl = trade.direction === "long"
              ? (closePrice - trade.entry) * trade.qty
              : (trade.entry - closePrice) * trade.qty;

            let result: "win" | "loss" | "breakeven" = "breakeven";
            if (pnl > trade.risk * 0.1) result = "win";
            else if (pnl < -trade.risk * 0.1) result = "loss";

            log.info("Trading", "Sending offline close update", {
              symbol: trade.symbol,
              direction: trade.direction,
              closePrice,
              actualFillPrice: fillData?.fillPrice ?? "not found",
              pnl,
              result
            });

            processedCloses.push({ trade, closePrice, pnl, result });

            sendToGoogleSheets({
              action: "close",
              coin: trade.symbol,
              entry: trade.entry,
              sl: trade.sl,
              exitPrice: closePrice,
              realizedLoss: result === "loss" ? Math.abs(pnl) : null,
              realizedWin: result === "win" ? pnl : null,
            });
          }

          // Update trade history with closed status using actual fill prices
          setTradeHistory(prev => prev.map(trade => {
            const closedData = processedCloses.find(t => t.trade.id === trade.id);
            if (closedData) {
              return {
                ...trade,
                status: "closed" as const,
                closePrice: closedData.closePrice,
                closeTimestamp: Date.now(),
                pnl: closedData.pnl,
                result: closedData.result
              };
            }
            return trade;
          }));

          // Note: Storage will be updated by the tradeHistory persist useEffect
        }

        offlineCheckDoneRef.current = true;
      } catch (e) {
        log.error("Storage", "Failed to check offline closes", e);
        offlineCheckDoneRef.current = true;
      }
    };

    checkOfflineCloses();
  }, [positions, walletAddress, googleSheetsUrl, prices]);

  // Settings scroll position ref - preserves scroll across re-renders
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const settingsScrollTop = useRef(0);

  // Save scroll position on every scroll
  const handleSettingsScroll = useCallback(() => {
    if (settingsScrollRef.current) {
      settingsScrollTop.current = settingsScrollRef.current.scrollTop;
    }
  }, []);

  // Restore scroll position after settings panel render
  useLayoutEffect(() => {
    if (showSettings && settingsScrollRef.current && settingsScrollTop.current > 0) {
      settingsScrollRef.current.scrollTop = settingsScrollTop.current;
    }
  }, [showSettings]);

  useEffect(() => {
    if (appState !== "dashboard") return;

    const prevPositions = previousPositionsRef.current;

    // Find positions that were in previous but not in current (closed)
    if (prevPositions.length > 0) {
      const closedPositions = prevPositions.filter(prevPos => {
        const stillOpen = positions.some(
          curPos => curPos.symbol === prevPos.symbol &&
                    ((prevPos.side === "long" && parseFloat(curPos.size) > 0) ||
                     (prevPos.side === "short" && parseFloat(curPos.size) < 0))
        );
        return !stillOpen;
      });

      // Update trade history for closed positions
      if (closedPositions.length > 0) {
        // Process closed positions asynchronously to get actual fill prices
        (async () => {
          const tradesToClose: Array<{
            trade: TradeHistoryItem;
            closePrice: number;
            pnl: number;
            result: "win" | "loss" | "breakeven";
          }> = [];

          // Get current trade history to find trades that need closing
          const currentHistory = tradeHistoryRef.current;

          for (const closedPos of closedPositions) {
            const trade = currentHistory.find(
              t => t.symbol === closedPos.symbol &&
                   t.direction === closedPos.side &&
                   t.status === "filled"
            );

            if (trade) {
              // Fetch ACTUAL fill price from Hyperliquid
              const fillData = await fetchActualFillPrice(
                walletAddress,
                trade.symbol,
                trade.direction,
                trade.timestamp
              );

              // Use actual fill price, or fall back to current price
              const closePrice = fillData?.fillPrice ?? parseFloat(prices.get(trade.symbol) || "0");
              const entryPrice = trade.entry;
              const pnl = trade.direction === "long"
                ? (closePrice - entryPrice) * trade.qty
                : (entryPrice - closePrice) * trade.qty;

              let result: "win" | "loss" | "breakeven" = "breakeven";
              if (pnl > trade.risk * 0.1) result = "win";
              else if (pnl < -trade.risk * 0.1) result = "loss";

              log.info("Trading", "Position closed detected", {
                symbol: trade.symbol,
                direction: trade.direction,
                entry: entryPrice,
                close: closePrice,
                actualFillPrice: fillData?.fillPrice ?? "not found",
                pnl,
                result
              });

              tradesToClose.push({ trade, closePrice, pnl, result });
            }
          }

          // Update trade history with actual close data
          if (tradesToClose.length > 0) {
            setTradeHistory(prev => prev.map(trade => {
              const closedData = tradesToClose.find(t => t.trade.id === trade.id);
              if (closedData) {
                return {
                  ...trade,
                  status: "closed" as const,
                  closePrice: closedData.closePrice,
                  closeTimestamp: Date.now(),
                  pnl: closedData.pnl,
                  result: closedData.result
                };
              }
              return trade;
            }));

            // Send close updates to Google Sheets for logged trades
            if (googleSheetsUrl) {
              tradesToClose.forEach(({ trade, closePrice, pnl, result }) => {
                if (trade.sheetsLogged && trade.sheetsTimestamp) {
                  sendToGoogleSheets({
                    action: "close",
                    coin: trade.symbol,
                    entry: trade.entry,
                    sl: trade.sl,
                    exitPrice: closePrice,
                    realizedLoss: result === "loss" ? Math.abs(pnl) : null,
                    realizedWin: result === "win" ? pnl : null,
                  });
                }
              });
            }
          }
        })();
      }
    }

    previousPositionsRef.current = positions;
  }, [positions, appState, prices, googleSheetsUrl, walletAddress]);

  // Set initial entry price when prices first become available
  const initialEntryPriceSet = useRef(false);
  useEffect(() => {
    if (!initialEntryPriceSet.current && !entryPrice && prices.has(selectedAsset)) {
      setEntryPrice(parseFloat(prices.get(selectedAsset)!).toFixed(2));
      initialEntryPriceSet.current = true;
    }
  }, [prices, selectedAsset, entryPrice]);

  // Update entry price when asset changes
  useEffect(() => {
    if (prices.has(selectedAsset) && autoUpdateEntry) {
      setEntryPrice(parseFloat(prices.get(selectedAsset)!).toFixed(2));
    }
  }, [selectedAsset, prices, autoUpdateEntry]);

  // Create password (first time setup)
  const createPassword = async () => {
    if (!passwordInput || passwordInput.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    setError("");

    log.info("Vault", "Starting vault creation");

    try {
      log.debug("Vault", "Loading store");
      const store = await load(STORE_PATH);

      log.debug("Vault", "Generating salt");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = btoa(String.fromCharCode(...salt));

      log.debug("Vault", "Hashing password");
      const passwordHash = await hashPassword(passwordInput, salt);

      log.debug("Vault", "Saving vault data to store");
      await store.set("hasVault", true);
      await store.set("passwordSalt", saltBase64);
      await store.set("passwordHash", passwordHash);
      await store.save();
      log.info("Vault", "Vault data saved successfully");

      log.debug("Vault", "Saving password to keychain for Touch ID");
      const keychainResult = await invoke<KeychainResult>("keychain_save", {
        password: passwordInput,
      });

      if (keychainResult.success) {
        log.info("Vault", "Password saved to keychain successfully");
        setBiometricAvailable(true);
      } else {
        log.warn("Vault", "Keychain save failed", { error: keychainResult.error });
      }

      setSessionPassword(passwordInput);
      setPasswordInput("");
      setConfirmPasswordInput("");
      setAppState("setup_keys");
      log.info("Vault", "Vault creation completed successfully");
    } catch (e) {
      log.error("Vault", "Failed to create vault", e);
      setError(`Failed to create vault: ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Manual unlock with password
  const manualUnlock = async () => {
    if (!passwordInput) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await unlockWithPassword(passwordInput);

      await invoke<KeychainResult>("keychain_save", {
        password: passwordInput,
      });

      setPasswordInput("");
    } catch (e) {
      log.error("Auth", "Manual unlock failed", e);
      setError(getErrorMessage(e) || "Wrong password");
    } finally {
      setLoading(false);
    }
  };

  // Retry biometric
  const retryBiometric = async () => {
    setLoading(true);
    setError("");
    setBiometricFailed(false);
    setAppState("biometric_prompt");

    try {
      // Try Touch ID authentication
      const authResult = await invoke<{ success: boolean; available: boolean; error?: string }>("authenticate_biometric", {
        reason: "Unlock Hyperliquid Trader"
      });

      if (authResult.success) {
        const result = await invoke<KeychainGetResult>("keychain_load");

        if (result.success && result.password) {
          await unlockWithPassword(result.password);
        } else {
          setBiometricFailed(true);
          setAppState("unlock");
          setError("Touch ID succeeded but keychain access failed. Please enter your password.");
        }
      } else {
        setBiometricFailed(true);
        setAppState("unlock");
        setError("Touch ID failed. Please enter your password.");
      }
    } catch (e) {
      log.error("Auth", "Biometric retry failed", e);
      setBiometricFailed(true);
      setAppState("unlock");
      setError("Touch ID failed. Please enter your password.");
    } finally {
      setLoading(false);
    }
  };

  // Save wallet keys
  const saveKeys = async () => {
    // Validate wallet address format
    if (!walletAddress) {
      setError("Please enter a wallet address");
      return;
    }
    if (!walletAddress.startsWith("0x")) {
      setError("Please enter a valid wallet address starting with 0x");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Initialize the exchange
      const exchange = createExchange(selectedExchange, false);

      if (apiPrivateKey) {
        try {
          // Initialize exchange with credentials
          await exchange.initialize({
            walletAddress,
            privateKey: apiPrivateKey,
          });

          // Derive API wallet address from private key
          const wallet = new ethers.Wallet(apiPrivateKey);
          setApiWalletAddress(wallet.address);

          exchangeRef.current = exchange;
          setTradingEnabled(true);

          log.info("Exchange", `Connected to ${selectedExchange}`, { walletAddress });
        } catch (e) {
          log.error("Exchange", "Failed to initialize exchange", e);
          setError(`Invalid credentials: ${getErrorMessage(e)}`);
          setLoading(false);
          return;
        }
      }

      // Fetch initial data using the exchange
      if (exchangeRef.current) {
        try {
          const [accountData, positionsData, ordersData] = await Promise.all([
            exchangeRef.current.getAccountInfo(),
            exchangeRef.current.getPositions(),
            exchangeRef.current.getOpenOrders(),
          ]);
          setAccountInfo(accountData);
          setPositions(positionsData);
          setOpenOrders(ordersData);
        } catch (e) {
          log.warn("Exchange", "Failed to fetch initial data", e);
        }
      }

      // Save to encrypted store
      const store = await load(STORE_PATH);
      const dataToSave = JSON.stringify({
        walletAddress,
        apiPrivateKey,
        exchangeType: selectedExchange,
      });
      const encrypted = await encryptData(dataToSave, sessionPassword);

      await store.set("encryptedWallet", encrypted);
      await store.save();

      setAppState("dashboard");
    } catch (e) {
      log.error("Wallet", "Save keys failed", e);
      setError(`Failed to save: ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Logout - go back to edit keys (keeps session password)
  const handleLogout = () => {
    setWalletAddress("");
    setApiPrivateKey("");
    setApiWalletAddress("");
    setTradingEnabled(false);
    setAccountInfo(null);
    setPositions([]);
    setOpenOrders([]);
    setSuccess("");
    setError("");
    setAppState("setup_keys");
    log.info("App", "User logged out - returning to setup keys");
  };

  // Lock vault
  const lockVault = () => {
    setSessionPassword("");
    setWalletAddress("");
    setApiPrivateKey("");
    setApiWalletAddress("");
    setTradingEnabled(false);
    setAccountInfo(null);
    setPositions([]);
    setSuccess("");
    setError("");
    setBiometricFailed(false);

    if (biometricAvailable) {
      setAppState("biometric_prompt");
      retryBiometric();
    } else {
      setAppState("unlock");
    }
  };

  // Reset vault
  const resetVault = async () => {
    try {
      await invoke<KeychainResult>("keychain_delete");

      const store = await load(STORE_PATH);
      await store.clear();
      await store.save();

      setSessionPassword("");
      setWalletAddress("");
      setApiPrivateKey("");
      setApiWalletAddress("");
      setTradingEnabled(false);
      setAccountInfo(null);
      setPositions([]);
      setBiometricAvailable(false);
      setBiometricFailed(false);
      setAppState("setup_password");
    } catch (e) {
      log.error("Vault", "Reset vault failed", e);
    }
  };

  const currentPrice = prices.get(selectedAsset);

  // KCEX-style calculation - automatically calculates when inputs change
  useEffect(() => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const risk = parseFloat(riskAmount);
    const lev = parseFloat(leverage);
    const tp = takeProfit ? parseFloat(takeProfit) : null;

    // Reset if invalid
    if (isNaN(entry) || isNaN(sl) || isNaN(risk) || isNaN(lev) || entry <= 0 || sl <= 0 || risk <= 0) {
      setCalculatedQty(null);
      setCalculatedMargin(null);
      setCalculatedLiquidation(null);
      setEstimatedPnl(null);
      setDirection(null);
      setLiqWarning(null);
      setRrRatio(null);
      setSlDistance(null);
      setTpDistance(null);
      setMinOrderWarning(null);
      setBalanceWarning(null);
      setPriceOrderError(null);
      return;
    }

    // Determine direction from entry vs SL
    const dir: "long" | "short" = sl < entry ? "long" : "short";
    setDirection(dir);

    // Price order validation - check SL is on correct side
    let priceError: string | null = null;
    if (dir === "long" && sl >= entry) {
      priceError = "Stop Loss must be BELOW entry price for LONG positions";
    } else if (dir === "short" && sl <= entry) {
      priceError = "Stop Loss must be ABOVE entry price for SHORT positions";
    }

    // Validate TP is on correct side if set
    if (tp && !isNaN(tp)) {
      if (dir === "long" && tp <= entry) {
        priceError = "Take Profit must be ABOVE entry price for LONG positions";
      } else if (dir === "short" && tp >= entry) {
        priceError = "Take Profit must be BELOW entry price for SHORT positions";
      }
    }
    setPriceOrderError(priceError);

    // Calculate position
    const slDist = Math.abs(entry - sl);
    const slPercent = (slDist / entry) * 100;
    setSlDistance(slDist);

    // Position value = risk / (SL distance %)
    // Apply fee buffer to account for fees and slippage
    const effectiveRisk = risk * (1 - feeBuffer);
    const positionValue = effectiveRisk / (slPercent / 100);
    const qty = positionValue / entry;

    // Margin required
    const margin = positionValue / lev;

    // Liquidation price (simplified - actual HL calculation is more complex)
    // For long: liq = entry * (1 - 1/leverage + maintenance margin)
    // For short: liq = entry * (1 + 1/leverage - maintenance margin)
    let liqPrice: number;
    if (dir === "long") {
      liqPrice = entry * (1 - (1 / lev) + MAINTENANCE_MARGIN);
    } else {
      liqPrice = entry * (1 + (1 / lev) - MAINTENANCE_MARGIN);
    }

    // Estimated PnL at TP and R:R ratio
    // Include taker fees (entry + exit) in PNL calculation
    let estPnl: number | null = null;
    let rr: number | null = null;
    let tpDist: number | null = null;
    const entryFee = positionValue * TAKER_FEE_RATE;
    const exitFee = positionValue * TAKER_FEE_RATE; // Approximate (actual would be at exit price)
    const totalFees = entryFee + exitFee;

    if (tp && !isNaN(tp)) {
      tpDist = Math.abs(tp - entry);
      const grossPnl = (tpDist / entry) * positionValue;
      estPnl = grossPnl - totalFees; // Net PNL after fees
      rr = slDist > 0 ? tpDist / slDist : null;
    }
    setTpDistance(tpDist);
    setRrRatio(rr);

    // Check liquidation safety using configurable distances
    let warning: { level: "safe" | "warning" | "danger"; message: string } | null = null;
    const liqDistanceAbs = Math.abs(liqPrice - entry);

    if (dir === "long") {
      if (liqPrice >= sl) {
        warning = { level: "danger", message: `Liquidation ($${liqPrice.toFixed(2)}) is ABOVE your SL! You'll get liquidated before SL hits.` };
      } else if (liqDistanceAbs < liqDangerDistance) {
        warning = { level: "danger", message: `Liquidation only $${liqDistanceAbs.toFixed(0)} from entry! Very risky.` };
      } else if (liqDistanceAbs < liqWarningDistance) {
        warning = { level: "warning", message: `Liquidation $${liqDistanceAbs.toFixed(0)} from entry. Consider lower leverage.` };
      }
    } else {
      if (liqPrice <= sl) {
        warning = { level: "danger", message: `Liquidation ($${liqPrice.toFixed(2)}) is BELOW your SL! You'll get liquidated before SL hits.` };
      } else if (liqDistanceAbs < liqDangerDistance) {
        warning = { level: "danger", message: `Liquidation only $${liqDistanceAbs.toFixed(0)} from entry! Very risky.` };
      } else if (liqDistanceAbs < liqWarningDistance) {
        warning = { level: "warning", message: `Liquidation $${liqDistanceAbs.toFixed(0)} from entry. Consider lower leverage.` };
      }
    }

    // Get decimals for the asset
    const asset = assets.get(selectedAsset);
    const decimals = asset?.szDecimals || 4;
    const finalQty = parseFloat(qty.toFixed(decimals));

    // Check minimum order size
    const minNotional = 10;
    const price = parseFloat(prices.get(selectedAsset) || "0");
    const minQty = price > 0 ? minNotional / price : 0;
    const minByDecimals = Math.pow(10, -decimals);
    const effectiveMin = Math.max(minQty, minByDecimals);

    if (finalQty < effectiveMin) {
      setMinOrderWarning(`Min order size is ${effectiveMin.toFixed(decimals)} ${selectedAsset} ($${minNotional}). Increase risk or decrease leverage.`);
    } else {
      setMinOrderWarning(null);
    }

    // Check balance
    const available = parseFloat(accountInfo?.available || "0");
    const buffer = 1.05;
    const required = margin * buffer;

    if (available > 0 && available < required) {
      if (autoAdjustLeverage) {
        const suggestedLev = Math.ceil(positionValue / (available * 0.9));
        setBalanceWarning({
          message: `Need $${required.toFixed(2)} margin, only $${available.toFixed(2)} available.`,
          suggestedLeverage: suggestedLev
        });
      } else {
        setBalanceWarning({
          message: `Insufficient margin: need $${required.toFixed(2)}, have $${available.toFixed(2)}`
        });
      }
    } else {
      setBalanceWarning(null);
    }

    setCalculatedQty(finalQty);
    setCalculatedMargin(parseFloat(margin.toFixed(2)));
    setCalculatedLiquidation(parseFloat(liqPrice.toFixed(2)));
    setEstimatedPnl(estPnl ? parseFloat(estPnl.toFixed(2)) : null);
    setLiqWarning(warning);
  }, [entryPrice, stopLoss, riskAmount, leverage, takeProfit, selectedAsset, assets, prices, accountInfo, autoAdjustLeverage, liqWarningDistance, liqDangerDistance, feeBuffer]);

  // Auto-update entry price when price changes (if enabled)
  useEffect(() => {
    if (autoUpdateEntry && currentPrice && appState === "dashboard") {
      setEntryPrice(parseFloat(currentPrice).toFixed(2));
    }
  }, [currentPrice, autoUpdateEntry, appState]);

  // Prepare trade for confirmation
  const prepareTrade = async () => {
    if (!calculatedQty || !direction) {
      setError("Please enter valid entry and stop loss prices");
      return;
    }
    if (!tradingEnabled) {
      setError("Trading not enabled. Add your API wallet's private key.");
      return;
    }
    if (priceOrderError) {
      setError(priceOrderError);
      return;
    }
    if (liqWarning?.level === "danger") {
      // Still allow but will require confirmation
    }
    // Fetch fresh prices before showing confirmation
    await fetchPrices();
    await refreshExchangeData();
    // Update entry to current price when modal opens (if enabled)
    if (updateEntryOnConfirm && currentPrice) {
      setEntryPrice(parseFloat(currentPrice).toFixed(2));
    }
    setShowConfirmModal(true);
  };

  // Apply TradingView position data and prepare trade
  const applyTvPositionAndTrade = () => {
    if (!tvPosition) return;

    // Set direction based on TradingView position
    setDirection(tvPosition.direction);

    // Set prices from TradingView
    setEntryPrice(tvPosition.entry.toFixed(2));
    setStopLoss(tvPosition.stopLoss.toFixed(2));
    if (tvPosition.takeProfit) {
      setTakeProfit(tvPosition.takeProfit.toFixed(2));
    } else {
      setTakeProfit("");
    }

    // Disable auto-update so our prices stick
    setAutoUpdateEntry(false);

    // Hide overlay
    setTvOverlayVisible(false);

    // Open confirm modal after a short delay to let state update
    setTimeout(() => {
      setShowConfirmModal(true);
    }, 100);
  };

  // Place take profit order
  // Place take profit (uses exchange abstraction)
  const placeTakeProfit = async (isBuy: boolean, size: string, triggerPrice: string) => {
    if (!exchangeRef.current || !tradingEnabled) return;

    try {
      // Use exchange-specific take profit method
      const exchange = exchangeRef.current as any; // Cast to access placeTakeProfit
      if (typeof exchange.placeTakeProfit === "function") {
        const result = await exchange.placeTakeProfit(
          selectedAsset,
          isBuy,
          parseFloat(size),
          parseFloat(triggerPrice)
        );
        if (result.success) {
          log.info("Trading", "Take profit order placed", { triggerPrice });
        } else {
          log.warn("Trading", "Take profit failed", result.error);
        }
      } else {
        log.warn("Trading", "Exchange does not support take profit orders");
      }
    } catch (e) {
      log.error("Trading", "Take profit failed", e);
    }
  };

  // Execute trade after confirmation
  const executeConfirmedTrade = async () => {
    if (!calculatedQty || !entryPrice || !direction) return;

    setShowConfirmModal(false);
    setIsExecuting(true);
    setExecutionStatus("Verifying PNL...");

    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const targetRisk = parseFloat(riskAmount);

    // PNL verification with iterative adjustment
    const { adjustedQty, iterations, verified } = verifyAndAdjustPnl(
      calculatedQty,
      entry,
      sl,
      targetRisk
    );

    // Get asset decimals for proper rounding
    const asset = assets.get(selectedAsset);
    const decimals = asset?.szDecimals || 4;
    const finalQty = parseFloat(adjustedQty.toFixed(decimals));

    if (!verified) {
      log.warn("Trading", "PNL verification incomplete after max iterations", {
        originalQty: calculatedQty,
        adjustedQty: finalQty,
        iterations
      });
    }

    const isBuy = direction === "long";
    const size = finalQty.toString();
    const price = entryPrice;

    setExecutionStatus("Placing entry order...");

    try {
      // Place entry order
      await placeOrder(isBuy, size, price, orderType === "market");

      // Place stop loss
      if (stopLoss && parseFloat(stopLoss) > 0) {
        setExecutionStatus("Placing stop loss...");
        await placeStopLoss(isBuy, size, stopLoss);
      }

      // Place take profit if set
      if (takeProfit && parseFloat(takeProfit) > 0) {
        setExecutionStatus("Placing take profit...");
        await placeTakeProfit(isBuy, size, takeProfit);
      }

      // Report success to extension EARLY (before position verification)
      log.info("Trading", "Orders placed successfully, reporting to extension");
      invoke("report_trade_result", { success: true, error: null }).catch((e) => {
        log.debug("Trading", "Early success report failed (extension not waiting)", e);
      });

      // Generate timestamp for trade identification
      const sheetsTimestamp = new Date().toISOString();
      const tradeId = Date.now().toString();

      // Fetch REAL position data from exchange
      setExecutionStatus("Checking position status...");
      const actualPosition = await fetchActualPosition(walletAddress, selectedAsset);

      // Use REAL values if position found, or fall back to our estimates
      const realEntry = actualPosition?.actualEntry ?? entry;
      const realSize = actualPosition?.actualSize ?? finalQty;
      const realRisk = realSize * Math.abs(realEntry - sl);

      // Determine if order filled or is pending (limit order sitting in orderbook)
      const orderFilled = actualPosition !== null;
      const tradeStatus = orderFilled ? "filled" : "pending";

      log.info("Trading", "Position data", {
        planned: { entry, qty: finalQty, risk: finalQty * Math.abs(entry - sl) },
        actual: actualPosition ? { entry: realEntry, qty: realSize, risk: realRisk } : "Not found - limit order pending",
        status: tradeStatus,
      });

      // Create trade record
      const historyItem: TradeHistoryItem = {
        id: tradeId,
        timestamp: Date.now(),
        symbol: selectedAsset,
        direction,
        entry: realEntry,
        sl: parseFloat(stopLoss),
        tp: takeProfit ? parseFloat(takeProfit) : undefined,
        qty: realSize,
        risk: realRisk,
        leverage: parseFloat(leverage),
        status: tradeStatus as "filled" | "pending",
        sheetsLogged: !!googleSheetsUrl,
        sheetsTimestamp: googleSheetsUrl ? sheetsTimestamp : undefined,
      };
      setTradeHistory(prev => [historyItem, ...prev].slice(0, 50));

      // Send to Google Sheets if configured
      if (googleSheetsUrl) {
        setExecutionStatus("Sending to Google Sheets...");

        // Format date and time for spreadsheet
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        await sendToGoogleSheets({
          action: "open",
          timestamp: sheetsTimestamp,   // For row matching on close
          date: dateStr,                // B: DATE (dd/mm)
          time: timeStr,                // C: TIME (hh:mm)
          coin: selectedAsset,          // D: COIN
          // E: DIRECTION - auto formula, don't fill
          orderType: orderType === "market" ? "Market" : "Limit", // F: ENTRY ORDER TYPE
          entry: realEntry,             // G: AVG ENTRY - REAL from Hyperliquid
          sl: parseFloat(stopLoss),     // H: STOP LOSS
          // I: AVG EXIT - filled on close
          risk: realRisk,               // J: RISK - REAL calculated from actual position
          expectedLoss: realRisk,       // K: EXPECTED LOSS - same as risk
          // L: REALISED LOSS - filled on close
          // M: REALISED WIN - filled on close
          // N: DEVIATION - auto formula, don't fill
          positionSize: realSize,       // O: POSITION SIZE - REAL from Hyperliquid
          // For matching on close (internal use)
          direction: direction,
        });
      }

      // Store real values for report generation
      setCalculatedQty(realSize);
      setEntryPrice(realEntry.toString());

      // Copy report to clipboard if enabled
      if (copyReportToClipboard) {
        // Generate report with REAL values
        const slDiff = Math.abs(realEntry - sl);
        const tpDiff = takeProfit ? Math.abs(parseFloat(takeProfit) - realEntry) : null;
        const rr = tpDiff && slDiff > 0 ? (tpDiff / slDiff).toFixed(2) : "N/A";

        const reportLines = [
          `${direction.toUpperCase()} ${selectedAsset}`,
          `Entry: $${realEntry}`,
          `SL: $${sl} (${direction === "long" ? "-" : "+"}${formatPriceDiff(slDiff)})`,
        ];
        if (takeProfit) {
          reportLines.push(`TP: $${takeProfit} (${direction === "long" ? "+" : "-"}${formatPriceDiff(tpDiff!)})`);
          reportLines.push(`R:R = 1:${rr}`);
        }
        reportLines.push(`Risk: $${realRisk.toFixed(2)} USDT`);
        reportLines.push(`Qty: ${realSize} ${selectedAsset}`);
        reportLines.push(`Leverage: ${leverage}x`);

        await copyToClipboard(reportLines.join("\n"));
      }

      setExecutionStatus("Trade placed successfully!");

      // Report success to extension via Tauri
      invoke("report_trade_result", { success: true, error: null }).catch((e) => {
        log.debug("Trading", "Failed to report trade result (extension not waiting)", e);
      });

      // Reset auto-update entry for next trade
      setAutoUpdateEntry(true);
    } catch (e) {
      log.error("Trading", "Trade execution failed", e);
      const errorMsg = getErrorMessage(e);
      setExecutionStatus(`Error: ${errorMsg}`);

      // Report failure to extension via Tauri
      invoke("report_trade_result", { success: false, error: errorMsg }).catch((err) => {
        log.debug("Trading", "Failed to report trade result (extension not waiting)", err);
      });

      // Check if this might be an unfilled order scenario (not a validation error)
      // Don't show retry modal for validation errors like minimum order size
      const isValidationError = errorMsg.includes("below minimum") ||
                                errorMsg.includes("Invalid order") ||
                                errorMsg.includes("insufficient") ||
                                errorMsg.includes("not found");
      if (autoRetryUnfilled && orderType === "limit" && !isValidationError) {
        // Store the unfilled order for retry
        setUnfilledOrder({
          symbol: selectedAsset,
          direction,
          qty: finalQty,
          originalPrice: parseFloat(entryPrice),
          timestamp: Date.now(),
        });
        setRetryEntryPrice(currentPrice || entryPrice);
        setShowRetryModal(true);
      }
    } finally {
      setTimeout(() => {
        setIsExecuting(false);
        setExecutionStatus("");
      }, 2000);
    }
  };

  // Auto-execute trade from extension (when pendingExtensionTrade is set)
  useEffect(() => {
    if (pendingExtensionTrade && calculatedQty && entryPrice && direction && !isExecuting) {
      console.log("[TVBridge] Auto-executing pending extension trade");
      setPendingExtensionTrade(false);
      // Fetch fresh prices before executing
      (async () => {
        await fetchPrices();
        await refreshExchangeData();
        executeConfirmedTrade();
      })();
    }
  }, [pendingExtensionTrade, calculatedQty, entryPrice, direction, isExecuting, fetchPrices, refreshExchangeData]);

  // Format number with commas
  const formatNumber = (n: number, decimals: number = 2) => {
    return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // Format price difference (3K, 300, 30, etc.) - KCEX style
  const formatPriceDiff = (diff: number): string => {
    const absDiff = Math.abs(diff);
    if (absDiff >= 1000) {
      return `${(diff / 1000).toFixed(1)}K`;
    } else if (absDiff >= 1) {
      return diff.toFixed(0);
    } else {
      return diff.toFixed(2);
    }
  };

  // Copy trade report to clipboard (using Tauri native API)
  const copyToClipboard = async (text: string) => {
    try {
      await writeText(text);
      setSuccess("Copied to clipboard!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (e) {
      log.error("Clipboard", "Failed to copy", e);
    }
  };

  // Copy positions summary to clipboard
  const copyPositionsToClipboard = async () => {
    if (positions.length === 0) {
      setError("No positions to copy");
      setTimeout(() => setError(""), 2000);
      return;
    }

    const positionsText = positions.map(p => {
      const pnl = parseFloat(p.unrealizedPnl);
      const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      return `${p.symbol} ${p.side.toUpperCase()} | Size: ${p.size} | Entry: $${p.entryPrice} | PNL: ${pnlStr} | Lev: ${p.leverage}x | Liq: $${p.liquidationPrice}`;
    }).join("\n");

    const header = `=== Positions (${positions.length}) ===\n`;
    await copyToClipboard(header + positionsText);
  };

  // Close position (market order to close entire position)
  const handleClosePosition = async (symbol: string) => {
    if (!exchangeRef.current) {
      setError("Not connected to exchange");
      return;
    }

    // Check if exchange supports closePosition
    if (!exchangeRef.current.closePosition) {
      setError("Close position not supported for this exchange");
      return;
    }

    try {
      log.info("Position", "Closing position", { symbol });
      const result = await exchangeRef.current.closePosition(symbol);

      if (result.success) {
        log.info("Position", "Position closed successfully", { symbol, txId: result.orderId });
        // Refresh positions after closing
        setTimeout(async () => {
          if (exchangeRef.current) {
            const newPositions = await exchangeRef.current.getPositions();
            setPositions(newPositions);
          }
        }, 2000);
      } else {
        setError(result.error || "Failed to close position");
        log.error("Position", "Failed to close", { symbol, error: result.error });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setError("Close position failed: " + errMsg);
      log.error("Position", "Close position error", e);
    }
  };

  // Send trade data to Google Sheets webhook
  const sendToGoogleSheets = async (tradeData: Record<string, any>) => {
    if (!googleSheetsUrl) return;

    // Log full payload for debugging
    console.log("[GoogleSheets] Sending data:", JSON.stringify(tradeData, null, 2));

    try {
      await fetch(googleSheetsUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeData),
      });
      log.info("GoogleSheets", "Trade data sent", {
        action: tradeData.action,
        date: tradeData.date,
        time: tradeData.time,
        coin: tradeData.coin,
        entry: tradeData.entry,
        sl: tradeData.sl,
        risk: tradeData.risk,
        positionSize: tradeData.positionSize,
      });
    } catch (e) {
      log.error("GoogleSheets", "Failed to send trade data", e);
    }
  };

  // PNL verification with iterative adjustment
  // This verifies that the expected loss at SL matches the intended risk amount
  const verifyAndAdjustPnl = (
    qty: number,
    entry: number,
    sl: number,
    targetRisk: number,
    maxIterations: number = 5
  ): { adjustedQty: number; iterations: number; verified: boolean } => {
    let currentQty = qty;
    let iterations = 0;

    while (iterations < maxIterations) {
      // Calculate actual loss at SL
      const slDistance = Math.abs(entry - sl);
      const actualLoss = (slDistance / entry) * (currentQty * entry);
      const diff = Math.abs(actualLoss - targetRisk);
      const diffPercent = diff / targetRisk;

      if (diffPercent <= pnlTolerance) {
        // Within tolerance, verified
        return { adjustedQty: currentQty, iterations, verified: true };
      }

      // Adjust qty to match target risk
      const adjustmentFactor = targetRisk / actualLoss;
      currentQty = currentQty * adjustmentFactor;
      iterations++;
    }

    // Max iterations reached, use best estimate
    return { adjustedQty: currentQty, iterations, verified: false };
  };

  // Retry unfilled order handler
  const retryUnfilledOrder = async (newPrice: string) => {
    if (!unfilledOrder) return;

    setShowRetryModal(false);
    setIsExecuting(true);
    setExecutionStatus("Retrying order...");

    const isBuy = unfilledOrder.direction === "long";
    const size = unfilledOrder.qty.toString();

    try {
      await placeOrder(isBuy, size, newPrice, orderType === "market");
      setSuccess(`Retry order placed at $${newPrice}`);
      setUnfilledOrder(null);
    } catch (e) {
      log.error("Trading", "Retry order failed", e);
      setError(`Retry failed: ${getErrorMessage(e)}`);
    } finally {
      setIsExecuting(false);
      setExecutionStatus("");
    }
  };

  // Cancel retry
  const cancelRetry = () => {
    setShowRetryModal(false);
    setUnfilledOrder(null);
    setRetryEntryPrice("");
  };

  // Loading state
  if (appState === "loading") {
    return (
      <AuthLayout title="Loading" subtitle="Initializing secure vault...">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div className="biometric-icon" style={{ margin: "0 auto 16px" }}>
            <TrendingIcon />
          </div>
          <p style={{ color: "var(--text-muted)" }}>Please wait...</p>
        </div>
      </AuthLayout>
    );
  }

  // Biometric prompt (Touch ID)
  if (appState === "biometric_prompt") {
    return (
      <AuthLayout
        title="Touch ID"
        subtitle="Use biometrics to unlock your vault"
        heroTitle="Welcome back,"
        heroHighlight="ready to trade."
      >
        <div className="biometric-container">
          <div className="biometric-icon">
            <FingerprintIcon />
          </div>
          {loading ? (
            <p className="biometric-status">Authenticating...</p>
          ) : (
            <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
              Touch the sensor to continue
            </p>
          )}
          <button
            onClick={() => setAppState("unlock")}
            className="btn-text"
          >
            Use password instead
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </AuthLayout>
    );
  }

  // Setup password screen
  if (appState === "setup_password") {
    return (
      <AuthLayout
        title="Create Your Vault"
        subtitle="Set up a password to protect your trading keys"
        heroTitle="Trade smarter,"
        heroHighlight="trade safer."
        heroDescription="Military-grade encryption protects your keys. Touch ID unlocks your vault. Your data never leaves your device."
      >
        <div className="mode-enter">
          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                placeholder="Re-enter your password"
                onKeyPress={(e) => e.key === "Enter" && createPassword()}
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            onClick={createPassword}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? "Creating Vault..." : "Create Vault"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </AuthLayout>
    );
  }

  // Unlock screen
  if (appState === "unlock") {
    return (
      <AuthLayout
        title="Welcome Back"
        subtitle={biometricFailed ? "Touch ID failed. Enter your password." : "Enter your password to unlock"}
        heroTitle="Welcome back,"
        heroHighlight="ready to trade."
      >
        <div className="mode-enter">
          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your password"
                onKeyPress={(e) => e.key === "Enter" && manualUnlock()}
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            onClick={manualUnlock}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? "Unlocking..." : "Unlock"}
          </button>

          {biometricAvailable && (
            <button
              onClick={retryBiometric}
              className="btn-secondary"
              style={{ marginTop: "12px" }}
              disabled={loading}
            >
              Try Touch ID Again
            </button>
          )}

          <button onClick={resetVault} className="btn-text danger">
            Reset vault (forget all data)
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </AuthLayout>
    );
  }

  // Setup keys screen
  if (appState === "setup_keys") {
    const exchangeConfig = EXCHANGE_CONFIGS[selectedExchange];

    return (
      <AuthLayout
        title="Connect Wallet"
        subtitle={`Connect to ${exchangeConfig.name} to start trading`}
        heroTitle="Almost there,"
        heroHighlight="connect your wallet."
        heroDescription="Your API wallet can execute trades but never withdraw funds. It's the safest way to trade programmatically."
      >
        <div className="mode-enter">
          <div className="form-group">
            <label>Ethereum Wallet Address</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                style={{ paddingRight: "16px" }}
              />
            </div>
            <span className="input-hint">
              Your MetaMask receiving address (same on all EVM networks)
            </span>
          </div>

          <div className="form-group">
            <label>API Wallet Private Key</label>
            <div className="input-wrapper">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiPrivateKey}
                onChange={(e) => setApiPrivateKey(e.target.value)}
                placeholder="0x... (optional for view-only)"
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowApiKey(!showApiKey)}
                tabIndex={-1}
              >
                {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <span className="input-hint">
              Required for trading. API wallets cannot withdraw.
            </span>
            {apiPrivateKey && apiPrivateKey.length >= 64 && (
              <div className="derived-address">
                <span className="derived-label">Derived address: </span>
                <code className="derived-value">
                  {(() => {
                    try {
                      const key = apiPrivateKey.startsWith('0x') ? apiPrivateKey : `0x${apiPrivateKey}`;
                      const wallet = new ethers.Wallet(key);
                      return wallet.address;
                    } catch {
                      return 'Invalid key';
                    }
                  })()}
                </code>
                <span className="derived-hint">↑ Must match your authorized API wallet on Hyperliquid</span>
              </div>
            )}
          </div>

          <button
            onClick={saveKeys}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? "Connecting..." : `Connect to ${exchangeConfig.name}`}
          </button>

          <button onClick={lockVault} className="btn-text">
            Back
          </button>

          <div className="info-box">
            <strong>How to get started with Hyperliquid</strong>
            <ul>
              <li>Go to app.hyperliquid.xyz</li>
              <li>Click your address → API Wallets</li>
              <li>Create a new API wallet</li>
              <li>Copy the private key</li>
            </ul>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
      </AuthLayout>
    );
  }

  // Trade Assistant Sidebar JSX (NOT a component - avoids recreation on re-render)
  const tradeSidebarJsx = (
    <div className="trade-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <TrendingIconSmall />
          <span>Trade Assistant</span>
        </div>
        <div className="sidebar-actions">
          <button
            onClick={() => setSidebarPosition(sidebarPosition === "left" ? "right" : "left")}
            className="sidebar-btn"
            title="Flip sidebar position"
          >
            <FlipIcon />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`sidebar-btn ${showSettings ? "active" : ""}`}
            title="Settings"
          >
            <SettingsIcon />
          </button>
          <button
            onClick={handleLogout}
            className="sidebar-btn logout-btn"
            title="Logout"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="sidebar-settings" ref={settingsScrollRef} onScroll={handleSettingsScroll}>
          <div className="settings-section-title">Trade Settings</div>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Risk ($)</label>
              <input
                type="number"
                value={riskAmount}
                onChange={(e) => setRiskAmount(e.target.value)}
                step="0.1"
              />
            </div>
            <div className="setting-item">
              <label>Leverage</label>
              <input
                type="number"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                min="1"
                max={assets.get(selectedAsset)?.maxLeverage || 40}
              />
            </div>
            <div className="setting-item">
              <label>Order Type</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as "market" | "limit")}
              >
                <option value="limit">Limit</option>
                <option value="market">Market</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Asset</label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
              >
                {Array.from(assets.keys()).slice(0, 100).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-section-title">Advanced Settings</div>
          <div className="settings-toggles">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={autoAdjustLeverage}
                onChange={(e) => setAutoAdjustLeverage(e.target.checked)}
              />
              <span>Auto-adjust leverage for balance</span>
            </label>
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={autoRetryUnfilled}
                onChange={(e) => setAutoRetryUnfilled(e.target.checked)}
              />
              <span>Auto-retry unfilled orders</span>
            </label>
          </div>

          <div className="settings-section-title">Liquidation Warnings</div>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Warning ($)</label>
              <input
                type="number"
                value={liqWarningDistance}
                onChange={(e) => setLiqWarningDistance(parseFloat(e.target.value) || 300)}
                min="50"
                step="50"
              />
            </div>
            <div className="setting-item">
              <label>Danger ($)</label>
              <input
                type="number"
                value={liqDangerDistance}
                onChange={(e) => setLiqDangerDistance(parseFloat(e.target.value) || 100)}
                min="10"
                step="10"
              />
            </div>
          </div>

          <div className="settings-section-title">PNL Verification</div>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Tolerance (%)</label>
              <input
                type="number"
                value={pnlTolerance * 100}
                onChange={(e) => setPnlTolerance((parseFloat(e.target.value) || 10) / 100)}
                min="1"
                max="50"
                step="1"
              />
            </div>
            <div className="setting-item">
              <label>Max Risk (x)</label>
              <input
                type="number"
                value={maxRiskMultiplier}
                onChange={(e) => setMaxRiskMultiplier(parseFloat(e.target.value) || 2.0)}
                min="1"
                max="5"
                step="0.5"
              />
            </div>
            <div className="setting-item">
              <label>Fee Buffer (%)</label>
              <input
                type="number"
                value={feeBuffer * 100}
                onChange={(e) => setFeeBuffer((parseFloat(e.target.value) || 5) / 100)}
                min="0"
                max="20"
                step="1"
              />
            </div>
          </div>
          <p className="setting-hint">Fee Buffer: Position sized for {((1 - feeBuffer) * 100).toFixed(0)}% of target risk to account for fees/slippage</p>

          <div className="settings-section-title">Unfilled Orders</div>
          <div className="settings-grid">
            <div className="setting-item full-width">
              <label>Wait Time (sec)</label>
              <input
                type="number"
                value={unfilledWaitTime / 1000}
                onChange={(e) => setUnfilledWaitTime((parseFloat(e.target.value) || 30) * 1000)}
                min="5"
                max="120"
                step="5"
              />
            </div>
          </div>

          <div className="settings-section-title">Confirmation</div>
          <div className="settings-toggles">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={updateEntryOnConfirm}
                onChange={(e) => setUpdateEntryOnConfirm(e.target.checked)}
              />
              <span>Live entry on confirm modal</span>
            </label>
          </div>

          <div className="settings-section-title">Google Sheets</div>
          <div className="setting-item full-width">
            <label>Webhook URL</label>
            <input
              type="text"
              value={googleSheetsUrl}
              onChange={(e) => setGoogleSheetsUrl(e.target.value)}
              placeholder="https://script.google.com/..."
            />
          </div>

          <div className="settings-section-title">Clipboard</div>
          <div className="settings-toggles">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={copyReportToClipboard}
                onChange={(e) => setCopyReportToClipboard(e.target.checked)}
              />
              <span>Copy trade report on execute</span>
            </label>
          </div>

          <div className="settings-section-title">Debug</div>
          <div className="settings-toggles">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={debugLogging}
                onChange={(e) => setDebugLogging(e.target.checked)}
              />
              <span>Enable console logging</span>
            </label>
          </div>

          <div className="settings-section-title">TradingView Bridge</div>
          <div className="tv-bridge-section">
            <div className="tv-bridge-info">
              <div className="tv-bridge-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="8" fill="#3B82F6"/>
                  <path d="M20 8L20 32M20 8L12 16M20 8L28 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 22H14M26 26H30" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="tv-bridge-text">
                <div className="tv-bridge-title">Chrome Extension</div>
                <div className="tv-bridge-desc">
                  Connects TradingView position tool to this app
                </div>
              </div>
            </div>
            <button
              className="tv-bridge-download-btn"
              onClick={async () => {
                try {
                  // Create the folder in Documents if it doesn't exist
                  const folderExists = await exists(TV_BRIDGE_FOLDER, { baseDir: BaseDirectory.Document });
                  if (!folderExists) {
                    await mkdir(TV_BRIDGE_FOLDER, { baseDir: BaseDirectory.Document });
                  }

                  // Download each file
                  for (const fileName of TV_BRIDGE_FILES) {
                    // Try GitHub first, fallback to local
                    let response = await fetch(`${TV_BRIDGE_BASE_URL}/${fileName}`).catch(() => null);
                    if (!response?.ok) {
                      response = await fetch(`/tradingview-bridge/${fileName}`);
                    }

                    const filePath = `${TV_BRIDGE_FOLDER}/${fileName}`;

                    if (fileName.endsWith('.png')) {
                      // Binary file (icons)
                      const arrayBuffer = await response.arrayBuffer();
                      await writeFile(filePath, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.Document });
                    } else {
                      // Text file (manifest.json, content.js)
                      const text = await response.text();
                      await writeTextFile(filePath, text, { baseDir: BaseDirectory.Document });
                    }
                  }

                  setSuccess('Extension installed to Documents/tradingview-bridge!');
                } catch (e) {
                  console.error('Download error:', e);
                  setError('Failed to download extension: ' + getErrorMessage(e));
                }
              }}
            >
              Download Extension
            </button>
            <div className="tv-bridge-instructions">
              <div className="instruction-step">1. Open chrome://extensions</div>
              <div className="instruction-step">2. Enable "Developer mode"</div>
              <div className="instruction-step">3. Click "Load unpacked"</div>
              <div className="instruction-step">4. Select Documents/tradingview-bridge</div>
            </div>
            <div className="tv-bridge-tip">
              <strong>Tip:</strong> Use Bybit perpetual charts (e.g., <code>BYBIT:BTCUSDT.P</code>) for prices closest to Hyperliquid.
            </div>
            <div className="settings-toggles tv-bridge-toggles">
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={extensionEnabled}
                  onChange={(e) => setExtensionEnabled(e.target.checked)}
                />
                <span>Enable TradingView Bridge</span>
              </label>
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={extensionSkipConfirm}
                  onChange={(e) => setExtensionSkipConfirm(e.target.checked)}
                />
                <span>Execute trades directly (skip confirmation)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="sidebar-content">
        {/* Price Display */}
        <div className="price-display">
          <div className="price-pair">{selectedAsset}/USD</div>
          <div className="price-current">
            ${currentPrice ? formatNumber(parseFloat(currentPrice)) : "---"}
          </div>
          <button
            onClick={() => open(`https://app.hyperliquid.xyz/trade/${selectedAsset}`)}
            className="btn-chart"
          >
            <ExternalLinkIcon /> Open Chart
          </button>
        </div>

        {/* Config Display - Editable */}
        <div className="config-display">
          <div className="config-box editable">
            <span className="config-label">Risk</span>
            <div className="config-input-wrap">
              <span className="config-prefix">$</span>
              <input
                type="number"
                className="config-input"
                value={riskAmount}
                onChange={(e) => setRiskAmount(e.target.value)}
                step="0.1"
                min="0.1"
              />
            </div>
          </div>
          <div className="config-box editable">
            <span className="config-label">Leverage</span>
            <div className="config-input-wrap">
              <input
                type="number"
                className="config-input"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                min="1"
                max={assets.get(selectedAsset)?.maxLeverage || 40}
              />
              <span className="config-suffix">x</span>
            </div>
          </div>
        </div>

        {/* Entry Price */}
        <div className="input-field">
          <div className="input-label">
            <span>Entry Price</span>
            <label className="auto-checkbox">
              <input
                type="checkbox"
                checked={autoUpdateEntry}
                onChange={(e) => setAutoUpdateEntry(e.target.checked)}
              />
              <span>Auto</span>
            </label>
          </div>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => {
              setAutoUpdateEntry(false);
              setEntryPrice(e.target.value);
            }}
            onFocus={() => fetchPrices()}
            placeholder="Entry price"
          />
        </div>

        {/* Stop Loss */}
        <div className="input-field">
          <div className="input-label">
            <span>Stop Loss</span>
            {direction && (
              <span className={`direction-badge ${direction}`}>
                {direction.toUpperCase()}
              </span>
            )}
          </div>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            onFocus={() => fetchPrices()}
            placeholder="Stop loss price"
          />
        </div>

        {/* Take Profit */}
        <div className="input-field">
          <div className="input-label">
            <span>Take Profit</span>
            <span className="optional-label">Optional</span>
          </div>
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            onFocus={() => fetchPrices()}
            placeholder="Take profit price"
          />
        </div>

        {/* Calculated Results */}
        {calculatedQty !== null && direction && (
          <div className="calc-results">
            {rrRatio && (
              <div className="calc-row rr-highlight">
                <span>R:R Ratio</span>
                <span className="rr-value">1 : {rrRatio.toFixed(1)}</span>
              </div>
            )}
            <div className="calc-row">
              <span>Quantity</span>
              <span>{calculatedQty} {selectedAsset}</span>
            </div>
            <div className="calc-row">
              <span>Position Value</span>
              <span>${formatNumber(calculatedQty * parseFloat(entryPrice))}</span>
            </div>
            <div className="calc-row">
              <span>Margin</span>
              <span>${formatNumber(calculatedMargin || 0)}</span>
            </div>
            {slDistance && (
              <div className="calc-row">
                <span>SL Distance</span>
                <span className="diff-value risk">-{formatPriceDiff(slDistance)}</span>
              </div>
            )}
            {tpDistance && (
              <div className="calc-row">
                <span>TP Distance</span>
                <span className="diff-value profit">+{formatPriceDiff(tpDistance)}</span>
              </div>
            )}
            <div className={`calc-row ${liqWarning?.level || ""}`}>
              <span>Liquidation</span>
              <span>${formatNumber(calculatedLiquidation || 0)}</span>
            </div>
            {estimatedPnl !== null && (
              <div className="calc-row profit">
                <span>Est. Profit</span>
                <span>+${formatNumber(estimatedPnl)}</span>
              </div>
            )}
            <div className="calc-row risk highlight">
              <span>PNL Max Loss</span>
              <span>-${riskAmount}</span>
            </div>
          </div>
        )}

        {/* Warnings */}
        {priceOrderError && (
          <div className="warning-alert danger">
            {priceOrderError}
          </div>
        )}
        {minOrderWarning && (
          <div className="warning-alert danger">
            {minOrderWarning}
          </div>
        )}
        {balanceWarning && (
          <div className="warning-alert warning">
            {balanceWarning.message}
            {balanceWarning.suggestedLeverage && (
              <button
                className="inline-adjust-btn"
                onClick={() => setLeverage(balanceWarning.suggestedLeverage!.toString())}
              >
                Use {balanceWarning.suggestedLeverage}x
              </button>
            )}
          </div>
        )}
        {liqWarning && (
          <div className={`warning-alert ${liqWarning.level}`}>
            {liqWarning.message}
          </div>
        )}

        {/* Execution Status */}
        {isExecuting && (
          <div className="execution-status">
            <span className="status-spinner" />
            {executionStatus}
          </div>
        )}

        {/* Trade Buttons */}
        <div className="trade-buttons">
          <button
            className={`trade-btn long ${direction === "long" ? "active" : ""}`}
            onClick={prepareTrade}
            disabled={!calculatedQty || !tradingEnabled || tradingLoading || direction !== "long" || !!priceOrderError}
          >
            LONG
          </button>
          <button
            className={`trade-btn short ${direction === "short" ? "active" : ""}`}
            onClick={prepareTrade}
            disabled={!calculatedQty || !tradingEnabled || tradingLoading || direction !== "short" || !!priceOrderError}
          >
            SHORT
          </button>
        </div>

        {/* Trade Info */}
        <div className="trade-info">
          <span>Taker fee: 0.025%</span>
          <span>•</span>
          <span>Maint. margin: 0.5%</span>
        </div>

        {!tradingEnabled && (
          <div className="status-alert">
            View only mode. Add API key to enable trading.
          </div>
        )}
      </div>
    </div>
  );

  // Main Content Component
  const MainContent = () => (
    <div className="main-content">
      {/* Account Stats Bar */}
      <div className="account-bar">
        <div className="account-stat">
          <span className="stat-label">Balance</span>
          <span className="stat-value">${accountInfo?.balance || "0.00"}</span>
        </div>
        <div className="account-stat">
          <span className="stat-label">Available</span>
          <span className="stat-value">${accountInfo?.available || "0.00"}</span>
        </div>
        <div className="account-stat">
          <span className="stat-label">Margin Used</span>
          <span className="stat-value">${accountInfo?.totalMarginUsed || "0.00"}</span>
        </div>
        <div className="account-stat">
          <span className="stat-label">Position Value</span>
          <span className="stat-value">${accountInfo?.totalPositionValue || "0.00"}</span>
        </div>
        <div className="account-actions">
          {tradingEnabled && <span className="trading-badge">Trading Enabled</span>}
          <button onClick={() => { fetchPrices(); refreshExchangeData(); }} className="refresh-btn" title="Refresh prices and data">↻</button>
          <button onClick={lockVault} className="lock-btn">Lock</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="content-tabs">
        <button
          className={`content-tab ${activeTab === "positions" ? "active" : ""}`}
          onClick={() => setActiveTab("positions")}
        >
          Positions ({positions.length})
        </button>
        <button
          className={`content-tab ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          Open Orders ({openOrders.length})
        </button>
        <button
          className={`content-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Trade History ({tradeHistory.length})
        </button>
        {activeTab === "positions" && positions.length > 0 && (
          <button
            className="copy-tab-btn"
            onClick={copyPositionsToClipboard}
            title="Copy positions to clipboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="content-body">
        {activeTab === "positions" && (
          positions.length === 0 ? (
            <div className="empty-state">
              <p>No open positions</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Size</th>
                    <th>Entry</th>
                    <th>Liq. Price</th>
                    <th>PnL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, i) => (
                    <tr key={i}>
                      <td className="symbol">{pos.symbol}</td>
                      <td className={pos.side}>{pos.side.toUpperCase()}</td>
                      <td>{Math.abs(parseFloat(pos.size))}</td>
                      <td>${pos.entryPrice}</td>
                      <td>${pos.liquidationPrice}</td>
                      <td className={parseFloat(pos.unrealizedPnl) >= 0 ? "positive" : "negative"}>
                        ${pos.unrealizedPnl}
                      </td>
                      <td>
                        <button
                          className="close-position-btn"
                          onClick={() => handleClosePosition(pos.symbol)}
                          title="Close position at market"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === "orders" && (
          openOrders.length === 0 ? (
            <div className="empty-state">
              <p>No open orders</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Size</th>
                    <th>Price</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((order, i) => {
                    const orderInfo = getOrderLabel(order, positions);
                    return (
                      <tr key={i}>
                        <td className="symbol">{order.symbol}</td>
                        <td className={orderInfo.type}>{orderInfo.label}</td>
                        <td>{order.size}</td>
                        <td>${order.price}</td>
                        <td>{order.orderType}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === "history" && (
          tradeHistory.length === 0 ? (
            <div className="empty-state">
              <p>No trade history yet</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Entry</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.map((trade) => (
                  <tr key={trade.id} className={trade.result || ""}>
                    <td>{new Date(trade.timestamp).toLocaleTimeString()}</td>
                    <td className="symbol">{trade.symbol}</td>
                    <td className={trade.direction}>{trade.direction.toUpperCase()}</td>
                    <td>${trade.entry.toFixed(2)}</td>
                    <td>${trade.sl.toFixed(2)}</td>
                    <td>{trade.tp ? `$${trade.tp.toFixed(2)}` : "-"}</td>
                    <td>${trade.risk.toFixed(2)}</td>
                    <td className={`status-${trade.status}`}>{trade.status}</td>
                    <td className={trade.result || ""}>
                      {trade.result ? (
                        <>
                          {trade.result.toUpperCase()}
                          {trade.pnl !== undefined && (
                            <span className={trade.pnl >= 0 ? "positive" : "negative"}>
                              {" "}(${trade.pnl.toFixed(2)})
                            </span>
                          )}
                        </>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );

  // Dashboard
  return (
    <div className={`dashboard-container sidebar-${sidebarPosition}`}>
      {/* Update notification banner */}
      {updateAvailable && (
        <div className="update-banner">
          <span>Update available: v{updateAvailable.version}</span>
          <button
            onClick={installUpdate}
            disabled={isUpdating}
            className="update-btn"
          >
            {isUpdating ? "Installing..." : "Install & Restart"}
          </button>
          <button
            onClick={() => setUpdateAvailable(null)}
            className="update-dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* VPN Warning Banner for US users */}
      {showVpnWarning && !vpnWarningDismissed && (
        <div className="vpn-warning-banner">
          <div className="vpn-warning-content">
            <span className="vpn-warning-icon">&#9888;</span>
            <div className="vpn-warning-text">
              <strong>VPN Required for US Users</strong>
              <span>Hyperliquid is not available in the US. Use Mullvad VPN ($5/mo, anonymous) with Singapore or Japan servers. Never disable VPN while logged in.</span>
            </div>
          </div>
          <button
            onClick={() => {
              setShowVpnWarning(false);
              setVpnWarningDismissed(true);
            }}
            className="vpn-warning-dismiss"
            title="I understand, dismiss"
          >
            Got it
          </button>
        </div>
      )}

      {sidebarPosition === "left" ? (
        <>
          {tradeSidebarJsx}
          <MainContent />
        </>
      ) : (
        <>
          <MainContent />
          {tradeSidebarJsx}
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && calculatedQty && direction && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-title ${direction}`}>
              Confirm {direction.toUpperCase()} {selectedAsset}
              {rrRatio && (
                <span className="rr-badge">R:R 1:{rrRatio.toFixed(1)}</span>
              )}
            </div>

            <div className="modal-body">
              {/* Price Ladder with formatted differences and direction arrow */}
              <div className="price-ladder">
                {/* Direction arrow indicator */}
                <div className={`direction-arrow ${direction}`}>
                  {direction === "long" ? "▲" : "▼"}
                </div>

                {/* For LONG: TP at top, Entry, SL, Liq at bottom */}
                {/* For SHORT: TP at bottom, Entry, SL, Liq at top */}
                {direction === "long" ? (
                  <>
                    {takeProfit && tpDistance && (
                      <div className="price-row tp">
                        <span className="label">Take Profit</span>
                        <span className="value">
                          ${takeProfit}
                          <span className="diff profit">+{formatPriceDiff(tpDistance)}</span>
                        </span>
                      </div>
                    )}
                    <div className="price-row entry active">
                      <span className="label">Entry</span>
                      <span className="value">${entryPrice}</span>
                    </div>
                    <div className="price-row sl">
                      <span className="label">Stop Loss</span>
                      <span className="value">
                        ${stopLoss}
                        <span className="diff risk">-{formatPriceDiff(slDistance || 0)}</span>
                      </span>
                    </div>
                    <div className={`price-row liq ${liqWarning?.level || ""}`}>
                      <span className="label">Liquidation</span>
                      <span className="value">${calculatedLiquidation}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`price-row liq ${liqWarning?.level || ""}`}>
                      <span className="label">Liquidation</span>
                      <span className="value">${calculatedLiquidation}</span>
                    </div>
                    <div className="price-row sl">
                      <span className="label">Stop Loss</span>
                      <span className="value">
                        ${stopLoss}
                        <span className="diff risk">-{formatPriceDiff(slDistance || 0)}</span>
                      </span>
                    </div>
                    <div className="price-row entry active">
                      <span className="label">Entry</span>
                      <span className="value">${entryPrice}</span>
                    </div>
                    {takeProfit && tpDistance && (
                      <div className="price-row tp">
                        <span className="label">Take Profit</span>
                        <span className="value">
                          ${takeProfit}
                          <span className="diff profit">+{formatPriceDiff(tpDistance)}</span>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-divider" />

              {/* Secondary info - smaller */}
              <div className="modal-row secondary">
                <span className="label">Quantity</span>
                <span className="value">{calculatedQty} {selectedAsset}</span>
              </div>
              <div className="modal-row secondary">
                <span className="label">Margin</span>
                <span className="value">${formatNumber(calculatedMargin || 0)}</span>
              </div>
              <div className="modal-row secondary">
                <span className="label">Leverage</span>
                <span className="value">{leverage}x</span>
              </div>

              {/* Primary - Risk/Reward */}
              <div className="modal-row highlight risk">
                <span className="label">PNL Max Loss</span>
                <span className="value">-${riskAmount}</span>
              </div>
              {estimatedPnl && rrRatio && (
                <div className="modal-row highlight profit">
                  <span className="label">Target ({rrRatio.toFixed(1)}R)</span>
                  <span className="value">+${formatNumber(estimatedPnl)}</span>
                </div>
              )}

              {/* Warnings */}
              {minOrderWarning && (
                <div className="modal-warning danger">
                  {minOrderWarning}
                </div>
              )}
              {balanceWarning && (
                <div className="modal-warning warning">
                  {balanceWarning.message}
                  {balanceWarning.suggestedLeverage && (
                    <button
                      className="adjust-btn"
                      onClick={() => {
                        setLeverage(balanceWarning.suggestedLeverage!.toString());
                      }}
                    >
                      Use {balanceWarning.suggestedLeverage}x
                    </button>
                  )}
                </div>
              )}
              {liqWarning && (
                <div className={`modal-warning ${liqWarning.level}`}>
                  {liqWarning.message}
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button
                className="modal-btn cancel"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className={`modal-btn confirm ${direction}`}
                onClick={executeConfirmedTrade}
                disabled={tradingLoading || !!minOrderWarning || !!priceOrderError}
              >
                {tradingLoading ? "Placing..." : `Confirm ${direction.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retry Unfilled Order Modal */}
      {showRetryModal && unfilledOrder && (
        <div className="modal-overlay" onClick={cancelRetry}>
          <div className="modal retry-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title warning-title">
              Order Not Filled
            </div>

            <div className="modal-body">
              <div className="retry-info">
                <p>Your {unfilledOrder.direction.toUpperCase()} order at ${unfilledOrder.originalPrice.toFixed(2)} may not have filled.</p>
                <p>Current price: <strong>${currentPrice || "---"}</strong></p>
              </div>

              <div className="retry-input">
                <label>New Entry Price</label>
                <input
                  type="number"
                  value={retryEntryPrice}
                  onChange={(e) => setRetryEntryPrice(e.target.value)}
                  placeholder="Enter new price"
                />
                <div className="retry-suggestions">
                  <button
                    className="suggestion-btn"
                    onClick={() => setRetryEntryPrice(currentPrice || "")}
                  >
                    Market: ${currentPrice || "---"}
                  </button>
                  <button
                    className="suggestion-btn"
                    onClick={() => setRetryEntryPrice(unfilledOrder.originalPrice.toFixed(2))}
                  >
                    Original: ${unfilledOrder.originalPrice.toFixed(2)}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={cancelRetry}>
                Cancel
              </button>
              <button
                className={`modal-btn confirm ${unfilledOrder.direction}`}
                onClick={() => retryUnfilledOrder(retryEntryPrice)}
                disabled={!retryEntryPrice}
              >
                Retry at ${retryEntryPrice || "---"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="toast error">{error}</div>}
      {success && <div className="toast success">{success}</div>}

      {/* TradingView Bridge Floating Overlay */}
      {tvOverlayVisible && tvPosition && (
        <div className="tv-overlay">
          <div className="tv-overlay-header">
            <span className={`tv-direction ${tvPosition.direction}`}>
              {tvPosition.direction === "long" ? "▲ LONG" : "▼ SHORT"}
            </span>
            <button
              className="tv-close-btn"
              onClick={() => setTvOverlayVisible(false)}
            >
              ×
            </button>
          </div>
          <div className="tv-overlay-content">
            <div className="tv-price-row">
              <span className="tv-label">Entry:</span>
              <span className="tv-value">${tvPosition.entry.toFixed(2)}</span>
            </div>
            <div className="tv-price-row">
              <span className="tv-label">Stop Loss:</span>
              <span className="tv-value sl">${tvPosition.stopLoss.toFixed(2)}</span>
            </div>
            {tvPosition.takeProfit && (
              <div className="tv-price-row">
                <span className="tv-label">Take Profit:</span>
                <span className="tv-value tp">${tvPosition.takeProfit.toFixed(2)}</span>
              </div>
            )}
          </div>
          <button
            className={`tv-enter-btn ${tvPosition.direction}`}
            onClick={applyTvPositionAndTrade}
            disabled={!tradingEnabled}
          >
            {tradingEnabled ? "Enter Trade" : "Trading Disabled"}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
