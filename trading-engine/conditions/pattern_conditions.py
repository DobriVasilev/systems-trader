"""
Pattern-based Conditions.

Conditions that check for pattern occurrences (BOS, MSB, Range, FB, etc.).
"""

import pandas as pd
from typing import Optional

from .base import BaseCondition, EvaluationResult, ConditionResult
from ..patterns.swings import SwingDetector, StructureAnalyzer
from ..patterns.structure_breaks import BOSDetector, MSBDetector, BreakType
from ..patterns.range_detector import RangeDetector, RangeStatus
from ..patterns.false_breakout import FalseBreakoutDetector


class BOSOccurred(BaseCondition):
    """Check if a BOS (Break of Structure) occurred recently."""

    def __init__(
        self,
        direction: Optional[str] = None,
        lookback: int = 5,
        name: Optional[str] = None
    ):
        """
        Initialize BOS condition.

        Args:
            direction: 'bullish', 'bearish', or None (any)
            lookback: Number of bars to look back for BOS
        """
        if name is None:
            name = f"bos_{direction or 'any'}"
        super().__init__(name)
        self.direction = direction
        self.lookback = lookback
        self.detector = BOSDetector()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        breaks = self.detector.detect_bos(candles)

        if not breaks:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="No BOS detected",
            )

        current_bar = len(candles) - 1

        # Filter by recency
        recent_breaks = [
            b for b in breaks
            if current_bar - b.break_index <= self.lookback
        ]

        if not recent_breaks:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No BOS in last {self.lookback} bars",
            )

        # Filter by direction
        if self.direction:
            if self.direction == 'bullish':
                recent_breaks = [b for b in recent_breaks if b.break_type == BreakType.BOS_BULLISH]
            else:
                recent_breaks = [b for b in recent_breaks if b.break_type == BreakType.BOS_BEARISH]

        if recent_breaks:
            latest = recent_breaks[-1]
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{latest.break_type.value} at bar {latest.break_index}",
                values={'break_type': latest.break_type.value, 'break_price': latest.break_price}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No {self.direction} BOS found",
            )


class MSBOccurred(BaseCondition):
    """Check if an MSB (Market Structure Break) occurred recently."""

    def __init__(
        self,
        direction: Optional[str] = None,
        lookback: int = 5,
        name: Optional[str] = None
    ):
        if name is None:
            name = f"msb_{direction or 'any'}"
        super().__init__(name)
        self.direction = direction
        self.lookback = lookback
        self.detector = MSBDetector()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        breaks = self.detector.detect_msb(candles)

        if not breaks:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="No MSB detected",
            )

        current_bar = len(candles) - 1
        recent_breaks = [
            b for b in breaks
            if current_bar - b.break_index <= self.lookback
        ]

        if not recent_breaks:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No MSB in last {self.lookback} bars",
            )

        if self.direction:
            if self.direction == 'bullish':
                recent_breaks = [b for b in recent_breaks if b.break_type == BreakType.MSB_BULLISH]
            else:
                recent_breaks = [b for b in recent_breaks if b.break_type == BreakType.MSB_BEARISH]

        if recent_breaks:
            latest = recent_breaks[-1]
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{latest.break_type.value} at bar {latest.break_index}",
                values={'break_type': latest.break_type.value, 'break_price': latest.break_price}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No {self.direction} MSB found",
            )


class InRange(BaseCondition):
    """Check if price is currently in a confirmed range."""

    def __init__(self, min_touches: int = 3, name: Optional[str] = None):
        if name is None:
            name = "in_range"
        super().__init__(name)
        self.min_touches = min_touches
        self.detector = RangeDetector(min_touches=min_touches)

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        current_range = self.detector.detect_current_range(candles)

        if current_range and current_range.is_active():
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"In range [{current_range.low:.4f}, {current_range.high:.4f}]",
                values={
                    'range_high': current_range.high,
                    'range_low': current_range.low,
                    'touches': current_range.total_touches
                }
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="Not in confirmed range",
            )


class At75FibLevel(BaseCondition):
    """Check if price is at the 75% Fibonacci level of current range."""

    def __init__(self, tolerance_pct: float = 0.5, name: Optional[str] = None):
        if name is None:
            name = "at_75_fib"
        super().__init__(name)
        self.tolerance_pct = tolerance_pct
        self.detector = RangeDetector()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        at_level, current_range = self.detector.is_at_75_level(candles, self.tolerance_pct)

        if at_level and current_range:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"At 75% Fib level ({current_range.fib.fib_75:.4f})",
                values={
                    'fib_75': current_range.fib.fib_75,
                    'range_high': current_range.high,
                    'range_low': current_range.low
                }
            )
        elif current_range:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Not at 75% level (target: {current_range.fib.fib_75:.4f})",
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="No active range found",
            )


class At25FibLevel(BaseCondition):
    """Check if price is at the 25% Fibonacci level of current range."""

    def __init__(self, tolerance_pct: float = 0.5, name: Optional[str] = None):
        if name is None:
            name = "at_25_fib"
        super().__init__(name)
        self.tolerance_pct = tolerance_pct
        self.detector = RangeDetector()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        at_level, current_range = self.detector.is_at_25_level(candles, self.tolerance_pct)

        if at_level and current_range:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"At 25% Fib level ({current_range.fib.fib_25:.4f})",
                values={
                    'fib_25': current_range.fib.fib_25,
                    'range_high': current_range.high,
                    'range_low': current_range.low
                }
            )
        elif current_range:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Not at 25% level",
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="No active range found",
            )


class FalseBreakoutOccurred(BaseCondition):
    """Check if a false breakout occurred recently."""

    def __init__(
        self,
        direction: Optional[str] = None,
        lookback: int = 5,
        name: Optional[str] = None
    ):
        """
        Initialize FB condition.

        Args:
            direction: 'bullish' (FB below), 'bearish' (FB above), or None (any)
            lookback: Bars to look back
        """
        if name is None:
            name = f"false_breakout_{direction or 'any'}"
        super().__init__(name)
        self.direction = direction
        self.lookback = lookback
        self.detector = FalseBreakoutDetector()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        fbs = self.detector.detect_at_swing_levels(candles)

        if not fbs:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="No false breakouts detected",
            )

        current_bar = len(candles) - 1
        recent_fbs = [
            fb for fb in fbs
            if current_bar - fb.break_index <= self.lookback
        ]

        if not recent_fbs:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No FB in last {self.lookback} bars",
            )

        if self.direction:
            if self.direction == 'bullish':
                recent_fbs = [fb for fb in recent_fbs if fb.is_bullish()]
            else:
                recent_fbs = [fb for fb in recent_fbs if fb.is_bearish()]

        if recent_fbs:
            latest = recent_fbs[-1]
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{latest.fb_type.value} at {latest.level_price:.4f}",
                values={
                    'fb_type': latest.fb_type.value,
                    'level': latest.level_price,
                    'wick_size': latest.wick_size
                }
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No {self.direction} FB found",
            )


class InUptrend(BaseCondition):
    """Check if market is in uptrend (HH + HL)."""

    def __init__(self, name: Optional[str] = None):
        if name is None:
            name = "in_uptrend"
        super().__init__(name)
        self.analyzer = StructureAnalyzer()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        analysis = self.analyzer.analyze(candles)

        if analysis['trend'] == 'uptrend':
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Uptrend (HH={analysis['hh_count']}, HL={analysis['hl_count']})",
                values=analysis['key_levels']
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Not in uptrend (trend={analysis['trend']})",
            )


class InDowntrend(BaseCondition):
    """Check if market is in downtrend (LH + LL)."""

    def __init__(self, name: Optional[str] = None):
        if name is None:
            name = "in_downtrend"
        super().__init__(name)
        self.analyzer = StructureAnalyzer()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        analysis = self.analyzer.analyze(candles)

        if analysis['trend'] == 'downtrend':
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Downtrend (LH={analysis['lh_count']}, LL={analysis['ll_count']})",
                values=analysis['key_levels']
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Not in downtrend (trend={analysis['trend']})",
            )


class IsRanging(BaseCondition):
    """Check if market is ranging (no clear trend)."""

    def __init__(self, name: Optional[str] = None):
        if name is None:
            name = "is_ranging"
        super().__init__(name)
        self.analyzer = StructureAnalyzer()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        analysis = self.analyzer.analyze(candles)

        if analysis['trend'] == 'ranging':
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details="Market is ranging",
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Market trending ({analysis['trend']})",
            )


class RetestOccurred(BaseCondition):
    """Check if a retest of a broken level occurred."""

    def __init__(
        self,
        lookback: int = 10,
        tolerance_pct: float = 0.3,
        name: Optional[str] = None
    ):
        if name is None:
            name = "retest_occurred"
        super().__init__(name)
        self.lookback = lookback
        self.tolerance_pct = tolerance_pct
        self.bos_detector = BOSDetector()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        # Look for recent BOS
        breaks = self.bos_detector.detect_bos(candles)

        if not breaks:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="No structure breaks to retest",
            )

        current_bar = len(candles) - 1
        current_price = candles['close'].iloc[-1]

        # Find breaks that could be retested
        for bos in reversed(breaks):
            if current_bar - bos.break_index > self.lookback:
                continue

            level = bos.break_price
            tolerance = level * (self.tolerance_pct / 100)

            # Check if current price is near the broken level
            if abs(current_price - level) <= tolerance:
                return EvaluationResult(
                    result=ConditionResult.TRUE,
                    condition_name=self.name,
                    details=f"Retesting {bos.break_type.value} level at {level:.4f}",
                    values={
                        'level': level,
                        'break_type': bos.break_type.value,
                        'break_bar': bos.break_index
                    }
                )

        return EvaluationResult(
            result=ConditionResult.FALSE,
            condition_name=self.name,
            details="No retest in progress",
        )
