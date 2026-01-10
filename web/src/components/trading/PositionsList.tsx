"use client";

import { useState } from "react";

interface Position {
  symbol: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  liquidationPrice: number | null;
  leverage: number;
  marginUsed: number;
}

interface OpenOrder {
  symbol: string;
  side: string;
  size: number;
  price: number;
  orderId: number;
  orderType: string;
}

interface PositionsListProps {
  walletId: string | null;
  positions: Position[];
  openOrders: OpenOrder[];
  onRefresh: () => void;
  onClose: (symbol: string) => void;
  onCancelOrder: (symbol: string, orderId: number) => void;
  activeTab: "positions" | "orders" | "history";
}

export function PositionsList({
  walletId,
  positions,
  openOrders,
  onRefresh,
  onClose,
  onCancelOrder,
  activeTab = "positions",
}: PositionsListProps) {
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<number | null>(null);

  const handleClose = async (symbol: string) => {
    setClosingSymbol(symbol);
    await onClose(symbol);
    setClosingSymbol(null);
  };

  const handleCancel = async (symbol: string, orderId: number) => {
    setCancellingOrder(orderId);
    await onCancelOrder(symbol, orderId);
    setCancellingOrder(null);
  };

  // Calculate totals
  const totalPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalMargin = positions.reduce((sum, p) => sum + p.marginUsed, 0);

  return (
    <div className="space-y-4">
      {/* Positions */}
      {activeTab === "positions" && (
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-200">Positions</h3>
            <span className="text-sm text-gray-500">({positions.length})</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`text-sm font-mono ${
                totalPnl >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </span>
            <button
              onClick={onRefresh}
              className="text-gray-400 hover:text-gray-200"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {positions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No open positions
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {positions.map((position) => {
              const isLong = position.size > 0;
              const pnlPercent =
                ((position.markPrice - position.entryPrice) /
                  position.entryPrice) *
                100 *
                (isLong ? 1 : -1);

              return (
                <div key={position.symbol} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{position.symbol}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isLong
                            ? "bg-green-900/30 text-green-400"
                            : "bg-red-900/30 text-red-400"
                        }`}
                      >
                        {isLong ? "LONG" : "SHORT"} {position.leverage}x
                      </span>
                    </div>
                    <button
                      onClick={() => handleClose(position.symbol)}
                      disabled={closingSymbol === position.symbol}
                      className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50"
                    >
                      {closingSymbol === position.symbol ? "Closing..." : "Close"}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Size</div>
                      <div className="font-mono">
                        ${Math.abs(position.size).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Entry</div>
                      <div className="font-mono">
                        ${position.entryPrice.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Mark</div>
                      <div className="font-mono">
                        ${position.markPrice.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">PnL</div>
                      <div
                        className={`font-mono ${
                          position.unrealizedPnl >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {position.unrealizedPnl >= 0 ? "+" : ""}$
                        {position.unrealizedPnl.toFixed(2)}
                        <span className="text-xs ml-1">
                          ({pnlPercent >= 0 ? "+" : ""}
                          {pnlPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {position.liquidationPrice && (
                    <div className="mt-2 text-xs text-gray-500">
                      Liq: ${position.liquidationPrice.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Open Orders */}
      {activeTab === "orders" && (
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-200">Open Orders</h3>
            <span className="text-sm text-gray-500">({openOrders.length})</span>
          </div>
        </div>

        {openOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No open orders</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {openOrders.map((order) => (
              <div
                key={order.orderId}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{order.symbol}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      order.side === "B"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-red-900/30 text-red-400"
                    }`}
                  >
                    {order.side === "B" ? "BUY" : "SELL"}
                  </span>
                  <span className="text-sm text-gray-400">
                    {order.size} @ ${order.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500">{order.orderType}</span>
                </div>
                <button
                  onClick={() => handleCancel(order.symbol, order.orderId)}
                  disabled={cancellingOrder === order.orderId}
                  className="text-xs px-3 py-1 bg-gray-800 hover:bg-red-900/30 hover:text-red-400 rounded disabled:opacity-50"
                >
                  {cancellingOrder === order.orderId ? "..." : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
