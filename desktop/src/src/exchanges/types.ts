// Common exchange types - shared across all exchange implementations

export type ExchangeType = "hyperliquid";

export type WalletType = "evm";

export interface ExchangeConfig {
  type: ExchangeType;
  name: string;
  walletType: WalletType;
  testnetAvailable: boolean;
  makerFee: number;  // negative = rebate
  takerFee: number;
}

export const EXCHANGE_CONFIGS: Record<ExchangeType, ExchangeConfig> = {
  hyperliquid: {
    type: "hyperliquid",
    name: "Hyperliquid",
    walletType: "evm",
    testnetAvailable: true,
    makerFee: 0.00015,  // 0.015%
    takerFee: 0.00045,  // 0.045%
  },
};

// Account info returned by exchange
export interface AccountInfo {
  balance: string;
  available: string;
  totalMarginUsed: string;
  totalPositionValue: string;
}

// Position info
export interface Position {
  symbol: string;
  size: string;
  entryPrice: string;
  unrealizedPnl: string;
  leverage: string;
  liquidationPrice: string;
  side: "long" | "short";
}

// Open order info
export interface OpenOrder {
  symbol: string;
  side: "buy" | "sell";
  size: string;
  price: string;
  orderType: string;
  timestamp: number;
  oid: string | number;
}

// Asset/market info
export interface AssetInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  assetId: number | string;
}

// Order parameters for placing orders
export interface OrderParams {
  asset: string;
  isBuy: boolean;
  size: number;
  price: number;
  reduceOnly?: boolean;
  postOnly?: boolean;
  leverage?: number;
}

// Order result
export interface OrderResult {
  success: boolean;
  orderId?: string | number;
  error?: string;
  filledSize?: number;
  avgPrice?: number;
}

// Cancel order params
export interface CancelOrderParams {
  asset: string;
  orderId: string | number;
}

// Market prices
export interface MarketPrices {
  [asset: string]: number;
}

// Credentials interface
export interface HyperliquidCredentials {
  walletAddress: string;
  privateKey: string;
}

export type ExchangeCredentials = HyperliquidCredentials;

// The main exchange interface - all exchanges must implement this
export interface Exchange {
  readonly type: ExchangeType;
  readonly config: ExchangeConfig;

  // Connection
  initialize(credentials: ExchangeCredentials): Promise<void>;
  isConnected(): boolean;
  disconnect(): void;

  // Account
  getAccountInfo(): Promise<AccountInfo>;
  getPositions(): Promise<Position[]>;
  getOpenOrders(): Promise<OpenOrder[]>;

  // Market data
  getAssets(): Promise<AssetInfo[]>;
  getMarketPrices(): Promise<MarketPrices>;
  getAssetPrice(asset: string): Promise<number>;

  // Trading
  placeOrder(params: OrderParams): Promise<OrderResult>;
  cancelOrder(params: CancelOrderParams): Promise<boolean>;
  cancelAllOrders(asset?: string): Promise<boolean>;
  closePosition?(asset: string): Promise<OrderResult>;  // Close entire position for asset
  emergencyWithdraw?(destination: string, amount: string): Promise<OrderResult>;  // Emergency withdraw all funds

  // Leverage
  setLeverage(asset: string, leverage: number): Promise<boolean>;

  // Optional: Get minimum order size for an asset (in base units)
  getMinOrderSize?(asset: string): Promise<number>;
}

// Factory function type
export type ExchangeFactory = (isTestnet?: boolean) => Exchange;
