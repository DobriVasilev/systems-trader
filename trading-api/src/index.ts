/**
 * Trading API Server
 *
 * Standalone API for Hyperliquid trading operations.
 * Runs on Bulgarian server to provide EU IP for Hyperliquid access.
 * Called by Vercel-hosted web app for trading operations.
 */

import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { createHyperliquidClient } from "./hyperliquid.js";
import {
  encryptPrivateKeyServerSide,
  decryptPrivateKeyServerSide,
  deserializeEncryptedData,
  serializeEncryptedData,
  isValidPrivateKey,
  getAddressFromPrivateKey,
} from "./wallet-encryption.js";

config();

const app = express();
const PORT = process.env.TRADING_API_PORT || 4000;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "https://dobri.org",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// API Key authentication middleware
const apiKeyAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.TRADING_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

// Apply API key auth to all routes except health
app.use((req, res, next) => {
  if (req.path === "/health") {
    return next();
  }
  return apiKeyAuth(req, res, next);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============= Wallet Routes =============

// Encrypt a private key for storage
app.post("/wallets/encrypt", async (req, res) => {
  try {
    const { privateKey } = req.body;

    if (!privateKey || !isValidPrivateKey(privateKey)) {
      res.status(400).json({ error: "Invalid private key format" });
      return;
    }

    const address = await getAddressFromPrivateKey(privateKey);
    const encrypted = await encryptPrivateKeyServerSide(privateKey);

    res.json({
      address,
      encryptedKey: serializeEncryptedData(encrypted),
    });
  } catch (error) {
    console.error("Encrypt error:", error);
    res.status(500).json({ error: "Encryption failed" });
  }
});

// Get account info for a wallet
app.post("/account", async (req, res) => {
  try {
    const { encryptedKey } = req.body;

    if (!encryptedKey) {
      res.status(400).json({ error: "Missing encryptedKey" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const accountInfo = await client.getAccountInfo();

    res.json(accountInfo);
  } catch (error) {
    console.error("Account error:", error);
    res.status(500).json({ error: "Failed to get account info" });
  }
});

// ============= Position Routes =============

// Get positions for a wallet
app.post("/positions", async (req, res) => {
  try {
    const { encryptedKey } = req.body;

    if (!encryptedKey) {
      res.status(400).json({ error: "Missing encryptedKey" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const positions = await client.getPositions();

    res.json(positions);
  } catch (error) {
    console.error("Positions error:", error);
    res.status(500).json({ error: "Failed to get positions" });
  }
});

// Get open orders
app.post("/orders", async (req, res) => {
  try {
    const { encryptedKey } = req.body;

    if (!encryptedKey) {
      res.status(400).json({ error: "Missing encryptedKey" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const orders = await client.getOpenOrders();

    res.json(orders);
  } catch (error) {
    console.error("Orders error:", error);
    res.status(500).json({ error: "Failed to get orders" });
  }
});

// ============= Trade Routes =============

// Place an order
app.post("/trade", async (req, res) => {
  try {
    const { encryptedKey, asset, isBuy, price, size, reduceOnly, postOnly } =
      req.body;

    if (!encryptedKey || !asset || isBuy === undefined || !price || !size) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.placeOrder({
      asset,
      isBuy,
      price,
      size,
      reduceOnly,
      postOnly,
    });

    res.json(result);
  } catch (error) {
    console.error("Trade error:", error);
    res.status(500).json({ error: "Trade execution failed" });
  }
});

// Place a market order
app.post("/trade/market", async (req, res) => {
  try {
    const { encryptedKey, asset, isBuy, size } = req.body;

    if (!encryptedKey || !asset || isBuy === undefined || !size) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.placeMarketOrder(asset, isBuy, size);

    res.json(result);
  } catch (error) {
    console.error("Market trade error:", error);
    res.status(500).json({ error: "Market trade execution failed" });
  }
});

// Close a position
app.post("/trade/close", async (req, res) => {
  try {
    const { encryptedKey, asset } = req.body;

    if (!encryptedKey || !asset) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.closePosition(asset);

    res.json(result);
  } catch (error) {
    console.error("Close position error:", error);
    res.status(500).json({ error: "Failed to close position" });
  }
});

// Close all positions
app.post("/trade/close-all", async (req, res) => {
  try {
    const { encryptedKey } = req.body;

    if (!encryptedKey) {
      res.status(400).json({ error: "Missing encryptedKey" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.closeAllPositions();

    res.json(result);
  } catch (error) {
    console.error("Close all error:", error);
    res.status(500).json({ error: "Failed to close all positions" });
  }
});

// Cancel an order
app.post("/trade/cancel", async (req, res) => {
  try {
    const { encryptedKey, asset, orderId } = req.body;

    if (!encryptedKey || !asset || !orderId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const success = await client.cancelOrder(asset, orderId);

    res.json({ success });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// Cancel all orders
app.post("/trade/cancel-all", async (req, res) => {
  try {
    const { encryptedKey } = req.body;

    if (!encryptedKey) {
      res.status(400).json({ error: "Missing encryptedKey" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.cancelAllOrders();

    res.json(result);
  } catch (error) {
    console.error("Cancel all error:", error);
    res.status(500).json({ error: "Failed to cancel all orders" });
  }
});

// Set leverage
app.post("/leverage", async (req, res) => {
  try {
    const { encryptedKey, asset, leverage } = req.body;

    if (!encryptedKey || !asset || !leverage) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const success = await client.setLeverage(asset, leverage);

    res.json({ success });
  } catch (error) {
    console.error("Leverage error:", error);
    res.status(500).json({ error: "Failed to set leverage" });
  }
});

// Place stop loss
app.post("/trade/stop-loss", async (req, res) => {
  try {
    const { encryptedKey, asset, isLong, size, triggerPrice } = req.body;

    if (
      !encryptedKey ||
      !asset ||
      isLong === undefined ||
      !size ||
      !triggerPrice
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.placeStopLoss(asset, isLong, size, triggerPrice);

    res.json(result);
  } catch (error) {
    console.error("Stop loss error:", error);
    res.status(500).json({ error: "Failed to place stop loss" });
  }
});

// Place take profit
app.post("/trade/take-profit", async (req, res) => {
  try {
    const { encryptedKey, asset, isLong, size, triggerPrice } = req.body;

    if (
      !encryptedKey ||
      !asset ||
      isLong === undefined ||
      !size ||
      !triggerPrice
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.placeTakeProfit(
      asset,
      isLong,
      size,
      triggerPrice
    );

    res.json(result);
  } catch (error) {
    console.error("Take profit error:", error);
    res.status(500).json({ error: "Failed to place take profit" });
  }
});

// Withdraw funds
app.post("/withdraw", async (req, res) => {
  try {
    const { encryptedKey, destination, amount } = req.body;

    if (!encryptedKey || !destination) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.withdrawFunds(destination, amount);

    res.json(result);
  } catch (error) {
    console.error("Withdraw error:", error);
    res.status(500).json({ error: "Withdrawal failed" });
  }
});

// Emergency withdraw (close all + withdraw)
app.post("/emergency-withdraw", async (req, res) => {
  try {
    const { encryptedKey, destination, amount } = req.body;

    if (!encryptedKey || !destination) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const privateKey = await decryptPrivateKeyServerSide(
      deserializeEncryptedData(encryptedKey)
    );
    const client = createHyperliquidClient(privateKey);
    const result = await client.emergencyWithdraw(destination, amount);

    res.json(result);
  } catch (error) {
    console.error("Emergency withdraw error:", error);
    res.status(500).json({ error: "Emergency withdrawal failed" });
  }
});

// ============= Price Routes =============

// Get market prices
app.get("/prices", async (_req, res) => {
  try {
    // Use a temporary client just for prices (no signing needed)
    const { HyperliquidClient } = await import("./hyperliquid.js");
    // Create with dummy key - prices don't need signing
    const client = new HyperliquidClient(
      "0x0000000000000000000000000000000000000000000000000000000000000001"
    );
    const prices = await client.getMarketPrices();

    res.json(prices);
  } catch (error) {
    console.error("Prices error:", error);
    res.status(500).json({ error: "Failed to get prices" });
  }
});

// Get coin metadata
app.get("/coins", async (_req, res) => {
  try {
    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });
    const meta = await response.json();

    res.json(meta);
  } catch (error) {
    console.error("Coins error:", error);
    res.status(500).json({ error: "Failed to get coin metadata" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Trading API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
