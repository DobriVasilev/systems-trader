"""
Hyperliquid Data Fetcher.

Fetches OHLCV candle data from Hyperliquid's API and stores it locally.
"""

import asyncio
import aiohttp
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
import json
from pathlib import Path

from .models import CandleData, Timeframe


# Hyperliquid API endpoint
HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info"

# Timeframe mapping for Hyperliquid API
TIMEFRAME_MAP = {
    Timeframe.M1: "1m",
    Timeframe.M5: "5m",
    Timeframe.M15: "15m",
    Timeframe.M30: "30m",
    Timeframe.H1: "1h",
    Timeframe.H4: "4h",
    Timeframe.D1: "1d",
    Timeframe.W1: "1w",
}


class HyperliquidFetcher:
    """
    Fetches candle data from Hyperliquid.

    Uses the public info API - no authentication required for market data.
    """

    def __init__(self, cache_dir: Optional[Path] = None):
        """
        Initialize the fetcher.

        Args:
            cache_dir: Directory to cache candle data. If None, no caching.
        """
        self.cache_dir = cache_dir
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self):
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch_candles(
        self,
        asset: str,
        timeframe: Timeframe,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        num_candles: int = 500,
    ) -> CandleData:
        """
        Fetch candle data for an asset.

        Args:
            asset: Trading pair (e.g., "BTC", "ETH")
            timeframe: Candle timeframe
            start_time: Start of data range (optional)
            end_time: End of data range (optional)
            num_candles: Number of candles to fetch if no time range specified

        Returns:
            CandleData object with the requested candles
        """
        session = await self._get_session()

        # Calculate time range if not provided
        if end_time is None:
            end_time = datetime.utcnow()

        if start_time is None:
            # Calculate start time based on num_candles and timeframe
            minutes = timeframe.minutes * num_candles
            start_time = end_time - timedelta(minutes=minutes)

        # Convert to milliseconds timestamp
        start_ts = int(start_time.timestamp() * 1000)
        end_ts = int(end_time.timestamp() * 1000)

        # Build request payload
        payload = {
            "type": "candleSnapshot",
            "req": {
                "coin": asset,
                "interval": TIMEFRAME_MAP[timeframe],
                "startTime": start_ts,
                "endTime": end_ts,
            }
        }

        async with session.post(HYPERLIQUID_INFO_URL, json=payload) as response:
            if response.status != 200:
                raise Exception(f"API error: {response.status} - {await response.text()}")

            data = await response.json()

        # Parse response into DataFrame
        # Response format: [[timestamp, open, high, low, close, volume], ...]
        if not data:
            # Return empty DataFrame
            df = pd.DataFrame(columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        else:
            df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

            # Convert types
            df['timestamp'] = df['timestamp'].astype('int64')
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = pd.to_numeric(df[col], errors='coerce')

            # Sort by timestamp
            df = df.sort_values('timestamp').reset_index(drop=True)

        return CandleData(asset=asset, timeframe=timeframe, candles=df)

    async def fetch_all_assets(self) -> list[str]:
        """Fetch list of all available trading assets."""
        session = await self._get_session()

        payload = {"type": "meta"}

        async with session.post(HYPERLIQUID_INFO_URL, json=payload) as response:
            if response.status != 200:
                raise Exception(f"API error: {response.status}")

            data = await response.json()

        # Extract asset names from universe
        assets = [asset['name'] for asset in data.get('universe', [])]
        return assets

    async def fetch_historical(
        self,
        asset: str,
        timeframe: Timeframe,
        days: int = 365,
    ) -> CandleData:
        """
        Fetch historical data for backtesting.

        Fetches data in chunks to handle API limits.

        Args:
            asset: Trading pair
            timeframe: Candle timeframe
            days: Number of days of history to fetch

        Returns:
            CandleData with all historical candles
        """
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)

        all_candles = []
        current_end = end_time

        # Fetch in chunks of 1000 candles
        chunk_minutes = timeframe.minutes * 1000

        while current_end > start_time:
            current_start = max(
                start_time,
                current_end - timedelta(minutes=chunk_minutes)
            )

            candle_data = await self.fetch_candles(
                asset=asset,
                timeframe=timeframe,
                start_time=current_start,
                end_time=current_end,
            )

            if len(candle_data) > 0:
                all_candles.append(candle_data.candles)

            current_end = current_start - timedelta(minutes=timeframe.minutes)

            # Rate limiting
            await asyncio.sleep(0.1)

        # Combine all chunks
        if all_candles:
            combined = pd.concat(all_candles, ignore_index=True)
            combined = combined.drop_duplicates(subset=['timestamp'])
            combined = combined.sort_values('timestamp').reset_index(drop=True)
        else:
            combined = pd.DataFrame(columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

        return CandleData(asset=asset, timeframe=timeframe, candles=combined)

    def save_to_cache(self, candle_data: CandleData, filename: Optional[str] = None):
        """Save candle data to local cache."""
        if not self.cache_dir:
            return

        if filename is None:
            filename = f"{candle_data.asset}_{candle_data.timeframe.value}.parquet"

        filepath = self.cache_dir / filename
        candle_data.candles.to_parquet(filepath, index=False)

    def load_from_cache(
        self,
        asset: str,
        timeframe: Timeframe,
        filename: Optional[str] = None
    ) -> Optional[CandleData]:
        """Load candle data from local cache."""
        if not self.cache_dir:
            return None

        if filename is None:
            filename = f"{asset}_{timeframe.value}.parquet"

        filepath = self.cache_dir / filename

        if not filepath.exists():
            return None

        df = pd.read_parquet(filepath)
        return CandleData(asset=asset, timeframe=timeframe, candles=df)


class DataManager:
    """
    High-level data management for the trading engine.

    Handles fetching, caching, and updating candle data.
    """

    def __init__(self, cache_dir: Path):
        """
        Initialize the data manager.

        Args:
            cache_dir: Directory for local data storage
        """
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.fetcher = HyperliquidFetcher(cache_dir)
        self._candle_cache: dict[str, CandleData] = {}

    async def get_candles(
        self,
        asset: str,
        timeframe: Timeframe,
        use_cache: bool = True,
        min_candles: int = 500,
    ) -> CandleData:
        """
        Get candle data, using cache if available.

        Args:
            asset: Trading pair
            timeframe: Candle timeframe
            use_cache: Whether to use cached data
            min_candles: Minimum number of candles required

        Returns:
            CandleData with at least min_candles
        """
        cache_key = f"{asset}_{timeframe.value}"

        # Check memory cache first
        if use_cache and cache_key in self._candle_cache:
            cached = self._candle_cache[cache_key]
            if len(cached) >= min_candles:
                return cached

        # Check disk cache
        if use_cache:
            cached = self.fetcher.load_from_cache(asset, timeframe)
            if cached and len(cached) >= min_candles:
                self._candle_cache[cache_key] = cached
                return cached

        # Fetch from API
        candles = await self.fetcher.fetch_candles(
            asset=asset,
            timeframe=timeframe,
            num_candles=max(min_candles, 500),
        )

        # Update caches
        self._candle_cache[cache_key] = candles
        self.fetcher.save_to_cache(candles)

        return candles

    async def update_candles(self, asset: str, timeframe: Timeframe) -> CandleData:
        """
        Update cached candle data with latest from API.

        Fetches only new candles since last cached timestamp.
        """
        cache_key = f"{asset}_{timeframe.value}"

        # Get existing data
        existing = self._candle_cache.get(cache_key)
        if existing is None:
            existing = self.fetcher.load_from_cache(asset, timeframe)

        if existing and len(existing) > 0:
            # Fetch only new candles
            last_ts = existing.candles['timestamp'].max()
            start_time = datetime.utcfromtimestamp(last_ts / 1000)

            new_candles = await self.fetcher.fetch_candles(
                asset=asset,
                timeframe=timeframe,
                start_time=start_time,
            )

            if len(new_candles) > 0:
                # Merge with existing
                combined = pd.concat([existing.candles, new_candles.candles], ignore_index=True)
                combined = combined.drop_duplicates(subset=['timestamp'])
                combined = combined.sort_values('timestamp').reset_index(drop=True)

                existing = CandleData(asset=asset, timeframe=timeframe, candles=combined)
        else:
            # No existing data, fetch fresh
            existing = await self.fetcher.fetch_candles(
                asset=asset,
                timeframe=timeframe,
            )

        # Update caches
        self._candle_cache[cache_key] = existing
        self.fetcher.save_to_cache(existing)

        return existing

    async def close(self):
        """Clean up resources."""
        await self.fetcher.close()
