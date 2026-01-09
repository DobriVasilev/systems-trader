#!/bin/bash
set -euo pipefail

# Set up automated backups
# Run as: sudo ./07-setup-backups.sh

echo "=== Setting Up Automated Backups ==="

# Create backup directory
mkdir -p /var/backups/trading-app
chown dobri:dobri /var/backups/trading-app

# Create backup script
cat > /usr/local/bin/backup-trading-app.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Backup script for trading app
BACKUP_DIR="/var/backups/trading-app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"

echo "Starting backup at $(date)"

# Create temporary directory
TMP_DIR=$(mktemp -d)
trap "rm -rf ${TMP_DIR}" EXIT

# Backup database
echo "Backing up database..."
PGPASSWORD='change_this_password_in_production' pg_dump \
    -U trading_user \
    -d trading_app \
    -F c \
    -f "${TMP_DIR}/database.dump"

# Backup .env file
echo "Backing up configuration..."
cp /home/dobri/systems-trader/web/.env "${TMP_DIR}/"

# Backup user uploads (if any)
# Add any other important directories here

# Create compressed archive
echo "Creating archive..."
tar -czf "${BACKUP_FILE}" -C "${TMP_DIR}" .

# Remove backups older than 30 days
echo "Cleaning old backups..."
find "${BACKUP_DIR}" -name "backup_*.tar.gz" -mtime +30 -delete

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"
echo "Backup finished at $(date)"
EOF

chmod +x /usr/local/bin/backup-trading-app.sh

# Create systemd timer for daily backups at 2 AM
cat > /etc/systemd/system/trading-app-backup.service << 'EOF'
[Unit]
Description=Trading App Backup
After=postgresql.service
Wants=postgresql.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/backup-trading-app.sh
StandardOutput=append:/var/log/trading-app/backup.log
StandardError=append:/var/log/trading-app/backup.log
EOF

cat > /etc/systemd/system/trading-app-backup.timer << 'EOF'
[Unit]
Description=Trading App Backup Timer
Requires=trading-app-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable timer
systemctl daemon-reload
systemctl enable trading-app-backup.timer
systemctl start trading-app-backup.timer

# Run first backup now
echo "Running initial backup..."
/usr/local/bin/backup-trading-app.sh

echo "=== Backup Setup Complete ==="
echo ""
echo "Backups will run daily at 2:00 AM"
echo "Backup location: /var/backups/trading-app/"
echo "Backups are kept for 30 days"
echo ""
echo "Manual backup: sudo /usr/local/bin/backup-trading-app.sh"
echo "Check timer: systemctl list-timers trading-app-backup.timer"
echo "View backup log: tail -f /var/log/trading-app/backup.log"
echo ""
echo "To restore from backup:"
echo "1. Extract: tar -xzf /var/backups/trading-app/backup_YYYYMMDD_HHMMSS.tar.gz"
echo "2. Restore DB: pg_restore -U trading_user -d trading_app database.dump"
echo "3. Restore .env: cp .env /home/dobri/systems-trader/web/"
