/**
 * Positions API
 *
 * POST /api/positions - Get open positions for a wallet
 * Supports both local (direct Hyperliquid) and remote (Trading API) modes
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWalletClient, isUsingTradingApi, tradingApi } from '@/lib/trading-client';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { walletId } = body;

    // Get wallet and optionally client
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null
    );

    let positions, openOrders;

    if (isUsingTradingApi()) {
      // Remote mode: Call trading API
      const [positionsResult, ordersResult] = await Promise.all([
        tradingApi.getPositions(wallet.encryptedKey),
        tradingApi.getOpenOrders(wallet.encryptedKey),
      ]);

      if (!positionsResult.success || !ordersResult.success) {
        return NextResponse.json(
          { error: positionsResult.error || ordersResult.error || 'Trading API error' },
          { status: 500 }
        );
      }

      positions = positionsResult.data;
      openOrders = ordersResult.data;
    } else {
      // Local mode: Use Hyperliquid client directly
      if (!client) {
        return NextResponse.json({ error: 'Client not initialized' }, { status: 500 });
      }
      [positions, openOrders] = await Promise.all([
        client.getPositions(),
        client.getOpenOrders(),
      ]);
    }

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        nickname: wallet.nickname,
      },
      positions,
      openOrders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error('Error getting positions:', error);
    return NextResponse.json(
      { error: 'Failed to get positions' },
      { status: 500 }
    );
  }
}
