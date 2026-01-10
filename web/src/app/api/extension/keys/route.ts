/**
 * Extension Keys Management API
 *
 * GET /api/extension/keys - List user's extension keys
 * POST /api/extension/keys - Create new extension key
 * DELETE /api/extension/keys - Delete extension key
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Generate a secure API key
function generateApiKey(): string {
  return `tv_${crypto.randomBytes(32).toString('hex')}`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await prisma.extensionKey.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        asset: true,
        riskAmount: true,
        leverage: true,
        lastUsedAt: true,
        usageCount: true,
        active: true,
        createdAt: true,
        wallet: {
          select: {
            id: true,
            nickname: true,
            address: true,
          },
        },
        // Don't return the actual key - only show first/last 4 chars
        key: true,
      },
    });

    // Mask the keys for security
    const maskedKeys = keys.map(k => ({
      ...k,
      key: `${k.key.slice(0, 6)}...${k.key.slice(-4)}`,
    }));

    return NextResponse.json({ keys: maskedKeys });
  } catch (error) {
    console.error('Error listing extension keys:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, walletId, walletPassword, asset, riskAmount, leverage } = body;

    if (!name || !walletId) {
      return NextResponse.json({ error: 'Name and wallet are required' }, { status: 400 });
    }

    // Verify wallet belongs to user
    const wallet = await prisma.userWallet.findFirst({
      where: { id: walletId, userId: session.user.id },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Generate new API key
    const apiKey = generateApiKey();

    // Create extension key
    const extensionKey = await prisma.extensionKey.create({
      data: {
        userId: session.user.id,
        walletId,
        key: apiKey,
        name,
        asset: asset || 'BTC',
        riskAmount: riskAmount || 1.0,
        leverage: leverage || 25,
        walletPassword: walletPassword || null,
      },
    });

    // Return the full key only on creation (user needs to save it)
    return NextResponse.json({
      success: true,
      key: {
        id: extensionKey.id,
        name: extensionKey.name,
        apiKey, // Full key shown only once
        asset: extensionKey.asset,
        riskAmount: extensionKey.riskAmount,
        leverage: extensionKey.leverage,
        walletNickname: wallet.nickname,
      },
    });
  } catch (error) {
    console.error('Error creating extension key:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
    }

    // Verify key belongs to user
    const key = await prisma.extensionKey.findFirst({
      where: { id: keyId, userId: session.user.id },
    });

    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    await prisma.extensionKey.delete({
      where: { id: keyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting extension key:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
