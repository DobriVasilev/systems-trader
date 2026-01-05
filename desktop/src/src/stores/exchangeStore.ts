import { create } from "zustand";
import { AccountInfo, Position, OpenOrder, AssetInfo } from "../exchanges/types";

interface ExchangeState {
  // Data
  prices: Map<string, string>;
  accountInfo: AccountInfo | null;
  positions: Position[];
  openOrders: OpenOrder[];
  assets: Map<string, AssetInfo>;
  assetIds: Map<string, number>;

  // Loading states
  pricesLoading: boolean;
  dataLoading: boolean;

  // Last fetch timestamps (for on-demand refresh logic)
  lastPriceFetch: number;
  lastDataFetch: number;

  // Actions
  setPrices: (prices: Map<string, string>) => void;
  setAccountInfo: (info: AccountInfo | null) => void;
  setPositions: (positions: Position[]) => void;
  setOpenOrders: (orders: OpenOrder[]) => void;
  setAssets: (assets: Map<string, AssetInfo>) => void;
  setAssetIds: (ids: Map<string, number>) => void;
  setPricesLoading: (loading: boolean) => void;
  setDataLoading: (loading: boolean) => void;
  markPriceFetch: () => void;
  markDataFetch: () => void;

  // Selectors (for getting specific prices without re-render on all price changes)
  getPrice: (asset: string) => string | undefined;
}

export const useExchangeStore = create<ExchangeState>((set, get) => ({
  // Initial state
  prices: new Map(),
  accountInfo: null,
  positions: [],
  openOrders: [],
  assets: new Map(),
  assetIds: new Map(),
  pricesLoading: false,
  dataLoading: false,
  lastPriceFetch: 0,
  lastDataFetch: 0,

  // Actions
  setPrices: (prices) => set({ prices, lastPriceFetch: Date.now() }),
  setAccountInfo: (accountInfo) => set({ accountInfo }),
  setPositions: (positions) => set({ positions }),
  setOpenOrders: (openOrders) => set({ openOrders }),
  setAssets: (assets) => set({ assets }),
  setAssetIds: (assetIds) => set({ assetIds }),
  setPricesLoading: (pricesLoading) => set({ pricesLoading }),
  setDataLoading: (dataLoading) => set({ dataLoading }),
  markPriceFetch: () => set({ lastPriceFetch: Date.now() }),
  markDataFetch: () => set({ lastDataFetch: Date.now() }),

  // Get price without subscribing to all price changes
  getPrice: (asset) => get().prices.get(asset),
}));

// Selector hooks for optimal re-renders
export const usePrice = (asset: string) =>
  useExchangeStore((state) => state.prices.get(asset));

export const useAccountInfo = () =>
  useExchangeStore((state) => state.accountInfo);

export const usePositions = () =>
  useExchangeStore((state) => state.positions);

export const useOpenOrders = () =>
  useExchangeStore((state) => state.openOrders);
