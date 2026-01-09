#!/bin/bash
set -euo pipefail

# Install and configure PostgreSQL
# Run as: sudo ./04-install-postgres.sh

echo "=== Installing PostgreSQL ==="

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create database and user for trading app
echo "Creating database and user..."
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE trading_app;

-- Create user with password
CREATE USER trading_user WITH ENCRYPTED PASSWORD 'change_this_password_in_production';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE trading_app TO trading_user;

-- Connect to the database to grant schema privileges
\c trading_app
GRANT ALL ON SCHEMA public TO trading_user;

-- Exit
\q
EOF

# Configure PostgreSQL to allow local connections
echo "Configuring PostgreSQL authentication..."
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Backup original config
cp "$PG_HBA" "${PG_HBA}.backup"

# Allow local connections with md5 password
sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "$PG_HBA"

# Restart PostgreSQL
systemctl restart postgresql

# Test connection
echo "Testing database connection..."
PGPASSWORD='change_this_password_in_production' psql -U trading_user -d trading_app -c "SELECT version();"

echo "=== PostgreSQL Installation Complete ==="
echo ""
echo "Database: trading_app"
echo "User: trading_user"
echo "Password: change_this_password_in_production"
echo ""
echo "⚠️  IMPORTANT: Change the database password before deploying!"
echo ""
echo "Connection string for your app:"
echo "postgresql://trading_user:change_this_password_in_production@localhost:5432/trading_app"
echo ""
echo "Next: sudo -u dobri ./05-deploy-app.sh"
