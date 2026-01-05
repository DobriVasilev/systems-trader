"""
Price-based Conditions.

Conditions that evaluate price relationships with indicators, levels, or other prices.
"""

import pandas as pd
import numpy as np
from typing import Optional, Union, Callable

from .base import BaseCondition, EvaluationResult, ConditionResult


class PriceAbove(BaseCondition):
    """Check if price is above a level or indicator."""

    def __init__(
        self,
        level: Union[float, str, Callable],
        source: str = 'close',
        name: Optional[str] = None
    ):
        """
        Initialize PriceAbove condition.

        Args:
            level: Static price, indicator name (from context), or callable
            source: Price source ('close', 'high', 'low', 'open')
            name: Custom name for the condition
        """
        if name is None:
            name = f"price_above_{level}"
        super().__init__(name)
        self.level = level
        self.source = source

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        price = candles[self.source].iloc[-1]

        # Resolve level
        if callable(self.level):
            target = self.level(candles, **context)
        elif isinstance(self.level, str):
            target = context.get(self.level)
            if target is None:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details=f"Indicator {self.level} not in context",
                )
            if isinstance(target, pd.Series):
                target = target.iloc[-1]
        else:
            target = self.level

        if price > target:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} > {target:.4f}",
                values={'price': price, 'level': target}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} <= {target:.4f}",
                values={'price': price, 'level': target}
            )


class PriceBelow(BaseCondition):
    """Check if price is below a level or indicator."""

    def __init__(
        self,
        level: Union[float, str, Callable],
        source: str = 'close',
        name: Optional[str] = None
    ):
        if name is None:
            name = f"price_below_{level}"
        super().__init__(name)
        self.level = level
        self.source = source

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        price = candles[self.source].iloc[-1]

        if callable(self.level):
            target = self.level(candles, **context)
        elif isinstance(self.level, str):
            target = context.get(self.level)
            if target is None:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details=f"Indicator {self.level} not in context",
                )
            if isinstance(target, pd.Series):
                target = target.iloc[-1]
        else:
            target = self.level

        if price < target:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} < {target:.4f}",
                values={'price': price, 'level': target}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} >= {target:.4f}",
                values={'price': price, 'level': target}
            )


class PriceNear(BaseCondition):
    """Check if price is near a level (within tolerance)."""

    def __init__(
        self,
        level: Union[float, str, Callable],
        tolerance_pct: float = 0.5,
        source: str = 'close',
        name: Optional[str] = None
    ):
        """
        Initialize PriceNear condition.

        Args:
            level: Target level
            tolerance_pct: Percentage tolerance (0.5 = 0.5%)
            source: Price source
            name: Custom name
        """
        if name is None:
            name = f"price_near_{level}"
        super().__init__(name)
        self.level = level
        self.tolerance_pct = tolerance_pct
        self.source = source

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        price = candles[self.source].iloc[-1]

        if callable(self.level):
            target = self.level(candles, **context)
        elif isinstance(self.level, str):
            target = context.get(self.level)
            if target is None:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details=f"Level {self.level} not in context",
                )
            if isinstance(target, pd.Series):
                target = target.iloc[-1]
        else:
            target = self.level

        tolerance = target * (self.tolerance_pct / 100)
        distance = abs(price - target)

        if distance <= tolerance:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} within {self.tolerance_pct}% of {target:.4f}",
                values={'price': price, 'level': target, 'distance': distance}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} not near {target:.4f} (dist={distance:.4f})",
                values={'price': price, 'level': target, 'distance': distance}
            )


class PriceCrossedAbove(BaseCondition):
    """Check if price just crossed above a level (on current bar)."""

    def __init__(
        self,
        level: Union[float, str, Callable],
        source: str = 'close',
        name: Optional[str] = None
    ):
        if name is None:
            name = f"price_crossed_above_{level}"
        super().__init__(name)
        self.level = level
        self.source = source

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        if len(candles) < 2:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Need at least 2 bars",
            )

        current_price = candles[self.source].iloc[-1]
        prev_price = candles[self.source].iloc[-2]

        if callable(self.level):
            target = self.level(candles, **context)
        elif isinstance(self.level, str):
            target = context.get(self.level)
            if target is None:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details=f"Level {self.level} not in context",
                )
            if isinstance(target, pd.Series):
                target = target.iloc[-1]
        else:
            target = self.level

        # Crossover: previous was below or at level, current is above
        if prev_price <= target and current_price > target:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Crossed above {target:.4f}",
                values={'current': current_price, 'prev': prev_price, 'level': target}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No crossover (prev={prev_price:.4f}, curr={current_price:.4f}, level={target:.4f})",
                values={'current': current_price, 'prev': prev_price, 'level': target}
            )


class PriceCrossedBelow(BaseCondition):
    """Check if price just crossed below a level."""

    def __init__(
        self,
        level: Union[float, str, Callable],
        source: str = 'close',
        name: Optional[str] = None
    ):
        if name is None:
            name = f"price_crossed_below_{level}"
        super().__init__(name)
        self.level = level
        self.source = source

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        if len(candles) < 2:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Need at least 2 bars",
            )

        current_price = candles[self.source].iloc[-1]
        prev_price = candles[self.source].iloc[-2]

        if callable(self.level):
            target = self.level(candles, **context)
        elif isinstance(self.level, str):
            target = context.get(self.level)
            if target is None:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details=f"Level {self.level} not in context",
                )
            if isinstance(target, pd.Series):
                target = target.iloc[-1]
        else:
            target = self.level

        if prev_price >= target and current_price < target:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Crossed below {target:.4f}",
                values={'current': current_price, 'prev': prev_price, 'level': target}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"No crossunder",
                values={'current': current_price, 'prev': prev_price, 'level': target}
            )


class PriceInRange(BaseCondition):
    """Check if price is within a range."""

    def __init__(
        self,
        low: Union[float, str],
        high: Union[float, str],
        source: str = 'close',
        name: Optional[str] = None
    ):
        if name is None:
            name = f"price_in_range"
        super().__init__(name)
        self.low = low
        self.high = high
        self.source = source

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        price = candles[self.source].iloc[-1]

        # Resolve low
        if isinstance(self.low, str):
            low_val = context.get(self.low)
            if isinstance(low_val, pd.Series):
                low_val = low_val.iloc[-1]
        else:
            low_val = self.low

        # Resolve high
        if isinstance(self.high, str):
            high_val = context.get(self.high)
            if isinstance(high_val, pd.Series):
                high_val = high_val.iloc[-1]
        else:
            high_val = self.high

        if low_val <= price <= high_val:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{price:.4f} in [{low_val:.4f}, {high_val:.4f}]",
                values={'price': price, 'low': low_val, 'high': high_val}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"{price:.4f} outside range",
                values={'price': price, 'low': low_val, 'high': high_val}
            )


class CandleDirection(BaseCondition):
    """Check if current candle is bullish or bearish."""

    def __init__(self, direction: str = 'bullish', name: Optional[str] = None):
        """
        Initialize CandleDirection condition.

        Args:
            direction: 'bullish' or 'bearish'
        """
        if name is None:
            name = f"candle_{direction}"
        super().__init__(name)
        self.direction = direction.lower()

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        open_price = candles['open'].iloc[-1]
        close_price = candles['close'].iloc[-1]

        is_bullish = close_price > open_price
        is_bearish = close_price < open_price

        if self.direction == 'bullish' and is_bullish:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Bullish candle (o={open_price:.4f}, c={close_price:.4f})",
            )
        elif self.direction == 'bearish' and is_bearish:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Bearish candle (o={open_price:.4f}, c={close_price:.4f})",
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Wrong candle direction",
            )


class ConsecutiveCandles(BaseCondition):
    """Check for N consecutive bullish or bearish candles."""

    def __init__(self, direction: str = 'bullish', count: int = 2, name: Optional[str] = None):
        if name is None:
            name = f"{count}_consecutive_{direction}"
        super().__init__(name)
        self.direction = direction.lower()
        self.count = count

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        if len(candles) < self.count:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details=f"Need at least {self.count} candles",
            )

        # Check last N candles
        opens = candles['open'].iloc[-self.count:]
        closes = candles['close'].iloc[-self.count:]

        if self.direction == 'bullish':
            all_match = all(c > o for o, c in zip(opens, closes))
        else:
            all_match = all(c < o for o, c in zip(opens, closes))

        if all_match:
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"{self.count} consecutive {self.direction} candles",
            )
        else:
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Not {self.count} consecutive {self.direction}",
            )
