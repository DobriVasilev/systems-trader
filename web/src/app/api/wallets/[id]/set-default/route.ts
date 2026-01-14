/**
 * Set Default Wallet API
 *
 * POST /api/wallets/[id]/set-default - Set a wallet as the default
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: walletId } = await context.params;

    // Verify wallet exists and belongs to user
    const wallet = await prisma.userWallet.findUnique({
      where: {
        id: walletId,
        userId: session.user.id,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Update in transaction: unset all defaults, then set this one
    await prisma.$transaction([
      // Unset all defaults for this user
      prisma.userWallet.updateMany({
        where: {
          userId: session.user.id,
        },
        data: {
          isDefault: false,
        },
      }),
      // Set this wallet as default
      prisma.userWallet.update({
        where: {
          id: walletId,
        },
        data: {
          isDefault: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Default wallet updated',
    });
  } catch (error) {
    console.error('Error setting default wallet:', error);
    return NextResponse.json(
      { error: 'Failed to set default wallet' },
      { status: 500 }
    );
  }
}
