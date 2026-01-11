/**
 * Close Position API
 *
 * POST /api/trade/close - Close a position (single or all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getWalletClient, isUsingTradingApi, tradingApi } from '@/lib/trading-client';

interface CloseRequest {
  walletId?: string;
  symbol?: string; // If not provided, closes all positions
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CloseRequest = await request.json();
    const { walletId, symbol } = body;

    // Get wallet and optionally client
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null
    );

    let result: { success: boolean; error?: string };

    if (isUsingTradingApi()) {
      // Remote mode: Use Trading API
      if (symbol) {
        const apiResult = await tradingApi.closePosition(wallet.encryptedKey, symbol);
        result = {
          success: apiResult.success && (apiResult.data?.success ?? false),
          error: apiResult.error || apiResult.data?.error,
        };
      } else {
        const apiResult = await tradingApi.closeAllPositions(wallet.encryptedKey);
        result = {
          success: apiResult.success && (apiResult.data?.success ?? false),
          error: apiResult.error || apiResult.data?.error,
        };
      }
    } else {
      // Local mode: Use Hyperliquid client directly
      if (!client) {
        return NextResponse.json({ error: 'Client not initialized' }, { status: 500 });
      }
      if (symbol) {
        result = await client.closePosition(symbol);
      } else {
        result = await client.closeAllPositions();
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to close position' },
        { status: 400 }
      );
    }

    // Update trades in database
    const updateWhere = symbol
      ? { walletId: wallet.id, symbol, status: 'open' }
      : { walletId: wallet.id, status: 'open' };

    await prisma.trade.updateMany({
      where: updateWhere,
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: symbol ? `Closed ${symbol} position` : 'Closed all positions',
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

    console.error('Error closing position:', error);
    return NextResponse.json(
      { error: 'Failed to close position' },
      { status: 500 }
    );
  }
}
