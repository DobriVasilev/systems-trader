"""
YAML System Parser.

Parses trading system definitions from YAML files into executable TradingSystem objects.

Example YAML:
```yaml
name: "BOS Breakout Long"
timeframe: "15m"
direction: "long"

entry:
  conditions:
    - type: "bos_occurred"
      direction: "bullish"
      lookback: 5
    - type: "price_above_ema"
      period: 200
    - type: "vwap_slope"
      direction: "up"

exit:
  stop_loss:
    type: "atr"
    multiplier: 1.5
  take_profit:
    type: "risk_reward"
    ratio: 3.0

filters:
  - type: "volume_spike"
    threshold: 1.5
```
"""

import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union, Type
from enum import Enum

from ..conditions.base import BaseCondition, ConditionGroup
from ..conditions.price_conditions import (
    PriceAbove, PriceBelow, PriceNear,
    PriceCrossedAbove, PriceCrossedBelow, PriceInRange,
    CandleDirection, ConsecutiveCandles,
)
from ..conditions.pattern_conditions import (
    BOSOccurred, MSBOccurred, InRange, At75FibLevel, At25FibLevel,
    FalseBreakoutOccurred, InUptrend, InDowntrend, IsRanging, RetestOccurred,
)
from ..conditions.indicator_conditions import (
    EMAAlignment, PriceAboveEMA, PriceBelowEMA, RSILevel,
    VWAPSlope, PriceAboveVWAP, PriceBelowVWAP,
    VolumeSpikeCondition, ADXTrending, MACDCrossover,
)


class StopLossType(Enum):
    """Types of stop loss calculation."""
    ATR = "atr"
    PERCENT = "percent"
    FIXED = "fixed"
    SWING = "swing"
    LEVEL = "level"


class TakeProfitType(Enum):
    """Types of take profit calculation."""
    RISK_REWARD = "risk_reward"
    ATR = "atr"
    PERCENT = "percent"
    FIXED = "fixed"
    LEVEL = "level"


@dataclass
class StopLossConfig:
    """Stop loss configuration."""
    type: StopLossType
    value: float  # ATR multiplier, percentage, or fixed amount
    trailing: bool = False
    trailing_activation: Optional[float] = None  # R multiple to activate trailing

    @classmethod
    def from_dict(cls, data: dict) -> 'StopLossConfig':
        return cls(
            type=StopLossType(data.get('type', 'atr')),
            value=data.get('multiplier', data.get('value', data.get('percent', 1.5))),
            trailing=data.get('trailing', False),
            trailing_activation=data.get('trailing_activation'),
        )


@dataclass
class TakeProfitConfig:
    """Take profit configuration."""
    type: TakeProfitType
    value: float  # R:R ratio, ATR multiplier, percentage, or fixed amount
    partial_exits: Optional[List[Dict[str, float]]] = None  # [{percent: 50, at_rr: 1.5}]

    @classmethod
    def from_dict(cls, data: dict) -> 'TakeProfitConfig':
        return cls(
            type=TakeProfitType(data.get('type', 'risk_reward')),
            value=data.get('ratio', data.get('value', data.get('multiplier', 3.0))),
            partial_exits=data.get('partial_exits'),
        )


@dataclass
class TradingSystem:
    """
    A complete trading system definition.

    Contains all rules for entry, exit, and position management.
    """
    name: str
    timeframe: str
    direction: str  # 'long', 'short', or 'both'

    # Entry conditions (all must be true)
    entry_conditions: List[BaseCondition]

    # Exit configuration
    stop_loss: StopLossConfig
    take_profit: TakeProfitConfig

    # Optional filters (any must be true, or skip if empty)
    filters: List[BaseCondition] = field(default_factory=list)

    # Risk management
    risk_percent: float = 1.0  # Risk per trade as % of account
    max_positions: int = 1

    # Additional settings
    description: str = ""
    enabled: bool = True

    def check_entry(self, candles, **context) -> bool:
        """Check if all entry conditions are met."""
        if not self.entry_conditions:
            return False

        for condition in self.entry_conditions:
            result = condition.evaluate(candles, **context)
            if not result.is_true():
                return False

        # Check filters (at least one must pass, or no filters = pass)
        if self.filters:
            filter_passed = any(
                f.evaluate(candles, **context).is_true()
                for f in self.filters
            )
            if not filter_passed:
                return False

        return True


class SystemParser:
    """
    Parses YAML system definitions into TradingSystem objects.

    Supports:
    - Loading from file or string
    - Condition type mapping
    - Validation
    """

    # Map condition type strings to classes
    CONDITION_TYPES: Dict[str, Type[BaseCondition]] = {
        # Pattern conditions
        'bos_occurred': BOSOccurred,
        'msb_occurred': MSBOccurred,
        'in_range': InRange,
        'at_75_fib': At75FibLevel,
        'at_25_fib': At25FibLevel,
        'false_breakout': FalseBreakoutOccurred,
        'in_uptrend': InUptrend,
        'in_downtrend': InDowntrend,
        'is_ranging': IsRanging,
        'retest_occurred': RetestOccurred,

        # Price conditions
        'price_above': PriceAbove,
        'price_below': PriceBelow,
        'price_near': PriceNear,
        'price_crossed_above': PriceCrossedAbove,
        'price_crossed_below': PriceCrossedBelow,
        'price_in_range': PriceInRange,
        'candle_direction': CandleDirection,
        'consecutive_candles': ConsecutiveCandles,

        # Indicator conditions
        'ema_alignment': EMAAlignment,
        'price_above_ema': PriceAboveEMA,
        'price_below_ema': PriceBelowEMA,
        'rsi_level': RSILevel,
        'vwap_slope': VWAPSlope,
        'price_above_vwap': PriceAboveVWAP,
        'price_below_vwap': PriceBelowVWAP,
        'volume_spike': VolumeSpikeCondition,
        'adx_trending': ADXTrending,
        'macd_crossover': MACDCrossover,
    }

    def __init__(self):
        self.systems: Dict[str, TradingSystem] = {}

    def load_file(self, path: Union[str, Path]) -> TradingSystem:
        """Load a trading system from a YAML file."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"System file not found: {path}")

        with open(path, 'r') as f:
            data = yaml.safe_load(f)

        system = self.parse(data)
        self.systems[system.name] = system
        return system

    def load_string(self, yaml_string: str) -> TradingSystem:
        """Load a trading system from a YAML string."""
        data = yaml.safe_load(yaml_string)
        system = self.parse(data)
        self.systems[system.name] = system
        return system

    def load_directory(self, path: Union[str, Path]) -> List[TradingSystem]:
        """Load all trading systems from a directory."""
        path = Path(path)
        systems = []

        for yaml_file in path.glob("*.yaml"):
            try:
                system = self.load_file(yaml_file)
                systems.append(system)
            except Exception as e:
                print(f"Error loading {yaml_file}: {e}")

        for yml_file in path.glob("*.yml"):
            try:
                system = self.load_file(yml_file)
                systems.append(system)
            except Exception as e:
                print(f"Error loading {yml_file}: {e}")

        return systems

    def parse(self, data: dict) -> TradingSystem:
        """Parse a dictionary into a TradingSystem."""
        # Required fields
        name = data.get('name', 'Unnamed System')
        timeframe = data.get('timeframe', '15m')
        direction = data.get('direction', 'both')

        # Parse entry conditions
        entry_data = data.get('entry', {})
        entry_conditions = self._parse_conditions(entry_data.get('conditions', []))

        # Parse exit configuration
        exit_data = data.get('exit', {})
        stop_loss = StopLossConfig.from_dict(exit_data.get('stop_loss', {'type': 'atr', 'multiplier': 1.5}))
        take_profit = TakeProfitConfig.from_dict(exit_data.get('take_profit', {'type': 'risk_reward', 'ratio': 3.0}))

        # Parse filters
        filter_data = data.get('filters', [])
        filters = self._parse_conditions(filter_data)

        # Optional settings
        risk_percent = data.get('risk_percent', data.get('risk', 1.0))
        max_positions = data.get('max_positions', 1)
        description = data.get('description', '')
        enabled = data.get('enabled', True)

        return TradingSystem(
            name=name,
            timeframe=timeframe,
            direction=direction,
            entry_conditions=entry_conditions,
            stop_loss=stop_loss,
            take_profit=take_profit,
            filters=filters,
            risk_percent=risk_percent,
            max_positions=max_positions,
            description=description,
            enabled=enabled,
        )

    def _parse_conditions(self, conditions_data: List[dict]) -> List[BaseCondition]:
        """Parse a list of condition definitions into Condition objects."""
        conditions = []

        for cond_data in conditions_data:
            condition = self._parse_condition(cond_data)
            if condition:
                conditions.append(condition)

        return conditions

    def _parse_condition(self, data: dict) -> Optional[BaseCondition]:
        """Parse a single condition definition."""
        cond_type = data.get('type')
        if not cond_type:
            return None

        cond_class = self.CONDITION_TYPES.get(cond_type)
        if not cond_class:
            print(f"Unknown condition type: {cond_type}")
            return None

        # Build kwargs from data (excluding 'type')
        kwargs = {k: v for k, v in data.items() if k != 'type'}

        try:
            return cond_class(**kwargs)
        except TypeError as e:
            print(f"Error creating condition {cond_type}: {e}")
            return None

    def get_system(self, name: str) -> Optional[TradingSystem]:
        """Get a loaded system by name."""
        return self.systems.get(name)

    def list_systems(self) -> List[str]:
        """List all loaded system names."""
        return list(self.systems.keys())


def create_example_systems() -> Dict[str, str]:
    """
    Create example system YAML definitions.

    Returns dict of {filename: yaml_content}.
    """
    systems = {}

    # BOS Breakout System
    systems['bos_breakout_long.yaml'] = """
name: "BOS Breakout Long"
description: "Enter long after bullish BOS with trend confirmation"
timeframe: "15m"
direction: "long"

entry:
  conditions:
    - type: "bos_occurred"
      direction: "bullish"
      lookback: 5
    - type: "price_above_ema"
      period: 200
    - type: "vwap_slope"
      direction: "up"
    - type: "retest_occurred"
      lookback: 10

exit:
  stop_loss:
    type: "atr"
    multiplier: 1.5
  take_profit:
    type: "risk_reward"
    ratio: 3.0

filters:
  - type: "volume_spike"
    threshold: 1.5

risk_percent: 1.0
max_positions: 1
"""

    # 75% Mean Reversion System
    systems['mean_reversion_75.yaml'] = """
name: "75% Mean Reversion Long"
description: "Enter long at 75% Fib level in uptrend range"
timeframe: "15m"
direction: "long"

entry:
  conditions:
    - type: "in_uptrend"
    - type: "in_range"
      min_touches: 3
    - type: "at_75_fib"
      tolerance_pct: 0.5
    - type: "candle_direction"
      direction: "bullish"

exit:
  stop_loss:
    type: "swing"
  take_profit:
    type: "level"

filters:
  - type: "price_above_ema"
    period: 200

risk_percent: 1.0
"""

    # False Breakout System
    systems['false_breakout.yaml'] = """
name: "False Breakout Long"
description: "Enter long after bullish false breakout at swing low"
timeframe: "15m"
direction: "long"

entry:
  conditions:
    - type: "false_breakout"
      direction: "bullish"
      lookback: 3
    - type: "in_uptrend"

exit:
  stop_loss:
    type: "atr"
    multiplier: 1.0
  take_profit:
    type: "risk_reward"
    ratio: 3.0

filters:
  - type: "volume_spike"
    threshold: 2.0

risk_percent: 1.0
"""

    # VWAP FB System
    systems['vwap_fb.yaml'] = """
name: "VWAP False Breakout Long"
description: "False breakout with VWAP confirmation"
timeframe: "15m"
direction: "long"

entry:
  conditions:
    - type: "false_breakout"
      direction: "bullish"
    - type: "price_above_vwap"
    - type: "vwap_slope"
      direction: "up"

exit:
  stop_loss:
    type: "atr"
    multiplier: 1.5
  take_profit:
    type: "risk_reward"
    ratio: 3.0

risk_percent: 1.0
"""

    return systems


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def load_system(path: Union[str, Path]) -> TradingSystem:
    """Quick function to load a system from file."""
    parser = SystemParser()
    return parser.load_file(path)


def load_systems(directory: Union[str, Path]) -> List[TradingSystem]:
    """Quick function to load all systems from directory."""
    parser = SystemParser()
    return parser.load_directory(directory)


def parse_system(yaml_string: str) -> TradingSystem:
    """Quick function to parse a system from YAML string."""
    parser = SystemParser()
    return parser.load_string(yaml_string)
