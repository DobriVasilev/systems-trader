"""
Condition Evaluators for the Trading Systems Engine.

Conditions are the building blocks of trading systems:
- They evaluate whether specific rules are met
- Can be combined with AND/OR/NOT logic
- Support sequences (A then B then C)
- All return EvaluationResult with TRUE/FALSE/NEUTRAL

Condition Categories:
- Base: Core condition classes and combinators
- Price: Price vs level/indicator comparisons
- Pattern: Pattern occurrence checks (BOS, MSB, Range, FB)
- Indicator: Indicator state checks (EMA alignment, RSI levels, etc.)
"""

# Base classes and combinators
from .base import (
    ConditionResult,
    EvaluationResult,
    BaseCondition,
    AndCondition,
    OrCondition,
    NotCondition,
    ConditionGroup,
    SequenceCondition,
)

# Price conditions
from .price_conditions import (
    PriceAbove,
    PriceBelow,
    PriceNear,
    PriceCrossedAbove,
    PriceCrossedBelow,
    PriceInRange,
    CandleDirection,
    ConsecutiveCandles,
)

# Pattern conditions
from .pattern_conditions import (
    BOSOccurred,
    MSBOccurred,
    InRange,
    At75FibLevel,
    At25FibLevel,
    FalseBreakoutOccurred,
    InUptrend,
    InDowntrend,
    IsRanging,
    RetestOccurred,
)

# Indicator conditions
from .indicator_conditions import (
    EMAAlignment,
    PriceAboveEMA,
    PriceBelowEMA,
    RSILevel,
    VWAPSlope,
    PriceAboveVWAP,
    PriceBelowVWAP,
    VolumeSpikeCondition,
    ADXTrending,
    MACDCrossover,
)


__all__ = [
    # Base
    'ConditionResult', 'EvaluationResult', 'BaseCondition',
    'AndCondition', 'OrCondition', 'NotCondition',
    'ConditionGroup', 'SequenceCondition',

    # Price
    'PriceAbove', 'PriceBelow', 'PriceNear',
    'PriceCrossedAbove', 'PriceCrossedBelow', 'PriceInRange',
    'CandleDirection', 'ConsecutiveCandles',

    # Pattern
    'BOSOccurred', 'MSBOccurred',
    'InRange', 'At75FibLevel', 'At25FibLevel',
    'FalseBreakoutOccurred',
    'InUptrend', 'InDowntrend', 'IsRanging',
    'RetestOccurred',

    # Indicator
    'EMAAlignment', 'PriceAboveEMA', 'PriceBelowEMA',
    'RSILevel', 'VWAPSlope', 'PriceAboveVWAP', 'PriceBelowVWAP',
    'VolumeSpikeCondition', 'ADXTrending', 'MACDCrossover',
]
