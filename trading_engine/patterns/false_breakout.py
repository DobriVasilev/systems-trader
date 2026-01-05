"""
False Breakout Detection.

Identifies false breakouts (fakeouts) where price briefly breaks a level
then reverses back.

This is a high-probability pattern when:
- Price breaks above/below a key level
- Quickly reverses back inside
- Often accompanied by volume spike (liquidity grab)
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple
from enum import Enum

from .swings import SwingDetector, SwingPoint
from .range_detector import RangeDetector, Range


class FBType(Enum):
    """Type of false breakout."""
    FB_ABOVE = "fb_above"  # False break above level (bearish signal)
    FB_BELOW = "fb_below"  # False break below level (bullish signal)


@dataclass
class FalseBreakout:
    """
    Represents a detected false breakout.

    Attributes:
        fb_type: Type (above or below)
        level_price: The level that was falsely broken
        break_index: Bar where break occurred
        break_high: Highest price during false break (for FB above)
        break_low: Lowest price during false break (for FB below)
        reversal_index: Bar where reversal was confirmed
        reversal_close: Close price confirming reversal
        wick_size: Size of the wick beyond the level
        volume_spike: Whether volume spiked during break
    """
    fb_type: FBType
    level_price: float
    break_index: int
    break_high: Optional[float] = None
    break_low: Optional[float] = None
    reversal_index: Optional[int] = None
    reversal_close: Optional[float] = None
    wick_size: float = 0.0
    volume_spike: bool = False
    timestamp: Optional[pd.Timestamp] = None

    def is_bullish(self) -> bool:
        """FB below is bullish (price rejected lower, going up)."""
        return self.fb_type == FBType.FB_BELOW

    def is_bearish(self) -> bool:
        """FB above is bearish (price rejected higher, going down)."""
        return self.fb_type == FBType.FB_ABOVE

    @property
    def entry_direction(self) -> str:
        """Suggested entry direction based on FB type."""
        return "long" if self.is_bullish() else "short"


class FalseBreakoutDetector:
    """
    Detects false breakouts at key levels.

    Detection logic:
    1. Price breaks above/below a level (swing high/low, range boundary, etc.)
    2. Close is back inside the level within N bars
    3. Optionally: volume spike during break (liquidity grab)

    The faster the reversal, the stronger the signal.
    """

    def __init__(
        self,
        max_break_bars: int = 3,
        min_wick_atr_mult: float = 0.3,
        require_volume_spike: bool = False,
        volume_spike_mult: float = 1.5,
        swing_detector: Optional[SwingDetector] = None,
    ):
        """
        Initialize False Breakout Detector.

        Args:
            max_break_bars: Maximum bars price can stay beyond level
            min_wick_atr_mult: Minimum wick size as ATR multiple
            require_volume_spike: Require volume spike for valid FB
            volume_spike_mult: Volume multiplier for spike detection
            swing_detector: SwingDetector instance
        """
        self.max_break_bars = max_break_bars
        self.min_wick_atr_mult = min_wick_atr_mult
        self.require_volume_spike = require_volume_spike
        self.volume_spike_mult = volume_spike_mult
        self.swing_detector = swing_detector or SwingDetector()

    def detect_at_swing_levels(self, candles: pd.DataFrame) -> List[FalseBreakout]:
        """
        Detect false breakouts at swing high/low levels.

        Returns:
            List of FalseBreakout objects
        """
        swings = self.swing_detector.detect_major_swings(candles)
        false_breakouts = []

        # Get ATR for wick size validation
        atr = self._calculate_atr(candles, 14)

        for swing in swings:
            if swing.is_high():
                fb = self._detect_fb_above(candles, swing.price, swing.index, atr)
                if fb:
                    false_breakouts.append(fb)
            else:
                fb = self._detect_fb_below(candles, swing.price, swing.index, atr)
                if fb:
                    false_breakouts.append(fb)

        false_breakouts.sort(key=lambda x: x.break_index)
        return false_breakouts

    def detect_at_range_levels(
        self,
        candles: pd.DataFrame,
        range_obj: Range
    ) -> List[FalseBreakout]:
        """
        Detect false breakouts at range high/low.

        Returns:
            List of FalseBreakout objects
        """
        atr = self._calculate_atr(candles, 14)
        false_breakouts = []

        # Check for FB above range high
        fb_above = self._detect_fb_above(candles, range_obj.high, range_obj.start_index, atr)
        if fb_above:
            false_breakouts.append(fb_above)

        # Check for FB below range low
        fb_below = self._detect_fb_below(candles, range_obj.low, range_obj.start_index, atr)
        if fb_below:
            false_breakouts.append(fb_below)

        return false_breakouts

    def detect_at_level(
        self,
        candles: pd.DataFrame,
        level: float,
        start_idx: int = 0
    ) -> Optional[FalseBreakout]:
        """
        Detect false breakout at a specific price level.

        Args:
            candles: OHLCV DataFrame
            level: Price level to monitor
            start_idx: Index to start looking from

        Returns:
            FalseBreakout if detected, None otherwise
        """
        atr = self._calculate_atr(candles, 14)

        # Try both directions
        fb_above = self._detect_fb_above(candles, level, start_idx, atr)
        if fb_above:
            return fb_above

        fb_below = self._detect_fb_below(candles, level, start_idx, atr)
        return fb_below

    def _detect_fb_above(
        self,
        candles: pd.DataFrame,
        level: float,
        start_idx: int,
        atr: pd.Series
    ) -> Optional[FalseBreakout]:
        """Detect false breakout above a level."""
        for i in range(start_idx + 1, len(candles) - 1):
            high = candles['high'].iloc[i]
            close = candles['close'].iloc[i]

            # Check for break above
            if high > level and close <= level:
                # Immediate rejection on same bar (classic FB)
                wick_size = high - level
                min_wick = atr.iloc[i] * self.min_wick_atr_mult if i < len(atr) else 0

                if wick_size >= min_wick:
                    # Check volume spike
                    vol_spike = self._check_volume_spike(candles, i)

                    if not self.require_volume_spike or vol_spike:
                        timestamp = None
                        if 'timestamp' in candles.columns:
                            timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                        return FalseBreakout(
                            fb_type=FBType.FB_ABOVE,
                            level_price=level,
                            break_index=i,
                            break_high=high,
                            reversal_index=i,
                            reversal_close=close,
                            wick_size=wick_size,
                            volume_spike=vol_spike,
                            timestamp=timestamp,
                        )

            # Check for break that takes multiple bars to reverse
            elif high > level:
                # Price broke above, look for close back below within max_break_bars
                for j in range(i + 1, min(i + self.max_break_bars + 1, len(candles))):
                    if candles['close'].iloc[j] <= level:
                        # Found reversal
                        wick_size = max(candles['high'].iloc[i:j+1]) - level
                        min_wick = atr.iloc[i] * self.min_wick_atr_mult if i < len(atr) else 0

                        if wick_size >= min_wick:
                            vol_spike = self._check_volume_spike(candles, i)

                            if not self.require_volume_spike or vol_spike:
                                timestamp = None
                                if 'timestamp' in candles.columns:
                                    timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                                return FalseBreakout(
                                    fb_type=FBType.FB_ABOVE,
                                    level_price=level,
                                    break_index=i,
                                    break_high=max(candles['high'].iloc[i:j+1]),
                                    reversal_index=j,
                                    reversal_close=candles['close'].iloc[j],
                                    wick_size=wick_size,
                                    volume_spike=vol_spike,
                                    timestamp=timestamp,
                                )
                        break

        return None

    def _detect_fb_below(
        self,
        candles: pd.DataFrame,
        level: float,
        start_idx: int,
        atr: pd.Series
    ) -> Optional[FalseBreakout]:
        """Detect false breakout below a level."""
        for i in range(start_idx + 1, len(candles) - 1):
            low = candles['low'].iloc[i]
            close = candles['close'].iloc[i]

            # Check for break below with immediate rejection
            if low < level and close >= level:
                wick_size = level - low
                min_wick = atr.iloc[i] * self.min_wick_atr_mult if i < len(atr) else 0

                if wick_size >= min_wick:
                    vol_spike = self._check_volume_spike(candles, i)

                    if not self.require_volume_spike or vol_spike:
                        timestamp = None
                        if 'timestamp' in candles.columns:
                            timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                        return FalseBreakout(
                            fb_type=FBType.FB_BELOW,
                            level_price=level,
                            break_index=i,
                            break_low=low,
                            reversal_index=i,
                            reversal_close=close,
                            wick_size=wick_size,
                            volume_spike=vol_spike,
                            timestamp=timestamp,
                        )

            # Multi-bar false breakout
            elif low < level:
                for j in range(i + 1, min(i + self.max_break_bars + 1, len(candles))):
                    if candles['close'].iloc[j] >= level:
                        wick_size = level - min(candles['low'].iloc[i:j+1])
                        min_wick = atr.iloc[i] * self.min_wick_atr_mult if i < len(atr) else 0

                        if wick_size >= min_wick:
                            vol_spike = self._check_volume_spike(candles, i)

                            if not self.require_volume_spike or vol_spike:
                                timestamp = None
                                if 'timestamp' in candles.columns:
                                    timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                                return FalseBreakout(
                                    fb_type=FBType.FB_BELOW,
                                    level_price=level,
                                    break_index=i,
                                    break_low=min(candles['low'].iloc[i:j+1]),
                                    reversal_index=j,
                                    reversal_close=candles['close'].iloc[j],
                                    wick_size=wick_size,
                                    volume_spike=vol_spike,
                                    timestamp=timestamp,
                                )
                        break

        return None

    def _check_volume_spike(self, candles: pd.DataFrame, idx: int, period: int = 20) -> bool:
        """Check if volume spiked at the given index."""
        if idx < period:
            return False

        avg_vol = candles['volume'].iloc[idx-period:idx].mean()
        current_vol = candles['volume'].iloc[idx]

        return current_vol >= avg_vol * self.volume_spike_mult

    def _calculate_atr(self, candles: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate ATR for the candles."""
        high = candles['high']
        low = candles['low']
        close = candles['close']

        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))

        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.ewm(span=period, adjust=False).mean()

        return atr


class LiquiditySweepDetector:
    """
    Detects liquidity sweeps (stop hunts).

    A liquidity sweep occurs when:
    1. Price moves beyond a key level to trigger stops
    2. Quickly reverses to trap traders on wrong side
    3. Often shows volume spike (stops being hit)

    Very similar to false breakout but specifically targets liquidity zones.
    """

    def __init__(
        self,
        sweep_depth_atr: float = 0.5,
        max_sweep_bars: int = 3,
        require_volume: bool = True,
        swing_detector: Optional[SwingDetector] = None,
    ):
        """
        Initialize Liquidity Sweep Detector.

        Args:
            sweep_depth_atr: Minimum sweep depth as ATR multiple
            max_sweep_bars: Maximum bars for sweep
            require_volume: Require volume spike
            swing_detector: SwingDetector instance
        """
        self.sweep_depth_atr = sweep_depth_atr
        self.max_sweep_bars = max_sweep_bars
        self.require_volume = require_volume
        self.swing_detector = swing_detector or SwingDetector()
        self.fb_detector = FalseBreakoutDetector(
            max_break_bars=max_sweep_bars,
            min_wick_atr_mult=sweep_depth_atr,
            require_volume_spike=require_volume,
        )

    def detect_sweeps(self, candles: pd.DataFrame) -> List[FalseBreakout]:
        """
        Detect liquidity sweeps at swing levels.

        Uses FalseBreakoutDetector internally as sweeps are essentially
        false breakouts at liquidity zones.
        """
        return self.fb_detector.detect_at_swing_levels(candles)

    def detect_sweep_of_lows(self, candles: pd.DataFrame) -> List[FalseBreakout]:
        """Detect sweeps of swing lows (bullish sweeps)."""
        all_sweeps = self.detect_sweeps(candles)
        return [s for s in all_sweeps if s.is_bullish()]

    def detect_sweep_of_highs(self, candles: pd.DataFrame) -> List[FalseBreakout]:
        """Detect sweeps of swing highs (bearish sweeps)."""
        all_sweeps = self.detect_sweeps(candles)
        return [s for s in all_sweeps if s.is_bearish()]


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def detect_false_breakouts(candles: pd.DataFrame) -> List[FalseBreakout]:
    """Quick function to detect false breakouts at swing levels."""
    detector = FalseBreakoutDetector()
    return detector.detect_at_swing_levels(candles)


def detect_fb_at_level(candles: pd.DataFrame, level: float) -> Optional[FalseBreakout]:
    """Quick function to detect FB at specific level."""
    detector = FalseBreakoutDetector()
    return detector.detect_at_level(candles, level)


def detect_liquidity_sweeps(candles: pd.DataFrame) -> List[FalseBreakout]:
    """Quick function to detect liquidity sweeps."""
    detector = LiquiditySweepDetector()
    return detector.detect_sweeps(candles)


def is_false_breakout(
    candles: pd.DataFrame,
    level: float,
    lookback: int = 5
) -> bool:
    """
    Quick check if recent price action is a false breakout of level.

    Args:
        candles: OHLCV DataFrame
        level: Price level to check
        lookback: Bars to look back

    Returns:
        True if false breakout detected
    """
    if len(candles) < lookback:
        return False

    detector = FalseBreakoutDetector(max_break_bars=lookback)
    fb = detector.detect_at_level(candles.iloc[-lookback-10:], level, 0)
    return fb is not None


# =============================================================================
# PRE-CONFIGURED DETECTORS
# =============================================================================

FB_DETECTOR_DEFAULT = lambda: FalseBreakoutDetector(max_break_bars=3, min_wick_atr_mult=0.3)
FB_DETECTOR_STRICT = lambda: FalseBreakoutDetector(max_break_bars=2, min_wick_atr_mult=0.5, require_volume_spike=True)
LIQUIDITY_SWEEP_DEFAULT = lambda: LiquiditySweepDetector(sweep_depth_atr=0.5, require_volume=True)
