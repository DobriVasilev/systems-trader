"""
Structure Break Detection.

BOS (Break of Structure) and MSB/CHOCH (Market Structure Break / Change of Character).

BOS: Trend continuation break (HH in uptrend, LL in downtrend)
MSB/CHOCH: Trend reversal break (LH breaking swing low in uptrend, etc.)
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple
from enum import Enum

from .swings import SwingDetector, SwingPoint, SwingType, StructureType


class BreakType(Enum):
    """Type of structure break."""
    BOS_BULLISH = "bos_bullish"      # Break above swing high (continuation in uptrend)
    BOS_BEARISH = "bos_bearish"      # Break below swing low (continuation in downtrend)
    MSB_BULLISH = "msb_bullish"      # Break above swing high (reversal from downtrend)
    MSB_BEARISH = "msb_bearish"      # Break below swing low (reversal from uptrend)


@dataclass
class StructureBreak:
    """
    Represents a detected structure break (BOS or MSB).

    Attributes:
        break_type: Type of break (BOS/MSB, bullish/bearish)
        break_index: Bar index where break occurred
        break_price: Price level that was broken
        break_candle_close: Close price of the break candle
        swing_broken: The swing point that was broken
        retest_index: Index of retest (if detected)
        retest_price: Price of retest (if detected)
    """
    break_type: BreakType
    break_index: int
    break_price: float
    break_candle_close: float
    swing_broken: SwingPoint
    timestamp: Optional[pd.Timestamp] = None
    retest_index: Optional[int] = None
    retest_price: Optional[float] = None

    def is_bos(self) -> bool:
        """Check if this is a BOS (continuation)."""
        return self.break_type in [BreakType.BOS_BULLISH, BreakType.BOS_BEARISH]

    def is_msb(self) -> bool:
        """Check if this is an MSB (reversal)."""
        return self.break_type in [BreakType.MSB_BULLISH, BreakType.MSB_BEARISH]

    def is_bullish(self) -> bool:
        """Check if break is bullish."""
        return self.break_type in [BreakType.BOS_BULLISH, BreakType.MSB_BULLISH]

    def is_bearish(self) -> bool:
        """Check if break is bearish."""
        return self.break_type in [BreakType.BOS_BEARISH, BreakType.MSB_BEARISH]

    def has_retest(self) -> bool:
        """Check if retest has been detected."""
        return self.retest_index is not None


class BOSDetector:
    """
    Detects Break of Structure (BOS).

    BOS = Price breaking through a swing high (bullish) or swing low (bearish)
    to continue the existing trend.

    Key characteristics:
    - In uptrend: BOS = break above previous swing high (making new HH)
    - In downtrend: BOS = break below previous swing low (making new LL)
    """

    def __init__(
        self,
        swing_detector: Optional[SwingDetector] = None,
        confirmation_bars: int = 1,
        use_close: bool = True,
    ):
        """
        Initialize BOS Detector.

        Args:
            swing_detector: SwingDetector instance
            confirmation_bars: Bars to wait for confirmation (default 1)
            use_close: Use close price for break (True) or high/low (False)
        """
        self.swing_detector = swing_detector or SwingDetector()
        self.confirmation_bars = confirmation_bars
        self.use_close = use_close

    def detect_bos(self, candles: pd.DataFrame) -> List[StructureBreak]:
        """
        Detect all BOS events in the data.

        Returns:
            List of StructureBreak objects (BOS type only)
        """
        swings = self.swing_detector.detect_major_swings(candles)

        if len(swings) < 2:
            return []

        breaks = []
        highs = [s for s in swings if s.is_high()]
        lows = [s for s in swings if s.is_low()]

        # Detect bullish BOS (break above swing high)
        for swing in highs:
            bos = self._detect_break_above(candles, swing, swings)
            if bos:
                breaks.append(bos)

        # Detect bearish BOS (break below swing low)
        for swing in lows:
            bos = self._detect_break_below(candles, swing, swings)
            if bos:
                breaks.append(bos)

        # Sort by break index
        breaks.sort(key=lambda x: x.break_index)

        return breaks

    def detect_latest_bos(self, candles: pd.DataFrame) -> Optional[StructureBreak]:
        """Get the most recent BOS."""
        all_bos = self.detect_bos(candles)
        return all_bos[-1] if all_bos else None

    def _detect_break_above(
        self,
        candles: pd.DataFrame,
        swing: SwingPoint,
        all_swings: List[SwingPoint]
    ) -> Optional[StructureBreak]:
        """
        Detect if price broke above this swing high.

        For it to be a BOS (not MSB), we need to be in an uptrend.
        """
        level = swing.price

        # Look for break after the swing
        for i in range(swing.index + self.confirmation_bars, len(candles)):
            check_price = candles['close'].iloc[i] if self.use_close else candles['high'].iloc[i]

            if check_price > level:
                # Check if this is continuation (BOS) or reversal (MSB)
                # BOS = in uptrend (last swing structure was HH or HL)
                prior_swings = [s for s in all_swings if s.index < i]
                if prior_swings:
                    last_swing = prior_swings[-1]
                    # If last swing was HH or HL, this is trend continuation = BOS
                    if last_swing.structure in [StructureType.HIGHER_HIGH, StructureType.HIGHER_LOW]:
                        timestamp = None
                        if 'timestamp' in candles.columns:
                            timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                        return StructureBreak(
                            break_type=BreakType.BOS_BULLISH,
                            break_index=i,
                            break_price=level,
                            break_candle_close=candles['close'].iloc[i],
                            swing_broken=swing,
                            timestamp=timestamp,
                        )
                break

        return None

    def _detect_break_below(
        self,
        candles: pd.DataFrame,
        swing: SwingPoint,
        all_swings: List[SwingPoint]
    ) -> Optional[StructureBreak]:
        """Detect if price broke below this swing low."""
        level = swing.price

        for i in range(swing.index + self.confirmation_bars, len(candles)):
            check_price = candles['close'].iloc[i] if self.use_close else candles['low'].iloc[i]

            if check_price < level:
                prior_swings = [s for s in all_swings if s.index < i]
                if prior_swings:
                    last_swing = prior_swings[-1]
                    # If last swing was LH or LL, this is trend continuation = BOS
                    if last_swing.structure in [StructureType.LOWER_HIGH, StructureType.LOWER_LOW]:
                        timestamp = None
                        if 'timestamp' in candles.columns:
                            timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                        return StructureBreak(
                            break_type=BreakType.BOS_BEARISH,
                            break_index=i,
                            break_price=level,
                            break_candle_close=candles['close'].iloc[i],
                            swing_broken=swing,
                            timestamp=timestamp,
                        )
                break

        return None


class MSBDetector:
    """
    Detects Market Structure Break (MSB) / Change of Character (CHOCH).

    MSB = Price breaking structure in the OPPOSITE direction of the trend,
    signaling a potential reversal.

    Key characteristics:
    - In uptrend: MSB = break below swing low (HL becomes LL)
    - In downtrend: MSB = break above swing high (LH becomes HH)
    """

    def __init__(
        self,
        swing_detector: Optional[SwingDetector] = None,
        confirmation_bars: int = 1,
        use_close: bool = True,
    ):
        """
        Initialize MSB Detector.

        Args:
            swing_detector: SwingDetector instance
            confirmation_bars: Bars to wait for confirmation
            use_close: Use close price for break (True) or high/low (False)
        """
        self.swing_detector = swing_detector or SwingDetector()
        self.confirmation_bars = confirmation_bars
        self.use_close = use_close

    def detect_msb(self, candles: pd.DataFrame) -> List[StructureBreak]:
        """
        Detect all MSB events in the data.

        Returns:
            List of StructureBreak objects (MSB type only)
        """
        swings = self.swing_detector.detect_major_swings(candles)

        if len(swings) < 3:
            return []

        breaks = []
        highs = [s for s in swings if s.is_high()]
        lows = [s for s in swings if s.is_low()]

        # Detect bullish MSB (break above swing high in downtrend)
        for swing in highs:
            msb = self._detect_bullish_msb(candles, swing, swings)
            if msb:
                breaks.append(msb)

        # Detect bearish MSB (break below swing low in uptrend)
        for swing in lows:
            msb = self._detect_bearish_msb(candles, swing, swings)
            if msb:
                breaks.append(msb)

        breaks.sort(key=lambda x: x.break_index)
        return breaks

    def detect_latest_msb(self, candles: pd.DataFrame) -> Optional[StructureBreak]:
        """Get the most recent MSB."""
        all_msb = self.detect_msb(candles)
        return all_msb[-1] if all_msb else None

    def _detect_bullish_msb(
        self,
        candles: pd.DataFrame,
        swing: SwingPoint,
        all_swings: List[SwingPoint]
    ) -> Optional[StructureBreak]:
        """
        Detect bullish MSB (reversal from downtrend to uptrend).

        Occurs when price breaks above a swing high while in a downtrend.
        """
        level = swing.price

        for i in range(swing.index + self.confirmation_bars, len(candles)):
            check_price = candles['close'].iloc[i] if self.use_close else candles['high'].iloc[i]

            if check_price > level:
                # Check if we were in downtrend (LH or LL structure)
                prior_swings = [s for s in all_swings if s.index < i and s.index > swing.index - 20]
                lh_ll_count = sum(
                    1 for s in prior_swings
                    if s.structure in [StructureType.LOWER_HIGH, StructureType.LOWER_LOW]
                )

                if lh_ll_count >= 2:  # Was in downtrend
                    timestamp = None
                    if 'timestamp' in candles.columns:
                        timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                    return StructureBreak(
                        break_type=BreakType.MSB_BULLISH,
                        break_index=i,
                        break_price=level,
                        break_candle_close=candles['close'].iloc[i],
                        swing_broken=swing,
                        timestamp=timestamp,
                    )
                break

        return None

    def _detect_bearish_msb(
        self,
        candles: pd.DataFrame,
        swing: SwingPoint,
        all_swings: List[SwingPoint]
    ) -> Optional[StructureBreak]:
        """
        Detect bearish MSB (reversal from uptrend to downtrend).

        Occurs when price breaks below a swing low while in an uptrend.
        """
        level = swing.price

        for i in range(swing.index + self.confirmation_bars, len(candles)):
            check_price = candles['close'].iloc[i] if self.use_close else candles['low'].iloc[i]

            if check_price < level:
                # Check if we were in uptrend (HH or HL structure)
                prior_swings = [s for s in all_swings if s.index < i and s.index > swing.index - 20]
                hh_hl_count = sum(
                    1 for s in prior_swings
                    if s.structure in [StructureType.HIGHER_HIGH, StructureType.HIGHER_LOW]
                )

                if hh_hl_count >= 2:  # Was in uptrend
                    timestamp = None
                    if 'timestamp' in candles.columns:
                        timestamp = pd.to_datetime(candles['timestamp'].iloc[i])

                    return StructureBreak(
                        break_type=BreakType.MSB_BEARISH,
                        break_index=i,
                        break_price=level,
                        break_candle_close=candles['close'].iloc[i],
                        swing_broken=swing,
                        timestamp=timestamp,
                    )
                break

        return None


class RetestDetector:
    """
    Detects retests of broken structure levels.

    After BOS/MSB, price often returns to test the broken level before continuing.
    This retest is often the best entry point.
    """

    def __init__(
        self,
        tolerance_pct: float = 0.3,
        max_retest_bars: int = 20,
    ):
        """
        Initialize Retest Detector.

        Args:
            tolerance_pct: How close price must get to level (% of level)
            max_retest_bars: Maximum bars to look for retest
        """
        self.tolerance_pct = tolerance_pct
        self.max_retest_bars = max_retest_bars

    def find_retest(
        self,
        candles: pd.DataFrame,
        structure_break: StructureBreak
    ) -> Optional[Tuple[int, float]]:
        """
        Find retest of broken level.

        Returns:
            Tuple of (retest_index, retest_price) or None
        """
        level = structure_break.break_price
        tolerance = level * (self.tolerance_pct / 100)
        start_idx = structure_break.break_index + 1
        end_idx = min(start_idx + self.max_retest_bars, len(candles))

        if structure_break.is_bullish():
            # After bullish break, look for price to come back down to level
            for i in range(start_idx, end_idx):
                low = candles['low'].iloc[i]
                if abs(low - level) <= tolerance:
                    return i, low
        else:
            # After bearish break, look for price to come back up to level
            for i in range(start_idx, end_idx):
                high = candles['high'].iloc[i]
                if abs(high - level) <= tolerance:
                    return i, high

        return None

    def has_valid_retest(
        self,
        candles: pd.DataFrame,
        structure_break: StructureBreak
    ) -> bool:
        """Check if a valid retest has occurred."""
        return self.find_retest(candles, structure_break) is not None


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def detect_bos(candles: pd.DataFrame) -> List[StructureBreak]:
    """Quick function to detect all BOS events."""
    detector = BOSDetector()
    return detector.detect_bos(candles)


def detect_msb(candles: pd.DataFrame) -> List[StructureBreak]:
    """Quick function to detect all MSB events."""
    detector = MSBDetector()
    return detector.detect_msb(candles)


def detect_all_structure_breaks(candles: pd.DataFrame) -> List[StructureBreak]:
    """Quick function to detect all structure breaks (BOS + MSB)."""
    bos = detect_bos(candles)
    msb = detect_msb(candles)
    all_breaks = bos + msb
    all_breaks.sort(key=lambda x: x.break_index)
    return all_breaks


def get_latest_bos(candles: pd.DataFrame) -> Optional[StructureBreak]:
    """Quick function to get most recent BOS."""
    detector = BOSDetector()
    return detector.detect_latest_bos(candles)


def get_latest_msb(candles: pd.DataFrame) -> Optional[StructureBreak]:
    """Quick function to get most recent MSB."""
    detector = MSBDetector()
    return detector.detect_latest_msb(candles)


# =============================================================================
# PRE-CONFIGURED DETECTORS
# =============================================================================

BOS_DETECTOR_DEFAULT = lambda: BOSDetector(confirmation_bars=1, use_close=True)
MSB_DETECTOR_DEFAULT = lambda: MSBDetector(confirmation_bars=1, use_close=True)
RETEST_DETECTOR_DEFAULT = lambda: RetestDetector(tolerance_pct=0.3, max_retest_bars=20)
