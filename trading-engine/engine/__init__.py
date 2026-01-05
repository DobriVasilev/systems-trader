"""
Core Execution Engine for the Trading Systems Engine.

Components:
- SystemParser: Loads trading systems from YAML files
- SignalGenerator: Evaluates systems and generates signals
- BacktestEngine: Runs historical backtests
- LiveEngine: Executes live trades (coming soon)
"""

from .system_parser import (
    # Classes
    StopLossType,
    TakeProfitType,
    StopLossConfig,
    TakeProfitConfig,
    TradingSystem,
    SystemParser,
    # Functions
    load_system,
    load_systems,
    parse_system,
    create_example_systems,
)

from .signal_generator import (
    # Classes
    SignalType,
    Signal,
    SignalGenerator,
    SystemEvaluation,
    DebugSignalGenerator,
    # Functions
    create_signal_generator,
    generate_signals,
)

from .backtest import (
    # Classes
    TradeStatus,
    BacktestTrade,
    BacktestResults,
    BacktestEngine,
    BacktestReport,
    # Functions
    run_backtest,
    run_backtests,
    compare_results,
)


__all__ = [
    # System Parser
    'StopLossType', 'TakeProfitType',
    'StopLossConfig', 'TakeProfitConfig',
    'TradingSystem', 'SystemParser',
    'load_system', 'load_systems', 'parse_system', 'create_example_systems',

    # Signal Generator
    'SignalType', 'Signal',
    'SignalGenerator', 'SystemEvaluation', 'DebugSignalGenerator',
    'create_signal_generator', 'generate_signals',

    # Backtest
    'TradeStatus', 'BacktestTrade', 'BacktestResults',
    'BacktestEngine', 'BacktestReport',
    'run_backtest', 'run_backtests', 'compare_results',
]
