"""
VWAP (Volume Weighted Average Price) Indicators.

Includes standard VWAP and 2-Day VWAP with slope analysis.
"""

import pandas as pd
import numpy as np
from typing import Optional, Tuple
from datetime import datetime, timedelta

from .base import BaseIndicator, IndicatorResult, slope


class VWAP(BaseIndicator):
    """
    Volume Weighted Average Price.

    VWAP = Cumulative(Typical Price * Volume) / Cumulative(Volume)
    Typical Price = (High + Low + Close) / 3

    Resets at session start (configurable).
    """

    def __init__(self, anchor: str = 'session'):
        """
        Initialize VWAP indicator.

        Args:
            anchor: Reset anchor - 'session' (daily), 'week', 'month', or 'none' (cumulative)
        """
        super().__init__("VWAP")
        self.anchor = anchor

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate VWAP values."""
        self.validate_input(candles, 1)

        # Calculate typical price
        typical_price = (candles['high'] + candles['low'] + candles['close']) / 3

        # Calculate cumulative values
        tp_volume = typical_price * candles['volume']

        if self.anchor == 'none':
            # Simple cumulative VWAP
            cum_tp_vol = tp_volume.cumsum()
            cum_vol = candles['volume'].cumsum()
        else:
            # Session-anchored VWAP (resets daily)
            # Group by date if we have timestamp
            if 'timestamp' in candles.columns:
                dates = pd.to_datetime(candles['timestamp']).dt.date
                cum_tp_vol = tp_volume.groupby(dates).cumsum()
                cum_vol = candles['volume'].groupby(dates).cumsum()
            else:
                # Fall back to cumulative
                cum_tp_vol = tp_volume.cumsum()
                cum_vol = candles['volume'].cumsum()

        # Calculate VWAP
        vwap = cum_tp_vol / cum_vol

        # Handle division by zero
        vwap = vwap.replace([np.inf, -np.inf], np.nan)

        return IndicatorResult(
            name=self.name,
            values=vwap,
            params={'anchor': self.anchor}
        )


class VWAP2Day(BaseIndicator):
    """
    2-Day VWAP with Slope Analysis.

    Calculates VWAP over 2 days worth of data with slope for trend detection.
    Critical for trading systems that use VWAP direction.
    """

    def __init__(self, slope_period: int = 5):
        """
        Initialize 2-Day VWAP.

        Args:
            slope_period: Period for slope calculation (default 5 candles)
        """
        super().__init__("VWAP_2D")
        self.slope_period = slope_period

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate 2-Day VWAP values."""
        self.validate_input(candles, 1)

        # Calculate typical price
        typical_price = (candles['high'] + candles['low'] + candles['close']) / 3
        tp_volume = typical_price * candles['volume']

        if 'timestamp' in candles.columns:
            timestamps = pd.to_datetime(candles['timestamp'])
            dates = timestamps.dt.date

            # Create rolling 2-day windows
            vwap_values = []

            for i, ts in enumerate(timestamps):
                # Get data from last 2 days
                cutoff = ts - timedelta(days=2)
                mask = (timestamps >= cutoff) & (timestamps <= ts)
                window_idx = candles.index[mask]

                if len(window_idx) > 0:
                    cum_tp_vol = tp_volume.loc[window_idx].sum()
                    cum_vol = candles['volume'].loc[window_idx].sum()
                    vwap_values.append(cum_tp_vol / cum_vol if cum_vol > 0 else np.nan)
                else:
                    vwap_values.append(np.nan)

            vwap = pd.Series(vwap_values, index=candles.index)
        else:
            # Without timestamps, use simple cumulative
            cum_tp_vol = tp_volume.cumsum()
            cum_vol = candles['volume'].cumsum()
            vwap = cum_tp_vol / cum_vol

        return IndicatorResult(
            name=self.name,
            values=vwap,
            params={'slope_period': self.slope_period}
        )

    def calculate_with_slope(self, candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
        """
        Calculate VWAP and its slope.

        Returns:
            Tuple of (vwap, slope)
        """
        vwap = self.calculate(candles).values
        vwap_slope = slope(vwap, self.slope_period)

        return vwap, vwap_slope


class VWAPBands(BaseIndicator):
    """
    VWAP with Standard Deviation Bands.

    Upper = VWAP + (StdDev * multiplier)
    Lower = VWAP - (StdDev * multiplier)
    """

    def __init__(self, std_multiplier: float = 2.0, anchor: str = 'session'):
        """
        Initialize VWAP Bands.

        Args:
            std_multiplier: Standard deviation multiplier for bands
            anchor: Reset anchor
        """
        super().__init__("VWAP_Bands")
        self.std_multiplier = std_multiplier
        self.anchor = anchor

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate VWAP (middle band)."""
        vwap_indicator = VWAP(anchor=self.anchor)
        return vwap_indicator.calculate(candles)

    def calculate_all(self, candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """
        Calculate VWAP and bands.

        Returns:
            Tuple of (upper, vwap, lower)
        """
        self.validate_input(candles, 1)

        # Calculate typical price
        typical_price = (candles['high'] + candles['low'] + candles['close']) / 3
        tp_volume = typical_price * candles['volume']

        # Simple cumulative VWAP
        cum_tp_vol = tp_volume.cumsum()
        cum_vol = candles['volume'].cumsum()
        vwap = cum_tp_vol / cum_vol

        # Calculate standard deviation of typical price from VWAP
        variance = ((typical_price - vwap) ** 2 * candles['volume']).cumsum() / cum_vol
        std_dev = np.sqrt(variance)

        upper = vwap + (std_dev * self.std_multiplier)
        lower = vwap - (std_dev * self.std_multiplier)

        return upper, vwap, lower


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def vwap(candles: pd.DataFrame, anchor: str = 'session') -> pd.Series:
    """Quick function to calculate VWAP."""
    indicator = VWAP(anchor=anchor)
    return indicator.calculate(candles).values


def vwap_2day(candles: pd.DataFrame, slope_period: int = 5) -> pd.Series:
    """Quick function to calculate 2-Day VWAP."""
    indicator = VWAP2Day(slope_period=slope_period)
    return indicator.calculate(candles).values


def vwap_with_slope(candles: pd.DataFrame, slope_period: int = 5) -> Tuple[pd.Series, pd.Series]:
    """Quick function to calculate 2-Day VWAP with slope. Returns (vwap, slope)."""
    indicator = VWAP2Day(slope_period=slope_period)
    return indicator.calculate_with_slope(candles)


def vwap_bands(candles: pd.DataFrame, std_mult: float = 2.0) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Quick function to calculate VWAP bands. Returns (upper, vwap, lower)."""
    indicator = VWAPBands(std_multiplier=std_mult)
    return indicator.calculate_all(candles)


# =============================================================================
# PRE-CONFIGURED INDICATORS
# =============================================================================

VWAP_SESSION = lambda: VWAP(anchor='session')
VWAP_CUMULATIVE = lambda: VWAP(anchor='none')
VWAP_2DAY = lambda: VWAP2Day(slope_period=5)
