/**
 * Cancel Order API
 *
 * POST /api/trade/cancel - Cancel an open order
 * Supports both local (direct Hyperliquid) and remote (Trading API) modes
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWalletClient, isUsingTradingApi, tradingApi } from '@/lib/trading-client';

interface CancelRequest {
  walletId?: string;
  symbol: string;
  orderId: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CancelRequest = await request.json();
    const { walletId, symbol, orderId } = body;

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }
    if (orderId === undefined) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Get wallet and optionally client
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null
    );

    let success: boolean;

    if (isUsingTradingApi()) {
      // Remote mode: Use Trading API
      const result = await tradingApi.cancelOrder(wallet.encryptedKey, symbol, orderId);
      success = result.success && (result.data?.success ?? false);
    } else {
      // Local mode: Use Hyperliquid client directly
      if (!client) {
        return NextResponse.json({ error: 'Client not initialized' }, { status: 500 });
      }
      success = await client.cancelOrder(symbol, orderId);
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to cancel order' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} cancelled`,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        nickname: wallet.nickname,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
