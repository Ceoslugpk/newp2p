#!/bin/bash

# P2P File Sharing Deployment Script
# This script sets up the application on a VPS server

set -e

echo "🚀 Starting P2P File Sharing deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root (use sudo)"
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Docker and Docker Compose
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $SUDO_USER
fi

if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Install Node.js (for development)
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Create application directory
APP_DIR="/opt/p2p-fileshare"
echo "📁 Creating application directory at $APP_DIR..."
mkdir -p $APP_DIR
cd $APP_DIR

# Set up environment variables
echo "⚙️ Setting up environment variables..."
cat > .env << EOF
NODE_ENV=production
NEXT_PUBLIC_SIGNALING_SERVER_URL=wss://$(hostname -I | awk '{print $1}'):8080
PORT=3000
SIGNALING_PORT=8080
EOF

# Create SSL directory (you'll need to add your certificates)
mkdir -p ssl
echo "🔒 SSL directory created at $APP_DIR/ssl"
echo "Please add your SSL certificates (cert.pem and key.pem) to the ssl directory"

# Create logs directory
mkdir -p logs

# Set up firewall rules
echo "🔥 Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Next.js
ufw allow 8080/tcp  # Signaling server
ufw --force enable

# Create systemd service for signaling server (alternative to Docker)
echo "📋 Creating systemd service..."
cat > /etc/systemd/system/p2p-signaling.service << EOF
[Unit]
Description=P2P File Sharing Signaling Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node scripts/signaling-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R www-data:www-data $APP_DIR
chmod +x deploy.sh

echo "✅ Deployment setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your application files to $APP_DIR"
echo "2. Add SSL certificates to $APP_DIR/ssl/"
echo "3. Update nginx.conf with your domain name"
echo "4. Run: docker-compose up -d"
echo "5. Or use systemd: systemctl enable p2p-signaling && systemctl start p2p-signaling"
echo ""
echo "🌐 Your application will be available at:"
echo "   - Frontend: https://your-domain.com"
echo "   - Signaling: wss://signaling.your-domain.com"
echo ""
echo "📊 Monitor logs with:"
echo "   - docker-compose logs -f"
echo "   - journalctl -u p2p-signaling -f"
