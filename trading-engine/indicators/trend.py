"""
Trend Indicators.

ADX, Supertrend, and trend strength measurements.
"""

import pandas as pd
import numpy as np
from typing import Optional, Tuple

from .base import BaseIndicator, IndicatorResult


class ADX(BaseIndicator):
    """
    Average Directional Index.

    Measures trend strength (not direction).
    - ADX < 20: Weak/no trend (ranging)
    - ADX 20-40: Developing trend
    - ADX 40-60: Strong trend
    - ADX > 60: Very strong trend

    Also provides +DI and -DI for direction.
    """

    def __init__(self, period: int = 14):
        """
        Initialize ADX indicator.

        Args:
            period: Lookback period (default 14)
        """
        super().__init__(f"ADX_{period}")
        self.period = period

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate ADX values."""
        self.validate_input(candles, self.period + 1)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        # Calculate True Range
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        # Calculate Directional Movement
        up_move = high - high.shift(1)
        down_move = low.shift(1) - low

        # +DM and -DM
        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0)

        plus_dm = pd.Series(plus_dm, index=candles.index)
        minus_dm = pd.Series(minus_dm, index=candles.index)

        # Smooth with EMA
        atr = true_range.ewm(span=self.period, adjust=False).mean()
        plus_di = 100 * (plus_dm.ewm(span=self.period, adjust=False).mean() / atr)
        minus_di = 100 * (minus_dm.ewm(span=self.period, adjust=False).mean() / atr)

        # DX and ADX
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        dx = dx.replace([np.inf, -np.inf], 0).fillna(0)
        adx = dx.ewm(span=self.period, adjust=False).mean()

        return IndicatorResult(
            name=self.name,
            values=adx,
            params={'period': self.period}
        )

    def calculate_all(self, candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """
        Calculate ADX with directional indicators.

        Returns:
            Tuple of (adx, plus_di, minus_di)
        """
        self.validate_input(candles, self.period + 1)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        # Calculate True Range
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        # Calculate Directional Movement
        up_move = high - high.shift(1)
        down_move = low.shift(1) - low

        # +DM and -DM
        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0)

        plus_dm = pd.Series(plus_dm, index=candles.index)
        minus_dm = pd.Series(minus_dm, index=candles.index)

        # Smooth with EMA
        atr = true_range.ewm(span=self.period, adjust=False).mean()
        plus_di = 100 * (plus_dm.ewm(span=self.period, adjust=False).mean() / atr)
        minus_di = 100 * (minus_dm.ewm(span=self.period, adjust=False).mean() / atr)

        # DX and ADX
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        dx = dx.replace([np.inf, -np.inf], 0).fillna(0)
        adx = dx.ewm(span=self.period, adjust=False).mean()

        return adx, plus_di, minus_di


class Supertrend(BaseIndicator):
    """
    Supertrend Indicator.

    Trend-following indicator based on ATR.
    Green (above price) = downtrend, Red (below price) = uptrend.
    """

    def __init__(self, period: int = 10, multiplier: float = 3.0):
        """
        Initialize Supertrend.

        Args:
            period: ATR period (default 10)
            multiplier: ATR multiplier (default 3.0)
        """
        super().__init__(f"SuperT_{period}")
        self.period = period
        self.multiplier = multiplier

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate Supertrend values.

        Returns the supertrend line.
        """
        self.validate_input(candles, self.period + 1)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        # Calculate ATR
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = true_range.ewm(span=self.period, adjust=False).mean()

        # Calculate basic bands
        hl2 = (high + low) / 2
        upper_band = hl2 + (self.multiplier * atr)
        lower_band = hl2 - (self.multiplier * atr)

        # Initialize supertrend
        supertrend = pd.Series(index=candles.index, dtype=float)
        direction = pd.Series(index=candles.index, dtype=int)

        # First value
        supertrend.iloc[0] = upper_band.iloc[0]
        direction.iloc[0] = 1  # Start with downtrend

        # Calculate supertrend
        for i in range(1, len(candles)):
            if close.iloc[i] > supertrend.iloc[i-1]:
                # Uptrend
                supertrend.iloc[i] = lower_band.iloc[i]
                direction.iloc[i] = 1
            elif close.iloc[i] < supertrend.iloc[i-1]:
                # Downtrend
                supertrend.iloc[i] = upper_band.iloc[i]
                direction.iloc[i] = -1
            else:
                # Continuation
                supertrend.iloc[i] = supertrend.iloc[i-1]
                direction.iloc[i] = direction.iloc[i-1]

                if direction.iloc[i] == 1 and lower_band.iloc[i] > supertrend.iloc[i]:
                    supertrend.iloc[i] = lower_band.iloc[i]
                elif direction.iloc[i] == -1 and upper_band.iloc[i] < supertrend.iloc[i]:
                    supertrend.iloc[i] = upper_band.iloc[i]

        return IndicatorResult(
            name=self.name,
            values=supertrend,
            params={'period': self.period, 'multiplier': self.multiplier}
        )

    def calculate_with_direction(self, candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
        """
        Calculate Supertrend with direction.

        Returns:
            Tuple of (supertrend, direction) where direction is 1=up, -1=down
        """
        self.validate_input(candles, self.period + 1)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        # Calculate ATR
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = true_range.ewm(span=self.period, adjust=False).mean()

        # Calculate basic bands
        hl2 = (high + low) / 2
        upper_band = hl2 + (self.multiplier * atr)
        lower_band = hl2 - (self.multiplier * atr)

        # Initialize
        supertrend = pd.Series(index=candles.index, dtype=float)
        direction = pd.Series(index=candles.index, dtype=int)

        supertrend.iloc[0] = upper_band.iloc[0]
        direction.iloc[0] = -1

        for i in range(1, len(candles)):
            if close.iloc[i] > supertrend.iloc[i-1]:
                supertrend.iloc[i] = lower_band.iloc[i]
                direction.iloc[i] = 1
            elif close.iloc[i] < supertrend.iloc[i-1]:
                supertrend.iloc[i] = upper_band.iloc[i]
                direction.iloc[i] = -1
            else:
                supertrend.iloc[i] = supertrend.iloc[i-1]
                direction.iloc[i] = direction.iloc[i-1]

        return supertrend, direction


class TrendStrength(BaseIndicator):
    """
    Simple Trend Strength indicator.

    Measures how consistently price has moved in one direction.
    Based on percentage of candles in trend direction.
    """

    def __init__(self, period: int = 20):
        super().__init__(f"TrendStr_{period}")
        self.period = period

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate trend strength.

        Returns value from -100 to +100.
        +100 = all up candles, -100 = all down candles, 0 = mixed
        """
        self.validate_input(candles, self.period)

        close = candles['close']
        changes = np.sign(close.diff())

        # Rolling sum of direction
        direction_sum = changes.rolling(window=self.period).sum()

        # Normalize to -100 to +100
        strength = (direction_sum / self.period) * 100

        return IndicatorResult(
            name=self.name,
            values=strength,
            params={'period': self.period}
        )


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def adx(candles: pd.DataFrame, period: int = 14) -> pd.Series:
    """Quick function to calculate ADX."""
    indicator = ADX(period=period)
    return indicator.calculate(candles).values


def adx_with_di(candles: pd.DataFrame, period: int = 14) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Quick function to calculate ADX with DI. Returns (adx, plus_di, minus_di)."""
    indicator = ADX(period=period)
    return indicator.calculate_all(candles)


def supertrend(candles: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> pd.Series:
    """Quick function to calculate Supertrend."""
    indicator = Supertrend(period=period, multiplier=multiplier)
    return indicator.calculate(candles).values


def supertrend_with_dir(candles: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> Tuple[pd.Series, pd.Series]:
    """Quick function to calculate Supertrend with direction. Returns (supertrend, direction)."""
    indicator = Supertrend(period=period, multiplier=multiplier)
    return indicator.calculate_with_direction(candles)


def trend_strength(candles: pd.DataFrame, period: int = 20) -> pd.Series:
    """Quick function to calculate trend strength."""
    indicator = TrendStrength(period=period)
    return indicator.calculate(candles).values


# =============================================================================
# PRE-CONFIGURED INDICATORS
# =============================================================================

ADX_14 = lambda: ADX(period=14)
SUPERTREND_DEFAULT = lambda: Supertrend(period=10, multiplier=3.0)
