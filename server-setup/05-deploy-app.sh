#!/bin/bash
set -euo pipefail

# Deploy Trading App
# Run as normal user: ./05-deploy-app.sh (NOT with sudo)

if [ "$EUID" -eq 0 ]; then
    echo "ERROR: Do NOT run this script with sudo"
    echo "Run as: ./05-deploy-app.sh"
    exit 1
fi

echo "=== Deploying Trading App ==="

cd ~/systems-trader/web

# Create .env file
echo "Creating .env file..."
cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://trading_user:change_this_password_in_production@localhost:5432/trading_app"

# NextAuth
AUTH_SECRET="generate-a-random-secret-here"
NEXTAUTH_URL="http://your-server-ip"

# OAuth (optional - add your keys later)
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_CLIENT_ID=""
# GITHUB_CLIENT_SECRET=""
EOF

echo "⚠️  IMPORTANT: Edit ~/systems-trader/web/.env with real values!"

# Install dependencies
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Build Next.js app
echo "Building Next.js application..."
npm run build

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/trading-app.service > /dev/null << EOF
[Unit]
Description=Trading App - Next.js Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=dobri
WorkingDirectory=/home/dobri/systems-trader/web
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:/var/log/trading-app/output.log
StandardError=append:/var/log/trading-app/error.log

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/dobri/systems-trader/web/.next
ReadWritePaths=/var/log/trading-app

[Install]
WantedBy=multi-user.target
EOF

# Create log directory
sudo mkdir -p /var/log/trading-app
sudo chown dobri:dobri /var/log/trading-app

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable trading-app
sudo systemctl start trading-app

# Wait a moment for service to start
sleep 3

# Check status
sudo systemctl status trading-app --no-pager

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Service status: systemctl status trading-app"
echo "View logs: sudo journalctl -u trading-app -f"
echo "Restart: sudo systemctl restart trading-app"
echo ""
echo "Test locally: curl http://localhost:3000"
echo ""
echo "Next steps:"
echo "1. Edit ~/systems-trader/web/.env with real values"
echo "2. Restart app: sudo systemctl restart trading-app"
echo "3. Access via browser: http://your-server-ip"
echo ""
echo "Optional: sudo ./06-setup-wireguard.sh"
