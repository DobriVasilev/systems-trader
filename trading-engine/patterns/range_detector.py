"""
Range Detection.

Identifies trading ranges and calculates key levels:
- Range high/low
- Fibonacci levels (especially 75% for mean reversion)
- Touch counts
- Breakout/breakdown detection
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from enum import Enum

from .swings import SwingDetector, SwingPoint, SwingType


class RangeStatus(Enum):
    """Current status of a range."""
    FORMING = "forming"        # Not enough touches yet
    CONFIRMED = "confirmed"    # Valid range with touches
    BROKEN_UP = "broken_up"    # Broke above range high
    BROKEN_DOWN = "broken_down"  # Broke below range low


@dataclass
class FibLevels:
    """
    Fibonacci levels for a range.

    Levels are calculated from LOW to HIGH:
    - 0% = range low
    - 100% = range high
    - 50% = midpoint
    - 75% = mean reversion entry zone (for longs in uptrend)
    - 25% = mean reversion entry zone (for shorts in downtrend)
    """
    range_low: float
    range_high: float

    @property
    def fib_0(self) -> float:
        """0% level (range low)."""
        return self.range_low

    @property
    def fib_25(self) -> float:
        """25% level."""
        return self.range_low + (self.range_high - self.range_low) * 0.25

    @property
    def fib_50(self) -> float:
        """50% level (midpoint)."""
        return self.range_low + (self.range_high - self.range_low) * 0.50

    @property
    def fib_75(self) -> float:
        """75% level (key mean reversion zone)."""
        return self.range_low + (self.range_high - self.range_low) * 0.75

    @property
    def fib_100(self) -> float:
        """100% level (range high)."""
        return self.range_high

    def get_level(self, pct: float) -> float:
        """Get any Fib level by percentage (0-100)."""
        return self.range_low + (self.range_high - self.range_low) * (pct / 100)


@dataclass
class Range:
    """
    Represents a detected trading range.

    Attributes:
        high: Range high price
        low: Range low price
        start_index: Index where range started
        end_index: Index where range ended (or current if active)
        high_touches: Number of times price touched range high
        low_touches: Number of times price touched range low
        status: Current range status
        fib: Fibonacci levels
    """
    high: float
    low: float
    start_index: int
    end_index: Optional[int] = None
    high_touches: int = 0
    low_touches: int = 0
    status: RangeStatus = RangeStatus.FORMING
    high_swing: Optional[SwingPoint] = None
    low_swing: Optional[SwingPoint] = None

    @property
    def fib(self) -> FibLevels:
        """Get Fibonacci levels for this range."""
        return FibLevels(self.low, self.high)

    @property
    def height(self) -> float:
        """Range height in price."""
        return self.high - self.low

    @property
    def height_percent(self) -> float:
        """Range height as percentage."""
        return (self.height / self.low) * 100

    @property
    def midpoint(self) -> float:
        """Range midpoint."""
        return (self.high + self.low) / 2

    @property
    def total_touches(self) -> int:
        """Total touches of range boundaries."""
        return self.high_touches + self.low_touches

    def is_valid(self, min_touches: int = 3) -> bool:
        """Check if range is valid (enough touches)."""
        return self.total_touches >= min_touches

    def is_active(self) -> bool:
        """Check if range is still active (not broken)."""
        return self.status in [RangeStatus.FORMING, RangeStatus.CONFIRMED]

    def price_in_range(self, price: float) -> bool:
        """Check if price is within range."""
        return self.low <= price <= self.high

    def at_75_level(self, price: float, tolerance_pct: float = 0.5) -> bool:
        """Check if price is at 75% Fib level."""
        target = self.fib.fib_75
        tolerance = self.height * (tolerance_pct / 100)
        return abs(price - target) <= tolerance

    def at_25_level(self, price: float, tolerance_pct: float = 0.5) -> bool:
        """Check if price is at 25% Fib level."""
        target = self.fib.fib_25
        tolerance = self.height * (tolerance_pct / 100)
        return abs(price - target) <= tolerance


class RangeDetector:
    """
    Detects trading ranges in price data.

    A range is formed when:
    1. Price makes a swing high and swing low
    2. Price returns to test those levels multiple times
    3. Range is confirmed when it has minimum touches

    Uses configurable touch tolerance (how close price must get to level).
    """

    def __init__(
        self,
        touch_tolerance_pct: float = 0.3,
        min_touches: int = 3,
        min_range_bars: int = 10,
        max_range_bars: int = 100,
        swing_detector: Optional[SwingDetector] = None,
    ):
        """
        Initialize Range Detector.

        Args:
            touch_tolerance_pct: How close price must be to level (% of range)
            min_touches: Minimum touches to confirm range
            min_range_bars: Minimum bars for valid range
            max_range_bars: Maximum bars before range expires
            swing_detector: SwingDetector instance
        """
        self.touch_tolerance_pct = touch_tolerance_pct
        self.min_touches = min_touches
        self.min_range_bars = min_range_bars
        self.max_range_bars = max_range_bars
        self.swing_detector = swing_detector or SwingDetector()

    def detect_ranges(self, candles: pd.DataFrame) -> List[Range]:
        """
        Detect all ranges in the data.

        Args:
            candles: OHLCV DataFrame

        Returns:
            List of Range objects
        """
        # Get swing points
        swings = self.swing_detector.detect_major_swings(candles)

        if len(swings) < 2:
            return []

        ranges = []
        high_swings = [s for s in swings if s.is_high()]
        low_swings = [s for s in swings if s.is_low()]

        # Find potential ranges (swing high followed by swing low or vice versa)
        for i, swing in enumerate(swings[:-1]):
            if swing.is_high():
                # Find next swing low
                next_lows = [s for s in low_swings if s.index > swing.index]
                if next_lows:
                    low_swing = next_lows[0]
                    range_obj = self._create_range(candles, swing, low_swing)
                    if range_obj and range_obj.is_valid(self.min_touches):
                        ranges.append(range_obj)

        return ranges

    def detect_current_range(self, candles: pd.DataFrame) -> Optional[Range]:
        """
        Detect the most recent active range.

        Returns:
            Range object if active range exists, None otherwise
        """
        ranges = self.detect_ranges(candles)

        # Find most recent range that could still be active
        active_ranges = [r for r in ranges if r.is_active()]

        if not active_ranges:
            return None

        # Return most recent
        return active_ranges[-1]

    def _create_range(
        self,
        candles: pd.DataFrame,
        high_swing: SwingPoint,
        low_swing: SwingPoint
    ) -> Optional[Range]:
        """
        Create a Range from two swing points.

        Counts touches of high and low within the range period.
        """
        start_idx = min(high_swing.index, low_swing.index)
        end_idx = max(high_swing.index, low_swing.index)

        # Check minimum bars
        if end_idx - start_idx < self.min_range_bars:
            return None

        range_high = high_swing.price
        range_low = low_swing.price
        range_height = range_high - range_low

        # Tolerance for touch detection
        tolerance = range_height * (self.touch_tolerance_pct / 100)

        # Count touches looking forward from range start
        high_touches = 0
        low_touches = 0

        # Look at bars after both swings are established
        for i in range(end_idx, min(len(candles), end_idx + self.max_range_bars)):
            bar_high = candles['high'].iloc[i]
            bar_low = candles['low'].iloc[i]

            # Check high touch (price gets close to range high)
            if bar_high >= range_high - tolerance:
                high_touches += 1

            # Check low touch (price gets close to range low)
            if bar_low <= range_low + tolerance:
                low_touches += 1

            # Check for breakout
            if bar_high > range_high + tolerance:
                return Range(
                    high=range_high,
                    low=range_low,
                    start_index=start_idx,
                    end_index=i,
                    high_touches=high_touches,
                    low_touches=low_touches,
                    status=RangeStatus.BROKEN_UP,
                    high_swing=high_swing,
                    low_swing=low_swing,
                )

            if bar_low < range_low - tolerance:
                return Range(
                    high=range_high,
                    low=range_low,
                    start_index=start_idx,
                    end_index=i,
                    high_touches=high_touches,
                    low_touches=low_touches,
                    status=RangeStatus.BROKEN_DOWN,
                    high_swing=high_swing,
                    low_swing=low_swing,
                )

        # Range still active
        status = RangeStatus.CONFIRMED if high_touches + low_touches >= self.min_touches else RangeStatus.FORMING

        return Range(
            high=range_high,
            low=range_low,
            start_index=start_idx,
            end_index=len(candles) - 1,
            high_touches=high_touches,
            low_touches=low_touches,
            status=status,
            high_swing=high_swing,
            low_swing=low_swing,
        )

    def is_at_75_level(
        self,
        candles: pd.DataFrame,
        tolerance_pct: float = 0.5
    ) -> Tuple[bool, Optional[Range]]:
        """
        Check if current price is at 75% Fib level of active range.

        Critical for mean reversion entries.

        Returns:
            Tuple of (is_at_level, range_if_found)
        """
        current_range = self.detect_current_range(candles)

        if not current_range:
            return False, None

        current_close = candles['close'].iloc[-1]
        is_at_level = current_range.at_75_level(current_close, tolerance_pct)

        return is_at_level, current_range

    def is_at_25_level(
        self,
        candles: pd.DataFrame,
        tolerance_pct: float = 0.5
    ) -> Tuple[bool, Optional[Range]]:
        """
        Check if current price is at 25% Fib level of active range.

        For short entries in downtrend.

        Returns:
            Tuple of (is_at_level, range_if_found)
        """
        current_range = self.detect_current_range(candles)

        if not current_range:
            return False, None

        current_close = candles['close'].iloc[-1]
        is_at_level = current_range.at_25_level(current_close, tolerance_pct)

        return is_at_level, current_range


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def detect_ranges(candles: pd.DataFrame, min_touches: int = 3) -> List[Range]:
    """Quick function to detect ranges."""
    detector = RangeDetector(min_touches=min_touches)
    return detector.detect_ranges(candles)


def get_current_range(candles: pd.DataFrame) -> Optional[Range]:
    """Quick function to get current active range."""
    detector = RangeDetector()
    return detector.detect_current_range(candles)


def is_at_75_fib(candles: pd.DataFrame) -> bool:
    """Quick function to check if at 75% Fib level."""
    detector = RangeDetector()
    at_level, _ = detector.is_at_75_level(candles)
    return at_level


def get_fib_levels(range_high: float, range_low: float) -> FibLevels:
    """Quick function to calculate Fib levels."""
    return FibLevels(range_low, range_high)


# =============================================================================
# PRE-CONFIGURED DETECTORS
# =============================================================================

RANGE_DETECTOR_DEFAULT = lambda: RangeDetector(touch_tolerance_pct=0.3, min_touches=3)
RANGE_DETECTOR_STRICT = lambda: RangeDetector(touch_tolerance_pct=0.2, min_touches=4)
RANGE_DETECTOR_LOOSE = lambda: RangeDetector(touch_tolerance_pct=0.5, min_touches=2)
