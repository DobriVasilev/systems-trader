#!/bin/bash
set -euo pipefail

# Set up WireGuard VPN for secure remote access
# Run as: sudo ./06-setup-wireguard.sh

echo "=== Setting Up WireGuard VPN ==="

# Install WireGuard
apt install -y wireguard

# Generate server keys
cd /etc/wireguard
wg genkey | tee server_private.key | wg pubkey > server_public.key
chmod 600 server_private.key

# Generate client keys (for your Mac)
wg genkey | tee client_private.key | wg pubkey > client_public.key
chmod 600 client_private.key

# Read keys
SERVER_PRIVATE=$(cat server_private.key)
SERVER_PUBLIC=$(cat server_public.key)
CLIENT_PRIVATE=$(cat client_private.key)
CLIENT_PUBLIC=$(cat client_public.key)

# Get server's public IP (for client config)
SERVER_PUBLIC_IP=$(curl -s ifconfig.me)

# Create server config
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = ${SERVER_PRIVATE}
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Client: Your Mac
[Peer]
PublicKey = ${CLIENT_PUBLIC}
AllowedIPs = 10.0.0.2/32
EOF

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# Open WireGuard port
ufw allow 51820/udp

# Enable and start WireGuard
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

# Create client config file
cat > /root/client-wireguard.conf << EOF
[Interface]
PrivateKey = ${CLIENT_PRIVATE}
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${SERVER_PUBLIC}
Endpoint = ${SERVER_PUBLIC_IP}:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
EOF

echo "=== WireGuard Setup Complete ==="
echo ""
echo "Server is now running WireGuard on port 51820"
echo ""
echo "🔑 Client config saved to: /root/client-wireguard.conf"
echo ""
echo "To use on your Mac:"
echo "1. Install WireGuard: brew install wireguard-tools"
echo "2. Copy /root/client-wireguard.conf to your Mac"
echo "3. Import it in WireGuard app"
echo "4. Connect!"
echo ""
echo "Once connected, access server via: 10.0.0.1"
echo ""
cat /root/client-wireguard.conf
echo ""
