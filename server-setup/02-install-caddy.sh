#!/bin/bash
set -euo pipefail

# Install Caddy Web Server (Modern, Auto-HTTPS)
# Run as: sudo ./02-install-caddy.sh

echo "=== Installing Caddy Web Server ==="

# Add Caddy repository
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list

# Install Caddy
apt update
apt install -y caddy

# Create directory for web app
mkdir -p /var/www/trading-app
chown -R caddy:caddy /var/www/trading-app

# Basic Caddyfile configuration
cat > /etc/caddy/Caddyfile << 'EOF'
# Trading App Configuration
# Replace with your actual domain once you have one

:80 {
    # Serve static Next.js build
    root * /var/www/trading-app
    file_server

    # API proxy to Node.js backend
    reverse_proxy /api/* localhost:3000
    reverse_proxy /socket.io/* localhost:3000 {
        transport http {
            compression off
        }
    }

    # Enable gzip compression
    encode gzip

    # Security headers
    header {
        # Remove server header
        -Server

        # Security headers
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"

        # Cache static assets
        Cache-Control "public, max-age=31536000, immutable" {
            path /_next/static/*
        }
    }

    # Logging
    log {
        output file /var/log/caddy/access.log
        format json
    }
}

# HTTPS configuration (when you have a domain)
# trader.yourdomain.com {
#     reverse_proxy localhost:3000
#     encode gzip
#
#     header {
#         -Server
#         X-Content-Type-Options "nosniff"
#         X-Frame-Options "DENY"
#         Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
#     }
# }
EOF

# Create log directory
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy

# Enable and start Caddy
systemctl enable caddy
systemctl restart caddy

# Check status
systemctl status caddy --no-pager

echo "=== Caddy Installation Complete ==="
echo ""
echo "Caddy is now running on port 80"
echo "Test it: curl http://localhost"
echo ""
echo "Next: ./03-install-nodejs.sh"
