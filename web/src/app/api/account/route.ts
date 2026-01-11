/**
 * Account API
 *
 * POST /api/account - Get account info (balance, equity, margin)
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

    let accountInfo;

    if (isUsingTradingApi()) {
      // Remote mode: Call trading API
      const result = await tradingApi.getAccountInfo(wallet.encryptedKey);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Trading API error' },
          { status: 500 }
        );
      }
      accountInfo = result.data;
    } else {
      // Local mode: Use Hyperliquid client directly
      if (!client) {
        return NextResponse.json({ error: 'Client not initialized' }, { status: 500 });
      }
      accountInfo = await client.getAccountInfo();
    }

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        nickname: wallet.nickname,
      },
      account: accountInfo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error('Error getting account:', error);
    return NextResponse.json(
      { error: 'Failed to get account info' },
      { status: 500 }
    );
  }
}
