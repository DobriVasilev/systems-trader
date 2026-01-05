"""
Swing Point Detection.

Swings are confirmed by BREAKS, not just local peaks.

Logic:
- A swing LOW is confirmed when price breaks ABOVE the previous swing high
- A swing HIGH is confirmed when price breaks BELOW the previous swing low

This matches how traders actually identify swings - you only know it was
a swing after price has moved away from it.
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple
from enum import Enum


class SwingType(Enum):
    """Type of swing point."""
    SWING_HIGH = "swing_high"
    SWING_LOW = "swing_low"


class StructureType(Enum):
    """Market structure classification."""
    HIGHER_HIGH = "HH"
    HIGHER_LOW = "HL"
    LOWER_HIGH = "LH"
    LOWER_LOW = "LL"


@dataclass
class SwingPoint:
    """
    Represents a confirmed swing point.

    Attributes:
        index: DataFrame index where the swing occurred
        price: Price level of the swing
        swing_type: SWING_HIGH or SWING_LOW
        confirmed_at_index: Index where swing was confirmed (break occurred)
        structure: HH/HL/LH/LL classification
    """
    index: int
    price: float
    swing_type: SwingType
    confirmed_at_index: int
    timestamp: Optional[pd.Timestamp] = None
    confirmed_at_timestamp: Optional[pd.Timestamp] = None
    structure: Optional[StructureType] = None

    def is_high(self) -> bool:
        return self.swing_type == SwingType.SWING_HIGH

    def is_low(self) -> bool:
        return self.swing_type == SwingType.SWING_LOW


class SwingDetector:
    """
    Detects swing points using break-confirmation logic.

    A swing is only confirmed when price breaks the opposite swing.
    This eliminates noise and matches how traders identify swings.

    Algorithm:
    1. Track the current swing high and swing low levels
    2. When price breaks ABOVE swing high → confirm the lowest point since
       last swing high as a new SWING LOW
    3. When price breaks BELOW swing low → confirm the highest point since
       last swing low as a new SWING HIGH
    """

    def __init__(self, use_close: bool = True):
        """
        Initialize Swing Detector.

        Args:
            use_close: If True, use close price for break detection.
                      If False, use high/low (more sensitive but more noise).
        """
        self.use_close = use_close

    def detect_swings(self, candles: pd.DataFrame) -> List[SwingPoint]:
        """
        Detect all confirmed swing points.

        Args:
            candles: DataFrame with OHLCV data

        Returns:
            List of confirmed SwingPoint objects, sorted by index
        """
        if len(candles) < 3:
            return []

        swings: List[SwingPoint] = []

        # Get timestamps if available
        has_timestamps = 'timestamp' in candles.columns or 'datetime' in candles.columns
        ts_col = 'datetime' if 'datetime' in candles.columns else 'timestamp'

        # Initialize with first bar
        current_swing_high = {
            'index': 0,
            'price': candles['high'].iloc[0]
        }
        current_swing_low = {
            'index': 0,
            'price': candles['low'].iloc[0]
        }

        # Track the highest high and lowest low since last confirmed swing
        highest_since_low = {'index': 0, 'price': candles['high'].iloc[0]}
        lowest_since_high = {'index': 0, 'price': candles['low'].iloc[0]}

        for i in range(1, len(candles)):
            high = candles['high'].iloc[i]
            low = candles['low'].iloc[i]
            close = candles['close'].iloc[i]

            # Price to use for break detection
            break_price_up = close if self.use_close else high
            break_price_down = close if self.use_close else low

            # Update tracking of highest/lowest points
            if high > highest_since_low['price']:
                highest_since_low = {'index': i, 'price': high}
            if low < lowest_since_high['price']:
                lowest_since_high = {'index': i, 'price': low}

            # Check for break ABOVE swing high → confirms a swing LOW
            if break_price_up > current_swing_high['price']:
                # The lowest point since the last swing high is now confirmed as swing low
                if lowest_since_high['index'] < i:  # Make sure it's not the current bar
                    swing_low = SwingPoint(
                        index=lowest_since_high['index'],
                        price=lowest_since_high['price'],
                        swing_type=SwingType.SWING_LOW,
                        confirmed_at_index=i,
                        timestamp=pd.to_datetime(candles[ts_col].iloc[lowest_since_high['index']]) if has_timestamps else None,
                        confirmed_at_timestamp=pd.to_datetime(candles[ts_col].iloc[i]) if has_timestamps else None,
                    )

                    # Determine structure (HL or LL)
                    prev_lows = [s for s in swings if s.is_low()]
                    if prev_lows:
                        if swing_low.price > prev_lows[-1].price:
                            swing_low.structure = StructureType.HIGHER_LOW
                        else:
                            swing_low.structure = StructureType.LOWER_LOW

                    swings.append(swing_low)
                    current_swing_low = {'index': lowest_since_high['index'], 'price': lowest_since_high['price']}

                # Update swing high to current level
                current_swing_high = {'index': i, 'price': high}
                highest_since_low = {'index': i, 'price': high}
                lowest_since_high = {'index': i, 'price': low}

            # Check for break BELOW swing low → confirms a swing HIGH
            elif break_price_down < current_swing_low['price']:
                # The highest point since the last swing low is now confirmed as swing high
                if highest_since_low['index'] < i:
                    swing_high = SwingPoint(
                        index=highest_since_low['index'],
                        price=highest_since_low['price'],
                        swing_type=SwingType.SWING_HIGH,
                        confirmed_at_index=i,
                        timestamp=pd.to_datetime(candles[ts_col].iloc[highest_since_low['index']]) if has_timestamps else None,
                        confirmed_at_timestamp=pd.to_datetime(candles[ts_col].iloc[i]) if has_timestamps else None,
                    )

                    # Determine structure (HH or LH)
                    prev_highs = [s for s in swings if s.is_high()]
                    if prev_highs:
                        if swing_high.price > prev_highs[-1].price:
                            swing_high.structure = StructureType.HIGHER_HIGH
                        else:
                            swing_high.structure = StructureType.LOWER_HIGH

                    swings.append(swing_high)
                    current_swing_high = {'index': highest_since_low['index'], 'price': highest_since_low['price']}

                # Update swing low to current level
                current_swing_low = {'index': i, 'price': low}
                lowest_since_high = {'index': i, 'price': low}
                highest_since_low = {'index': i, 'price': high}

        # Sort by index (should already be sorted but ensure it)
        swings.sort(key=lambda x: x.index)

        return swings

    def detect_major_swings(self, candles: pd.DataFrame) -> List[SwingPoint]:
        """Alias for detect_swings for compatibility."""
        return self.detect_swings(candles)

    def get_latest_swing_high(self, candles: pd.DataFrame) -> Optional[SwingPoint]:
        """Get the most recent confirmed swing high."""
        swings = self.detect_swings(candles)
        highs = [s for s in swings if s.is_high()]
        return highs[-1] if highs else None

    def get_latest_swing_low(self, candles: pd.DataFrame) -> Optional[SwingPoint]:
        """Get the most recent confirmed swing low."""
        swings = self.detect_swings(candles)
        lows = [s for s in swings if s.is_low()]
        return lows[-1] if lows else None

    def get_swing_series(self, candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
        """
        Get swing highs and lows as Series.

        Returns:
            Tuple of (swing_highs, swing_lows) Series with NaN where no swing
        """
        swings = self.detect_swings(candles)

        swing_highs = pd.Series(np.nan, index=candles.index)
        swing_lows = pd.Series(np.nan, index=candles.index)

        for swing in swings:
            if swing.is_high():
                swing_highs.iloc[swing.index] = swing.price
            else:
                swing_lows.iloc[swing.index] = swing.price

        return swing_highs, swing_lows

    def get_current_levels(self, candles: pd.DataFrame) -> dict:
        """
        Get current swing high and low levels (for live trading).

        Returns the levels that would trigger a break if crossed.
        """
        swings = self.detect_swings(candles)

        highs = [s for s in swings if s.is_high()]
        lows = [s for s in swings if s.is_low()]

        return {
            'swing_high': highs[-1].price if highs else None,
            'swing_low': lows[-1].price if lows else None,
        }


class StructureAnalyzer:
    """
    Analyzes market structure based on confirmed swings.
    """

    def __init__(self, swing_detector: Optional[SwingDetector] = None):
        self.swing_detector = swing_detector or SwingDetector()

    def analyze(self, candles: pd.DataFrame) -> dict:
        """
        Analyze market structure.

        Returns dict with trend, swings, and key levels.
        """
        swings = self.swing_detector.detect_swings(candles)

        if len(swings) < 4:
            return {
                'trend': 'unknown',
                'swings': swings,
                'key_levels': {},
            }

        # Get recent swings
        recent = swings[-6:] if len(swings) >= 6 else swings

        # Count structure types
        hh_count = sum(1 for s in recent if s.structure == StructureType.HIGHER_HIGH)
        hl_count = sum(1 for s in recent if s.structure == StructureType.HIGHER_LOW)
        lh_count = sum(1 for s in recent if s.structure == StructureType.LOWER_HIGH)
        ll_count = sum(1 for s in recent if s.structure == StructureType.LOWER_LOW)

        # Determine trend
        if hh_count >= 1 and hl_count >= 1:
            trend = 'uptrend'
        elif lh_count >= 1 and ll_count >= 1:
            trend = 'downtrend'
        else:
            trend = 'ranging'

        # Key levels
        highs = [s for s in swings if s.is_high()]
        lows = [s for s in swings if s.is_low()]

        key_levels = {
            'last_swing_high': highs[-1].price if highs else None,
            'last_swing_low': lows[-1].price if lows else None,
            'prev_swing_high': highs[-2].price if len(highs) > 1 else None,
            'prev_swing_low': lows[-2].price if len(lows) > 1 else None,
        }

        return {
            'trend': trend,
            'swings': swings,
            'highs': highs,
            'lows': lows,
            'key_levels': key_levels,
            'hh_count': hh_count,
            'hl_count': hl_count,
            'lh_count': lh_count,
            'll_count': ll_count,
        }

    def is_uptrend(self, candles: pd.DataFrame) -> bool:
        return self.analyze(candles)['trend'] == 'uptrend'

    def is_downtrend(self, candles: pd.DataFrame) -> bool:
        return self.analyze(candles)['trend'] == 'downtrend'

    def is_ranging(self, candles: pd.DataFrame) -> bool:
        return self.analyze(candles)['trend'] == 'ranging'


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def detect_swings(candles: pd.DataFrame, use_close: bool = True) -> List[SwingPoint]:
    """Quick function to detect confirmed swings."""
    detector = SwingDetector(use_close=use_close)
    return detector.detect_swings(candles)


def detect_major_swings(candles: pd.DataFrame) -> List[SwingPoint]:
    """Quick function to detect swings (alias for compatibility)."""
    return detect_swings(candles)


def get_market_structure(candles: pd.DataFrame) -> dict:
    """Quick function to analyze market structure."""
    analyzer = StructureAnalyzer()
    return analyzer.analyze(candles)


def get_swing_series(candles: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
    """Quick function to get swing high/low series."""
    detector = SwingDetector()
    return detector.get_swing_series(candles)


# =============================================================================
# PRE-CONFIGURED DETECTORS
# =============================================================================

SWING_DETECTOR_DEFAULT = lambda: SwingDetector(use_close=True)
SWING_DETECTOR_SENSITIVE = lambda: SwingDetector(use_close=False)  # Uses high/low for breaks
