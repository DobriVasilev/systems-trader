# Systems Trader

A comprehensive trading analysis and pattern validation platform.

## Project Structure

```
systems-trader/
├── web/                    # Next.js web application (main platform)
├── desktop/                # Tauri desktop application
├── trading-engine/         # Python trading engine (indicators & patterns)
├── extension/              # TradingView browser extension
├── docs/                   # Documentation and specifications
└── legacy/                 # Archived files
```

## Components

### Web Application (`/web`)
The main Systems Trader platform built with:
- **Next.js 15** with App Router
- **Prisma** + Neon PostgreSQL
- **NextAuth.js** for authentication (Google, GitHub OAuth)
- **Upstash Redis** for rate limiting and real-time features
- **Cloudflare R2** for file storage
- **TradingView Lightweight Charts** for candlestick visualization

Features:
- Collaborative pattern validation sessions
- Real-time multi-user editing
- Pattern detection with corrections and comments
- Session sharing and export

### Desktop Application (`/desktop`)
Cross-platform desktop app built with:
- **Tauri** (Rust backend)
- **React** + **Vite** (frontend)
- Native system integration

### Trading Engine (`/trading-engine`)
Python-based trading analysis engine with:
- **Indicators**: MA, EMA, RSI, MACD, ATR, Bollinger Bands, VWAP
- **Patterns**: Swing detection, BOS/MSB, Range detection, False breakouts
- **Backtesting**: Historical performance analysis
- **Signal generation**: Configurable trading systems

### Browser Extension (`/extension`)
TradingView integration extension for chart data extraction.

## Getting Started

### Web Application
```bash
cd web
npm install
cp .env.example .env  # Configure your environment variables
npx prisma generate
npx prisma db push
npm run dev
```

### Desktop Application
```bash
cd desktop
npm install
npm run tauri dev
```

### Trading Engine
```bash
cd trading-engine
pip install -r requirements.txt
python visualize_swings.py
```

## Documentation

See the `/docs` folder for:
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Vision Document](docs/VISION.md)
- [Pattern Tool Specification](docs/specs/PATTERN_TOOL_SPEC.md)
- [Server Infrastructure](docs/specs/SERVER_INFRASTRUCTURE.md)
- [Trading Systems Engine](docs/specs/TRADING_SYSTEMS_ENGINE_SPEC.md)

## License

Private - All rights reserved.
