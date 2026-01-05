"""
Swing Visualization Tool.

Generates an interactive HTML chart showing detected swings.
Open the generated HTML file in a browser to compare bot's swings vs your manual analysis.
"""

import pandas as pd
import json
from datetime import datetime, timedelta
from typing import Optional
import urllib.request

from patterns.swings import detect_swings, SwingType


def fetch_candles(symbol: str = "BTC", interval: str = "4h", days: int = 30) -> pd.DataFrame:
    """Fetch candle data from Hyperliquid API."""

    # Calculate time range
    end_time = int(datetime.now().timestamp() * 1000)
    start_time = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)

    # Map interval to Hyperliquid format
    interval_map = {
        "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
        "1h": "1h", "4h": "4h", "1d": "1d"
    }
    hl_interval = interval_map.get(interval, "4h")

    # API request
    url = "https://api.hyperliquid.xyz/info"
    payload = {
        "type": "candleSnapshot",
        "req": {
            "coin": symbol,
            "interval": hl_interval,
            "startTime": start_time,
            "endTime": end_time
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}
    )

    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())

    # Parse response
    candles = []
    for candle in data:
        candles.append({
            "datetime": pd.to_datetime(candle['t'], unit='ms'),
            "open": float(candle['o']),
            "high": float(candle['h']),
            "low": float(candle['l']),
            "close": float(candle['c']),
            "volume": float(candle['v'])
        })

    df = pd.DataFrame(candles)
    df = df.sort_values('datetime').reset_index(drop=True)
    return df


def generate_chart_html(
    candles: pd.DataFrame,
    swings: list,
    title: str = "Swing Detection Visualization"
) -> str:
    """Generate interactive HTML chart with swing markers."""

    # Prepare candlestick data for lightweight-charts
    candlestick_data = []
    for _, row in candles.iterrows():
        candlestick_data.append({
            "time": int(row['datetime'].timestamp()),
            "open": row['open'],
            "high": row['high'],
            "low": row['low'],
            "close": row['close']
        })

    # Prepare swing markers
    markers = []
    for swing in swings:
        ts = int(pd.to_datetime(candles['datetime'].iloc[swing.index]).timestamp())

        if swing.is_high():
            markers.append({
                "time": ts,
                "position": "aboveBar",
                "color": "#ef5350",
                "shape": "arrowDown",
                "text": f"SH {swing.structure.value if swing.structure else ''}"
            })
        else:
            markers.append({
                "time": ts,
                "position": "belowBar",
                "color": "#26a69a",
                "shape": "arrowUp",
                "text": f"SL {swing.structure.value if swing.structure else ''}"
            })

    # Sort markers by time
    markers.sort(key=lambda x: x['time'])

    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>{title}</title>
    <script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
    <style>
        body {{
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
        }}
        h1 {{
            margin: 0 0 10px 0;
            font-size: 18px;
            color: #fff;
        }}
        .info {{
            margin-bottom: 15px;
            font-size: 13px;
            color: #888;
        }}
        .legend {{
            display: flex;
            gap: 20px;
            margin-bottom: 10px;
            font-size: 12px;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 5px;
        }}
        .legend-dot {{
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }}
        #chart {{
            width: 100%;
            height: calc(100vh - 120px);
            border-radius: 8px;
            overflow: hidden;
        }}
        .swing-list {{
            margin-top: 20px;
            max-height: 200px;
            overflow-y: auto;
            font-size: 12px;
            font-family: monospace;
        }}
        .swing-list table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .swing-list th, .swing-list td {{
            padding: 5px 10px;
            text-align: left;
            border-bottom: 1px solid #333;
        }}
        .swing-list th {{
            background: #252540;
            position: sticky;
            top: 0;
        }}
        .high {{ color: #ef5350; }}
        .low {{ color: #26a69a; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <div class="info">
        {len(candles)} candles | {len(swings)} confirmed swings
        ({len([s for s in swings if s.is_high()])} highs, {len([s for s in swings if s.is_low()])} lows)
    </div>
    <div class="legend">
        <div class="legend-item">
            <div class="legend-dot" style="background: #26a69a;"></div>
            <span>Swing Low (confirmed by break above)</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: #ef5350;"></div>
            <span>Swing High (confirmed by break below)</span>
        </div>
    </div>
    <div id="chart"></div>

    <div class="swing-list">
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Structure</th>
                    <th>Price</th>
                    <th>Formed</th>
                    <th>Confirmed</th>
                </tr>
            </thead>
            <tbody>
"""

    # Add swing details to table
    for swing in swings:
        swing_class = "high" if swing.is_high() else "low"
        swing_type = "HIGH" if swing.is_high() else "LOW"
        structure = swing.structure.value if swing.structure else "-"
        formed = pd.to_datetime(candles['datetime'].iloc[swing.index]).strftime('%m/%d %H:%M')
        confirmed = pd.to_datetime(candles['datetime'].iloc[swing.confirmed_at_index]).strftime('%m/%d %H:%M')

        html += f"""
                <tr class="{swing_class}">
                    <td>{swing_type}</td>
                    <td>{structure}</td>
                    <td>${swing.price:,.2f}</td>
                    <td>{formed}</td>
                    <td>{confirmed}</td>
                </tr>"""

    html += f"""
            </tbody>
        </table>
    </div>

    <script>
        const chart = LightweightCharts.createChart(document.getElementById('chart'), {{
            layout: {{
                background: {{ type: 'solid', color: '#1a1a2e' }},
                textColor: '#d1d4dc',
            }},
            grid: {{
                vertLines: {{ color: '#2a2a4a' }},
                horzLines: {{ color: '#2a2a4a' }},
            }},
            crosshair: {{
                mode: LightweightCharts.CrosshairMode.Normal,
            }},
            rightPriceScale: {{
                borderColor: '#2a2a4a',
            }},
            timeScale: {{
                borderColor: '#2a2a4a',
                timeVisible: true,
                secondsVisible: false,
            }},
        }});

        const candlestickSeries = chart.addCandlestickSeries({{
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
        }});

        const data = {json.dumps(candlestick_data)};
        candlestickSeries.setData(data);

        const markers = {json.dumps(markers)};
        candlestickSeries.setMarkers(markers);

        chart.timeScale().fitContent();

        // Handle resize
        window.addEventListener('resize', () => {{
            chart.applyOptions({{ width: document.getElementById('chart').clientWidth }});
        }});
    </script>
</body>
</html>
"""
    return html


def visualize(
    symbol: str = "BTC",
    interval: str = "4h",
    days: int = 30,
    output_file: Optional[str] = None
) -> str:
    """
    Fetch data, detect swings, and generate visualization.

    Args:
        symbol: Trading symbol (e.g., "BTC", "ETH")
        interval: Candle interval ("1m", "5m", "15m", "30m", "1h", "4h", "1d")
        days: Number of days of history
        output_file: Output HTML file path (default: /tmp/swings_{symbol}_{interval}.html)

    Returns:
        Path to generated HTML file
    """
    print(f"Fetching {symbol} {interval} data for last {days} days...")
    candles = fetch_candles(symbol, interval, days)
    print(f"Loaded {len(candles)} candles")

    print("Detecting swings...")
    swings = detect_swings(candles)
    print(f"Found {len(swings)} confirmed swings")

    print("Generating chart...")
    html = generate_chart_html(candles, swings, f"{symbol} {interval} - Swing Detection")

    if output_file is None:
        output_file = f"/tmp/swings_{symbol.lower()}_{interval}.html"

    with open(output_file, 'w') as f:
        f.write(html)

    print(f"Chart saved to: {output_file}")
    return output_file


if __name__ == "__main__":
    import sys

    symbol = sys.argv[1] if len(sys.argv) > 1 else "BTC"
    interval = sys.argv[2] if len(sys.argv) > 2 else "4h"
    days = int(sys.argv[3]) if len(sys.argv) > 3 else 30

    output_file = visualize(symbol, interval, days)
    print(f"\nOpen in browser: file://{output_file}")
