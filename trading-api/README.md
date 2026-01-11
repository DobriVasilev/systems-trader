# Trading API

Standalone trading API server for Hyperliquid. This server runs on a Bulgarian server to ensure trades come from a Bulgarian IP address (required for Hyperliquid access).

## Architecture

```
[Vercel Web App] --> [Bulgarian Trading API] --> [Hyperliquid API]
```

- **Vercel**: Hosts the web UI, authentication, database access
- **Bulgarian Server**: Runs this trading API for Hyperliquid operations
- **Communication**: Web app calls trading API via HTTPS with API key auth

## Setup

### 1. Install Dependencies

```bash
cd trading-api
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
TRADING_API_PORT=4000
TRADING_API_KEY=<generate-a-secure-key>
WALLET_ENCRYPTION_KEY=<same-key-as-web-app>
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
```

Generate secure keys:
```bash
# Generate API key
openssl rand -hex 32

# WALLET_ENCRYPTION_KEY must match the one in your web app
```

### 3. Build & Run

```bash
# Build
npm run build

# Run
npm start

# Or run in development mode
npm run dev
```

## Deployment on Bulgarian Server

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Build the project
npm run build

# Start with PM2
pm2 start dist/index.js --name trading-api

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Caddy Reverse Proxy Config

Add to your Caddyfile:
```
api.yourdomain.com {
    reverse_proxy localhost:4000
}
```

## API Endpoints

All endpoints require `X-API-Key` header with the configured API key.

### Health Check
- `GET /health` - Check if API is running

### Wallet Operations
- `POST /wallets/encrypt` - Encrypt a private key for storage

### Account Info
- `POST /account` - Get account balance and margin info
- `POST /positions` - Get open positions
- `POST /orders` - Get open orders

### Trading
- `POST /trade` - Place a limit order
- `POST /trade/market` - Place a market order
- `POST /trade/close` - Close a single position
- `POST /trade/close-all` - Close all positions
- `POST /trade/cancel` - Cancel an order
- `POST /trade/cancel-all` - Cancel all orders

### Leverage & Risk
- `POST /leverage` - Set leverage for an asset
- `POST /trade/stop-loss` - Place a stop loss order
- `POST /trade/take-profit` - Place a take profit order

### Withdrawals
- `POST /withdraw` - Withdraw USDC
- `POST /emergency-withdraw` - Emergency withdraw (skips to L1)

### Market Data
- `GET /prices` - Get all market prices
- `GET /coins` - Get available coins metadata
