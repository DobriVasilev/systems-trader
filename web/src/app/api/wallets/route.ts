/**
 * Wallet Management API
 *
 * POST /api/wallets - Add a new wallet (encrypts and stores private key)
 * GET /api/wallets - List user's wallets (without private keys)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  encryptPrivateKey,
  serializeEncryptedData,
  isValidPrivateKey,
} from '@/lib/wallet-encryption';

// Add a new wallet
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { walletAddress, apiPrivateKey, password, nickname } = body;

    // Validate inputs
    if (!walletAddress || !apiPrivateKey || !password || !nickname) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, apiPrivateKey, password, nickname' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format. Must be 0x followed by 40 hex characters.' },
        { status: 400 }
      );
    }

    if (!isValidPrivateKey(apiPrivateKey)) {
      return NextResponse.json(
        { error: 'Invalid API private key format. Must be 64 hex characters (with or without 0x prefix)' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Use the provided wallet address (main Hyperliquid wallet)
    const address = walletAddress;

    // Check if wallet already exists for this user
    const existingWallet = await prisma.userWallet.findUnique({
      where: {
        userId_address: {
          userId: session.user.id,
          address,
        },
      },
    });

    if (existingWallet) {
      return NextResponse.json(
        { error: 'This wallet is already added to your account' },
        { status: 400 }
      );
    }

    // Encrypt the API private key
    const encryptedData = await encryptPrivateKey(apiPrivateKey, password);
    const serializedEncryptedKey = serializeEncryptedData(encryptedData);

    // Check if this is the user's first wallet (make it default)
    const walletCount = await prisma.userWallet.count({
      where: { userId: session.user.id },
    });

    // Store the wallet
    const wallet = await prisma.userWallet.create({
      data: {
        userId: session.user.id,
        nickname,
        address,
        encryptedKey: serializedEncryptedKey,
        salt: encryptedData.salt,
        isDefault: walletCount === 0, // First wallet is default
      },
      select: {
        id: true,
        nickname: true,
        address: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      wallet,
      message: 'Wallet connected successfully. Your API key is encrypted and stored securely.',
    });
  } catch (error) {
    console.error('Error adding wallet:', error);
    return NextResponse.json(
      { error: 'Failed to add wallet' },
      { status: 500 }
    );
  }
}

// List user's wallets
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallets = await prisma.userWallet.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        nickname: true,
        address: true,
        isDefault: true,
        lastUsedAt: true,
        createdAt: true,
        _count: {
          select: {
            bots: true,
            trades: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      wallets,
    });
  } catch (error) {
    console.error('Error listing wallets:', error);
    return NextResponse.json(
      { error: 'Failed to list wallets' },
      { status: 500 }
    );
  }
}
