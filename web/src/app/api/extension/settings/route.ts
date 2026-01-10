/**
 * Extension Bridge - Settings API
 *
 * GET /api/extension/settings
 *
 * Returns current settings for the TradingView extension.
 * Authentication via API key header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // Find user by API key
    const extensionKey = await prisma.extensionKey.findUnique({
      where: { key: apiKey },
      include: {
        user: true,
        wallet: true,
      },
    });

    if (!extensionKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Update last used
    await prisma.extensionKey.update({
      where: { id: extensionKey.id },
      data: { lastUsedAt: new Date() },
    });

    // Get current price for selected asset
    let currentPrice = 0;
    try {
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
      });
      const mids = await response.json();
      currentPrice = parseFloat(mids[extensionKey.asset] || '0');
    } catch (e) {
      // Ignore price fetch errors
    }

    return NextResponse.json({
      risk: extensionKey.riskAmount,
      leverage: extensionKey.leverage,
      asset: extensionKey.asset,
      price: currentPrice,
      walletId: extensionKey.walletId,
      walletNickname: extensionKey.wallet?.nickname || 'Unknown',
    });
  } catch (error) {
    console.error('Extension settings error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Allow updating settings from extension
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const extensionKey = await prisma.extensionKey.findUnique({
      where: { key: apiKey },
    });

    if (!extensionKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { risk, leverage, asset } = body;

    const updates: Record<string, any> = { lastUsedAt: new Date() };
    if (typeof risk === 'number' && risk > 0) updates.riskAmount = risk;
    if (typeof leverage === 'number' && leverage >= 1) updates.leverage = leverage;
    if (typeof asset === 'string' && asset.length > 0) updates.asset = asset.toUpperCase();

    await prisma.extensionKey.update({
      where: { id: extensionKey.id },
      data: updates,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Extension settings update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
