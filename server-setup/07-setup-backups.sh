#!/bin/bash
set -euo pipefail

# Set up automated backups for Neon database -> Cloudflare R2
# Run as: sudo ./07-setup-backups.sh

echo "=== Setting Up Automated Backups (with R2) ==="

# Create backup directory (local cache)
mkdir -p /var/backups/trading-app
chown dobri:dobri /var/backups/trading-app

# Create log directory
mkdir -p /var/log/trading-app
chown dobri:dobri /var/log/trading-app

# Install rclone if not present
if ! command -v rclone &> /dev/null; then
    echo "Installing rclone for R2 uploads..."
    curl -s https://rclone.org/install.sh | bash
fi

# Create rclone config directory
mkdir -p /home/dobri/.config/rclone

# Create backup script
cat > /usr/local/bin/backup-trading-app.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

# Backup script for trading app (Neon database -> Cloudflare R2)
BACKUP_DIR="/var/backups/trading-app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="backup_${TIMESTAMP}.tar.gz"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"
APP_DIR="/home/dobri/systems-trader/web"

echo "Starting backup at $(date)"

# Create temporary directory
TMP_DIR=$(mktemp -d)
trap "rm -rf ${TMP_DIR}" EXIT

# Load environment variables from .env
if [ -f "${APP_DIR}/.env" ]; then
    # Read env vars line by line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$line" ]] && continue
        # Remove leading spaces
        line=$(echo "$line" | sed 's/^[[:space:]]*//')
        # Extract var name and value, strip quotes from value
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${BASH_REMATCH[2]}"
            # Remove surrounding quotes (single or double)
            var_value=$(echo "$var_value" | sed 's/^["'"'"']//;s/["'"'"']$//')
            export "$var_name=$var_value"
        fi
    done < "${APP_DIR}/.env"
else
    echo "ERROR: .env file not found"
    exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL not found in .env"
    exit 1
fi

# Backup database from Neon (use pg_dump 17 for Neon compatibility)
echo "Backing up database from Neon..."
PG_DUMP="/usr/lib/postgresql/17/bin/pg_dump"
if [ ! -x "$PG_DUMP" ]; then
    PG_DUMP="pg_dump"  # Fallback to default
fi
if $PG_DUMP "${DATABASE_URL}" -F c -f "${TMP_DIR}/database.dump" 2>/dev/null; then
    echo "Database backup successful"
else
    echo "WARNING: Database backup failed"
    echo "Continuing with config backup only..."
fi

# Backup .env file (contains secrets)
echo "Backing up configuration..."
cp "${APP_DIR}/.env" "${TMP_DIR}/"

# Backup prisma schema
cp "${APP_DIR}/prisma/schema.prisma" "${TMP_DIR}/"

# Create backup info file
cat > "${TMP_DIR}/backup_info.txt" << EOF
Backup Date: $(date)
Hostname: $(hostname)
App Directory: ${APP_DIR}
Database: Neon PostgreSQL
Storage: Cloudflare R2
EOF

# Create compressed archive
echo "Creating archive..."
tar -czf "${BACKUP_FILE}" -C "${TMP_DIR}" .

# Encrypt backup if BACKUP_PASSWORD is set
if [ -n "${BACKUP_PASSWORD:-}" ]; then
    echo "Encrypting backup with GPG..."
    gpg --batch --yes --passphrase "${BACKUP_PASSWORD}" --symmetric --cipher-algo AES256 "${BACKUP_FILE}"
    rm "${BACKUP_FILE}"  # Remove unencrypted version
    BACKUP_FILE="${BACKUP_FILE}.gpg"
    BACKUP_FILENAME="${BACKUP_FILENAME}.gpg"
    echo "Backup encrypted: ${BACKUP_FILE}"
else
    echo "WARNING: BACKUP_PASSWORD not set - backup is NOT encrypted!"
    echo "Add BACKUP_PASSWORD to .env for encrypted backups"
fi

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "Local backup: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Upload to Cloudflare R2
echo "Uploading to Cloudflare R2..."
if [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ] && [ -n "${R2_ACCOUNT_ID:-}" ]; then
    # Configure rclone on-the-fly
    export RCLONE_CONFIG_R2_TYPE=s3
    export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
    export RCLONE_CONFIG_R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    export RCLONE_CONFIG_R2_ACL=private

    R2_BUCKET="${R2_BACKUP_BUCKET:-${R2_BUCKET_NAME:-trading-app-backups}}"

    if rclone copy "${BACKUP_FILE}" "r2:${R2_BUCKET}/backups/" --s3-no-check-bucket --progress; then
        echo "R2 upload successful: r2:${R2_BUCKET}/backups/${BACKUP_FILENAME}"

        # Clean old R2 backups (keep last 30)
        echo "Cleaning old R2 backups..."
        rclone delete "r2:${R2_BUCKET}/backups/" --min-age 30d 2>/dev/null || true
    else
        echo "WARNING: R2 upload failed, backup saved locally only"
    fi
else
    echo "WARNING: R2 credentials not found, backup saved locally only"
fi

# Remove local backups older than 7 days (R2 is primary, local is cache)
echo "Cleaning old local backups..."
find "${BACKUP_DIR}" -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup complete at $(date)"
SCRIPT

chmod +x /usr/local/bin/backup-trading-app.sh

# Create systemd timer for daily backups at 2 AM
cat > /etc/systemd/system/trading-app-backup.service << 'EOF'
[Unit]
Description=Trading App Backup

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
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable timer
systemctl daemon-reload
systemctl enable trading-app-backup.timer
systemctl start trading-app-backup.timer

# Install pg_dump if not present (needed for Neon backup)
if ! command -v pg_dump &> /dev/null; then
    echo "Installing PostgreSQL client for pg_dump..."
    apt-get update -qq
    apt-get install -y -qq postgresql-client
fi

# Run first backup now
echo "Running initial backup..."
/usr/local/bin/backup-trading-app.sh

echo ""
echo "=== Backup Setup Complete ==="
echo ""
echo "Backups will run daily at 2:00 AM"
echo "Primary storage: Cloudflare R2 (30 days retention)"
echo "Local cache: /var/backups/trading-app/ (7 days)"
echo ""
echo "Commands:"
echo "  Manual backup: sudo /usr/local/bin/backup-trading-app.sh"
echo "  Check timer:   systemctl list-timers trading-app-backup.timer"
echo "  View log:      tail -f /var/log/trading-app/backup.log"
echo "  List R2 backups: rclone ls r2:\${R2_BUCKET_NAME}/backups/"
echo ""
echo "To restore from R2:"
echo "  1. Download: rclone copy r2:\${R2_BACKUP_BUCKET}/backups/backup_YYYYMMDD_HHMMSS.tar.gz.gpg /tmp/"
echo "  2. Decrypt: gpg --decrypt /tmp/backup_*.gpg > /tmp/backup.tar.gz"
echo "  3. Extract: tar -xzf /tmp/backup.tar.gz -C /tmp/restore"
echo "  4. Restore DB: pg_restore -d \"\$DATABASE_URL\" /tmp/restore/database.dump"
echo "  5. Restore .env if needed"
echo ""
echo "IMPORTANT: Set BACKUP_PASSWORD in .env for encrypted backups!"
