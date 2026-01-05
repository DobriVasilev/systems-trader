"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  SeriesMarker,
  ColorType,
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
  onCandleClick?: (candle: ChartCandle, index: number) => void;
  onMarkerClick?: (marker: ChartMarker) => void;
  onChartClick?: (time: number, price: number) => void;
  height?: number;
  className?: string;
}

export function CandlestickChart({
  candles,
  markers = [],
  onCandleClick,
  onMarkerClick,
  onChartClick,
  height = 500,
  className = "",
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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
        mode: 1, // Normal
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

    // v4 API - addCandlestickSeries
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

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update candle data
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
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Update markers
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time as Time,
      position: m.position,
      color: m.color,
      shape: m.shape,
      text: m.text,
      size: m.size || 1,
    }));

    // Sort markers by time
    seriesMarkers.sort((a, b) => (a.time as number) - (b.time as number));

    candleSeriesRef.current.setMarkers(seriesMarkers);
  }, [markers]);

  // Handle click events
  // By default: free price selection (exact cursor position)
  // With Cmd/Ctrl held: snap to nearest candle level (high, low, open, close)
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!chartRef.current || !candleSeriesRef.current) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const shouldSnap = event.metaKey || event.ctrlKey; // Cmd on Mac, Ctrl on Windows

      // Get time and price from coordinates
      const timeScale = chartRef.current.timeScale();
      const time = timeScale.coordinateToTime(x);
      const clickedPrice = candleSeriesRef.current.coordinateToPrice(y);

      if (time !== null && clickedPrice !== null) {
        // Find the candle at this time first
        const candleIndex = candles.findIndex((c) => c.time === time);
        const candle = candleIndex !== -1 ? candles[candleIndex] : null;

        // Find if we clicked on a marker - check BOTH X and Y position
        const clickedMarker = markers.find((m) => {
          const markerX = timeScale.timeToCoordinate(m.time as Time);
          if (markerX === null) return false;

          // X must be close (within 15px)
          if (Math.abs(markerX - x) > 15) return false;

          // Also check Y position - marker must be near the click
          // Get the marker's candle to check vertical position
          const markerCandle = candles.find(c => c.time === m.time);
          if (!markerCandle) return false;

          // Calculate marker's Y coordinate based on position
          let markerPrice: number;
          if (m.position === "aboveBar") {
            markerPrice = markerCandle.high;
          } else if (m.position === "belowBar") {
            markerPrice = markerCandle.low;
          } else {
            markerPrice = (markerCandle.high + markerCandle.low) / 2;
          }

          const markerY = candleSeriesRef.current?.priceToCoordinate(markerPrice);
          if (markerY === null || markerY === undefined) return false;

          // Y must also be close (within 25px for marker area)
          return Math.abs(markerY - y) < 25;
        });

        if (clickedMarker && onMarkerClick) {
          onMarkerClick(clickedMarker);
          return;
        }

        // For candle clicks
        if (candle && onCandleClick) {
          const clickedPriceNum = clickedPrice as number;
          let finalPrice = clickedPriceNum;
          let snappedLevel = "free";

          // Only snap to price levels if Cmd/Ctrl is held
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

          // Create modified candle with price info
          const snappedCandle = {
            ...candle,
            _snappedPrice: finalPrice,
            _snappedLevel: snappedLevel,
          };

          onCandleClick(snappedCandle as ChartCandle, candleIndex);
          return;
        }

        // General chart click
        if (onChartClick) {
          let finalPrice = clickedPrice as number;

          // Only snap if Cmd/Ctrl is held and we're on a candle
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
    [candles, markers, onCandleClick, onMarkerClick, onChartClick]
  );

  return (
    <div
      ref={containerRef}
      className={`w-full ${className}`}
      style={{ height }}
      onClick={handleClick}
    />
  );
}
