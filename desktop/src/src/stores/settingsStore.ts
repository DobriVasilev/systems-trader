import { create } from "zustand";
import { ExchangeType, DEFAULT_EXCHANGE } from "../exchanges";

interface SettingsState {
  // Exchange
  selectedExchange: ExchangeType;

  // UI
  sidebarPosition: "left" | "right";
  debugLogging: boolean;

  // Trading settings
  autoAdjustLeverage: boolean;
  autoRetryUnfilled: boolean;
  unfilledWaitTime: number;
  maxRiskMultiplier: number;
  feeBuffer: number;
  updateEntryOnConfirm: boolean;
  copyReportToClipboard: boolean;

  // Risk settings
  liqWarningDistance: number;
  liqDangerDistance: number;
  pnlTolerance: number;

  // TradingView Bridge settings
  extensionSkipConfirm: boolean;
  extensionEnabled: boolean;

  // Google Sheets
  googleSheetsUrl: string;

  // Loaded flag
  settingsLoaded: boolean;

  // Actions
  setSelectedExchange: (exchange: ExchangeType) => void;
  setSidebarPosition: (position: "left" | "right") => void;
  setDebugLogging: (enabled: boolean) => void;
  setAutoAdjustLeverage: (enabled: boolean) => void;
  setAutoRetryUnfilled: (enabled: boolean) => void;
  setUnfilledWaitTime: (time: number) => void;
  setMaxRiskMultiplier: (multiplier: number) => void;
  setFeeBuffer: (buffer: number) => void;
  setUpdateEntryOnConfirm: (enabled: boolean) => void;
  setCopyReportToClipboard: (enabled: boolean) => void;
  setLiqWarningDistance: (distance: number) => void;
  setLiqDangerDistance: (distance: number) => void;
  setPnlTolerance: (tolerance: number) => void;
  setExtensionSkipConfirm: (enabled: boolean) => void;
  setExtensionEnabled: (enabled: boolean) => void;
  setGoogleSheetsUrl: (url: string) => void;
  setSettingsLoaded: (loaded: boolean) => void;

  // Bulk update for loading from storage
  loadSettings: (settings: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // Initial values
  selectedExchange: DEFAULT_EXCHANGE,
  sidebarPosition: "right",
  debugLogging: false,
  autoAdjustLeverage: true,
  autoRetryUnfilled: false,
  unfilledWaitTime: 30000,
  maxRiskMultiplier: 2.0,
  feeBuffer: 0.05,
  updateEntryOnConfirm: false,
  copyReportToClipboard: false,
  liqWarningDistance: 300,
  liqDangerDistance: 100,
  pnlTolerance: 0.10,
  extensionSkipConfirm: true,
  extensionEnabled: true,
  googleSheetsUrl: "",
  settingsLoaded: false,

  // Actions
  setSelectedExchange: (selectedExchange) => set({ selectedExchange }),
  setSidebarPosition: (sidebarPosition) => set({ sidebarPosition }),
  setDebugLogging: (debugLogging) => set({ debugLogging }),
  setAutoAdjustLeverage: (autoAdjustLeverage) => set({ autoAdjustLeverage }),
  setAutoRetryUnfilled: (autoRetryUnfilled) => set({ autoRetryUnfilled }),
  setUnfilledWaitTime: (unfilledWaitTime) => set({ unfilledWaitTime }),
  setMaxRiskMultiplier: (maxRiskMultiplier) => set({ maxRiskMultiplier }),
  setFeeBuffer: (feeBuffer) => set({ feeBuffer }),
  setUpdateEntryOnConfirm: (updateEntryOnConfirm) => set({ updateEntryOnConfirm }),
  setCopyReportToClipboard: (copyReportToClipboard) => set({ copyReportToClipboard }),
  setLiqWarningDistance: (liqWarningDistance) => set({ liqWarningDistance }),
  setLiqDangerDistance: (liqDangerDistance) => set({ liqDangerDistance }),
  setPnlTolerance: (pnlTolerance) => set({ pnlTolerance }),
  setExtensionSkipConfirm: (extensionSkipConfirm) => set({ extensionSkipConfirm }),
  setExtensionEnabled: (extensionEnabled) => set({ extensionEnabled }),
  setGoogleSheetsUrl: (googleSheetsUrl) => set({ googleSheetsUrl }),
  setSettingsLoaded: (settingsLoaded) => set({ settingsLoaded }),

  loadSettings: (settings) => set((state) => ({ ...state, ...settings, settingsLoaded: true })),
}));
