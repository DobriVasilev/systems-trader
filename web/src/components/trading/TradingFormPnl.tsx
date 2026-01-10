"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTradeStore } from "@/stores/tradeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  calculatePositionSize,
  validateTrade,
  verifyAndAdjustPnl,
  type PositionSizingResult,
  type PositionWarnings
} from "@/lib/position-sizing";

interface TradingFormPnlProps {
  walletId: string | null;
  password: string;
  availableBalance: number;
  onTradeComplete: () => void;
}

interface Price {
  symbol: string;
  price: number;
}

const POPULAR_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "WIF", "PEPE"];

export function TradingFormPnl({
  walletId,
  password,
  availableBalance,
  onTradeComplete
}: TradingFormPnlProps) {
  // Store state
  const {
    selectedAsset,
    riskAmount,
    entryPrice,
    stopLoss,
    takeProfit,
    leverage,
    orderType,
    direction,
    autoUpdateEntry,
    isExecuting,
    executionStatus,
    showConfirmModal,
    setSelectedAsset,
    setRiskAmount,
    setEntryPrice,
    setStopLoss,
    setTakeProfit,
    setLeverage,
    setOrderType,
    setDirection,
    setAutoUpdateEntry,
    setIsExecuting,
    setExecutionStatus,
    setShowConfirmModal,
    setCalculations,
    setWarnings,
    clearCalculations,
    resetForm,
  } = useTradeStore();

  const {
    feeBuffer,
    liqWarningDistance,
    liqDangerDistance,
    pnlTolerance,
    autoAdjustLeverage,
  } = useSettingsStore();

  // Local state
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Calculated values
  const [calculations, setLocalCalculations] = useState<PositionSizingResult | null>(null);
  const [warnings, setLocalWarnings] = useState<PositionWarnings | null>(null);

  // Fetch prices
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        if (data.success) {
          setPrices(data.prices);
        }
      } catch (err) {
        console.error("Failed to fetch prices");
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentPrice = prices[selectedAsset] || 0;

  // Auto-update entry price when price changes
  useEffect(() => {
    if (autoUpdateEntry && currentPrice > 0) {
      setEntryPrice(currentPrice.toFixed(2));
    }
  }, [currentPrice, autoUpdateEntry, setEntryPrice]);

  // Calculate position when inputs change
  useEffect(() => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const risk = parseFloat(riskAmount);
    const lev = parseFloat(leverage);
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;

    // Need entry, SL, and risk to calculate
    if (isNaN(entry) || isNaN(sl) || isNaN(risk) || entry <= 0 || sl <= 0 || risk <= 0) {
      setLocalCalculations(null);
      setLocalWarnings(null);
      setDirection(null);
      return;
    }

    const input = {
      entryPrice: entry,
      stopLoss: sl,
      riskAmount: risk,
      leverage: lev,
      takeProfit: tp,
      feeBuffer,
    };

    const result = calculatePositionSize(input);
    setLocalCalculations(result);
    setDirection(result.direction);

    // Validate and get warnings
    const validationWarnings = validateTrade(input, result, {
      availableBalance,
      autoAdjustLeverage,
      liqWarningDistance,
      liqDangerDistance,
    });
    setLocalWarnings(validationWarnings);

  }, [entryPrice, stopLoss, riskAmount, leverage, takeProfit, feeBuffer, availableBalance, autoAdjustLeverage, liqWarningDistance, liqDangerDistance, setDirection]);

  // Handle trade confirmation
  const handleConfirmTrade = useCallback(async () => {
    if (!walletId || !calculations || !direction) {
      setError("Missing required fields");
      return;
    }

    if (warnings?.priceOrderError) {
      setError(warnings.priceOrderError);
      return;
    }

    setShowConfirmModal(false);
    setIsExecuting(true);
    setExecutionStatus("Placing order...");
    setError("");
    setSuccess("");

    try {
      // Verify and adjust PNL
      const { adjustedQty, verified } = verifyAndAdjustPnl(
        calculations.qty,
        parseFloat(entryPrice),
        parseFloat(stopLoss),
        parseFloat(riskAmount),
        pnlTolerance
      );

      const finalQty = verified ? adjustedQty : calculations.qty;

      // Execute trade
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId,
          password,
          symbol: selectedAsset,
          side: direction,
          size: finalQty,
          leverage: parseFloat(leverage),
          orderType,
          limitPrice: orderType === "limit" ? parseFloat(entryPrice) : undefined,
          stopLoss: parseFloat(stopLoss),
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Trade failed");
        return;
      }

      setSuccess(`${direction.toUpperCase()} ${finalQty.toFixed(4)} ${selectedAsset} @ $${entryPrice}`);

      // Reset form but keep asset and risk settings
      setStopLoss("");
      setTakeProfit("");

      onTradeComplete();
    } catch (err) {
      setError("Network error");
    } finally {
      setIsExecuting(false);
      setExecutionStatus("");
    }
  }, [walletId, password, calculations, direction, warnings, entryPrice, stopLoss, takeProfit, riskAmount, selectedAsset, leverage, orderType, pnlTolerance, onTradeComplete, setShowConfirmModal, setIsExecuting, setExecutionStatus, setStopLoss, setTakeProfit]);

  const handlePrepareTrade = () => {
    if (!calculations || !direction) {
      setError("Enter entry price and stop loss");
      return;
    }
    if (warnings?.priceOrderError) {
      setError(warnings.priceOrderError);
      return;
    }
    setShowConfirmModal(true);
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-200">Place Trade</h3>
        <span className="text-xs text-gray-500">PNL-Based Sizing</span>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2 bg-green-900/30 border border-green-800 rounded text-green-400 text-sm">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {/* Symbol Selection */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Symbol</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {POPULAR_SYMBOLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedAsset(s)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedAsset === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              placeholder="Custom symbol"
            />
            {currentPrice > 0 && (
              <span className="text-sm text-yellow-500 font-mono">
                ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* Risk Amount (THE KEY INPUT) */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Risk Amount (Max Loss) <span className="text-yellow-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={riskAmount}
              onChange={(e) => setRiskAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              placeholder="1.00"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">This is the maximum you can lose on this trade</p>
        </div>

        {/* Entry Price */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">Entry Price</label>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={autoUpdateEntry}
                onChange={(e) => setAutoUpdateEntry(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800"
              />
              Auto-update
            </label>
          </div>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            placeholder={currentPrice.toString() || "Enter price"}
            step="0.01"
          />
        </div>

        {/* Stop Loss (REQUIRED) */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Stop Loss <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            placeholder="Required"
            step="0.01"
          />
          {calculations?.slDistance && (
            <p className="text-xs text-gray-500 mt-1">
              Distance: ${calculations.slDistance.toFixed(2)}
            </p>
          )}
        </div>

        {/* Take Profit */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Take Profit</label>
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            placeholder="Optional"
            step="0.01"
          />
          {calculations?.tpDistance && (
            <p className="text-xs text-gray-500 mt-1">
              Distance: ${calculations.tpDistance.toFixed(2)}
            </p>
          )}
        </div>

        {/* Leverage and Order Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Leverage</label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              {[1, 2, 3, 5, 10, 15, 20, 25, 30, 50].map((l) => (
                <option key={l} value={l}>
                  {l}x
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as "market" | "limit")}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              <option value="limit">Limit</option>
              <option value="market">Market</option>
            </select>
          </div>
        </div>

        {/* Calculated Values Preview */}
        {calculations && (
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Direction</span>
              <span className={`text-sm font-medium ${
                calculations.direction === "long" ? "text-green-500" : "text-red-500"
              }`}>
                {calculations.direction.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Position Size</span>
              <span className="text-sm font-mono text-white">
                {calculations.qty.toFixed(4)} {selectedAsset}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Position Value</span>
              <span className="text-sm font-mono text-white">
                ${calculations.positionValue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Margin Required</span>
              <span className="text-sm font-mono text-white">
                ${calculations.margin.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Liquidation</span>
              <span className="text-sm font-mono text-orange-400">
                ${calculations.liquidationPrice.toFixed(2)}
              </span>
            </div>
            {calculations.estimatedPnl !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Est. PNL @ TP</span>
                <span className="text-sm font-mono text-green-400">
                  +${calculations.estimatedPnl.toFixed(2)}
                </span>
              </div>
            )}
            {calculations.riskRewardRatio !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">R:R Ratio</span>
                <span className="text-sm font-mono text-blue-400">
                  1:{calculations.riskRewardRatio.toFixed(1)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Fees (est.)</span>
              <span className="text-sm font-mono text-gray-400">
                ${calculations.totalFees.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings && (
          <div className="space-y-2">
            {warnings.priceOrderError && (
              <div className="p-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs">
                {warnings.priceOrderError}
              </div>
            )}
            {warnings.liqWarning && (
              <div className={`p-2 rounded text-xs ${
                warnings.liqWarning.level === "danger"
                  ? "bg-red-900/30 border border-red-800 text-red-400"
                  : "bg-yellow-900/30 border border-yellow-800 text-yellow-400"
              }`}>
                {warnings.liqWarning.message}
              </div>
            )}
            {warnings.minOrderWarning && (
              <div className="p-2 bg-yellow-900/30 border border-yellow-800 rounded text-yellow-400 text-xs">
                {warnings.minOrderWarning}
              </div>
            )}
            {warnings.balanceWarning && (
              <div className="p-2 bg-yellow-900/30 border border-yellow-800 rounded text-yellow-400 text-xs">
                {warnings.balanceWarning.message}
                {warnings.balanceWarning.suggestedLeverage && (
                  <button
                    type="button"
                    onClick={() => setLeverage(warnings.balanceWarning!.suggestedLeverage!.toString())}
                    className="ml-2 underline hover:no-underline"
                  >
                    Use {warnings.balanceWarning.suggestedLeverage}x
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handlePrepareTrade}
          disabled={isExecuting || !walletId || !calculations || !!warnings?.priceOrderError}
          className={`w-full py-3 rounded font-medium transition-colors ${
            calculations?.direction === "long"
              ? "bg-green-600 hover:bg-green-700"
              : calculations?.direction === "short"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-700"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isExecuting
            ? executionStatus || "Processing..."
            : calculations
            ? `${calculations.direction === "long" ? "Long" : "Short"} ${selectedAsset}`
            : "Enter Entry & Stop Loss"}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && calculations && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Trade</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Direction</span>
                <span className={calculations.direction === "long" ? "text-green-500" : "text-red-500"}>
                  {calculations.direction.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Symbol</span>
                <span>{selectedAsset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Entry</span>
                <span>${entryPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Stop Loss</span>
                <span className="text-red-400">${stopLoss}</span>
              </div>
              {takeProfit && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Take Profit</span>
                  <span className="text-green-400">${takeProfit}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Size</span>
                <span>{calculations.qty.toFixed(4)} {selectedAsset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Risk</span>
                <span className="text-yellow-500">${riskAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Leverage</span>
                <span>{leverage}x</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTrade}
                disabled={isExecuting}
                className={`flex-1 py-2 rounded font-medium ${
                  calculations.direction === "long"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                } disabled:opacity-50`}
              >
                {isExecuting ? "Executing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
