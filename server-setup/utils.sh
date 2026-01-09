#!/bin/bash

# Utility functions for managing trading server
# Source this file: source utils.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Quick status check
status() {
    echo -e "${GREEN}=== Service Status ===${NC}"
    systemctl status caddy --no-pager | head -3
    systemctl status trading-app --no-pager | head -3
    systemctl status postgresql --no-pager | head -3
}

# Restart all services
restart_all() {
    echo -e "${YELLOW}Restarting all services...${NC}"
    sudo systemctl restart postgresql
    sudo systemctl restart trading-app
    sudo systemctl restart caddy
    echo -e "${GREEN}All services restarted${NC}"
}

# View logs
logs() {
    case "$1" in
        app)
            sudo journalctl -u trading-app -f
            ;;
        caddy)
            sudo tail -f /var/log/caddy/access.log
            ;;
        backup)
            tail -f /var/log/trading-app/backup.log
            ;;
        health)
            tail -f /var/log/trading-app/healthcheck.log
            ;;
        *)
            echo "Usage: logs [app|caddy|backup|health]"
            ;;
    esac
}

# Update app from git
update_app() {
    echo -e "${YELLOW}Updating app from git...${NC}"
    cd ~/systems-trader
    git pull
    cd web
    npm install
    npx prisma generate
    npx prisma migrate deploy
    npm run build
    sudo systemctl restart trading-app
    echo -e "${GREEN}App updated and restarted${NC}"
}

# Create new user account
create_user() {
    echo "Creating new trading app user..."
    read -p "Email: " email
    read -p "Name: " name
    read -sp "Password: " password
    echo ""

    # Connect to database and create user
    # This would need to be implemented based on your user model
    echo "User creation would be implemented here"
}

# Backup now
backup_now() {
    echo -e "${YELLOW}Running backup...${NC}"
    sudo /usr/local/bin/backup-trading-app.sh
}

# System stats
stats() {
    echo -e "${GREEN}=== System Statistics ===${NC}"
    echo ""
    echo "Uptime:"
    uptime
    echo ""
    echo "Memory:"
    free -h
    echo ""
    echo "Disk:"
    df -h /
    echo ""
    echo "Network:"
    ifconfig | grep "inet " | grep -v 127.0.0.1
}

# Help
help() {
    echo "Trading Server Utility Commands"
    echo "================================"
    echo ""
    echo "status              - Check service status"
    echo "restart_all         - Restart all services"
    echo "logs [type]         - View logs (app|caddy|backup|health)"
    echo "update_app          - Update app from git and restart"
    echo "backup_now          - Run backup immediately"
    echo "stats               - Show system statistics"
    echo "help                - Show this help"
    echo ""
    echo "Monitoring:"
    echo "  health-check.sh           - Run health check"
    echo "  monitor-trading-app.sh    - Interactive monitoring"
    echo ""
    echo "Direct systemctl commands:"
    echo "  sudo systemctl restart trading-app"
    echo "  sudo systemctl status trading-app"
    echo "  sudo journalctl -u trading-app -f"
}

# Show help on source
help
