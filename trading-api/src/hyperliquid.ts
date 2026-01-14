/**
 * Hyperliquid Trading SDK
 *
 * Server-side implementation for executing trades on Hyperliquid.
 * Ported from the Tauri desktop app with modifications for server use.
 */

import { ethers, keccak256 } from "ethers";
import { encode } from "@msgpack/msgpack";

// API Endpoints
const MAINNET_INFO_API = "https://api.hyperliquid.xyz/info";
const MAINNET_EXCHANGE_API = "https://api.hyperliquid.xyz/exchange";

// EIP-712 domain for phantom agent signing
const PHANTOM_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000",
};

const AGENT_TYPES = {
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
};

// Types
export interface AccountInfo {
  balance: string;
  available: string;
  totalMarginUsed: string;
  totalPositionValue: string;
}

export interface Position {
  symbol: string;
  size: string;
  entryPrice: string;
  unrealizedPnl: string;
  leverage: string;
  liquidationPrice: string;
  side: "long" | "short";
}

export interface OpenOrder {
  symbol: string;
  side: "buy" | "sell";
  size: string;
  price: string;
  orderType: string;
  timestamp: number;
  oid: number;
}

export interface OrderParams {
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

// Raw API response types
interface MetaResponse {
  universe?: Array<{ name: string; szDecimals: number }>;
}

interface ClearinghouseResponse {
  marginSummary?: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
  };
  withdrawable?: string;
  assetPositions?: Array<{
    position: {
      coin: string;
      szi: string;
      entryPx: string;
      unrealizedPnl: string;
      leverage?: {
        value: string;
      };
      liquidationPx: string;
    };
  }>;
}

interface ExchangeResponse {
  status: string;
  response?: {
    type: string;
    data?: {
      statuses?: Array<{
        filled?: {
          totalSz: string;
          avgPx: string;
          oid: number;
        };
        resting?: {
          oid: number;
        };
        error?: string;
      }>;
    };
  };
}

// Helper functions
function normalizeTrailingZeros(obj: unknown): unknown {
  if (typeof obj === "string") {
    if (obj.includes(".")) {
      const trimmed = obj.replace(/\.?0+$/, "");
      return trimmed === "" ? "0" : trimmed;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizeTrailingZeros);
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = normalizeTrailingZeros(value);
    }
    return result;
  }
  return obj;
}

function addressToBytes(address: string): Uint8Array {
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function actionHash(action: unknown, vaultAddress: string | null, nonce: number): string {
  const normalizedAction = normalizeTrailingZeros(action);
  const msgPackBytes = encode(normalizedAction);
  const additionalBytesLength = vaultAddress === null ? 9 : 29;
  const data = new Uint8Array(msgPackBytes.length + additionalBytesLength);
  data.set(msgPackBytes);
  const view = new DataView(data.buffer);
  view.setBigUint64(msgPackBytes.length, BigInt(nonce), false);
  if (vaultAddress === null) {
    view.setUint8(msgPackBytes.length + 8, 0);
  } else {
    view.setUint8(msgPackBytes.length + 8, 1);
    data.set(addressToBytes(vaultAddress), msgPackBytes.length + 9);
  }
  return keccak256(data);
}

function constructPhantomAgent(hash: string, isMainnet: boolean) {
  return { source: isMainnet ? "a" : "b", connectionId: hash };
}

function formatHyperliquidPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num) || num <= 0) return "0";

  const magnitude = Math.floor(Math.log10(Math.abs(num)));
  const scale = Math.pow(10, 4 - magnitude);
  const rounded = Math.round(num * scale) / scale;

  let decimals: number;
  if (num >= 10000) decimals = 1;
  else if (num >= 100) decimals = 2;
  else if (num >= 1) decimals = 4;
  else decimals = 6;

  return rounded.toFixed(decimals);
}

/**
 * Hyperliquid Exchange Client
 *
 * Initialize with a private key to execute trades.
 */
export class HyperliquidClient {
  private wallet: ethers.Wallet;
  private walletAddress: string;
  private assetMap: Map<string, number> = new Map();
  private assetDecimals: Map<string, number> = new Map();
  private initialized: boolean = false;

  constructor(privateKey: string, mainWalletAddress?: string) {
    // Ensure key has 0x prefix
    const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    this.wallet = new ethers.Wallet(formattedKey);
    // Use provided main wallet address, or derive from private key
    this.walletAddress = mainWalletAddress || this.wallet.address;
  }

  /**
   * Initialize the client by loading asset metadata
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const response = await fetch(MAINNET_INFO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });
    const meta = (await response.json()) as MetaResponse;

    if (meta?.universe) {
      meta.universe.forEach((asset, index) => {
        this.assetMap.set(asset.name, index);
        this.assetDecimals.set(asset.name, asset.szDecimals);
      });
    }

    this.initialized = true;
  }

  /**
   * Get the wallet address
   */
  getAddress(): string {
    return this.walletAddress;
  }

  /**
   * Sign an action for Hyperliquid
   */
  private async signAction(action: unknown, timestamp: number): Promise<{ r: string; s: string; v: number }> {
    const hash = actionHash(action, null, timestamp);
    const phantomAgent = constructPhantomAgent(hash, true);
    const rawSignature = await this.wallet.signTypedData(PHANTOM_DOMAIN, AGENT_TYPES, phantomAgent);
    const { r, s, v } = ethers.Signature.from(rawSignature);
    return { r, s, v };
  }

  /**
   * Get account info (balance, margin, etc.)
   */
  async getAccountInfo(): Promise<AccountInfo> {
    const response = await fetch(MAINNET_INFO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: this.walletAddress,
      }),
    });
    const state = (await response.json()) as ClearinghouseResponse;

    // Debug logging
    console.log('[Trading API Hyperliquid] getAccountInfo for:', this.walletAddress);
    console.log('[Trading API Hyperliquid] clearinghouseState response:', {
      hasMarginSummary: !!state?.marginSummary,
      accountValue: state?.marginSummary?.accountValue,
      withdrawable: state?.withdrawable,
      totalMarginUsed: state?.marginSummary?.totalMarginUsed,
      totalNtlPos: state?.marginSummary?.totalNtlPos,
    });

    return {
      balance: state?.marginSummary?.accountValue || "0",
      available: state?.withdrawable || "0",
      totalMarginUsed: state?.marginSummary?.totalMarginUsed || "0",
      totalPositionValue: state?.marginSummary?.totalNtlPos || "0",
    };
  }

  /**
   * Get open positions
   */
  async getPositions(): Promise<Position[]> {
    const response = await fetch(MAINNET_INFO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: this.walletAddress,
      }),
    });
    const state = (await response.json()) as ClearinghouseResponse;

    if (!state?.assetPositions) return [];

    return state.assetPositions
      .filter((ap) => ap.position && parseFloat(ap.position.szi) !== 0)
      .map((ap) => ({
        symbol: ap.position.coin,
        size: Math.abs(parseFloat(ap.position.szi)).toString(),
        entryPrice: ap.position.entryPx,
        unrealizedPnl: ap.position.unrealizedPnl,
        leverage: ap.position.leverage?.value || "1",
        liquidationPrice: ap.position.liquidationPx || "0",
        side: (parseFloat(ap.position.szi) > 0 ? "long" : "short") as "long" | "short",
      }));
  }

  /**
   * Get open orders
   */
  async getOpenOrders(): Promise<OpenOrder[]> {
    const response = await fetch(MAINNET_INFO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "openOrders",
        user: this.walletAddress,
      }),
    });
    const orders = await response.json();

    if (!Array.isArray(orders)) return [];

    return orders.map((order: any) => ({
      symbol: order.coin,
      side: order.side === "B" ? "buy" : "sell",
      size: order.sz,
      price: order.limitPx,
      orderType: order.orderType || "limit",
      timestamp: order.timestamp,
      oid: order.oid,
    }));
  }

  /**
   * Get current market prices
   */
  async getMarketPrices(): Promise<Record<string, number>> {
    const response = await fetch(MAINNET_INFO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });
    const mids = await response.json();

    const prices: Record<string, number> = {};
    if (mids && typeof mids === "object") {
      for (const [asset, price] of Object.entries(mids)) {
        prices[asset] = parseFloat(price as string);
      }
    }
    return prices;
  }

  /**
   * Place an order
   */
  async placeOrder(params: OrderParams): Promise<OrderResult> {
    await this.initialize();

    const assetId = this.assetMap.get(params.asset);
    if (assetId === undefined) {
      return { success: false, error: `Asset ${params.asset} not found` };
    }

    try {
      const timestamp = Date.now();
      const formattedPrice = formatHyperliquidPrice(params.price);
      const szDecimals = this.assetDecimals.get(params.asset) || 4;
      const formattedSize = params.size.toFixed(szDecimals);

      const orderWire = {
        a: assetId,
        b: params.isBuy,
        p: formattedPrice,
        s: formattedSize,
        r: params.reduceOnly || false,
        t: params.postOnly
          ? { limit: { tif: "Alo" } }
          : { limit: { tif: "Gtc" } },
      };

      const action = {
        type: "order",
        orders: [orderWire],
        grouping: "na",
      };

      const signature = await this.signAction(action, timestamp);

      const response = await fetch(MAINNET_EXCHANGE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = (await response.json()) as ExchangeResponse;

      if (result.status === "ok") {
        const statuses = result.response?.data?.statuses;

        if (statuses?.[0]?.error) {
          return { success: false, error: statuses[0].error };
        }

        const orderId = statuses?.[0]?.resting?.oid || statuses?.[0]?.filled?.oid;
        return {
          success: true,
          orderId,
          filledSize: statuses?.[0]?.filled?.totalSz ? parseFloat(statuses[0].filled.totalSz) : undefined,
          avgPrice: statuses?.[0]?.filled?.avgPx ? parseFloat(statuses[0].filled.avgPx) : undefined,
        };
      } else {
        return { success: false, error: JSON.stringify(result) };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Place a market order (limit order with slippage)
   */
  async placeMarketOrder(asset: string, isBuy: boolean, size: number): Promise<OrderResult> {
    await this.initialize();

    const prices = await this.getMarketPrices();
    const currentPrice = prices[asset];
    if (!currentPrice) {
      return { success: false, error: `Could not get price for ${asset}` };
    }

    // 1% slippage for market order
    const slippagePrice = isBuy ? currentPrice * 1.01 : currentPrice * 0.99;

    return this.placeOrder({
      asset,
      isBuy,
      price: slippagePrice,
      size,
    });
  }

  /**
   * Cancel an order
   */
  async cancelOrder(asset: string, orderId: number): Promise<boolean> {
    await this.initialize();

    const assetId = this.assetMap.get(asset);
    if (assetId === undefined) return false;

    try {
      const timestamp = Date.now();
      const action = {
        type: "cancel",
        cancels: [{ a: assetId, o: orderId }],
      };

      const signature = await this.signAction(action, timestamp);

      const response = await fetch(MAINNET_EXCHANGE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = (await response.json()) as ExchangeResponse;
      return result.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Set leverage for an asset
   */
  async setLeverage(asset: string, leverage: number): Promise<boolean> {
    await this.initialize();

    const assetId = this.assetMap.get(asset);
    if (assetId === undefined) return false;

    try {
      const timestamp = Date.now();
      const action = {
        type: "updateLeverage",
        asset: assetId,
        isCross: true,
        leverage,
      };

      const signature = await this.signAction(action, timestamp);

      const response = await fetch(MAINNET_EXCHANGE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = (await response.json()) as ExchangeResponse;
      return result.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Place a stop loss order
   */
  async placeStopLoss(asset: string, isLong: boolean, size: number, triggerPrice: number): Promise<OrderResult> {
    await this.initialize();

    const assetId = this.assetMap.get(asset);
    if (assetId === undefined) {
      return { success: false, error: `Asset ${asset} not found` };
    }

    try {
      const timestamp = Date.now();
      const formattedTrigger = formatHyperliquidPrice(triggerPrice);
      const szDecimals = this.assetDecimals.get(asset) || 4;
      const formattedSize = size.toFixed(szDecimals);

      const orderWire = {
        a: assetId,
        b: !isLong, // Opposite direction to close
        p: formattedTrigger,
        s: formattedSize,
        r: true, // Reduce only
        t: {
          trigger: {
            isMarket: true,
            triggerPx: formattedTrigger,
            tpsl: "sl",
          },
        },
      };

      const action = {
        type: "order",
        orders: [orderWire],
        grouping: "na",
      };

      const signature = await this.signAction(action, timestamp);

      const response = await fetch(MAINNET_EXCHANGE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = (await response.json()) as ExchangeResponse;

      if (result.status === "ok") {
        return { success: true };
      } else {
        return { success: false, error: JSON.stringify(result.response || result) };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Place a take profit order
   */
  async placeTakeProfit(asset: string, isLong: boolean, size: number, triggerPrice: number): Promise<OrderResult> {
    await this.initialize();

    const assetId = this.assetMap.get(asset);
    if (assetId === undefined) {
      return { success: false, error: `Asset ${asset} not found` };
    }

    try {
      const timestamp = Date.now();
      const formattedTrigger = formatHyperliquidPrice(triggerPrice);
      const szDecimals = this.assetDecimals.get(asset) || 4;
      const formattedSize = size.toFixed(szDecimals);

      const orderWire = {
        a: assetId,
        b: !isLong, // Opposite direction to close
        p: formattedTrigger,
        s: formattedSize,
        r: true, // Reduce only
        t: {
          trigger: {
            isMarket: true,
            triggerPx: formattedTrigger,
            tpsl: "tp",
          },
        },
      };

      const action = {
        type: "order",
        orders: [orderWire],
        grouping: "na",
      };

      const signature = await this.signAction(action, timestamp);

      const response = await fetch(MAINNET_EXCHANGE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = (await response.json()) as ExchangeResponse;

      if (result.status === "ok") {
        return { success: true };
      } else {
        return { success: false, error: JSON.stringify(result.response || result) };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Close a position at market
   */
  async closePosition(asset: string): Promise<OrderResult> {
    const positions = await this.getPositions();
    const position = positions.find(p => p.symbol === asset);

    if (!position) {
      return { success: true }; // No position to close
    }

    const size = parseFloat(position.size);
    const isLong = position.side === "long";

    return this.placeMarketOrder(asset, !isLong, size);
  }

  /**
   * Close all positions at market
   */
  async closeAllPositions(): Promise<OrderResult> {
    try {
      const positions = await this.getPositions();
      if (positions.length === 0) {
        return { success: true };
      }

      const errors: string[] = [];
      for (const pos of positions) {
        const result = await this.closePosition(pos.symbol);
        if (!result.success) {
          errors.push(`${pos.symbol}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        return { success: false, error: errors.join("; ") };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Cancel all open orders
   */
  async cancelAllOrders(): Promise<OrderResult> {
    try {
      const orders = await this.getOpenOrders();
      if (orders.length === 0) {
        return { success: true };
      }

      const errors: string[] = [];
      for (const order of orders) {
        const result = await this.cancelOrder(order.symbol, order.oid);
        if (!result) {
          errors.push(`${order.symbol} order ${order.oid}`);
        }
      }

      if (errors.length > 0) {
        return { success: false, error: `Failed to cancel: ${errors.join(", ")}` };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Withdraw funds to destination address
   * Note: This requires the MAIN wallet private key, not an API wallet
   * API wallets cannot withdraw - that's a security feature
   */
  async withdrawFunds(destination: string, amount?: string): Promise<OrderResult> {
    try {
      // Get available balance
      const accountInfo = await this.getAccountInfo();
      const availableBalance = parseFloat(accountInfo.available);

      if (availableBalance <= 1) {
        return { success: false, error: "Insufficient balance to withdraw (need > $1 for fee)" };
      }

      // Calculate withdraw amount (leave $1 for fee, or use specified amount)
      const withdrawAmount = amount
        ? Math.min(parseFloat(amount), availableBalance - 1)
        : availableBalance - 1;

      if (withdrawAmount <= 0) {
        return { success: false, error: "Nothing to withdraw after fees" };
      }

      const amountStr = withdrawAmount.toFixed(2);
      const timestamp = Date.now();

      // Build the withdraw action
      const withdrawAction = {
        type: "withdraw3",
        hyperliquidChain: "Mainnet",
        signatureChainId: "0xa4b1", // Arbitrum chain ID in hex
        destination: destination,
        amount: amountStr,
        time: timestamp,
      };

      // EIP-712 domain for Arbitrum
      const WITHDRAW_DOMAIN = {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: 42161, // Arbitrum
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };

      // Types for withdraw
      const WITHDRAW_TYPES = {
        "HyperliquidTransaction:Withdraw": [
          { name: "hyperliquidChain", type: "string" },
          { name: "destination", type: "string" },
          { name: "amount", type: "string" },
          { name: "time", type: "uint64" },
        ],
      };

      // Message to sign
      const withdrawMessage = {
        hyperliquidChain: withdrawAction.hyperliquidChain,
        destination: withdrawAction.destination,
        amount: withdrawAction.amount,
        time: withdrawAction.time,
      };

      const rawSignature = await this.wallet.signTypedData(
        WITHDRAW_DOMAIN,
        WITHDRAW_TYPES,
        withdrawMessage
      );
      const { r, s, v } = ethers.Signature.from(rawSignature);

      const requestBody = {
        action: withdrawAction,
        nonce: timestamp,
        signature: { r, s, v },
      };

      const response = await fetch(MAINNET_EXCHANGE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = (await response.json()) as ExchangeResponse;

      if (result.status === "ok") {
        return {
          success: true,
          orderId: timestamp,
        };
      } else {
        return { success: false, error: JSON.stringify(result.response || result) };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Emergency withdraw - closes positions, cancels orders, withdraws all funds
   * Note: Requires main wallet key (not API wallet)
   */
  async emergencyWithdraw(destination: string, amount?: string): Promise<OrderResult> {
    try {
      // Step 1: Cancel all open orders
      await this.cancelAllOrders();

      // Step 2: Close all positions
      const closeResult = await this.closeAllPositions();
      if (!closeResult.success) {
        console.warn("Some positions may not have closed:", closeResult.error);
      }

      // Wait a moment for settlements
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Withdraw funds
      return await this.withdrawFunds(destination, amount);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

/**
 * Create a Hyperliquid client from a private key
 */
export function createHyperliquidClient(privateKey: string, mainWalletAddress?: string): HyperliquidClient {
  return new HyperliquidClient(privateKey, mainWalletAddress);
}
