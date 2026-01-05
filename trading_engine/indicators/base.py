"""
Base indicator class and utilities.

All indicators inherit from BaseIndicator for consistent interface.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional
import pandas as pd
import numpy as np


@dataclass
class IndicatorResult:
    """
    Result from an indicator calculation.

    Contains the computed values as a pandas Series with the same index as input.
    """
    name: str
    values: pd.Series
    params: dict[str, Any]

    def __len__(self) -> int:
        return len(self.values)

    @property
    def latest(self) -> float:
        """Get most recent value."""
        return self.values.iloc[-1]

    def at(self, index: int) -> float:
        """Get value at specific index."""
        return self.values.iloc[index]


class BaseIndicator(ABC):
    """
    Abstract base class for all indicators.

    All indicators must implement the calculate() method.
    """

    def __init__(self, name: str):
        """
        Initialize indicator.

        Args:
            name: Unique identifier for this indicator
        """
        self.name = name

    @abstractmethod
    def calculate(self, candles: pd.DataFrame) -> IndicatorResult:
        """
        Calculate indicator values from candle data.

        Args:
            candles: DataFrame with columns [timestamp, open, high, low, close, volume]

        Returns:
            IndicatorResult with calculated values
        """
        pass

    def validate_input(self, candles: pd.DataFrame, min_periods: int = 1):
        """
        Validate input data has required columns and length.

        Args:
            candles: Input DataFrame
            min_periods: Minimum number of candles required

        Raises:
            ValueError: If validation fails
        """
        required = ['open', 'high', 'low', 'close', 'volume']
        for col in required:
            if col not in candles.columns:
                raise ValueError(f"Missing required column: {col}")

        if len(candles) < min_periods:
            raise ValueError(f"Need at least {min_periods} candles, got {len(candles)}")


def crossover(series1: pd.Series, series2: pd.Series) -> pd.Series:
    """
    Detect crossover: series1 crosses above series2.

    Returns Series of booleans where True = crossover occurred at that index.
    """
    prev1 = series1.shift(1)
    prev2 = series2.shift(1)
    return (prev1 <= prev2) & (series1 > series2)


def crossunder(series1: pd.Series, series2: pd.Series) -> pd.Series:
    """
    Detect crossunder: series1 crosses below series2.

    Returns Series of booleans where True = crossunder occurred at that index.
    """
    prev1 = series1.shift(1)
    prev2 = series2.shift(1)
    return (prev1 >= prev2) & (series1 < series2)


def is_above(series1: pd.Series, series2: pd.Series) -> pd.Series:
    """Check if series1 is above series2."""
    return series1 > series2


def is_below(series1: pd.Series, series2: pd.Series) -> pd.Series:
    """Check if series1 is below series2."""
    return series1 < series2


def percent_change(series: pd.Series, periods: int = 1) -> pd.Series:
    """Calculate percent change over periods."""
    return series.pct_change(periods=periods) * 100


def normalize(series: pd.Series, period: int = 20) -> pd.Series:
    """
    Normalize series to 0-100 range over rolling window.

    Useful for comparing different indicators.
    """
    rolling_min = series.rolling(period).min()
    rolling_max = series.rolling(period).max()
    return (series - rolling_min) / (rolling_max - rolling_min) * 100


def slope(series: pd.Series, periods: int = 5) -> pd.Series:
    """Calculate slope (rate of change) over periods."""
    return series.diff(periods) / periods
