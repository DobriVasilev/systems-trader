#!/bin/bash
set -euo pipefail

# Set up system monitoring and health checks
# Run as: sudo ./08-setup-monitoring.sh

echo "=== Setting Up Monitoring ==="

# Install monitoring tools
apt install -y \
    htop \
    iotop \
    nethogs \
    ncdu \
    glances

# Create health check script
cat > /usr/local/bin/health-check.sh << 'EOF'
#!/bin/bash

# Health check script for trading app infrastructure

echo "=== Trading Server Health Check ==="
echo "Generated: $(date)"
echo ""

# System resources
echo "=== System Resources ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}'
echo ""

echo "Memory Usage:"
free -h | awk 'NR==2{printf "Used: %s / %s (%.2f%%)\n", $3,$2,$3*100/$2 }'
echo ""

echo "Disk Usage:"
df -h / | awk 'NR==2{printf "Used: %s / %s (%s)\n", $3,$2,$5}'
echo ""

# Service status
echo "=== Service Status ==="
services=("caddy" "trading-app" "postgresql" "wg-quick@wg0" "fail2ban")

for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "✓ $service: RUNNING"
    else
        echo "✗ $service: STOPPED"
    fi
done
echo ""

# Network
echo "=== Network ==="
echo "Public IP: $(curl -s ifconfig.me)"
echo "Open ports:"
ss -tulpn | grep LISTEN | awk '{print $5}' | sed 's/.*://' | sort -u | tr '\n' ', ' | sed 's/,$/\n/'
echo ""

# Application health
echo "=== Application Health ==="
if curl -sf http://localhost:3000 > /dev/null; then
    echo "✓ Next.js app responding"
else
    echo "✗ Next.js app not responding"
fi

if curl -sf http://localhost > /dev/null; then
    echo "✓ Caddy responding"
else
    echo "✗ Caddy not responding"
fi
echo ""

# Database
echo "=== Database ==="
PGPASSWORD='change_this_password_in_production' psql -U trading_user -d trading_app -c "SELECT version();" > /dev/null 2>&1 && echo "✓ PostgreSQL accessible" || echo "✗ PostgreSQL not accessible"
echo ""

# Recent errors (last hour)
echo "=== Recent Errors (Last Hour) ==="
echo "Trading app errors:"
journalctl -u trading-app --since "1 hour ago" | grep -i error | tail -5 || echo "No errors"
echo ""

# Disk space warning
DISK_USAGE=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  WARNING: Disk usage is ${DISK_USAGE}%"
fi

# Memory warning
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2 }')
if [ "$MEM_USAGE" -gt 90 ]; then
    echo "⚠️  WARNING: Memory usage is ${MEM_USAGE}%"
fi

echo ""
echo "=== End Health Check ==="
EOF

chmod +x /usr/local/bin/health-check.sh

# Create monitoring dashboard script
cat > /usr/local/bin/monitor-trading-app.sh << 'EOF'
#!/bin/bash

# Interactive monitoring dashboard

echo "Trading App Monitoring Dashboard"
echo "================================="
echo ""
echo "1. System resources (htop)"
echo "2. Network activity (nethogs)"
echo "3. Disk I/O (iotop)"
echo "4. Overall dashboard (glances)"
echo "5. Service logs (journalctl)"
echo "6. Health check report"
echo "7. Exit"
echo ""

read -p "Select option (1-7): " option

case $option in
    1) htop ;;
    2) sudo nethogs ;;
    3) sudo iotop ;;
    4) glances ;;
    5) sudo journalctl -u trading-app -f ;;
    6) /usr/local/bin/health-check.sh ;;
    7) exit 0 ;;
    *) echo "Invalid option" ;;
esac
EOF

chmod +x /usr/local/bin/monitor-trading-app.sh

# Set up health check timer (runs every 6 hours)
cat > /etc/systemd/system/trading-app-healthcheck.service << 'EOF'
[Unit]
Description=Trading App Health Check
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/health-check.sh
StandardOutput=append:/var/log/trading-app/healthcheck.log
StandardError=append:/var/log/trading-app/healthcheck.log
EOF

cat > /etc/systemd/system/trading-app-healthcheck.timer << 'EOF'
[Unit]
Description=Trading App Health Check Timer

[Timer]
OnBootSec=5min
OnUnitActiveSec=6h
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable trading-app-healthcheck.timer
systemctl start trading-app-healthcheck.timer

# Run initial health check
echo "Running initial health check..."
/usr/local/bin/health-check.sh

echo ""
echo "=== Monitoring Setup Complete ==="
echo ""
echo "Available commands:"
echo "  health-check.sh           - Run health check"
echo "  monitor-trading-app.sh    - Interactive monitoring menu"
echo "  htop                      - System resources"
echo "  glances                   - Overall dashboard"
echo ""
echo "Automated health checks run every 6 hours"
echo "View health check log: tail -f /var/log/trading-app/healthcheck.log"
echo "View timers: systemctl list-timers"
