"""
Momentum Indicators.

RSI (Relative Strength Index), MACD, Stochastic.
"""

import pandas as pd
import numpy as np
from typing import Optional, Tuple

from .base import BaseIndicator, IndicatorResult


class RSI(BaseIndicator):
    """
    Relative Strength Index.

    Measures momentum by comparing average gains to average losses.
    RSI = 100 - (100 / (1 + RS))
    RS = Average Gain / Average Loss
    """

    def __init__(self, period: int = 14, source: str = 'close'):
        """
        Initialize RSI indicator.

        Args:
            period: Lookback period (default 14)
            source: Price source column
        """
        super().__init__(f"RSI_{period}")
        self.period = period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate RSI values."""
        self.validate_input(candles, self.period + 1)

        source = candles[self.source] if self.source in candles.columns else candles['close']

        # Calculate price changes
        delta = source.diff()

        # Separate gains and losses
        gains = delta.where(delta > 0, 0.0)
        losses = (-delta).where(delta < 0, 0.0)

        # Calculate average gains and losses using EMA
        avg_gain = gains.ewm(span=self.period, adjust=False).mean()
        avg_loss = losses.ewm(span=self.period, adjust=False).mean()

        # Calculate RS
        rs = avg_gain / avg_loss

        # Calculate RSI
        rsi = 100 - (100 / (1 + rs))

        # Handle division by zero (when avg_loss is 0)
        rsi = rsi.fillna(100)

        return IndicatorResult(
            name=self.name,
            values=rsi,
            params={'period': self.period, 'source': self.source}
        )


class MACD(BaseIndicator):
    """
    Moving Average Convergence Divergence.

    MACD Line = Fast EMA - Slow EMA
    Signal Line = EMA of MACD Line
    Histogram = MACD Line - Signal Line
    """

    def __init__(
        self,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
        source: str = 'close'
    ):
        """
        Initialize MACD indicator.

        Args:
            fast_period: Fast EMA period (default 12)
            slow_period: Slow EMA period (default 26)
            signal_period: Signal line EMA period (default 9)
            source: Price source column
        """
        super().__init__(f"MACD_{fast_period}_{slow_period}_{signal_period}")
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.signal_period = signal_period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate MACD line.

        Use calculate_all() for MACD line, signal, and histogram.
        """
        self.validate_input(candles, self.slow_period)

        source = candles[self.source] if self.source in candles.columns else candles['close']

        # Calculate EMAs
        fast_ema = source.ewm(span=self.fast_period, adjust=False).mean()
        slow_ema = source.ewm(span=self.slow_period, adjust=False).mean()

        # MACD line
        macd_line = fast_ema - slow_ema

        return IndicatorResult(
            name=self.name,
            values=macd_line,
            params={
                'fast_period': self.fast_period,
                'slow_period': self.slow_period,
                'signal_period': self.signal_period,
                'source': self.source
            }
        )

    def calculate_all(self, candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """
        Calculate all MACD components.

        Returns:
            Tuple of (macd_line, signal_line, histogram)
        """
        self.validate_input(candles, self.slow_period)

        source = candles[self.source] if self.source in candles.columns else candles['close']

        # Calculate EMAs
        fast_ema = source.ewm(span=self.fast_period, adjust=False).mean()
        slow_ema = source.ewm(span=self.slow_period, adjust=False).mean()

        # MACD line
        macd_line = fast_ema - slow_ema

        # Signal line
        signal_line = macd_line.ewm(span=self.signal_period, adjust=False).mean()

        # Histogram
        histogram = macd_line - signal_line

        return macd_line, signal_line, histogram


class Stochastic(BaseIndicator):
    """
    Stochastic Oscillator.

    %K = (Current Close - Lowest Low) / (Highest High - Lowest Low) * 100
    %D = SMA of %K
    """

    def __init__(self, k_period: int = 14, d_period: int = 3, smooth_k: int = 3):
        """
        Initialize Stochastic indicator.

        Args:
            k_period: Lookback period for %K (default 14)
            d_period: SMA period for %D (default 3)
            smooth_k: Smoothing period for %K (default 3)
        """
        super().__init__(f"Stoch_{k_period}_{d_period}")
        self.k_period = k_period
        self.d_period = d_period
        self.smooth_k = smooth_k

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate Slow %K (smoothed).

        Use calculate_all() for both %K and %D.
        """
        self.validate_input(candles, self.k_period)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        # Rolling highest high and lowest low
        highest_high = high.rolling(window=self.k_period).max()
        lowest_low = low.rolling(window=self.k_period).min()

        # Fast %K
        fast_k = ((close - lowest_low) / (highest_high - lowest_low)) * 100

        # Slow %K (smoothed)
        slow_k = fast_k.rolling(window=self.smooth_k).mean()

        return IndicatorResult(
            name=self.name,
            values=slow_k,
            params={
                'k_period': self.k_period,
                'd_period': self.d_period,
                'smooth_k': self.smooth_k
            }
        )

    def calculate_all(self, candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
        """
        Calculate both %K and %D.

        Returns:
            Tuple of (slow_k, slow_d)
        """
        self.validate_input(candles, self.k_period)

        high = candles['high']
        low = candles['low']
        close = candles['close']

        # Rolling highest high and lowest low
        highest_high = high.rolling(window=self.k_period).max()
        lowest_low = low.rolling(window=self.k_period).min()

        # Fast %K
        fast_k = ((close - lowest_low) / (highest_high - lowest_low)) * 100

        # Slow %K
        slow_k = fast_k.rolling(window=self.smooth_k).mean()

        # Slow %D
        slow_d = slow_k.rolling(window=self.d_period).mean()

        return slow_k, slow_d


class MomentumOscillator(BaseIndicator):
    """
    Simple Momentum Oscillator.

    Measures rate of change: (Current Price / Price N periods ago) * 100
    """

    def __init__(self, period: int = 10, source: str = 'close'):
        super().__init__(f"MOM_{period}")
        self.period = period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate Momentum values."""
        self.validate_input(candles, self.period + 1)

        source = candles[self.source] if self.source in candles.columns else candles['close']

        # Rate of change as percentage
        momentum = (source / source.shift(self.period) - 1) * 100

        return IndicatorResult(
            name=self.name,
            values=momentum,
            params={'period': self.period, 'source': self.source}
        )


class ROC(BaseIndicator):
    """
    Rate of Change.

    ROC = ((Current - Previous) / Previous) * 100
    """

    def __init__(self, period: int = 10, source: str = 'close'):
        super().__init__(f"ROC_{period}")
        self.period = period
        self.source = source

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate ROC values."""
        self.validate_input(candles, self.period + 1)

        source = candles[self.source] if self.source in candles.columns else candles['close']

        roc = source.pct_change(periods=self.period) * 100

        return IndicatorResult(
            name=self.name,
            values=roc,
            params={'period': self.period, 'source': self.source}
        )


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def rsi(candles: pd.DataFrame, period: int = 14, source: str = 'close') -> pd.Series:
    """Quick function to calculate RSI."""
    indicator = RSI(period=period, source=source)
    return indicator.calculate(candles).values


def macd(candles: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Quick function to calculate MACD. Returns (macd_line, signal_line, histogram)."""
    indicator = MACD(fast_period=fast, slow_period=slow, signal_period=signal)
    return indicator.calculate_all(candles)


def stochastic(candles: pd.DataFrame, k_period: int = 14, d_period: int = 3, smooth: int = 3) -> Tuple[pd.Series, pd.Series]:
    """Quick function to calculate Stochastic. Returns (slow_k, slow_d)."""
    indicator = Stochastic(k_period=k_period, d_period=d_period, smooth_k=smooth)
    return indicator.calculate_all(candles)


def momentum(candles: pd.DataFrame, period: int = 10) -> pd.Series:
    """Quick function to calculate Momentum."""
    indicator = MomentumOscillator(period=period)
    return indicator.calculate(candles).values


def roc(candles: pd.DataFrame, period: int = 10) -> pd.Series:
    """Quick function to calculate Rate of Change."""
    indicator = ROC(period=period)
    return indicator.calculate(candles).values


# =============================================================================
# PRE-CONFIGURED INDICATORS
# =============================================================================

RSI_14 = lambda: RSI(period=14)
RSI_7 = lambda: RSI(period=7)
MACD_DEFAULT = lambda: MACD(fast_period=12, slow_period=26, signal_period=9)
