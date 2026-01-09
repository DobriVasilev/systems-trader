#!/bin/bash
set -euo pipefail

# Install Node.js 20 LTS and PM2
# Run as: sudo ./03-install-nodejs.sh

echo "=== Installing Node.js 20 LTS ==="

# Install Node.js 20 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install global packages
echo "Installing global npm packages..."
npm install -g pnpm pm2

# Configure PM2 for auto-start on boot
pm2 startup systemd -u dobri --hp /home/dobri
# Note: The above command will output a command to run. Copy and run it.

echo "=== Node.js Installation Complete ==="
echo ""
echo "Versions installed:"
node --version
npm --version
pnpm --version
pm2 --version
echo ""
echo "Next: sudo ./04-install-postgres.sh"
