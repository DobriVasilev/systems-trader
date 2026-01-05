"""
Moving Average Indicators.

SMA (Simple Moving Average) and EMA (Exponential Moving Average).
"""

import pandas as pd
import numpy as np
from typing import Optional

from .base import BaseIndicator, IndicatorResult


class SMA(BaseIndicator):
    """
    Simple Moving Average.

    Sum of closes over period divided by period.
    """

    def __init__(self, period: int = 20, source: str = 'close'):
        """
        Initialize SMA indicator.

        Args:
            period: Lookback period
            source: Column to use ('close', 'high', 'low', 'open', 'hl2', 'hlc3', 'ohlc4')
        """
        super().__init__(f"SMA_{period}")
        self.period = period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate SMA values."""
        self.validate_input(candles, self.period)

        source_data = self._get_source(candles)
        sma = source_data.rolling(window=self.period).mean()

        return IndicatorResult(
            name=self.name,
            values=sma,
            params={'period': self.period, 'source': self.source}
        )

    def _get_source(self, candles: pd.DataFrame) -> pd.Series:
        """Get the source series based on source type."""
        if self.source == 'close':
            return candles['close']
        elif self.source == 'high':
            return candles['high']
        elif self.source == 'low':
            return candles['low']
        elif self.source == 'open':
            return candles['open']
        elif self.source == 'hl2':
            return (candles['high'] + candles['low']) / 2
        elif self.source == 'hlc3':
            return (candles['high'] + candles['low'] + candles['close']) / 3
        elif self.source == 'ohlc4':
            return (candles['open'] + candles['high'] + candles['low'] + candles['close']) / 4
        else:
            return candles['close']


class EMA(BaseIndicator):
    """
    Exponential Moving Average.

    Weights recent prices more heavily using smoothing factor.
    """

    def __init__(self, period: int = 20, source: str = 'close'):
        """
        Initialize EMA indicator.

        Args:
            period: Lookback period
            source: Column to use
        """
        super().__init__(f"EMA_{period}")
        self.period = period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate EMA values."""
        self.validate_input(candles, self.period)

        source_data = self._get_source(candles)
        ema = source_data.ewm(span=self.period, adjust=False).mean()

        return IndicatorResult(
            name=self.name,
            values=ema,
            params={'period': self.period, 'source': self.source}
        )

    def _get_source(self, candles: pd.DataFrame) -> pd.Series:
        """Get the source series based on source type."""
        if self.source == 'close':
            return candles['close']
        elif self.source == 'high':
            return candles['high']
        elif self.source == 'low':
            return candles['low']
        elif self.source == 'open':
            return candles['open']
        elif self.source == 'hl2':
            return (candles['high'] + candles['low']) / 2
        elif self.source == 'hlc3':
            return (candles['high'] + candles['low'] + candles['close']) / 3
        elif self.source == 'ohlc4':
            return (candles['open'] + candles['high'] + candles['low'] + candles['close']) / 4
        else:
            return candles['close']


class WMA(BaseIndicator):
    """
    Weighted Moving Average.

    Weights decrease linearly (most recent = highest weight).
    """

    def __init__(self, period: int = 20, source: str = 'close'):
        """
        Initialize WMA indicator.

        Args:
            period: Lookback period
            source: Column to use
        """
        super().__init__(f"WMA_{period}")
        self.period = period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate WMA values."""
        self.validate_input(candles, self.period)

        source_data = self._get_source(candles)

        # Generate linear weights [1, 2, 3, ..., period]
        weights = np.arange(1, self.period + 1)

        # Apply weighted average
        wma = source_data.rolling(window=self.period).apply(
            lambda x: np.dot(x, weights) / weights.sum(),
            raw=True
        )

        return IndicatorResult(
            name=self.name,
            values=wma,
            params={'period': self.period, 'source': self.source}
        )

    def _get_source(self, candles: pd.DataFrame) -> pd.Series:
        """Get the source series based on source type."""
        if self.source in ['close', 'high', 'low', 'open']:
            return candles[self.source]
        elif self.source == 'hl2':
            return (candles['high'] + candles['low']) / 2
        elif self.source == 'hlc3':
            return (candles['high'] + candles['low'] + candles['close']) / 3
        elif self.source == 'ohlc4':
            return (candles['open'] + candles['high'] + candles['low'] + candles['close']) / 4
        else:
            return candles['close']


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def sma(candles: pd.DataFrame, period: int = 20, source: str = 'close') -> pd.Series:
    """Quick function to calculate SMA."""
    indicator = SMA(period=period, source=source)
    return indicator.calculate(candles).values


def ema(candles: pd.DataFrame, period: int = 20, source: str = 'close') -> pd.Series:
    """Quick function to calculate EMA."""
    indicator = EMA(period=period, source=source)
    return indicator.calculate(candles).values


def wma(candles: pd.DataFrame, period: int = 20, source: str = 'close') -> pd.Series:
    """Quick function to calculate WMA."""
    indicator = WMA(period=period, source=source)
    return indicator.calculate(candles).values


# =============================================================================
# PRE-CONFIGURED INDICATORS (matching BUILD_CHECKLIST.md)
# =============================================================================

# Standard EMA periods used across systems
EMA_12 = lambda: EMA(period=12)
EMA_21 = lambda: EMA(period=21)
EMA_50 = lambda: EMA(period=50)
EMA_100 = lambda: EMA(period=100)
EMA_200 = lambda: EMA(period=200)
EMA_300 = lambda: EMA(period=300)

# Standard SMA periods
SMA_20 = lambda: SMA(period=20)
SMA_50 = lambda: SMA(period=50)
SMA_200 = lambda: SMA(period=200)
