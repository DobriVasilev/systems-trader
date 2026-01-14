/**
 * Trading API Client
 *
 * Client for calling the Bulgarian trading API server.
 * Used when the web app is deployed on Vercel but needs Bulgarian IP for trades.
 */

const TRADING_API_URL = process.env.TRADING_API_URL || "http://localhost:4000";
const TRADING_API_KEY = process.env.TRADING_API_KEY || "";

interface TradingApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function callTradingApi<T>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>
): Promise<TradingApiResponse<T>> {
  try {
    const response = await fetch(`${TRADING_API_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": TRADING_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      return { success: false, error: error.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============= Wallet Operations =============

export async function encryptWalletKey(privateKey: string) {
  return callTradingApi<{ address: string; encryptedKey: string }>(
    "/wallets/encrypt",
    "POST",
    { privateKey }
  );
}

// ============= Account Operations =============

export async function getAccountInfo(encryptedKey: string, address?: string) {
  return callTradingApi<{
    balance: string;
    available: string;
    totalMarginUsed: string;
    totalPositionValue: string;
  }>("/account", "POST", { encryptedKey, address });
}

// ============= Position Operations =============

export async function getPositions(encryptedKey: string, address?: string) {
  return callTradingApi<
    Array<{
      symbol: string;
      size: string;
      entryPrice: string;
      unrealizedPnl: string;
      leverage: string;
      liquidationPrice: string;
      side: "long" | "short";
    }>
  >("/positions", "POST", { encryptedKey, address });
}

export async function getOpenOrders(encryptedKey: string, address?: string) {
  return callTradingApi<
    Array<{
      symbol: string;
      side: "buy" | "sell";
      size: string;
      price: string;
      orderType: string;
      timestamp: number;
      oid: number;
    }>
  >("/orders", "POST", { encryptedKey, address });
}

// ============= Trade Operations =============

export interface PlaceOrderParams {
  encryptedKey: string;
  address?: string;
  asset: string;
  isBuy: boolean;
  price: number;
  size: number;
  reduceOnly?: boolean;
  postOnly?: boolean;
}

export interface OrderResult {
  success: boolean;
  orderId?: number;
  filledSize?: number;
  avgPrice?: number;
  error?: string;
}

export async function placeOrder(params: PlaceOrderParams) {
  return callTradingApi<OrderResult>("/trade", "POST", { ...params });
}

export async function placeMarketOrder(
  encryptedKey: string,
  asset: string,
  isBuy: boolean,
  size: number,
  address?: string
) {
  return callTradingApi<OrderResult>("/trade/market", "POST", {
    encryptedKey,
    address,
    asset,
    isBuy,
    size,
  });
}

export async function closePosition(encryptedKey: string, asset: string, address?: string) {
  return callTradingApi<OrderResult>("/trade/close", "POST", {
    encryptedKey,
    address,
    asset,
  });
}

export async function closeAllPositions(encryptedKey: string, address?: string) {
  return callTradingApi<OrderResult>("/trade/close-all", "POST", {
    encryptedKey,
    address,
  });
}

export async function cancelOrder(
  encryptedKey: string,
  asset: string,
  orderId: number,
  address?: string
) {
  return callTradingApi<{ success: boolean }>("/trade/cancel", "POST", {
    encryptedKey,
    address,
    asset,
    orderId,
  });
}

export async function cancelAllOrders(encryptedKey: string, address?: string) {
  return callTradingApi<OrderResult>("/trade/cancel-all", "POST", {
    encryptedKey,
    address,
  });
}

export async function setLeverage(
  encryptedKey: string,
  asset: string,
  leverage: number,
  address?: string
) {
  return callTradingApi<{ success: boolean }>("/leverage", "POST", {
    encryptedKey,
    address,
    asset,
    leverage,
  });
}

export async function placeStopLoss(
  encryptedKey: string,
  asset: string,
  isLong: boolean,
  size: number,
  triggerPrice: number,
  address?: string
) {
  return callTradingApi<OrderResult>("/trade/stop-loss", "POST", {
    encryptedKey,
    address,
    asset,
    isLong,
    size,
    triggerPrice,
  });
}

export async function placeTakeProfit(
  encryptedKey: string,
  asset: string,
  isLong: boolean,
  size: number,
  triggerPrice: number,
  address?: string
) {
  return callTradingApi<OrderResult>("/trade/take-profit", "POST", {
    encryptedKey,
    address,
    asset,
    isLong,
    size,
    triggerPrice,
  });
}

export async function withdrawFunds(
  encryptedKey: string,
  destination: string,
  amount?: string,
  address?: string
) {
  return callTradingApi<OrderResult>("/withdraw", "POST", {
    encryptedKey,
    address,
    destination,
    amount,
  });
}

export async function emergencyWithdraw(
  encryptedKey: string,
  destination: string,
  amount?: string,
  address?: string
) {
  return callTradingApi<OrderResult>("/emergency-withdraw", "POST", {
    encryptedKey,
    address,
    destination,
    amount,
  });
}

// ============= Price Operations =============

export async function getMarketPrices() {
  return callTradingApi<Record<string, number>>("/prices", "GET");
}

export async function getCoinMetadata() {
  return callTradingApi<{ universe: Array<{ name: string; szDecimals: number }> }>(
    "/coins",
    "GET"
  );
}

// ============= Health Check =============

export async function checkTradingApiHealth() {
  return callTradingApi<{ status: string; timestamp: string }>("/health", "GET");
}

/**
 * Check if trading API is configured and available
 */
export function isTradingApiConfigured(): boolean {
  return Boolean(TRADING_API_URL && TRADING_API_KEY);
}
