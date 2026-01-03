// Hyperliquid Exchange Implementation
import { ethers, keccak256 } from "ethers";
import { encode } from "@msgpack/msgpack";
import {
  Exchange,
  ExchangeConfig,
  EXCHANGE_CONFIGS,
  AccountInfo,
  Position,
  OpenOrder,
  AssetInfo,
  MarketPrices,
  OrderParams,
  OrderResult,
  CancelOrderParams,
  HyperliquidCredentials,
  ExchangeCredentials,
} from "./types";

const MAINNET_INFO_API = "https://api.hyperliquid.xyz/info";
const MAINNET_EXCHANGE_API = "https://api.hyperliquid.xyz/exchange";
const TESTNET_INFO_API = "https://api.hyperliquid-testnet.xyz/info";
const TESTNET_EXCHANGE_API = "https://api.hyperliquid-testnet.xyz/exchange";

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

export class HyperliquidExchange implements Exchange {
  readonly type = "hyperliquid" as const;
  readonly config: ExchangeConfig = EXCHANGE_CONFIGS.hyperliquid;

  private wallet: ethers.Wallet | null = null;
  private walletAddress: string = "";
  private infoApi: string;
  private exchangeApi: string;
  private isMainnet: boolean;
  private assetMap: Map<string, number> = new Map();
  private assetDecimals: Map<string, number> = new Map();

  constructor(isTestnet: boolean = false) {
    this.isMainnet = !isTestnet;
    this.infoApi = isTestnet ? TESTNET_INFO_API : MAINNET_INFO_API;
    this.exchangeApi = isTestnet ? TESTNET_EXCHANGE_API : MAINNET_EXCHANGE_API;
  }

  async initialize(credentials: ExchangeCredentials): Promise<void> {
    const creds = credentials as HyperliquidCredentials;
    this.wallet = new ethers.Wallet(creds.privateKey);
    this.walletAddress = creds.walletAddress;

    // Load asset metadata
    await this.loadAssetMetadata();
  }

  isConnected(): boolean {
    return this.wallet !== null && this.walletAddress !== "";
  }

  disconnect(): void {
    this.wallet = null;
    this.walletAddress = "";
  }

  private async loadAssetMetadata(): Promise<void> {
    const response = await fetch(this.infoApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });
    const meta = await response.json();

    if (meta?.universe) {
      meta.universe.forEach((asset: { name: string; szDecimals: number }, index: number) => {
        this.assetMap.set(asset.name, index);
        this.assetDecimals.set(asset.name, asset.szDecimals);
      });
    }
  }

  private async signAction(action: unknown, timestamp: number): Promise<{ r: string; s: string; v: number }> {
    if (!this.wallet) throw new Error("Wallet not initialized");

    const hash = actionHash(action, null, timestamp);
    const phantomAgent = constructPhantomAgent(hash, this.isMainnet);
    const rawSignature = await this.wallet.signTypedData(PHANTOM_DOMAIN, AGENT_TYPES, phantomAgent);
    const { r, s, v } = ethers.Signature.from(rawSignature);
    return { r, s, v };
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const response = await fetch(this.infoApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: this.walletAddress,
      }),
    });
    const state = await response.json();

    return {
      balance: state?.marginSummary?.accountValue || "0",
      available: state?.withdrawable || "0",
      totalMarginUsed: state?.marginSummary?.totalMarginUsed || "0",
      totalPositionValue: state?.marginSummary?.totalNtlPos || "0",
    };
  }

  async getPositions(): Promise<Position[]> {
    const response = await fetch(this.infoApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: this.walletAddress,
      }),
    });
    const state = await response.json();

    if (!state?.assetPositions) return [];

    return state.assetPositions
      .filter((ap: any) => ap.position && parseFloat(ap.position.szi) !== 0)
      .map((ap: any) => ({
        symbol: ap.position.coin,
        size: Math.abs(parseFloat(ap.position.szi)).toString(),
        entryPrice: ap.position.entryPx,
        unrealizedPnl: ap.position.unrealizedPnl,
        leverage: ap.position.leverage?.value || "1",
        liquidationPrice: ap.position.liquidationPx || "0",
        side: parseFloat(ap.position.szi) > 0 ? "long" : "short",
      }));
  }

  async getOpenOrders(): Promise<OpenOrder[]> {
    const response = await fetch(this.infoApi, {
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

  async getAssets(): Promise<AssetInfo[]> {
    const response = await fetch(this.infoApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });
    const meta = await response.json();

    if (!meta?.universe) return [];

    return meta.universe.map((asset: any, index: number) => ({
      name: asset.name,
      szDecimals: asset.szDecimals,
      maxLeverage: asset.maxLeverage || 50,
      assetId: index,
    }));
  }

  async getMarketPrices(): Promise<MarketPrices> {
    const response = await fetch(this.infoApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });
    const mids = await response.json();

    const prices: MarketPrices = {};
    if (mids && typeof mids === "object") {
      for (const [asset, price] of Object.entries(mids)) {
        prices[asset] = parseFloat(price as string);
      }
    }
    return prices;
  }

  async getAssetPrice(asset: string): Promise<number> {
    const prices = await this.getMarketPrices();
    return prices[asset] || 0;
  }

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not initialized" };
    }

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
          ? { limit: { tif: "Alo" } }  // Add liquidity only
          : { limit: { tif: "Gtc" } },
      };

      const action = {
        type: "order",
        orders: [orderWire],
        grouping: "na",
      };

      const signature = await this.signAction(action, timestamp);

      const response = await fetch(this.exchangeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = await response.json();

      if (result.status === "ok") {
        const statuses = result.response?.data?.statuses;
        const orderId = statuses?.[0]?.resting?.oid || statuses?.[0]?.filled?.oid;
        return {
          success: true,
          orderId,
          filledSize: statuses?.[0]?.filled?.totalSz ? parseFloat(statuses[0].filled.totalSz) : undefined,
          avgPrice: statuses?.[0]?.filled?.avgPx ? parseFloat(statuses[0].filled.avgPx) : undefined,
        };
      } else {
        return { success: false, error: result.response || JSON.stringify(result) };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async cancelOrder(params: CancelOrderParams): Promise<boolean> {
    if (!this.wallet) return false;

    const assetId = this.assetMap.get(params.asset);
    if (assetId === undefined) return false;

    try {
      const timestamp = Date.now();
      const action = {
        type: "cancel",
        cancels: [{ a: assetId, o: params.orderId }],
      };

      const signature = await this.signAction(action, timestamp);

      const response = await fetch(this.exchangeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = await response.json();
      return result.status === "ok";
    } catch {
      return false;
    }
  }

  async cancelAllOrders(asset?: string): Promise<boolean> {
    const orders = await this.getOpenOrders();
    const toCancel = asset ? orders.filter(o => o.symbol === asset) : orders;

    const results = await Promise.all(
      toCancel.map(o => this.cancelOrder({ asset: o.symbol, orderId: o.oid }))
    );

    return results.every(r => r);
  }

  async setLeverage(asset: string, leverage: number): Promise<boolean> {
    if (!this.wallet) return false;

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

      const response = await fetch(this.exchangeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = await response.json();
      return result.status === "ok";
    } catch {
      return false;
    }
  }

  // Additional Hyperliquid-specific methods

  async placeStopLoss(asset: string, isBuy: boolean, size: number, triggerPrice: number): Promise<OrderResult> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not initialized" };
    }

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
        b: !isBuy, // Opposite direction to close
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

      const response = await fetch(this.exchangeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = await response.json();

      if (result.status === "ok") {
        return { success: true };
      } else {
        return { success: false, error: result.response || JSON.stringify(result) };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async placeTakeProfit(asset: string, isBuy: boolean, size: number, triggerPrice: number): Promise<OrderResult> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not initialized" };
    }

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
        b: !isBuy, // Opposite direction to close
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

      const response = await fetch(this.exchangeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: timestamp,
          signature,
        }),
      });

      const result = await response.json();

      if (result.status === "ok") {
        return { success: true };
      } else {
        return { success: false, error: result.response || JSON.stringify(result) };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Close all positions at market
  async closeAllPositions(): Promise<OrderResult> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not initialized" };
    }

    try {
      const positions = await this.getPositions();
      if (positions.length === 0) {
        return { success: true }; // No positions to close
      }

      const errors: string[] = [];
      for (const pos of positions) {
        const assetId = this.assetMap.get(pos.symbol);
        if (assetId === undefined) {
          errors.push(`Asset ${pos.symbol} not found`);
          continue;
        }

        const timestamp = Date.now();
        const size = parseFloat(pos.size);
        const szDecimals = this.assetDecimals.get(pos.symbol) || 4;
        const isLong = pos.side === "long";

        // Get current price for market order
        const prices = await this.getMarketPrices();
        const currentPrice = prices[pos.symbol] || 0;
        // Slippage: 1% worse price for market order
        const slippagePrice = isLong ? currentPrice * 0.99 : currentPrice * 1.01;

        const orderWire = {
          a: assetId,
          b: !isLong, // Opposite direction to close
          p: formatHyperliquidPrice(slippagePrice),
          s: size.toFixed(szDecimals),
          r: true, // Reduce only
          t: { limit: { tif: "Ioc" } }, // Immediate or cancel
        };

        const action = {
          type: "order",
          orders: [orderWire],
          grouping: "na",
        };

        const signature = await this.signAction(action, timestamp);

        const response = await fetch(this.exchangeApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            nonce: timestamp,
            signature,
          }),
        });

        const result = await response.json();
        if (result.status !== "ok") {
          errors.push(`Failed to close ${pos.symbol}: ${JSON.stringify(result.response)}`);
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

  // Emergency withdraw - closes positions, cancels orders, withdraws all funds
  // This works even if the UI is blocked (flagged account)
  async emergencyWithdraw(destination: string, amount?: string): Promise<OrderResult> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not initialized" };
    }

    try {
      console.log("[Hyperliquid] Starting emergency withdrawal...");

      // Step 1: Cancel all open orders
      console.log("[Hyperliquid] Cancelling all orders...");
      await this.cancelAllOrders();

      // Step 2: Close all positions
      console.log("[Hyperliquid] Closing all positions...");
      const closeResult = await this.closeAllPositions();
      if (!closeResult.success) {
        console.warn("[Hyperliquid] Some positions may not have closed:", closeResult.error);
      }

      // Wait a moment for settlements
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Get available balance
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

      console.log("[Hyperliquid] Withdrawing", withdrawAmount, "USDC to", destination);

      // Step 4: Withdraw via bridge
      const timestamp = Date.now();

      // Withdrawal uses different signature - EIP-712 on Arbitrum (chain ID 42161 = 0xa4b1)
      const withdrawAction = {
        type: "withdraw3",
        hyperliquidChain: this.isMainnet ? "Mainnet" : "Testnet",
        signatureChainId: "0xa4b1", // Arbitrum
        destination: destination,
        amount: withdrawAmount.toFixed(2),
        time: timestamp,
      };

      // Sign the withdrawal action with Arbitrum domain
      const WITHDRAW_DOMAIN = {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: 42161, // Arbitrum
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };

      const WITHDRAW_TYPES = {
        HyperliquidTransaction: [
          { name: "action", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      };

      const withdrawMessage = {
        action: JSON.stringify(withdrawAction),
        nonce: timestamp,
      };

      const rawSignature = await this.wallet.signTypedData(WITHDRAW_DOMAIN, WITHDRAW_TYPES, withdrawMessage);
      const { r, s, v } = ethers.Signature.from(rawSignature);

      const response = await fetch(this.exchangeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: withdrawAction,
          nonce: timestamp,
          signature: { r, s, v },
        }),
      });

      const result = await response.json();

      if (result.status === "ok") {
        console.log("[Hyperliquid] Withdrawal initiated! Funds will arrive in ~5 minutes.");
        return {
          success: true,
          orderId: `withdraw-${timestamp}`,
        };
      } else {
        return { success: false, error: result.response || JSON.stringify(result) };
      }
    } catch (e) {
      console.error("[Hyperliquid] Emergency withdrawal failed:", e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// Factory function
export function createHyperliquidExchange(isTestnet: boolean = false): HyperliquidExchange {
  return new HyperliquidExchange(isTestnet);
}
