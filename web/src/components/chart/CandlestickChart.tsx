"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  SeriesMarker,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";

export interface ChartCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartMarker {
  id: string;
  time: number;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text?: string;
  size?: number;
}

interface CandlestickChartProps {
  candles: ChartCandle[];
  markers?: ChartMarker[];
  hiddenMarkerIds?: string[]; // Markers to hide (e.g., during move operation)
  onCandleClick?: (candle: ChartCandle, index: number) => void;
  onMarkerClick?: (marker: ChartMarker) => void;
  onChartClick?: (time: number, price: number) => void;
  onMarkerDragStart?: (marker: ChartMarker) => void; // Called when drag starts
  onMarkerDrag?: (marker: ChartMarker, newTime: number, newPrice: number) => void;
  onMarkerDragEnd?: () => void; // Called when drag ends (successful or cancelled)
  onMarkerContextMenu?: (marker: ChartMarker, x: number, y: number) => void;
  sessionId?: string; // For saving/restoring chart position
  height?: number;
  className?: string;
}

export function CandlestickChart({
  candles,
  markers = [],
  hiddenMarkerIds = [],
  onCandleClick,
  onMarkerClick,
  onChartClick,
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  onMarkerContextMenu,
  sessionId,
  height = 500,
  className = "",
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Modifier key state (Cmd/Ctrl for magnet mode)
  const isModifierHeldRef = useRef(false);
  const [isModifierHeld, setIsModifierHeld] = useState(false);

  // Snap indicator state (includes x position for line starting point)
  const [snapIndicator, setSnapIndicator] = useState<{
    price: number;
    y: number;
    x: number; // X position of the candle
    level: string;
    color: string;
  } | null>(null);

  // Drag state
  const [draggingMarker, setDraggingMarker] = useState<ChartMarker | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Save chart position to localStorage
  const saveChartPosition = useCallback(() => {
    if (!chartRef.current || !sessionId) return;

    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (visibleRange) {
      const key = `chart-position-${sessionId}`;
      localStorage.setItem(key, JSON.stringify({
        from: visibleRange.from,
        to: visibleRange.to,
      }));
    }
  }, [sessionId]);

  // Restore chart position from localStorage
  const restoreChartPosition = useCallback(() => {
    if (!chartRef.current || !sessionId) return false;

    const key = `chart-position-${sessionId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const { from, to } = JSON.parse(saved);
        chartRef.current.timeScale().setVisibleRange({
          from: from as Time,
          to: to as Time,
        });
        return true;
      } catch (e) {
        console.error("Failed to restore chart position:", e);
      }
    }
    return false;
  }, [sessionId]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0f" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1a1a2e" },
        horzLines: { color: "#1a1a2e" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#4a4a6a",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2a2a4a",
        },
        horzLine: {
          color: "#4a4a6a",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2a2a4a",
        },
      },
      rightPriceScale: {
        borderColor: "#2a2a4a",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        autoScale: true,
      },
      timeScale: {
        borderColor: "#2a2a4a",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    // Save position before unload
    const handleBeforeUnload = () => {
      saveChartPosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("beforeunload", handleBeforeUnload);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      saveChartPosition(); // Save on unmount too
      chart.remove();
    };
  }, [saveChartPosition]);

  // Update candle data - only fitContent on FIRST load
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const chartData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(chartData);

    // Only fit content on initial load, and try to restore saved position
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      // Try to restore saved position, otherwise fit content
      const restored = restoreChartPosition();
      if (!restored) {
        chartRef.current?.timeScale().fitContent();
      }
    }
  }, [candles, restoreChartPosition]);

  // Update markers (without resetting view), filtering out hidden ones
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Filter out hidden markers (e.g., markers being moved)
    const visibleMarkers = markers.filter(m => !hiddenMarkerIds.includes(m.id));

    const seriesMarkers: SeriesMarker<Time>[] = visibleMarkers.map((m) => ({
      time: m.time as Time,
      position: m.position,
      color: m.color,
      shape: m.shape,
      text: m.text,
      size: m.size || 1,
    }));

    seriesMarkers.sort((a, b) => (a.time as number) - (b.time as number));
    candleSeriesRef.current.setMarkers(seriesMarkers);
  }, [markers, hiddenMarkerIds]);

  // Track modifier key (Cmd/Ctrl) for snap mode - use global listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        isModifierHeldRef.current = true;
        setIsModifierHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Check if modifier is released
      if (e.key === "Meta" || e.key === "Control") {
        isModifierHeldRef.current = false;
        setIsModifierHeld(false);
        setSnapIndicator(null);
      }
    };

    // Also handle blur (when user switches windows)
    const handleBlur = () => {
      isModifierHeldRef.current = false;
      setIsModifierHeld(false);
      setSnapIndicator(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Handle crosshair move for snap indicator - always subscribed
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const chart = chartRef.current;
    const series = candleSeriesRef.current;

    const handleCrosshairMove = (param: { time?: Time; point?: { x: number; y: number } }) => {
      // Check ref for immediate update
      if (!isModifierHeldRef.current || !param.time || !param.point) {
        setSnapIndicator(null);
        return;
      }

      const candle = candles.find((c) => c.time === param.time);
      if (!candle) {
        setSnapIndicator(null);
        return;
      }

      const y = param.point.y;
      const hoveredPrice = series.coordinateToPrice(y);
      if (hoveredPrice === null || hoveredPrice === undefined) {
        setSnapIndicator(null);
        return;
      }

      // Get X coordinate of the candle
      const candleX = chart.timeScale().timeToCoordinate(param.time);
      if (candleX === null) {
        setSnapIndicator(null);
        return;
      }

      const priceLevels = [
        { price: candle.high, name: "HIGH", color: "#26a69a" },
        { price: candle.low, name: "LOW", color: "#ef5350" },
        { price: candle.open, name: "OPEN", color: "#9e9e9e" },
        { price: candle.close, name: "CLOSE", color: "#ffffff" },
      ];

      const closest = priceLevels.reduce((best, level) =>
        Math.abs(level.price - (hoveredPrice as number)) < Math.abs(best.price - (hoveredPrice as number)) ? level : best
      );

      const snapY = series.priceToCoordinate(closest.price);
      if (snapY !== null && snapY !== undefined) {
        setSnapIndicator({
          price: closest.price,
          y: snapY,
          x: candleX,
          level: closest.name,
          color: closest.color,
        });
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [candles]); // Only depend on candles, not isModifierHeld

  // Find marker at position
  const findMarkerAtPosition = useCallback((x: number, y: number): ChartMarker | null => {
    if (!chartRef.current || !candleSeriesRef.current) return null;

    const timeScale = chartRef.current.timeScale();

    for (const marker of markers) {
      const markerX = timeScale.timeToCoordinate(marker.time as Time);
      if (markerX === null) continue;

      if (Math.abs(markerX - x) > 25) continue;

      const markerCandle = candles.find(c => c.time === marker.time);
      if (!markerCandle) continue;

      let markerPrice: number;
      if (marker.position === "aboveBar") {
        markerPrice = markerCandle.high;
      } else if (marker.position === "belowBar") {
        markerPrice = markerCandle.low;
      } else {
        markerPrice = (markerCandle.high + markerCandle.low) / 2;
      }

      const markerY = candleSeriesRef.current.priceToCoordinate(markerPrice);
      if (markerY === null || markerY === undefined) continue;

      // Larger hitbox for markers (40px vertical area)
      if (Math.abs(markerY - y) < 40) {
        return marker;
      }
    }

    return null;
  }, [candles, markers]);

  // Handle mouse down - for drag initiation
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onMarkerDrag) return;
    if (event.button !== 0) return; // Only left click

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const marker = findMarkerAtPosition(x, y);
    if (marker) {
      // Start drag mode
      event.preventDefault();
      event.stopPropagation();
      isDraggingRef.current = true;
      setDraggingMarker(marker);
      setDragPosition({ x, y });

      // Notify parent that drag started (so they can hide the original marker)
      onMarkerDragStart?.(marker);

      // Disable chart interaction while dragging
      if (chartRef.current) {
        chartRef.current.applyOptions({
          handleScroll: false,
          handleScale: false,
        });
      }
    }
  }, [findMarkerAtPosition, onMarkerDrag, onMarkerDragStart]);

  // Handle mouse move
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !draggingMarker || !containerRef.current) return;

    event.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setDragPosition({ x, y });
  }, [draggingMarker]);

  // Handle mouse up - complete drag
  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const wasDragging = isDraggingRef.current;

    // Re-enable chart interaction
    if (chartRef.current) {
      chartRef.current.applyOptions({
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });
    }

    if (!isDraggingRef.current || !draggingMarker || !dragPosition || !chartRef.current || !candleSeriesRef.current || !onMarkerDrag) {
      isDraggingRef.current = false;
      setDraggingMarker(null);
      setDragPosition(null);
      if (wasDragging) onMarkerDragEnd?.();
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      isDraggingRef.current = false;
      setDraggingMarker(null);
      setDragPosition(null);
      onMarkerDragEnd?.();
      return;
    }

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const timeScale = chartRef.current.timeScale();
    const newTime = timeScale.coordinateToTime(x);
    const newPrice = candleSeriesRef.current.coordinateToPrice(y);

    if (newTime !== null && newPrice !== null) {
      let finalPrice = newPrice as number;

      // Snap to candle level if modifier held
      if (isModifierHeldRef.current) {
        const candle = candles.find(c => c.time === newTime);
        if (candle) {
          const priceLevels = [candle.high, candle.low, candle.open, candle.close];
          finalPrice = priceLevels.reduce((closest, level) =>
            Math.abs(level - finalPrice) < Math.abs(closest - finalPrice) ? level : closest
          );
        }
      }

      // Only trigger drag if moved significantly
      const startMarkerX = timeScale.timeToCoordinate(draggingMarker.time as Time);
      if (startMarkerX !== null && (Math.abs(x - startMarkerX) > 5 || Math.abs(y - (dragPosition?.y || y)) > 5)) {
        onMarkerDrag(draggingMarker, newTime as number, finalPrice);
      }
    }

    // Notify parent drag ended
    onMarkerDragEnd?.();

    isDraggingRef.current = false;
    setDraggingMarker(null);
    setDragPosition(null);
  }, [draggingMarker, dragPosition, candles, onMarkerDrag]);

  // Handle context menu (right-click)
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onMarkerContextMenu) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const marker = findMarkerAtPosition(x, y);
    if (marker) {
      event.preventDefault();
      event.stopPropagation();
      onMarkerContextMenu(marker, event.clientX, event.clientY);
    }
  }, [findMarkerAtPosition, onMarkerContextMenu]);

  // Handle click events
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Don't handle click if we were dragging
      if (isDraggingRef.current) return;

      if (!chartRef.current || !candleSeriesRef.current) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const shouldSnap = event.metaKey || event.ctrlKey;

      const timeScale = chartRef.current.timeScale();
      const time = timeScale.coordinateToTime(x);
      const clickedPrice = candleSeriesRef.current.coordinateToPrice(y);

      if (time !== null && clickedPrice !== null) {
        const candleIndex = candles.findIndex((c) => c.time === time);
        const candle = candleIndex !== -1 ? candles[candleIndex] : null;

        // Check if clicked on a marker (for left-click modal)
        const clickedMarker = findMarkerAtPosition(x, y);

        if (clickedMarker && onMarkerClick) {
          onMarkerClick(clickedMarker);
          return;
        }

        // For candle clicks (adding new detection)
        if (candle && onCandleClick) {
          const clickedPriceNum = clickedPrice as number;
          let finalPrice = clickedPriceNum;
          let snappedLevel = "free";

          if (shouldSnap) {
            const priceLevels = [
              { price: candle.high, name: "high" },
              { price: candle.low, name: "low" },
              { price: candle.open, name: "open" },
              { price: candle.close, name: "close" },
            ];

            const closestLevel = priceLevels.reduce((closest, level) => {
              return Math.abs(level.price - clickedPriceNum) < Math.abs(closest.price - clickedPriceNum)
                ? level
                : closest;
            });

            finalPrice = closestLevel.price;
            snappedLevel = closestLevel.name;
          }

          const snappedCandle = {
            ...candle,
            _snappedPrice: finalPrice,
            _snappedLevel: snappedLevel,
          };

          onCandleClick(snappedCandle as ChartCandle, candleIndex);
          return;
        }

        // General chart click (for move mode placement)
        if (onChartClick) {
          let finalPrice = clickedPrice as number;

          if (shouldSnap && candle) {
            const priceLevels = [candle.high, candle.low, candle.open, candle.close];
            finalPrice = priceLevels.reduce((closest, level) =>
              Math.abs(level - (clickedPrice as number)) < Math.abs(closest - (clickedPrice as number)) ? level : closest
            );
          }

          onChartClick(time as number, finalPrice);
        }
      }
    },
    [candles, findMarkerAtPosition, onCandleClick, onMarkerClick, onChartClick]
  );

  // Global mouse up handler (in case mouse leaves the chart while dragging)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        // Re-enable chart interaction
        if (chartRef.current) {
          chartRef.current.applyOptions({
            handleScroll: {
              mouseWheel: true,
              pressedMouseMove: true,
              horzTouchDrag: true,
              vertTouchDrag: true,
            },
            handleScale: {
              axisPressedMouseMove: true,
              mouseWheel: true,
              pinch: true,
            },
          });
        }
        isDraggingRef.current = false;
        setDraggingMarker(null);
        setDragPosition(null);
        onMarkerDragEnd?.(); // Notify parent drag ended
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [onMarkerDragEnd]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`w-full ${className} ${draggingMarker ? "cursor-grabbing" : ""}`}
        style={{ height }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
      />

      {/* Snap/Magnet indicator overlay */}
      {snapIndicator && isModifierHeld && (
        <>
          {/* Horizontal line at snap level - starts from candle, goes RIGHT only */}
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: snapIndicator.x,
              right: 60, // Leave space for price scale
              top: snapIndicator.y,
              height: 2,
              backgroundColor: snapIndicator.color,
              opacity: 0.9,
              boxShadow: `0 0 10px ${snapIndicator.color}, 0 0 20px ${snapIndicator.color}`,
            }}
          />
          {/* Snap level label - positioned at the right end */}
          <div
            className="absolute pointer-events-none px-3 py-1.5 text-xs font-mono font-bold rounded shadow-lg z-50"
            style={{
              right: 65,
              top: snapIndicator.y - 14,
              backgroundColor: snapIndicator.color,
              color: snapIndicator.color === "#ffffff" ? "#000" : "#fff",
              boxShadow: `0 0 10px ${snapIndicator.color}`,
            }}
          >
            {snapIndicator.level} ${snapIndicator.price.toFixed(2)}
          </div>
          {/* Magnet mode indicator */}
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-blue-600 rounded text-sm text-white font-bold pointer-events-none shadow-lg z-50 animate-pulse">
            MAGNET MODE
          </div>
        </>
      )}

      {/* Drag indicator */}
      {draggingMarker && dragPosition && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: dragPosition.x - 12,
            top: dragPosition.y - 12,
            width: 24,
            height: 24,
            backgroundColor: draggingMarker.color,
            borderRadius: "50%",
            opacity: 0.9,
            border: "2px solid white",
            boxShadow: `0 0 15px ${draggingMarker.color}`,
          }}
        />
      )}
    </div>
  );
}
