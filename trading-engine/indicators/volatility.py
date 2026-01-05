"""
Volatility Indicators.

ATR (Average True Range), Bollinger Bands, Standard Deviation.
"""

import pandas as pd
import numpy as np
from typing import Optional

from .base import BaseIndicator, IndicatorResult


class ATR(BaseIndicator):
    """
    Average True Range.

    Measures volatility by decomposing the entire range of price.
    True Range = max(H-L, |H-Prev Close|, |L-Prev Close|)
    ATR = EMA or SMA of True Range over period.
    """

    def __init__(self, period: int = 14, use_ema: bool = True):
        """
        Initialize ATR indicator.

        Args:
            period: Lookback period (default 14)
            use_ema: Use EMA smoothing (True) or SMA (False)
        """
        super().__init__(f"ATR_{period}")
        self.period = period
        self.use_ema = use_ema

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate ATR values."""
        self.validate_input(candles, self.period + 1)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        # Calculate True Range components
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))

        # True Range is the maximum of the three
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        # Calculate ATR as smoothed average
        if self.use_ema:
            atr = true_range.ewm(span=self.period, adjust=False).mean()
        else:
            atr = true_range.rolling(window=self.period).mean()

        return IndicatorResult(
            name=self.name,
            values=atr,
            params={'period': self.period, 'use_ema': self.use_ema}
        )


class TrueRange(BaseIndicator):
    """
    True Range (single bar volatility).

    Returns raw True Range without averaging.
    """

    def __init__(self):
        super().__init__("TrueRange")

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate True Range values."""
        self.validate_input(candles, 2)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))

        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        return IndicatorResult(
            name=self.name,
            values=true_range,
            params={}
        )


class BollingerBands(BaseIndicator):
    """
    Bollinger Bands.

    Middle = SMA, Upper/Lower = Middle +/- (std_dev * multiplier).
    """

    def __init__(self, period: int = 20, std_dev: float = 2.0, source: str = 'close'):
        """
        Initialize Bollinger Bands.

        Args:
            period: Lookback period for SMA and std dev
            std_dev: Number of standard deviations for bands
            source: Price source
        """
        super().__init__(f"BB_{period}")
        self.period = period
        self.std_dev = std_dev
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate Bollinger Bands.

        Returns middle band. Use calculate_all() for all bands.
        """
        self.validate_input(candles, self.period)

        source = self._get_source(candles)
        middle = source.rolling(window=self.period).mean()

        return IndicatorResult(
            name=self.name,
            values=middle,
            params={'period': self.period, 'std_dev': self.std_dev}
        )

    def calculate_all(self, candles: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series]:
        """
        Calculate all three bands.

        Returns:
            Tuple of (upper, middle, lower) bands
        """
        self.validate_input(candles, self.period)

        source = self._get_source(candles)
        middle = source.rolling(window=self.period).mean()
        std = source.rolling(window=self.period).std()

        upper = middle + (std * self.std_dev)
        lower = middle - (std * self.std_dev)

        return upper, middle, lower

    def _get_source(self, candles: pd.DataFrame) -> pd.Series:
        """Get the source series."""
        if self.source == 'close':
            return candles['close']
        elif self.source == 'hl2':
            return (candles['high'] + candles['low']) / 2
        elif self.source == 'hlc3':
            return (candles['high'] + candles['low'] + candles['close']) / 3
        else:
            return candles['close']


class StandardDeviation(BaseIndicator):
    """Standard Deviation of price over period."""

    def __init__(self, period: int = 20, source: str = 'close'):
        super().__init__(f"StdDev_{period}")
        self.period = period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate standard deviation."""
        self.validate_input(candles, self.period)

        source = candles[self.source] if self.source in candles.columns else candles['close']
        std = source.rolling(window=self.period).std()

        return IndicatorResult(
            name=self.name,
            values=std,
            params={'period': self.period, 'source': self.source}
        )


class ATRPercent(BaseIndicator):
    """
    ATR as percentage of price.

    Useful for comparing volatility across different price assets.
    """

    def __init__(self, period: int = 14):
        super().__init__(f"ATRp_{period}")
        self.period = period

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate ATR as percentage of close price."""
        self.validate_input(candles, self.period + 1)

        # Calculate ATR
        atr_indicator = ATR(period=self.period)
        atr = atr_indicator.calculate(candles).values

        # Convert to percentage
        atr_percent = (atr / candles['close']) * 100

        return IndicatorResult(
            name=self.name,
            values=atr_percent,
            params={'period': self.period}
        )


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def atr(candles: pd.DataFrame, period: int = 14, use_ema: bool = True) -> pd.Series:
    """Quick function to calculate ATR."""
    indicator = ATR(period=period, use_ema=use_ema)
    return indicator.calculate(candles).values


def true_range(candles: pd.DataFrame) -> pd.Series:
    """Quick function to calculate True Range."""
    indicator = TrueRange()
    return indicator.calculate(candles).values


def bollinger_bands(candles: pd.DataFrame, period: int = 20, std_dev: float = 2.0) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Quick function to calculate Bollinger Bands. Returns (upper, middle, lower)."""
    indicator = BollingerBands(period=period, std_dev=std_dev)
    return indicator.calculate_all(candles)


def std_dev(candles: pd.DataFrame, period: int = 20, source: str = 'close') -> pd.Series:
    """Quick function to calculate standard deviation."""
    indicator = StandardDeviation(period=period, source=source)
    return indicator.calculate(candles).values


# =============================================================================
# PRE-CONFIGURED INDICATORS
# =============================================================================

ATR_14 = lambda: ATR(period=14)
ATR_7 = lambda: ATR(period=7)
