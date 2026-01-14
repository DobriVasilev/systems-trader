/**
 * Trading Client Helper
 *
 * Handles wallet decryption and Hyperliquid client creation.
 * Supports both local mode (direct Hyperliquid) and remote mode (via Trading API).
 */

import { prisma } from '@/lib/db';
import { deserializeEncryptedData, decryptPrivateKeyServerSide } from '@/lib/wallet-encryption';
import { HyperliquidClient } from '@/lib/hyperliquid';
import * as tradingApi from '@/lib/trading-api-client';

// Check if we should use remote trading API (when deployed on Vercel)
const USE_TRADING_API = Boolean(process.env.TRADING_API_URL && process.env.TRADING_API_KEY);

// Debug logging (always log)
console.log('[Trading Client] TRADING_API_URL:', process.env.TRADING_API_URL || 'NOT SET');
console.log('[Trading Client] TRADING_API_KEY:', process.env.TRADING_API_KEY ? 'SET' : 'NOT SET');
console.log('[Trading Client] USE_TRADING_API:', USE_TRADING_API);

interface WalletWithClient {
  wallet: {
    id: string;
    address: string;
    nickname: string;
    encryptedKey: string;
  };
  client: HyperliquidClient | null;
}

/**
 * Get a wallet and optionally an initialized Hyperliquid client
 * Uses server-side encryption - no user password needed
 *
 * @param userId - The user's ID
 * @param walletId - The wallet ID (or null for default wallet)
 * @returns The wallet and initialized client (null if using remote API)
 */
export async function getWalletClient(
  userId: string,
  walletId: string | null
): Promise<WalletWithClient> {
  // Get wallet (specific or default)
  const wallet = await prisma.userWallet.findFirst({
    where: walletId
      ? { id: walletId, userId }
      : { userId, isDefault: true },
    select: {
      id: true,
      address: true,
      nickname: true,
      encryptedKey: true,
    },
  });

  if (!wallet) {
    throw new Error(walletId ? 'Wallet not found' : 'No default wallet found');
  }

  // Update last used timestamp
  await prisma.userWallet.update({
    where: { id: wallet.id },
    data: { lastUsedAt: new Date() },
  });

  // If using remote trading API, don't create local client
  if (USE_TRADING_API) {
    return {
      wallet: {
        id: wallet.id,
        address: wallet.address,
        nickname: wallet.nickname,
        encryptedKey: wallet.encryptedKey,
      },
      client: null,
    };
  }

  // Local mode: Decrypt private key and create client
  const encryptedData = deserializeEncryptedData(wallet.encryptedKey);
  const privateKey = await decryptPrivateKeyServerSide(encryptedData);
  const client = new HyperliquidClient(privateKey);
  await client.initialize();

  return {
    wallet: {
      id: wallet.id,
      address: wallet.address,
      nickname: wallet.nickname,
      encryptedKey: wallet.encryptedKey,
    },
    client,
  };
}

/**
 * Check if using remote trading API mode
 */
export function isUsingTradingApi(): boolean {
  return USE_TRADING_API;
}

/**
 * Get the trading API client for remote operations
 */
export { tradingApi };

/**
 * Record a trade in the database
 */
export async function recordTrade(params: {
  userId: string;
  walletId: string;
  botId?: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  status: string;
  entryOrderId?: string;
  slOrderId?: string;
  tpOrderId?: string;
}) {
  return prisma.trade.create({
    data: {
      userId: params.userId,
      walletId: params.walletId,
      botId: params.botId,
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      leverage: params.leverage,
      entryPrice: params.entryPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      status: params.status,
      entryOrderId: params.entryOrderId,
      slOrderId: params.slOrderId,
      tpOrderId: params.tpOrderId,
    },
  });
}
