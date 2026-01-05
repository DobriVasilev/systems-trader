"""
Base Condition Classes.

All trading conditions inherit from BaseCondition for consistent evaluation.
Conditions can be combined with AND, OR, NOT logic.
"""

import pandas as pd
import numpy as np
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, List, Optional, Union
from enum import Enum


class ConditionResult(Enum):
    """Result of condition evaluation."""
    TRUE = "true"
    FALSE = "false"
    NEUTRAL = "neutral"  # Condition not applicable (e.g., waiting for setup)


@dataclass
class EvaluationResult:
    """
    Detailed result from condition evaluation.

    Attributes:
        result: TRUE, FALSE, or NEUTRAL
        condition_name: Name of the condition
        details: Additional details about why condition passed/failed
        values: Actual values that were evaluated
    """
    result: ConditionResult
    condition_name: str
    details: str = ""
    values: dict = None

    def __post_init__(self):
        if self.values is None:
            self.values = {}

    def __bool__(self) -> bool:
        """Allow using result in boolean context."""
        return self.result == ConditionResult.TRUE

    def is_true(self) -> bool:
        return self.result == ConditionResult.TRUE

    def is_false(self) -> bool:
        return self.result == ConditionResult.FALSE

    def is_neutral(self) -> bool:
        return self.result == ConditionResult.NEUTRAL


class BaseCondition(ABC):
    """
    Abstract base class for all conditions.

    Conditions evaluate whether a trading rule is satisfied at the current bar.
    """

    def __init__(self, name: str):
        """
        Initialize condition.

        Args:
            name: Unique identifier for this condition
        """
        self.name = name

    @abstractmethod
    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        """
        Evaluate the condition on the current bar.

        Args:
            candles: OHLCV DataFrame
            **context: Additional context (indicators, patterns, etc.)

        Returns:
            EvaluationResult with outcome and details
        """
        pass

    def __and__(self, other: 'BaseCondition') -> 'AndCondition':
        """Allow combining conditions with &."""
        return AndCondition(self, other)

    def __or__(self, other: 'BaseCondition') -> 'OrCondition':
        """Allow combining conditions with |."""
        return OrCondition(self, other)

    def __invert__(self) -> 'NotCondition':
        """Allow negating condition with ~."""
        return NotCondition(self)


class AndCondition(BaseCondition):
    """
    Combines two conditions with AND logic.

    Both conditions must be TRUE for result to be TRUE.
    If either is FALSE, result is FALSE.
    If either is NEUTRAL (and none FALSE), result is NEUTRAL.
    """

    def __init__(self, cond1: BaseCondition, cond2: BaseCondition):
        super().__init__(f"({cond1.name} AND {cond2.name})")
        self.cond1 = cond1
        self.cond2 = cond2

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        result1 = self.cond1.evaluate(candles, **context)
        result2 = self.cond2.evaluate(candles, **context)

        if result1.is_false() or result2.is_false():
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Failed: {result1.details if result1.is_false() else result2.details}",
                values={'cond1': result1.result.value, 'cond2': result2.result.value}
            )
        elif result1.is_true() and result2.is_true():
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details="Both conditions met",
                values={'cond1': result1.values, 'cond2': result2.values}
            )
        else:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="One or more conditions neutral",
            )


class OrCondition(BaseCondition):
    """
    Combines two conditions with OR logic.

    Either condition TRUE means result is TRUE.
    Both FALSE means result is FALSE.
    """

    def __init__(self, cond1: BaseCondition, cond2: BaseCondition):
        super().__init__(f"({cond1.name} OR {cond2.name})")
        self.cond1 = cond1
        self.cond2 = cond2

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        result1 = self.cond1.evaluate(candles, **context)
        result2 = self.cond2.evaluate(candles, **context)

        if result1.is_true() or result2.is_true():
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Passed: {result1.details if result1.is_true() else result2.details}",
                values={'cond1': result1.values, 'cond2': result2.values}
            )
        elif result1.is_false() and result2.is_false():
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details="Both conditions failed",
            )
        else:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="Neither condition met, one neutral",
            )


class NotCondition(BaseCondition):
    """Negates a condition (TRUE becomes FALSE and vice versa)."""

    def __init__(self, condition: BaseCondition):
        super().__init__(f"NOT({condition.name})")
        self.condition = condition

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        result = self.condition.evaluate(candles, **context)

        if result.is_true():
            return EvaluationResult(
                result=ConditionResult.FALSE,
                condition_name=self.name,
                details=f"Inverted from TRUE",
                values=result.values
            )
        elif result.is_false():
            return EvaluationResult(
                result=ConditionResult.TRUE,
                condition_name=self.name,
                details=f"Inverted from FALSE",
                values=result.values
            )
        else:
            return EvaluationResult(
                result=ConditionResult.NEUTRAL,
                condition_name=self.name,
                details="NEUTRAL unchanged",
            )


class ConditionGroup(BaseCondition):
    """
    Groups multiple conditions together.

    Supports 'all' (AND) or 'any' (OR) logic.
    """

    def __init__(self, conditions: List[BaseCondition], mode: str = 'all'):
        """
        Initialize condition group.

        Args:
            conditions: List of conditions to group
            mode: 'all' for AND logic, 'any' for OR logic
        """
        names = [c.name for c in conditions]
        super().__init__(f"{mode.upper()}({', '.join(names)})")
        self.conditions = conditions
        self.mode = mode

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        results = [c.evaluate(candles, **context) for c in self.conditions]

        if self.mode == 'all':
            # All must be TRUE
            if all(r.is_true() for r in results):
                return EvaluationResult(
                    result=ConditionResult.TRUE,
                    condition_name=self.name,
                    details="All conditions met",
                )
            elif any(r.is_false() for r in results):
                failed = [r for r in results if r.is_false()]
                return EvaluationResult(
                    result=ConditionResult.FALSE,
                    condition_name=self.name,
                    details=f"Failed: {failed[0].condition_name}",
                )
            else:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details="Some conditions neutral",
                )
        else:  # 'any'
            if any(r.is_true() for r in results):
                passed = [r for r in results if r.is_true()]
                return EvaluationResult(
                    result=ConditionResult.TRUE,
                    condition_name=self.name,
                    details=f"Passed: {passed[0].condition_name}",
                )
            elif all(r.is_false() for r in results):
                return EvaluationResult(
                    result=ConditionResult.FALSE,
                    condition_name=self.name,
                    details="All conditions failed",
                )
            else:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details="No condition met yet",
                )


class SequenceCondition(BaseCondition):
    """
    Conditions that must happen in sequence (A then B then C).

    Tracks state across evaluations.
    """

    def __init__(self, conditions: List[BaseCondition], max_bars_between: int = 10):
        """
        Initialize sequence condition.

        Args:
            conditions: Ordered list of conditions
            max_bars_between: Maximum bars allowed between each condition
        """
        names = [c.name for c in conditions]
        super().__init__(f"SEQ({' -> '.join(names)})")
        self.conditions = conditions
        self.max_bars_between = max_bars_between
        self.current_step = 0
        self.last_step_bar = -1

    def evaluate(self, candles: pd.DataFrame, **context) -> EvaluationResult:
        current_bar = len(candles) - 1

        # Check if we've waited too long
        if self.last_step_bar >= 0 and current_bar - self.last_step_bar > self.max_bars_between:
            self.reset()

        # Evaluate current step
        current_condition = self.conditions[self.current_step]
        result = current_condition.evaluate(candles, **context)

        if result.is_true():
            self.last_step_bar = current_bar
            self.current_step += 1

            if self.current_step >= len(self.conditions):
                # Sequence complete
                self.reset()
                return EvaluationResult(
                    result=ConditionResult.TRUE,
                    condition_name=self.name,
                    details="Sequence complete",
                )
            else:
                return EvaluationResult(
                    result=ConditionResult.NEUTRAL,
                    condition_name=self.name,
                    details=f"Step {self.current_step}/{len(self.conditions)} complete",
                )

        return EvaluationResult(
            result=ConditionResult.NEUTRAL,
            condition_name=self.name,
            details=f"Waiting for step {self.current_step + 1}",
        )

    def reset(self):
        """Reset sequence to beginning."""
        self.current_step = 0
        self.last_step_bar = -1
