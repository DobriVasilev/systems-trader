"""
Indicator-based Conditions.

Conditions that evaluate indicator states (EMA alignment, RSI levels, VWAP direction, etc.).
"""

import pandas as pd
import numpy as np
from typing import Optional, List

from .base import BaseCondition, EvaluationResult, ConditionResult
from ..indicators.moving_averages import EMA, SMA
from ..indicators.momentum import RSI, MACD
from ..indicators.vwap import VWAP2Day
from ..indicators.volume import VolumeSpike, RelativeVolume
from ..indicators.trend import ADX


class EMAAlignment(BaseCondition):
    """
    Check if EMAs are aligned in bullish or bearish order.

    Bullish: EMA12 > EMA21 > EMA50 > EMA200
    Bearish: EMA12 < EMA21 < EMA50 < EMA200
    """

    def __init__(
        self,
        direction: str = 'bullish',
        periods: List[int] = None,
        name: Optional[str] = None
    ):
        """
        Initialize EMA Alignment condition.

        Args:
            direction: 'bullish' or 'bearish'
            periods: List of EMA periods to check (default: [12, 21, 50, 200])
        """
        if name is None:
            name = f"ema_alignment_{direction}"
        super().__init__(name)
        self.direction = direction.lower()
        self.periods = periods or [12, 21, 50, 200]
        self.emas = [EMA(period=p) for p in self.periods]

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        # Calculate all EMAs
        ema_values = []
        for ema in self.emas:
            try:
                result = ema.calculate(candles)
                ema_values.append(result.latest)
            except ValueError:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details="Not enough data for EMAs",
                )

        # Check alignment
        if self.direction == 'bullish':
            aligned = all(ema_values[i] > ema_values[i+1] for i in range(len(ema_values)-1))
        else:
            aligned = all(ema_values[i] < ema_values[i+1] for i in range(len(ema_values)-1))

        if aligned:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"EMAs aligned {self.direction}",
                values={f'ema_{p}': v for p, v in zip(self.periods, ema_values)}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"EMAs not aligned {self.direction}",
                values={f'ema_{p}': v for p, v in zip(self.periods, ema_values)}
            )


class PriceAboveEMA(BaseCondition):
    """Check if price is above a specific EMA."""

    def __init__(self, period: int = 200, source: str = 'close', name: Optional[str] = None):
        if name is None:
            name = f"price_above_ema{period}"
        super().__init__(name)
        self.period = period
        self.source = source
        self.ema = EMA(period=period)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            ema_result = self.ema.calculate(candles)
            ema_value = ema_result.latest
        except ValueError:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details=f"Need at least {self.period} candles",
            )

        price = candles[self.source].iloc[-1]

        if price > ema_value:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} > EMA{self.period}({ema_value:.4f})",
                values={'price': price, 'ema': ema_value}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} <= EMA{self.period}({ema_value:.4f})",
                values={'price': price, 'ema': ema_value}
            )


class PriceBelowEMA(BaseCondition):
    """Check if price is below a specific EMA."""

    def __init__(self, period: int = 200, source: str = 'close', name: Optional[str] = None):
        if name is None:
            name = f"price_below_ema{period}"
        super().__init__(name)
        self.period = period
        self.source = source
        self.ema = EMA(period=period)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            ema_result = self.ema.calculate(candles)
            ema_value = ema_result.latest
        except ValueError:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details=f"Need at least {self.period} candles",
            )

        price = candles[self.source].iloc[-1]

        if price < ema_value:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} < EMA{self.period}({ema_value:.4f})",
                values={'price': price, 'ema': ema_value}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} >= EMA{self.period}({ema_value:.4f})",
                values={'price': price, 'ema': ema_value}
            )


class RSILevel(BaseCondition):
    """Check if RSI is in a specific zone."""

    def __init__(
        self,
        zone: str = 'oversold',
        period: int = 14,
        oversold: float = 30.0,
        overbought: float = 70.0,
        name: Optional[str] = None
    ):
        """
        Initialize RSI Level condition.

        Args:
            zone: 'oversold', 'overbought', 'neutral'
            period: RSI period
            oversold: Oversold threshold
            overbought: Overbought threshold
        """
        if name is None:
            name = f"rsi_{zone}"
        super().__init__(name)
        self.zone = zone.lower()
        self.period = period
        self.oversold = oversold
        self.overbought = overbought
        self.rsi = RSI(period=period)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            rsi_result = self.rsi.calculate(candles)
            rsi_value = rsi_result.latest
        except ValueError:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details=f"Need more data for RSI",
            )

        in_oversold = rsi_value < self.oversold
        in_overbought = rsi_value > self.overbought
        in_neutral = self.oversold <= rsi_value <= self.overbought

        if self.zone == 'oversold' and in_oversold:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"RSI={rsi_value:.1f} (oversold)",
                values={'rsi': rsi_value}
            )
        elif self.zone == 'overbought' and in_overbought:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"RSI={rsi_value:.1f} (overbought)",
                values={'rsi': rsi_value}
            )
        elif self.zone == 'neutral' and in_neutral:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"RSI={rsi_value:.1f} (neutral)",
                values={'rsi': rsi_value}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"RSI={rsi_value:.1f} not in {self.zone} zone",
                values={'rsi': rsi_value}
            )


class VWAPSlope(BaseCondition):
    """Check if VWAP slope is positive (up) or negative (down)."""

    def __init__(self, direction: str = 'up', slope_period: int = 5, name: Optional[str] = None):
        """
        Initialize VWAP Slope condition.

        Args:
            direction: 'up' (positive slope) or 'down' (negative slope)
            slope_period: Period for slope calculation
        """
        if name is None:
            name = f"vwap_slope_{direction}"
        super().__init__(name)
        self.direction = direction.lower()
        self.slope_period = slope_period
        self.vwap = VWAP2Day(slope_period=slope_period)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            vwap_values, slope_values = self.vwap.calculate_with_slope(candles)
            current_slope = slope_values.iloc[-1]
        except (ValueError, IndexError):
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Cannot calculate VWAP slope",
            )

        if np.isnan(current_slope):
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="VWAP slope is NaN",
            )

        if self.direction == 'up' and current_slope > 0:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"VWAP slope positive ({current_slope:.6f})",
                values={'slope': current_slope, 'vwap': vwap_values.iloc[-1]}
            )
        elif self.direction == 'down' and current_slope < 0:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"VWAP slope negative ({current_slope:.6f})",
                values={'slope': current_slope, 'vwap': vwap_values.iloc[-1]}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"VWAP slope not {self.direction} ({current_slope:.6f})",
                values={'slope': current_slope}
            )


class PriceAboveVWAP(BaseCondition):
    """Check if price is above VWAP."""

    def __init__(self, source: str = 'close', name: Optional[str] = None):
        if name is None:
            name = "price_above_vwap"
        super().__init__(name)
        self.source = source
        self.vwap = VWAP2Day()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            vwap_result = self.vwap.calculate(candles)
            vwap_value = vwap_result.latest
        except (ValueError, IndexError):
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Cannot calculate VWAP",
            )

        price = candles[self.source].iloc[-1]

        if price > vwap_value:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} > VWAP({vwap_value:.4f})",
                values={'price': price, 'vwap': vwap_value}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} <= VWAP({vwap_value:.4f})",
                values={'price': price, 'vwap': vwap_value}
            )


class PriceBelowVWAP(BaseCondition):
    """Check if price is below VWAP."""

    def __init__(self, source: str = 'close', name: Optional[str] = None):
        if name is None:
            name = "price_below_vwap"
        super().__init__(name)
        self.source = source
        self.vwap = VWAP2Day()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            vwap_result = self.vwap.calculate(candles)
            vwap_value = vwap_result.latest
        except (ValueError, IndexError):
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Cannot calculate VWAP",
            )

        price = candles[self.source].iloc[-1]

        if price < vwap_value:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} < VWAP({vwap_value:.4f})",
                values={'price': price, 'vwap': vwap_value}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} >= VWAP({vwap_value:.4f})",
                values={'price': price, 'vwap': vwap_value}
            )


class VolumeSpikeCondition(BaseCondition):
    """Check if there's a volume spike."""

    def __init__(
        self,
        threshold: float = 2.0,
        period: int = 20,
        name: Optional[str] = None
    ):
        """
        Initialize Volume Spike condition.

        Args:
            threshold: Volume must be this many times average
            period: Period for average calculation
        """
        if name is None:
            name = f"volume_spike_{threshold}x"
        super().__init__(name)
        self.threshold = threshold
        self.period = period
        self.detector = VolumeSpike(period=period, threshold=threshold)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            is_spike = self.detector.detect_spikes(candles).iloc[-1]
            ratio = self.detector.calculate(candles).values.iloc[-1]
        except (ValueError, IndexError):
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Cannot calculate volume spike",
            )

        if is_spike:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Volume spike ({ratio:.1f}x average)",
                values={'ratio': ratio, 'volume': candles['volume'].iloc[-1]}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No volume spike ({ratio:.1f}x)",
                values={'ratio': ratio}
            )


class ADXTrending(BaseCondition):
    """Check if ADX indicates trending market."""

    def __init__(self, threshold: float = 25.0, period: int = 14, name: Optional[str] = None):
        """
        Initialize ADX Trending condition.

        Args:
            threshold: ADX value above this indicates trend
            period: ADX period
        """
        if name is None:
            name = f"adx_trending"
        super().__init__(name)
        self.threshold = threshold
        self.period = period
        self.adx = ADX(period=period)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            adx_result = self.adx.calculate(candles)
            adx_value = adx_result.latest
        except ValueError:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Need more data for ADX",
            )

        if adx_value > self.threshold:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"ADX={adx_value:.1f} (trending)",
                values={'adx': adx_value}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"ADX={adx_value:.1f} (not trending)",
                values={'adx': adx_value}
            )


class MACDCrossover(BaseCondition):
    """Check if MACD line crossed above/below signal line."""

    def __init__(
        self,
        direction: str = 'bullish',
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
        name: Optional[str] = None
    ):
        """
        Initialize MACD Crossover condition.

        Args:
            direction: 'bullish' (MACD crosses above signal) or 'bearish'
            fast, slow, signal: MACD parameters
        """
        if name is None:
            name = f"macd_cross_{direction}"
        super().__init__(name)
        self.direction = direction.lower()
        self.macd = MACD(fast_period=fast, slow_period=slow, signal_period=signal)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        try:
            macd_line, signal_line, histogram = self.macd.calculate_all(candles)
        except ValueError:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Need more data for MACD",
            )

        if len(macd_line) < 2:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Need at least 2 bars",
            )

        prev_macd = macd_line.iloc[-2]
        prev_signal = signal_line.iloc[-2]
        curr_macd = macd_line.iloc[-1]
        curr_signal = signal_line.iloc[-1]

        if self.direction == 'bullish':
            # MACD crossed above signal
            crossed = prev_macd <= prev_signal and curr_macd > curr_signal
        else:
            # MACD crossed below signal
            crossed = prev_macd >= prev_signal and curr_macd < curr_signal

        if crossed:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"MACD {self.direction} crossover",
                values={'macd': curr_macd, 'signal': curr_signal}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No {self.direction} MACD crossover",
                values={'macd': curr_macd, 'signal': curr_signal}
            )
