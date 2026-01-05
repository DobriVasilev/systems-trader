import { create } from "zustand";

interface TradeCalculations {
  calculatedQty: number | null;
  calculatedMargin: number | null;
  calculatedLiquidation: number | null;
  estimatedPnl: number | null;
  rrRatio: number | null;
  slDistance: number | null;
  tpDistance: number | null;
}

interface TradeWarnings {
  liqWarning: { level: "safe" | "warning" | "danger"; message: string } | null;
  minOrderWarning: string | null;
  balanceWarning: { message: string; suggestedLeverage?: number } | null;
  priceOrderError: string | null;
}

interface TradeFormState {
  selectedAsset: string;
  riskAmount: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  leverage: string;
  orderType: "market" | "limit";
  direction: "long" | "short" | null;
  autoUpdateEntry: boolean;
}

interface UnfilledOrder {
  symbol: string;
  direction: "long" | "short";
  qty: number;
  originalPrice: number;
  timestamp: number;
}

interface ExecutionState {
  isExecuting: boolean;
  executionStatus: string;
  showConfirmModal: boolean;
  showRetryModal: boolean;
  retryEntryPrice: string;
  unfilledOrder: UnfilledOrder | null;
}

interface TradeState extends TradeFormState, TradeCalculations, TradeWarnings, ExecutionState {
  // Actions - Form
  setSelectedAsset: (asset: string) => void;
  setRiskAmount: (amount: string) => void;
  setEntryPrice: (price: string) => void;
  setStopLoss: (price: string) => void;
  setTakeProfit: (price: string) => void;
  setLeverage: (leverage: string) => void;
  setOrderType: (type: "market" | "limit") => void;
  setDirection: (direction: "long" | "short" | null) => void;
  setAutoUpdateEntry: (enabled: boolean) => void;

  // Actions - Calculations (individual setters)
  setCalculatedQty: (qty: number | null) => void;
  setCalculatedMargin: (margin: number | null) => void;
  setCalculatedLiquidation: (liq: number | null) => void;
  setEstimatedPnl: (pnl: number | null) => void;
  setRrRatio: (rr: number | null) => void;
  setSlDistance: (dist: number | null) => void;
  setTpDistance: (dist: number | null) => void;
  setCalculations: (calcs: Partial<TradeCalculations>) => void;

  // Actions - Warnings (individual setters)
  setLiqWarning: (warning: TradeWarnings["liqWarning"]) => void;
  setMinOrderWarning: (warning: string | null) => void;
  setBalanceWarning: (warning: TradeWarnings["balanceWarning"]) => void;
  setPriceOrderError: (error: string | null) => void;
  setWarnings: (warnings: Partial<TradeWarnings>) => void;
  clearCalculations: () => void;

  // Actions - Execution
  setIsExecuting: (executing: boolean) => void;
  setExecutionStatus: (status: string) => void;
  setShowConfirmModal: (show: boolean) => void;
  setShowRetryModal: (show: boolean) => void;
  setRetryEntryPrice: (price: string) => void;
  setUnfilledOrder: (order: ExecutionState["unfilledOrder"]) => void;

  // Reset form
  resetForm: () => void;
}

const initialFormState: TradeFormState = {
  selectedAsset: "BTC",
  riskAmount: "1.00",
  entryPrice: "",
  stopLoss: "",
  takeProfit: "",
  leverage: "25",
  orderType: "limit",
  direction: null,
  autoUpdateEntry: true,
};

const initialCalculations: TradeCalculations = {
  calculatedQty: null,
  calculatedMargin: null,
  calculatedLiquidation: null,
  estimatedPnl: null,
  rrRatio: null,
  slDistance: null,
  tpDistance: null,
};

const initialWarnings: TradeWarnings = {
  liqWarning: null,
  minOrderWarning: null,
  balanceWarning: null,
  priceOrderError: null,
};

const initialExecutionState: ExecutionState = {
  isExecuting: false,
  executionStatus: "",
  showConfirmModal: false,
  showRetryModal: false,
  retryEntryPrice: "",
  unfilledOrder: null,
};

export const useTradeStore = create<TradeState>((set) => ({
  ...initialFormState,
  ...initialCalculations,
  ...initialWarnings,
  ...initialExecutionState,

  // Form actions
  setSelectedAsset: (selectedAsset) => set({ selectedAsset }),
  setRiskAmount: (riskAmount) => set({ riskAmount }),
  setEntryPrice: (entryPrice) => set({ entryPrice }),
  setStopLoss: (stopLoss) => set({ stopLoss }),
  setTakeProfit: (takeProfit) => set({ takeProfit }),
  setLeverage: (leverage) => set({ leverage }),
  setOrderType: (orderType) => set({ orderType }),
  setDirection: (direction) => set({ direction }),
  setAutoUpdateEntry: (autoUpdateEntry) => set({ autoUpdateEntry }),

  // Calculation actions (individual setters)
  setCalculatedQty: (calculatedQty) => set({ calculatedQty }),
  setCalculatedMargin: (calculatedMargin) => set({ calculatedMargin }),
  setCalculatedLiquidation: (calculatedLiquidation) => set({ calculatedLiquidation }),
  setEstimatedPnl: (estimatedPnl) => set({ estimatedPnl }),
  setRrRatio: (rrRatio) => set({ rrRatio }),
  setSlDistance: (slDistance) => set({ slDistance }),
  setTpDistance: (tpDistance) => set({ tpDistance }),
  setCalculations: (calcs) => set((state) => ({ ...state, ...calcs })),

  // Warning actions (individual setters)
  setLiqWarning: (liqWarning) => set({ liqWarning }),
  setMinOrderWarning: (minOrderWarning) => set({ minOrderWarning }),
  setBalanceWarning: (balanceWarning) => set({ balanceWarning }),
  setPriceOrderError: (priceOrderError) => set({ priceOrderError }),
  setWarnings: (warnings) => set((state) => ({ ...state, ...warnings })),
  clearCalculations: () => set({ ...initialCalculations, ...initialWarnings }),

  // Execution actions
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setExecutionStatus: (executionStatus) => set({ executionStatus }),
  setShowConfirmModal: (showConfirmModal) => set({ showConfirmModal }),
  setShowRetryModal: (showRetryModal) => set({ showRetryModal }),
  setRetryEntryPrice: (retryEntryPrice) => set({ retryEntryPrice }),
  setUnfilledOrder: (unfilledOrder) => set({ unfilledOrder }),

  // Reset
  resetForm: () => set({ ...initialFormState, ...initialCalculations, ...initialWarnings }),
}));
