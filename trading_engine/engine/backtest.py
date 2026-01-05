"""
Backtest Engine.

Runs historical backtests on trading systems.
Designed for mass testing 10+ systems per day.

Key features:
- Deterministic execution (same data = same results)
- Detailed trade logging
- Performance metrics (win rate, profit factor, Sharpe, etc.)
- Multi-system parallel testing
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed

from .system_parser import TradingSystem
from .signal_generator import SignalGenerator, Signal, SignalType


class TradeStatus(Enum):
    """Status of a backtest trade."""
    OPEN = "open"
    CLOSED_TP = "closed_tp"      # Hit take profit
    CLOSED_SL = "closed_sl"      # Hit stop loss
    CLOSED_SIGNAL = "closed_signal"  # Opposite signal
    CLOSED_EOD = "closed_eod"    # End of data


@dataclass
class BacktestTrade:
    """
    A single trade in a backtest.

    Records all details for analysis.
    """
    trade_id: int
    system_name: str
    signal_type: SignalType

    # Entry
    entry_time: datetime
    entry_price: float
    entry_bar: int

    # Exit
    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    exit_bar: Optional[int] = None
    exit_reason: Optional[TradeStatus] = None

    # Levels
    stop_loss: float = 0.0
    take_profit: float = 0.0

    # Position
    position_size: float = 0.0
    risk_amount: float = 0.0

    # Results
    pnl: float = 0.0
    pnl_percent: float = 0.0
    r_multiple: float = 0.0

    @property
    def is_open(self) -> bool:
        return self.exit_time is None

    @property
    def is_winner(self) -> bool:
        return self.pnl > 0

    @property
    def duration_bars(self) -> int:
        if self.exit_bar is None:
            return 0
        return self.exit_bar - self.entry_bar


@dataclass
class BacktestResults:
    """
    Complete results from a backtest run.

    Contains all trades and calculated metrics.
    """
    system_name: str
    symbol: str
    timeframe: str
    start_date: datetime
    end_date: datetime

    # Trade list
    trades: List[BacktestTrade] = field(default_factory=list)

    # Account tracking
    initial_balance: float = 10000.0
    final_balance: float = 10000.0
    peak_balance: float = 10000.0
    max_drawdown: float = 0.0
    max_drawdown_percent: float = 0.0

    # Pre-calculated metrics
    _metrics: Dict[str, float] = field(default_factory=dict)

    @property
    def total_trades(self) -> int:
        return len(self.trades)

    @property
    def winning_trades(self) -> int:
        return sum(1 for t in self.trades if t.is_winner)

    @property
    def losing_trades(self) -> int:
        return sum(1 for t in self.trades if not t.is_winner and not t.is_open)

    @property
    def win_rate(self) -> float:
        closed = [t for t in self.trades if not t.is_open]
        if not closed:
            return 0.0
        return self.winning_trades / len(closed) * 100

    @property
    def total_pnl(self) -> float:
        return sum(t.pnl for t in self.trades)

    @property
    def total_pnl_percent(self) -> float:
        return (self.final_balance - self.initial_balance) / self.initial_balance * 100

    @property
    def avg_winner(self) -> float:
        winners = [t.pnl for t in self.trades if t.is_winner]
        return np.mean(winners) if winners else 0.0

    @property
    def avg_loser(self) -> float:
        losers = [t.pnl for t in self.trades if not t.is_winner and not t.is_open]
        return np.mean(losers) if losers else 0.0

    @property
    def profit_factor(self) -> float:
        gross_profit = sum(t.pnl for t in self.trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in self.trades if t.pnl < 0))
        return gross_profit / gross_loss if gross_loss > 0 else float('inf')

    @property
    def avg_r_multiple(self) -> float:
        r_multiples = [t.r_multiple for t in self.trades if not t.is_open]
        return np.mean(r_multiples) if r_multiples else 0.0

    @property
    def expectancy(self) -> float:
        """Expected R per trade."""
        if not self.trades:
            return 0.0
        return (self.win_rate / 100 * self.avg_r_multiple) - ((1 - self.win_rate / 100) * 1.0)

    def to_dict(self) -> Dict[str, Any]:
        """Convert results to dictionary for reporting."""
        return {
            'system_name': self.system_name,
            'symbol': self.symbol,
            'timeframe': self.timeframe,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'losing_trades': self.losing_trades,
            'win_rate': round(self.win_rate, 2),
            'total_pnl': round(self.total_pnl, 2),
            'total_pnl_percent': round(self.total_pnl_percent, 2),
            'profit_factor': round(self.profit_factor, 2),
            'avg_r_multiple': round(self.avg_r_multiple, 2),
            'expectancy': round(self.expectancy, 2),
            'max_drawdown_percent': round(self.max_drawdown_percent, 2),
            'initial_balance': self.initial_balance,
            'final_balance': round(self.final_balance, 2),
        }

    def summary(self) -> str:
        """Generate human-readable summary."""
        return f"""
=== Backtest Results: {self.system_name} ===
Symbol: {self.symbol} | Timeframe: {self.timeframe}
Period: {self.start_date} to {self.end_date}

TRADES:
  Total: {self.total_trades}
  Winners: {self.winning_trades} | Losers: {self.losing_trades}
  Win Rate: {self.win_rate:.1f}%

PERFORMANCE:
  Total P&L: ${self.total_pnl:,.2f} ({self.total_pnl_percent:.1f}%)
  Profit Factor: {self.profit_factor:.2f}
  Avg R-Multiple: {self.avg_r_multiple:.2f}
  Expectancy: {self.expectancy:.2f}R

RISK:
  Max Drawdown: {self.max_drawdown_percent:.1f}%
  Final Balance: ${self.final_balance:,.2f}
"""


class BacktestEngine:
    """
    Runs backtests on trading systems.

    Simulates trading through historical data bar by bar.
    """

    def __init__(
        self,
        initial_balance: float = 10000.0,
        commission_pct: float = 0.0,
        slippage_pct: float = 0.0,
    ):
        """
        Initialize Backtest Engine.

        Args:
            initial_balance: Starting account balance
            commission_pct: Commission as percentage of trade value
            slippage_pct: Slippage as percentage of price
        """
        self.initial_balance = initial_balance
        self.commission_pct = commission_pct
        self.slippage_pct = slippage_pct
        self.signal_generator = SignalGenerator()

    def run(
        self,
        system: TradingSystem,
        candles: pd.DataFrame,
        symbol: str,
    ) -> BacktestResults:
        """
        Run a backtest on a single system.

        Args:
            system: Trading system to test
            candles: Historical OHLCV data
            symbol: Trading symbol

        Returns:
            BacktestResults with all trades and metrics
        """
        # Initialize
        self.signal_generator.add_system(system)

        trades: List[BacktestTrade] = []
        balance = self.initial_balance
        peak_balance = balance
        max_drawdown = 0.0
        trade_id = 0
        current_trade: Optional[BacktestTrade] = None

        # Determine date range
        start_date = datetime.now()
        end_date = datetime.now()
        if 'timestamp' in candles.columns:
            start_date = pd.to_datetime(candles['timestamp'].iloc[0])
            end_date = pd.to_datetime(candles['timestamp'].iloc[-1])

        # Walk through each bar
        min_bars = 50  # Need minimum history for indicators
        for i in range(min_bars, len(candles)):
            bar_data = candles.iloc[:i+1]
            current_bar = candles.iloc[i]
            bar_timestamp = datetime.now()
            if 'timestamp' in candles.columns:
                bar_timestamp = pd.to_datetime(current_bar['timestamp'])

            high = current_bar['high']
            low = current_bar['low']
            close = current_bar['close']

            # Check if we have an open trade
            if current_trade is not None:
                # Check for exit
                exit_price, exit_reason = self._check_exit(
                    trade=current_trade,
                    high=high,
                    low=low,
                    close=close,
                )

                if exit_price is not None:
                    # Close the trade
                    current_trade.exit_time = bar_timestamp
                    current_trade.exit_price = exit_price
                    current_trade.exit_bar = i
                    current_trade.exit_reason = exit_reason

                    # Calculate P&L
                    if current_trade.signal_type == SignalType.LONG:
                        current_trade.pnl = (exit_price - current_trade.entry_price) * current_trade.position_size
                    else:
                        current_trade.pnl = (current_trade.entry_price - exit_price) * current_trade.position_size

                    # Apply commission
                    commission = abs(current_trade.pnl) * (self.commission_pct / 100)
                    current_trade.pnl -= commission

                    # Calculate R-multiple
                    if current_trade.risk_amount > 0:
                        current_trade.r_multiple = current_trade.pnl / (current_trade.risk_amount * current_trade.position_size)

                    # Update balance
                    balance += current_trade.pnl
                    current_trade.pnl_percent = (current_trade.pnl / self.initial_balance) * 100

                    trades.append(current_trade)
                    current_trade = None

                    # Track drawdown
                    if balance > peak_balance:
                        peak_balance = balance
                    drawdown = peak_balance - balance
                    if drawdown > max_drawdown:
                        max_drawdown = drawdown

            # Check for new entry (only if no open trade)
            if current_trade is None:
                signals = self.signal_generator.generate_signals(
                    candles=bar_data,
                    symbol=symbol,
                    account_balance=balance,
                )

                if signals:
                    signal = signals[0]  # Take first signal

                    # Apply slippage to entry
                    slippage = close * (self.slippage_pct / 100)
                    if signal.signal_type == SignalType.LONG:
                        entry_price = close + slippage
                    else:
                        entry_price = close - slippage

                    trade_id += 1
                    current_trade = BacktestTrade(
                        trade_id=trade_id,
                        system_name=system.name,
                        signal_type=signal.signal_type,
                        entry_time=bar_timestamp,
                        entry_price=entry_price,
                        entry_bar=i,
                        stop_loss=signal.stop_loss,
                        take_profit=signal.take_profit,
                        position_size=signal.position_size,
                        risk_amount=signal.risk_amount,
                    )

        # Close any remaining open trade at end of data
        if current_trade is not None:
            current_trade.exit_time = end_date
            current_trade.exit_price = candles['close'].iloc[-1]
            current_trade.exit_bar = len(candles) - 1
            current_trade.exit_reason = TradeStatus.CLOSED_EOD

            if current_trade.signal_type == SignalType.LONG:
                current_trade.pnl = (current_trade.exit_price - current_trade.entry_price) * current_trade.position_size
            else:
                current_trade.pnl = (current_trade.entry_price - current_trade.exit_price) * current_trade.position_size

            if current_trade.risk_amount > 0:
                current_trade.r_multiple = current_trade.pnl / (current_trade.risk_amount * current_trade.position_size)

            balance += current_trade.pnl
            trades.append(current_trade)

        # Clear system for next run
        self.signal_generator.systems = []

        return BacktestResults(
            system_name=system.name,
            symbol=symbol,
            timeframe=system.timeframe,
            start_date=start_date,
            end_date=end_date,
            trades=trades,
            initial_balance=self.initial_balance,
            final_balance=balance,
            peak_balance=peak_balance,
            max_drawdown=max_drawdown,
            max_drawdown_percent=(max_drawdown / peak_balance * 100) if peak_balance > 0 else 0,
        )

    def _check_exit(
        self,
        trade: BacktestTrade,
        high: float,
        low: float,
        close: float,
    ) -> Tuple[Optional[float], Optional[TradeStatus]]:
        """
        Check if trade should exit on current bar.

        Returns (exit_price, exit_reason) or (None, None) if no exit.
        """
        if trade.signal_type == SignalType.LONG:
            # Check stop loss (low touches SL)
            if low <= trade.stop_loss:
                return trade.stop_loss, TradeStatus.CLOSED_SL

            # Check take profit (high touches TP)
            if high >= trade.take_profit:
                return trade.take_profit, TradeStatus.CLOSED_TP

        else:  # SHORT
            # Check stop loss (high touches SL)
            if high >= trade.stop_loss:
                return trade.stop_loss, TradeStatus.CLOSED_SL

            # Check take profit (low touches TP)
            if low <= trade.take_profit:
                return trade.take_profit, TradeStatus.CLOSED_TP

        return None, None

    def run_multiple(
        self,
        systems: List[TradingSystem],
        candles: pd.DataFrame,
        symbol: str,
        parallel: bool = True,
    ) -> List[BacktestResults]:
        """
        Run backtests on multiple systems.

        Args:
            systems: List of systems to test
            candles: Historical data
            symbol: Trading symbol
            parallel: Run in parallel (faster)

        Returns:
            List of BacktestResults
        """
        results = []

        if parallel:
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = {
                    executor.submit(self.run, system, candles, symbol): system
                    for system in systems
                }

                for future in as_completed(futures):
                    try:
                        result = future.result()
                        results.append(result)
                    except Exception as e:
                        system = futures[future]
                        print(f"Error running {system.name}: {e}")
        else:
            for system in systems:
                try:
                    result = self.run(system, candles, symbol)
                    results.append(result)
                except Exception as e:
                    print(f"Error running {system.name}: {e}")

        return results


class BacktestReport:
    """
    Generates reports from backtest results.

    Supports multiple output formats.
    """

    @staticmethod
    def compare_systems(results: List[BacktestResults]) -> pd.DataFrame:
        """
        Create comparison table of multiple system results.

        Returns DataFrame sorted by expectancy.
        """
        data = []
        for r in results:
            data.append({
                'System': r.system_name,
                'Trades': r.total_trades,
                'Win Rate %': round(r.win_rate, 1),
                'Profit Factor': round(r.profit_factor, 2),
                'Avg R': round(r.avg_r_multiple, 2),
                'Expectancy': round(r.expectancy, 2),
                'Max DD %': round(r.max_drawdown_percent, 1),
                'Total P&L %': round(r.total_pnl_percent, 1),
            })

        df = pd.DataFrame(data)
        return df.sort_values('Expectancy', ascending=False)

    @staticmethod
    def trade_log(results: BacktestResults) -> pd.DataFrame:
        """Create detailed trade log DataFrame."""
        data = []
        for t in results.trades:
            data.append({
                'ID': t.trade_id,
                'Type': t.signal_type.value,
                'Entry Time': t.entry_time,
                'Entry Price': round(t.entry_price, 4),
                'Exit Time': t.exit_time,
                'Exit Price': round(t.exit_price, 4) if t.exit_price else None,
                'Exit Reason': t.exit_reason.value if t.exit_reason else None,
                'P&L': round(t.pnl, 2),
                'R-Multiple': round(t.r_multiple, 2),
                'Duration (bars)': t.duration_bars,
            })

        return pd.DataFrame(data)


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def run_backtest(
    system: TradingSystem,
    candles: pd.DataFrame,
    symbol: str,
    initial_balance: float = 10000.0,
) -> BacktestResults:
    """Quick function to run a backtest."""
    engine = BacktestEngine(initial_balance=initial_balance)
    return engine.run(system, candles, symbol)


def run_backtests(
    systems: List[TradingSystem],
    candles: pd.DataFrame,
    symbol: str,
    initial_balance: float = 10000.0,
    parallel: bool = True,
) -> List[BacktestResults]:
    """Quick function to run multiple backtests."""
    engine = BacktestEngine(initial_balance=initial_balance)
    return engine.run_multiple(systems, candles, symbol, parallel)


def compare_results(results: List[BacktestResults]) -> pd.DataFrame:
    """Quick function to compare backtest results."""
    return BacktestReport.compare_systems(results)
