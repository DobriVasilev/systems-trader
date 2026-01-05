"""
Technical Indicators for the Trading Systems Engine.

All indicators follow a consistent interface:
- Class-based: Create instance, call calculate()
- Function-based: Quick functions for simple use

Example:
    # Class-based (more control)
    rsi_indicator = RSI(period=14)
    result = rsi_indicator.calculate(candles)
    print(result.latest)

    # Function-based (quick use)
    rsi_values = rsi(candles, period=14)
"""

# Base classes and utilities
from .base import (
    BaseIndicator,
    IndicatorResult,
    crossover,
    crossunder,
    is_above,
    is_below,
    percent_change,
    normalize,
    slope,
)

# Moving Averages
from .moving_averages import (
    SMA, EMA, WMA,
    sma, ema, wma,
    # Pre-configured
    EMA_12, EMA_21, EMA_50, EMA_100, EMA_200, EMA_300,
    SMA_20, SMA_50, SMA_200,
)

# Volatility
from .volatility import (
    ATR, TrueRange, BollingerBands, StandardDeviation, ATRPercent,
    atr, true_range, bollinger_bands, std_dev,
    # Pre-configured
    ATR_14, ATR_7,
)

# Momentum
from .momentum import (
    RSI, MACD, Stochastic, MomentumOscillator, ROC,
    rsi, macd, stochastic, momentum, roc,
    # Pre-configured
    RSI_14, RSI_7, MACD_DEFAULT,
)

# VWAP
from .vwap import (
    VWAP, VWAP2Day, VWAPBands,
    vwap, vwap_2day, vwap_with_slope, vwap_bands,
    # Pre-configured
    VWAP_SESSION, VWAP_CUMULATIVE, VWAP_2DAY,
)

# Volume
from .volume import (
    VolumeSMA, VolumeSpike, CVD, OBV, VolumeProfile, RelativeVolume,
    volume_sma, volume_spike, volume_ratio, cvd, obv, relative_volume, volume_profile,
    # Pre-configured
    VOL_SMA_20, VOL_SPIKE_2X, VOL_SPIKE_3X, CVD_ROLLING,
)

# Trend
from .trend import (
    ADX, Supertrend, TrendStrength,
    adx, adx_with_di, supertrend, supertrend_with_dir, trend_strength,
    # Pre-configured
    ADX_14, SUPERTREND_DEFAULT,
)


__all__ = [
    # Base
    'BaseIndicator', 'IndicatorResult',
    'crossover', 'crossunder', 'is_above', 'is_below',
    'percent_change', 'normalize', 'slope',

    # Moving Averages
    'SMA', 'EMA', 'WMA', 'sma', 'ema', 'wma',
    'EMA_12', 'EMA_21', 'EMA_50', 'EMA_100', 'EMA_200', 'EMA_300',
    'SMA_20', 'SMA_50', 'SMA_200',

    # Volatility
    'ATR', 'TrueRange', 'BollingerBands', 'StandardDeviation', 'ATRPercent',
    'atr', 'true_range', 'bollinger_bands', 'std_dev',
    'ATR_14', 'ATR_7',

    # Momentum
    'RSI', 'MACD', 'Stochastic', 'MomentumOscillator', 'ROC',
    'rsi', 'macd', 'stochastic', 'momentum', 'roc',
    'RSI_14', 'RSI_7', 'MACD_DEFAULT',

    # VWAP
    'VWAP', 'VWAP2Day', 'VWAPBands',
    'vwap', 'vwap_2day', 'vwap_with_slope', 'vwap_bands',
    'VWAP_SESSION', 'VWAP_CUMULATIVE', 'VWAP_2DAY',

    # Volume
    'VolumeSMA', 'VolumeSpike', 'CVD', 'OBV', 'VolumeProfile', 'RelativeVolume',
    'volume_sma', 'volume_spike', 'volume_ratio', 'cvd', 'obv', 'relative_volume', 'volume_profile',
    'VOL_SMA_20', 'VOL_SPIKE_2X', 'VOL_SPIKE_3X', 'CVD_ROLLING',

    # Trend
    'ADX', 'Supertrend', 'TrendStrength',
    'adx', 'adx_with_di', 'supertrend', 'supertrend_with_dir', 'trend_strength',
    'ADX_14', 'SUPERTREND_DEFAULT',
]
