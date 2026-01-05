"""
Pattern Detection for the Trading Systems Engine.

Core pattern modules:
- swings: Swing High/Low detection, Interim swings, Market Structure (HH/HL/LH/LL)
- range_detector: Range identification, Fibonacci levels, Touch counting
- structure_breaks: BOS and MSB/CHOCH detection
- false_breakout: False breakout and liquidity sweep detection

All patterns work together:
1. SwingDetector identifies key pivot points
2. RangeDetector uses swings to find consolidation zones
3. BOSDetector/MSBDetector track structure breaks
4. FalseBreakoutDetector identifies failed breaks
"""

# Swing Detection
from .swings import (
    # Classes
    SwingType,
    StructureType,
    SwingPoint,
    SwingDetector,
    StructureAnalyzer,
    # Functions
    detect_swings,
    detect_major_swings,
    get_market_structure,
    get_swing_series,
    # Pre-configured
    SWING_DETECTOR_DEFAULT,
    SWING_DETECTOR_SENSITIVE,
)

# Range Detection
from .range_detector import (
    # Classes
    RangeStatus,
    FibLevels,
    Range,
    RangeDetector,
    # Functions
    detect_ranges,
    get_current_range,
    is_at_75_fib,
    get_fib_levels,
    # Pre-configured
    RANGE_DETECTOR_DEFAULT,
    RANGE_DETECTOR_STRICT,
    RANGE_DETECTOR_LOOSE,
)

# Structure Breaks (BOS/MSB)
from .structure_breaks import (
    # Classes
    BreakType,
    StructureBreak,
    BOSDetector,
    MSBDetector,
    RetestDetector,
    # Functions
    detect_bos,
    detect_msb,
    detect_all_structure_breaks,
    get_latest_bos,
    get_latest_msb,
    # Pre-configured
    BOS_DETECTOR_DEFAULT,
    MSB_DETECTOR_DEFAULT,
    RETEST_DETECTOR_DEFAULT,
)

# False Breakout / Liquidity Sweep
from .false_breakout import (
    # Classes
    FBType,
    FalseBreakout,
    FalseBreakoutDetector,
    LiquiditySweepDetector,
    # Functions
    detect_false_breakouts,
    detect_fb_at_level,
    detect_liquidity_sweeps,
    is_false_breakout,
    # Pre-configured
    FB_DETECTOR_DEFAULT,
    FB_DETECTOR_STRICT,
    LIQUIDITY_SWEEP_DEFAULT,
)


__all__ = [
    # Swing Detection
    'SwingType', 'StructureType', 'SwingPoint', 'SwingDetector', 'StructureAnalyzer',
    'detect_swings', 'detect_major_swings',
    'get_market_structure', 'get_swing_series',
    'SWING_DETECTOR_DEFAULT', 'SWING_DETECTOR_SENSITIVE',

    # Range Detection
    'RangeStatus', 'FibLevels', 'Range', 'RangeDetector',
    'detect_ranges', 'get_current_range', 'is_at_75_fib', 'get_fib_levels',
    'RANGE_DETECTOR_DEFAULT', 'RANGE_DETECTOR_STRICT', 'RANGE_DETECTOR_LOOSE',

    # Structure Breaks
    'BreakType', 'StructureBreak', 'BOSDetector', 'MSBDetector', 'RetestDetector',
    'detect_bos', 'detect_msb', 'detect_all_structure_breaks',
    'get_latest_bos', 'get_latest_msb',
    'BOS_DETECTOR_DEFAULT', 'MSB_DETECTOR_DEFAULT', 'RETEST_DETECTOR_DEFAULT',

    # False Breakout / Liquidity Sweep
    'FBType', 'FalseBreakout', 'FalseBreakoutDetector', 'LiquiditySweepDetector',
    'detect_false_breakouts', 'detect_fb_at_level', 'detect_liquidity_sweeps', 'is_false_breakout',
    'FB_DETECTOR_DEFAULT', 'FB_DETECTOR_STRICT', 'LIQUIDITY_SWEEP_DEFAULT',
]
