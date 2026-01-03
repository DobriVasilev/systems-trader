import { create } from "zustand";

type AppState = "loading" | "setup" | "setup_password" | "setup_keys" | "unlock" | "biometric_prompt" | "dashboard";

interface TVPositionData {
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit: number | null;
  timestamp: number;
}

interface TradeHistoryItem {
  id: string;
  timestamp: number;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  sl: number;
  tp?: number;
  qty: number;
  risk: number;
  leverage: number;
  status: "pending" | "filled" | "cancelled" | "closed";
  closePrice?: number;
  closeTimestamp?: number;
  pnl?: number;
  result?: "win" | "loss" | "breakeven";
  sheetsLogged?: boolean;
  sheetsTimestamp?: string;
}

interface AppStoreState {
  // App state
  appState: AppState;
  loading: boolean;
  tradingLoading: boolean;
  error: string;
  success: string;

  // Auth
  sessionPassword: string;
  biometricAvailable: boolean;
  biometricFailed: boolean;
  passwordInput: string;
  confirmPasswordInput: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  showApiKey: boolean;

  // Credentials
  walletAddress: string;
  apiPrivateKey: string;
  apiWalletAddress: string;
  tradingEnabled: boolean;

  // UI
  activeTab: "positions" | "orders" | "history";
  showSettings: boolean;

  // TradingView Bridge
  tvPosition: TVPositionData | null;
  tvOverlayVisible: boolean;
  pendingExtensionTrade: boolean;

  // Trade History
  tradeHistory: TradeHistoryItem[];

  // Updates
  updateAvailable: { version: string; notes: string } | null;
  isUpdating: boolean;

  // VPN Warning
  showVpnWarning: boolean;
  vpnWarningDismissed: boolean;

  // Emergency Withdraw
  showWithdrawModal: boolean;
  withdrawDestination: string;
  withdrawing: boolean;

  // Actions
  setAppState: (state: AppState) => void;
  setLoading: (loading: boolean) => void;
  setTradingLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;

  setSessionPassword: (password: string) => void;
  setBiometricAvailable: (available: boolean) => void;
  setBiometricFailed: (failed: boolean) => void;
  setPasswordInput: (input: string) => void;
  setConfirmPasswordInput: (input: string) => void;
  setShowPassword: (show: boolean) => void;
  setShowConfirmPassword: (show: boolean) => void;
  setShowApiKey: (show: boolean) => void;

  setWalletAddress: (address: string) => void;
  setApiPrivateKey: (key: string) => void;
  setApiWalletAddress: (address: string) => void;
  setTradingEnabled: (enabled: boolean) => void;

  setActiveTab: (tab: "positions" | "orders" | "history") => void;
  setShowSettings: (show: boolean) => void;

  setTvPosition: (position: TVPositionData | null) => void;
  setTvOverlayVisible: (visible: boolean) => void;
  setPendingExtensionTrade: (pending: boolean) => void;

  setTradeHistory: (historyOrUpdater: TradeHistoryItem[] | ((prev: TradeHistoryItem[]) => TradeHistoryItem[])) => void;
  addTradeToHistory: (trade: TradeHistoryItem) => void;
  updateTradeInHistory: (id: string, updates: Partial<TradeHistoryItem>) => void;

  setUpdateAvailable: (update: { version: string; notes: string } | null) => void;
  setIsUpdating: (updating: boolean) => void;

  setShowVpnWarning: (show: boolean) => void;
  setVpnWarningDismissed: (dismissed: boolean) => void;

  setShowWithdrawModal: (show: boolean) => void;
  setWithdrawDestination: (destination: string) => void;
  setWithdrawing: (withdrawing: boolean) => void;

  // Clear auth state on logout
  clearAuth: () => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  // Initial state
  appState: "loading",
  loading: false,
  tradingLoading: false,
  error: "",
  success: "",

  sessionPassword: "",
  biometricAvailable: false,
  biometricFailed: false,
  passwordInput: "",
  confirmPasswordInput: "",
  showPassword: false,
  showConfirmPassword: false,
  showApiKey: false,

  walletAddress: "",
  apiPrivateKey: "",
  apiWalletAddress: "",
  tradingEnabled: false,

  activeTab: "positions",
  showSettings: false,

  tvPosition: null,
  tvOverlayVisible: false,
  pendingExtensionTrade: false,

  tradeHistory: [],

  updateAvailable: null,
  isUpdating: false,

  showVpnWarning: false,
  vpnWarningDismissed: false,

  showWithdrawModal: false,
  withdrawDestination: "",
  withdrawing: false,

  // Actions
  setAppState: (appState) => set({ appState }),
  setLoading: (loading) => set({ loading }),
  setTradingLoading: (tradingLoading) => set({ tradingLoading }),
  setError: (error) => set({ error }),
  setSuccess: (success) => set({ success }),

  setSessionPassword: (sessionPassword) => set({ sessionPassword }),
  setBiometricAvailable: (biometricAvailable) => set({ biometricAvailable }),
  setBiometricFailed: (biometricFailed) => set({ biometricFailed }),
  setPasswordInput: (passwordInput) => set({ passwordInput }),
  setConfirmPasswordInput: (confirmPasswordInput) => set({ confirmPasswordInput }),
  setShowPassword: (showPassword) => set({ showPassword }),
  setShowConfirmPassword: (showConfirmPassword) => set({ showConfirmPassword }),
  setShowApiKey: (showApiKey) => set({ showApiKey }),

  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setApiPrivateKey: (apiPrivateKey) => set({ apiPrivateKey }),
  setApiWalletAddress: (apiWalletAddress) => set({ apiWalletAddress }),
  setTradingEnabled: (tradingEnabled) => set({ tradingEnabled }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setShowSettings: (showSettings) => set({ showSettings }),

  setTvPosition: (tvPosition) => set({ tvPosition }),
  setTvOverlayVisible: (tvOverlayVisible) => set({ tvOverlayVisible }),
  setPendingExtensionTrade: (pendingExtensionTrade) => set({ pendingExtensionTrade }),

  setTradeHistory: (historyOrUpdater) => set((state) => ({
    tradeHistory: typeof historyOrUpdater === 'function'
      ? historyOrUpdater(state.tradeHistory)
      : historyOrUpdater,
  })),
  addTradeToHistory: (trade) => set((state) => ({
    tradeHistory: [trade, ...state.tradeHistory],
  })),
  updateTradeInHistory: (id, updates) => set((state) => ({
    tradeHistory: state.tradeHistory.map((trade) =>
      trade.id === id ? { ...trade, ...updates } : trade
    ),
  })),

  setUpdateAvailable: (updateAvailable) => set({ updateAvailable }),
  setIsUpdating: (isUpdating) => set({ isUpdating }),

  setShowVpnWarning: (showVpnWarning) => set({ showVpnWarning }),
  setVpnWarningDismissed: (vpnWarningDismissed) => set({ vpnWarningDismissed }),

  setShowWithdrawModal: (showWithdrawModal) => set({ showWithdrawModal }),
  setWithdrawDestination: (withdrawDestination) => set({ withdrawDestination }),
  setWithdrawing: (withdrawing) => set({ withdrawing }),

  clearAuth: () => set({
    sessionPassword: "",
    passwordInput: "",
    confirmPasswordInput: "",
    walletAddress: "",
    apiPrivateKey: "",
    apiWalletAddress: "",
    tradingEnabled: false,
  }),
}));

// Re-export types
export type { TVPositionData, TradeHistoryItem };
