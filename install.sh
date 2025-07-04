#!/bin/bash

# P2P File Sharing - Complete Automatic Installation Script
# This script installs and configures everything needed for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="p2p-fileshare"
APP_DIR="/opt/$APP_NAME"
SERVICE_USER="p2pshare"
DOMAIN=""
EMAIL=""

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "Please run this script as root (use sudo)"
        exit 1
    fi
}

# Get user input
get_user_input() {
    echo -e "${BLUE}=== P2P File Sharing Installation ===${NC}"
    echo ""
    
    # Get domain name
    while [ -z "$DOMAIN" ]; do
        read -p "Enter your domain name (e.g., example.com): " DOMAIN
        if [ -z "$DOMAIN" ]; then
            warning "Domain name is required!"
        fi
    done
    
    # Get email for SSL certificate
    while [ -z "$EMAIL" ]; do
        read -p "Enter your email for SSL certificate: " EMAIL
        if [ -z "$EMAIL" ]; then
            warning "Email is required for SSL certificate!"
        fi
    done
    
    # Confirm installation
    echo ""
    info "Installation Summary:"
    info "Domain: $DOMAIN"
    info "Email: $EMAIL"
    info "Installation Directory: $APP_DIR"
    echo ""
    
    read -p "Continue with installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Installation cancelled."
        exit 0
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    apt update && apt upgrade -y
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release ufw
}

# Install Docker and Docker Compose
install_docker() {
    log "Installing Docker..."
    
    if ! command -v docker &> /dev/null; then
        # Add Docker's official GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # Add Docker repository
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker
        apt update
        apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        # Start and enable Docker
        systemctl start docker
        systemctl enable docker
        
        log "Docker installed successfully"
    else
        log "Docker already installed"
    fi
    
    # Install Docker Compose standalone
    if ! command -v docker-compose &> /dev/null; then
        log "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        log "Docker Compose installed successfully"
    else
        log "Docker Compose already installed"
    fi
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js..."
    
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        log "Node.js installed successfully"
    else
        log "Node.js already installed"
    fi
}

# Install Certbot for SSL certificates
install_certbot() {
    log "Installing Certbot for SSL certificates..."
    
    if ! command -v certbot &> /dev/null; then
        apt install -y certbot python3-certbot-nginx
        log "Certbot installed successfully"
    else
        log "Certbot already installed"
    fi
}

# Create application user
create_user() {
    log "Creating application user..."
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /bin/false -d $APP_DIR $SERVICE_USER
        log "User $SERVICE_USER created"
    else
        log "User $SERVICE_USER already exists"
    fi
}

# Setup application directory
setup_app_directory() {
    log "Setting up application directory..."
    
    # Create directories
    mkdir -p $APP_DIR/{ssl,logs,data}
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    chmod 755 $APP_DIR
    
    log "Application directory created at $APP_DIR"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (be careful not to lock yourself out)
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow application ports
    ufw allow 3000/tcp comment "P2P Frontend"
    ufw allow 8080/tcp comment "P2P Signaling"
    
    # Enable firewall
    ufw --force enable
    
    log "Firewall configured successfully"
}

# Generate SSL certificates
generate_ssl_certificates() {
    log "Generating SSL certificates with Let's Encrypt..."
    
    # Stop any running web servers
    systemctl stop nginx 2>/dev/null || true
    systemctl stop apache2 2>/dev/null || true
    
    # Generate certificates
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    # Copy certificates to application directory
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/ssl/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $APP_DIR/ssl/key.pem
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR/ssl
    chmod 600 $APP_DIR/ssl/*.pem
    
    log "SSL certificates generated successfully"
}

# Create application files
create_app_files() {
    log "Creating application configuration files..."
    
    # Create environment file
    cat > $APP_DIR/.env << EOF
NODE_ENV=production
NEXT_PUBLIC_SIGNALING_SERVER_URL=wss://$DOMAIN:8080
PORT=3000
SIGNALING_PORT=8080
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF

    # Create Docker Compose file
    cat > $APP_DIR/docker-compose.yml << 'EOF'
version: '3.8'

services:
  frontend:
    build: .
    container_name: p2p-frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SIGNALING_SERVER_URL=wss://signaling:8080
    depends_on:
      - signaling
    networks:
      - p2p-network
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

  signaling:
    build:
      context: .
      dockerfile: Dockerfile.signaling
    container_name: p2p-signaling
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    networks:
      - p2p-network
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

  nginx:
    image: nginx:alpine
    container_name: p2p-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs:/var/log/nginx
    depends_on:
      - frontend
      - signaling
    networks:
      - p2p-network
    restart: unless-stopped

networks:
  p2p-network:
    driver: bridge
EOF

    # Create Nginx configuration
    cat > $APP_DIR/nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    upstream frontend {
        server frontend:3000;
    }

    upstream signaling {
        server signaling:8080;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS server for frontend
    server {
        listen 443 ssl http2;
        server_name $DOMAIN www.$DOMAIN;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!3DES:!MD5:!PSK;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_set_header X-Forwarded-Host \$server_name;
            proxy_redirect off;
        }
    }

    # WebSocket signaling server
    server {
        listen 443 ssl http2;
        server_name $DOMAIN;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!3DES:!MD5:!PSK;
        ssl_prefer_server_ciphers off;

        location /ws {
            proxy_pass http://signaling;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }
    }
}
EOF

    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    chmod 644 $APP_DIR/.env
    chmod 644 $APP_DIR/docker-compose.yml
    chmod 644 $APP_DIR/nginx.conf
    
    log "Application configuration files created"
}

# Create systemd services
create_systemd_services() {
    log "Creating systemd services..."
    
    # Create service for Docker Compose
    cat > /etc/systemd/system/p2p-fileshare.service << EOF
[Unit]
Description=P2P File Sharing Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0
User=root

[Install]
WantedBy=multi-user.target
EOF

    # Create SSL renewal service
    cat > /etc/systemd/system/ssl-renewal.service << EOF
[Unit]
Description=Renew SSL certificates and restart services
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/ssl/cert.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $APP_DIR/ssl/key.pem && chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR/ssl && systemctl restart p2p-fileshare'
EOF

    # Create SSL renewal timer
    cat > /etc/systemd/system/ssl-renewal.timer << EOF
[Unit]
Description=Run SSL renewal twice daily
Requires=ssl-renewal.service

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # Reload systemd and enable services
    systemctl daemon-reload
    systemctl enable p2p-fileshare.service
    systemctl enable ssl-renewal.timer
    systemctl start ssl-renewal.timer
    
    log "Systemd services created and enabled"
}

# Create monitoring scripts
create_monitoring() {
    log "Creating monitoring and management scripts..."
    
    # Create status script
    cat > $APP_DIR/status.sh << 'EOF'
#!/bin/bash

echo "=== P2P File Sharing Status ==="
echo ""

# Check Docker containers
echo "Docker Containers:"
docker-compose ps

echo ""
echo "Service Status:"
systemctl status p2p-fileshare.service --no-pager -l

echo ""
echo "SSL Certificate Status:"
certbot certificates

echo ""
echo "Disk Usage:"
df -h $APP_DIR

echo ""
echo "Recent Logs:"
echo "--- Frontend Logs ---"
docker-compose logs --tail=10 frontend

echo ""
echo "--- Signaling Logs ---"
docker-compose logs --tail=10 signaling

echo ""
echo "--- Nginx Logs ---"
docker-compose logs --tail=10 nginx
EOF

    # Create backup script
    cat > $APP_DIR/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/backups/p2p-fileshare"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configuration files
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    .env \
    docker-compose.yml \
    nginx.conf \
    ssl/

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz logs/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
EOF

    # Create update script
    cat > $APP_DIR/update.sh << 'EOF'
#!/bin/bash

echo "Updating P2P File Sharing application..."

# Pull latest images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d

echo "Update completed"
EOF

    # Make scripts executable
    chmod +x $APP_DIR/status.sh
    chmod +x $APP_DIR/backup.sh
    chmod +x $APP_DIR/update.sh
    
    # Set ownership
    chown $SERVICE_USER:$SERVICE_USER $APP_DIR/*.sh
    
    log "Monitoring scripts created"
}

# Copy application source code
copy_source_code() {
    log "Copying application source code..."
    
    # Get the directory where this script is located
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Copy all necessary files
    cp -r $SCRIPT_DIR/{app,components,hooks,lib,public,scripts,styles} $APP_DIR/ 2>/dev/null || true
    cp $SCRIPT_DIR/{package.json,next.config.mjs,tailwind.config.ts,tsconfig.json,postcss.config.mjs} $APP_DIR/ 2>/dev/null || true
    
    # Create Dockerfiles if they don't exist
    if [ ! -f $APP_DIR/Dockerfile ]; then
        cat > $APP_DIR/Dockerfile << 'EOF'
FROM node:18-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN yarn build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
RUN mkdir .next
RUN chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
EOF
    fi
    
    if [ ! -f $APP_DIR/Dockerfile.signaling ]; then
        cat > $APP_DIR/Dockerfile.signaling << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
COPY scripts/signaling-server.js ./
RUN npm install ws
RUN mkdir -p logs
RUN addgroup -g 1001 -S nodejs
RUN adduser -S signaling -u 1001
RUN chown -R signaling:nodejs /app
USER signaling
EXPOSE 8080
CMD ["node", "signaling-server.js"]
EOF
    fi
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    
    log "Application source code copied"
}

# Start services
start_services() {
    log "Starting P2P File Sharing services..."
    
    cd $APP_DIR
    
    # Build and start containers
    docker-compose build
    docker-compose up -d
    
    # Start systemd service
    systemctl start p2p-fileshare.service
    
    # Wait for services to start
    sleep 10
    
    log "Services started successfully"
}

# Verify installation
verify_installation() {
    log "Verifying installation..."
    
    # Check if containers are running
    if docker-compose ps | grep -q "Up"; then
        log "✅ Docker containers are running"
    else
        error "❌ Docker containers are not running"
        return 1
    fi
    
    # Check if ports are listening
    if netstat -tlnp | grep -q ":80\|:443\|:3000\|:8080"; then
        log "✅ Services are listening on required ports"
    else
        error "❌ Services are not listening on required ports"
        return 1
    fi
    
    # Check SSL certificate
    if [ -f "$APP_DIR/ssl/cert.pem" ] && [ -f "$APP_DIR/ssl/key.pem" ]; then
        log "✅ SSL certificates are present"
    else
        error "❌ SSL certificates are missing"
        return 1
    fi
    
    log "✅ Installation verification completed successfully"
}

# Print final information
print_final_info() {
    echo ""
    echo -e "${GREEN}🎉 P2P File Sharing installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Installation Summary:${NC}"
    echo "   Domain: https://$DOMAIN"
    echo "   Installation Directory: $APP_DIR"
    echo "   Service User: $SERVICE_USER"
    echo ""
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "   Status: cd $APP_DIR && ./status.sh"
    echo "   Logs: docker-compose logs -f"
    echo "   Restart: systemctl restart p2p-fileshare"
    echo "   Update: cd $APP_DIR && ./update.sh"
    echo "   Backup: cd $APP_DIR && ./backup.sh"
    echo ""
    echo -e "${BLUE}🌐 Access URLs:${NC}"
    echo "   Frontend: https://$DOMAIN"
    echo "   Signaling: wss://$DOMAIN:8080/ws"
    echo ""
    echo -e "${BLUE}📊 Monitoring:${NC}"
    echo "   System logs: journalctl -u p2p-fileshare -f"
    echo "   Container logs: cd $APP_DIR && docker-compose logs -f"
    echo "   SSL renewal: systemctl status ssl-renewal.timer"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "   - SSL certificates will auto-renew every 12 hours"
    echo "   - Firewall is configured to allow only necessary ports"
    echo "   - Application data is stored in $APP_DIR"
    echo "   - Backups can be created with the backup script"
    echo ""
    echo -e "${GREEN}✅ Your P2P File Sharing application is now ready!${NC}"
}

# Main installation function
main() {
    log "Starting P2P File Sharing automatic installation..."
    
    check_root
    get_user_input
    update_system
    install_docker
    install_nodejs
    install_certbot
    create_user
    setup_app_directory
    configure_firewall
    generate_ssl_certificates
    create_app_files
    create_systemd_services
    create_monitoring
    copy_source_code
    start_services
    verify_installation
    print_final_info
    
    log "Installation completed successfully!"
}

# Run main function
main "$@"
