"""
Volume Indicators.

Volume analysis indicators for trade confirmation and liquidity detection.
"""

import pandas as pd
import numpy as np
from typing import Optional, Tuple

from .base import BaseIndicator, IndicatorResult


class VolumeSMA(BaseIndicator):
    """
    Volume Simple Moving Average.

    Used to determine if current volume is above/below average.
    """

    def __init__(self, period: int = 20):
        """
        Initialize Volume SMA.

        Args:
            period: Lookback period (default 20)
        """
        super().__init__(f"VolSMA_{period}")
        self.period = period

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate Volume SMA."""
        self.validate_input(candles, self.period)

        vol_sma = candles['volume'].rolling(window=self.period).mean()

        return IndicatorResult(
            name=self.name,
            values=vol_sma,
            params={'period': self.period}
        )


class VolumeSpike(BaseIndicator):
    """
    Volume Spike Detector.

    Identifies when volume exceeds a multiple of the average.
    Critical for liquidity events and breakout confirmation.
    """

    def __init__(self, period: int = 20, threshold: float = 2.0):
        """
        Initialize Volume Spike detector.

        Args:
            period: Lookback period for average
            threshold: Multiplier for spike detection (e.g., 2.0 = 2x average)
        """
        super().__init__(f"VolSpike_{period}")
        self.period = period
        self.threshold = threshold

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate volume ratio to average.

        Returns ratio (volume / avg_volume). Values > threshold indicate spike.
        """
        self.validate_input(candles, self.period)

        vol_sma = candles['volume'].rolling(window=self.period).mean()
        volume_ratio = candles['volume'] / vol_sma

        return IndicatorResult(
            name=self.name,
            values=volume_ratio,
            params={'period': self.period, 'threshold': self.threshold}
        )

    def detect_spikes(self, candles: pd.DataFrame) -> pd.Series:
        """
        Detect volume spikes.

        Returns boolean Series where True = spike detected.
        """
        vol_ratio = self.calculate(candles).values
        return vol_ratio >= self.threshold


class CVD(BaseIndicator):
    """
    Cumulative Volume Delta.

    Tracks buying vs selling pressure based on price direction.
    Positive = more buying, Negative = more selling.
    """

    def __init__(self, reset_period: Optional[int] = None):
        """
        Initialize CVD.

        Args:
            reset_period: Optional period to reset cumulation (None = never reset)
        """
        super().__init__("CVD")
        self.reset_period = reset_period

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate CVD values."""
        self.validate_input(candles, 2)

        close = candles['close']
        volume = candles['volume']

        # Determine direction: close > previous close = buy, else sell
        direction = np.where(close > close.shift(1), 1, -1)
        direction = pd.Series(direction, index=candles.index)

        # Volume delta
        vol_delta = volume * direction

        # Cumulative
        if self.reset_period:
            # Rolling window cumulative
            cvd = vol_delta.rolling(window=self.reset_period).sum()
        else:
            # Simple cumulative
            cvd = vol_delta.cumsum()

        return IndicatorResult(
            name=self.name,
            values=cvd,
            params={'reset_period': self.reset_period}
        )


class OBV(BaseIndicator):
    """
    On-Balance Volume.

    Classic volume indicator: adds volume on up days, subtracts on down days.
    """

    def __init__(self):
        super().__init__("OBV")

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate OBV values."""
        self.validate_input(candles, 2)

        close = candles['close']
        volume = candles['volume']

        # Direction based on close vs previous close
        direction = np.sign(close.diff())

        # OBV = cumulative sum of signed volume
        obv = (volume * direction).fillna(0).cumsum()

        return IndicatorResult(
            name=self.name,
            values=obv,
            params={}
        )


class VolumeProfile(BaseIndicator):
    """
    Volume Profile (Price by Volume).

    Calculates volume distribution across price levels.
    Identifies Point of Control (POC) and Value Area.
    """

    def __init__(self, num_bins: int = 50, value_area_pct: float = 0.70):
        """
        Initialize Volume Profile.

        Args:
            num_bins: Number of price bins
            value_area_pct: Percentage of volume for value area (default 70%)
        """
        super().__init__("VolProfile")
        self.num_bins = num_bins
        self.value_area_pct = value_area_pct

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate volume profile.

        Returns the Point of Control (POC) price level.
        """
        self.validate_input(candles, 1)

        # Get price range
        price_min = candles['low'].min()
        price_max = candles['high'].max()

        # Create bins
        bins = np.linspace(price_min, price_max, self.num_bins + 1)
        bin_centers = (bins[:-1] + bins[1:]) / 2

        # Assign each candle's typical price to a bin
        typical_price = (candles['high'] + candles['low'] + candles['close']) / 3
        bin_idx = np.digitize(typical_price, bins) - 1
        bin_idx = np.clip(bin_idx, 0, self.num_bins - 1)

        # Accumulate volume per bin
        volume_per_bin = np.zeros(self.num_bins)
        for i, vol in zip(bin_idx, candles['volume']):
            volume_per_bin[i] += vol

        # Find POC (bin with highest volume)
        poc_idx = np.argmax(volume_per_bin)
        poc_price = bin_centers[poc_idx]

        # Return POC as constant series (for consistency with other indicators)
        poc_series = pd.Series(poc_price, index=candles.index)

        return IndicatorResult(
            name=self.name,
            values=poc_series,
            params={'num_bins': self.num_bins, 'value_area_pct': self.value_area_pct}
        )

    def calculate_all(self, candles: pd.DataFrame) -> dict:
        """
        Calculate full volume profile.

        Returns:
            Dict with 'poc', 'vah' (value area high), 'val' (value area low),
            'bins', 'volumes'
        """
        self.validate_input(candles, 1)

        # Get price range
        price_min = candles['low'].min()
        price_max = candles['high'].max()

        # Create bins
        bins = np.linspace(price_min, price_max, self.num_bins + 1)
        bin_centers = (bins[:-1] + bins[1:]) / 2

        # Assign each candle to a bin
        typical_price = (candles['high'] + candles['low'] + candles['close']) / 3
        bin_idx = np.digitize(typical_price, bins) - 1
        bin_idx = np.clip(bin_idx, 0, self.num_bins - 1)

        # Accumulate volume per bin
        volume_per_bin = np.zeros(self.num_bins)
        for i, vol in zip(bin_idx, candles['volume']):
            volume_per_bin[i] += vol

        # Find POC
        poc_idx = np.argmax(volume_per_bin)
        poc = bin_centers[poc_idx]

        # Calculate Value Area
        total_volume = volume_per_bin.sum()
        target_volume = total_volume * self.value_area_pct

        # Start from POC and expand outward
        cumulative = volume_per_bin[poc_idx]
        low_idx = poc_idx
        high_idx = poc_idx

        while cumulative < target_volume and (low_idx > 0 or high_idx < self.num_bins - 1):
            # Look at volume on each side
            vol_below = volume_per_bin[low_idx - 1] if low_idx > 0 else 0
            vol_above = volume_per_bin[high_idx + 1] if high_idx < self.num_bins - 1 else 0

            # Expand to side with more volume
            if vol_below >= vol_above and low_idx > 0:
                low_idx -= 1
                cumulative += vol_below
            elif high_idx < self.num_bins - 1:
                high_idx += 1
                cumulative += vol_above
            else:
                low_idx -= 1
                cumulative += vol_below

        vah = bin_centers[high_idx]  # Value Area High
        val = bin_centers[low_idx]   # Value Area Low

        return {
            'poc': poc,
            'vah': vah,
            'val': val,
            'bins': bin_centers,
            'volumes': volume_per_bin
        }


class RelativeVolume(BaseIndicator):
    """
    Relative Volume (RVOL).

    Current volume as a ratio of average volume.
    """

    def __init__(self, period: int = 20):
        super().__init__(f"RVOL_{period}")
        self.period = period

    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """Calculate relative volume."""
        self.validate_input(candles, self.period)

        avg_vol = candles['volume'].rolling(window=self.period).mean()
        rvol = candles['volume'] / avg_vol

        return IndicatorResult(
            name=self.name,
            values=rvol,
            params={'period': self.period}
        )


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def volume_sma(candles: pd.DataFrame, period: int = 20) -> pd.Series:
    """Quick function to calculate Volume SMA."""
    indicator = VolumeSMA(period=period)
    return indicator.calculate(candles).values


def volume_spike(candles: pd.DataFrame, period: int = 20, threshold: float = 2.0) -> pd.Series:
    """Quick function to detect volume spikes. Returns boolean Series."""
    indicator = VolumeSpike(period=period, threshold=threshold)
    return indicator.detect_spikes(candles)


def volume_ratio(candles: pd.DataFrame, period: int = 20) -> pd.Series:
    """Quick function to get volume ratio (current / average)."""
    indicator = VolumeSpike(period=period)
    return indicator.calculate(candles).values


def cvd(candles: pd.DataFrame, reset_period: Optional[int] = None) -> pd.Series:
    """Quick function to calculate CVD."""
    indicator = CVD(reset_period=reset_period)
    return indicator.calculate(candles).values


def obv(candles: pd.DataFrame) -> pd.Series:
    """Quick function to calculate OBV."""
    indicator = OBV()
    return indicator.calculate(candles).values


def relative_volume(candles: pd.DataFrame, period: int = 20) -> pd.Series:
    """Quick function to calculate relative volume."""
    indicator = RelativeVolume(period=period)
    return indicator.calculate(candles).values


def volume_profile(candles: pd.DataFrame, num_bins: int = 50) -> dict:
    """Quick function to calculate volume profile. Returns dict with poc, vah, val."""
    indicator = VolumeProfile(num_bins=num_bins)
    return indicator.calculate_all(candles)


# =============================================================================
# PRE-CONFIGURED INDICATORS
# =============================================================================

VOL_SMA_20 = lambda: VolumeSMA(period=20)
VOL_SPIKE_2X = lambda: VolumeSpike(period=20, threshold=2.0)
VOL_SPIKE_3X = lambda: VolumeSpike(period=20, threshold=3.0)
CVD_ROLLING = lambda: CVD(reset_period=50)
