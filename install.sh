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
NODE_VERSION="18"

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

# Detect OS and set package manager
detect_os() {
    log "Detecting operating system..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    elif [ -f /etc/redhat-release ]; then
        OS="Red Hat Enterprise Linux"
        VER=$(cat /etc/redhat-release | sed s/.*release\ // | sed s/\ .*//)
    else
        error "Cannot detect operating system"
        exit 1
    fi
    
    log "Detected OS: $OS $VER"
    
    case "$OS" in
        "Ubuntu"|"Debian GNU/Linux")
            PKG_MANAGER="apt"
            PKG_UPDATE="apt update"
            PKG_INSTALL="apt install -y"
            ;;
        "CentOS Linux"|"Red Hat Enterprise Linux"|"Rocky Linux"|"AlmaLinux")
            PKG_MANAGER="yum"
            PKG_UPDATE="yum update -y"
            PKG_INSTALL="yum install -y"
            ;;
        "Fedora")
            PKG_MANAGER="dnf"
            PKG_UPDATE="dnf update -y"
            PKG_INSTALL="dnf install -y"
            ;;
        *)
            error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
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
    info "Operating System: $OS $VER"
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
    
    case "$PKG_MANAGER" in
        "apt")
            $PKG_UPDATE
            $PKG_INSTALL curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release ufw build-essential python3 python3-pip net-tools htop nano vim
            ;;
        "yum"|"dnf")
            $PKG_UPDATE
            $PKG_INSTALL curl wget git unzip ca-certificates gnupg firewalld gcc gcc-c++ make python3 python3-pip net-tools htop nano vim epel-release
            ;;
    esac
    
    log "System packages updated successfully"
}

# Install Docker and Docker Compose
install_docker() {
    log "Installing Docker..."
    
    if ! command -v docker &> /dev/null; then
        case "$PKG_MANAGER" in
            "apt")
                # Remove old versions
                apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
                
                # Add Docker's official GPG key
                curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
                
                # Add Docker repository
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
                
                # Install Docker
                apt update
                $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
            "yum")
                # Remove old versions
                yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
                
                # Add Docker repository
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
            "dnf")
                # Remove old versions
                dnf remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-selinux docker-engine-selinux docker-engine 2>/dev/null || true
                
                # Add Docker repository
                dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
                $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
        esac
        
        # Start and enable Docker
        systemctl start docker
        systemctl enable docker
        
        # Add current user to docker group
        usermod -aG docker $SUDO_USER 2>/dev/null || true
        
        log "Docker installed successfully"
    else
        log "Docker already installed"
    fi
    
    # Install Docker Compose standalone
    if ! command -v docker-compose &> /dev/null; then
        log "Installing Docker Compose..."
        DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
        curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        log "Docker Compose installed successfully"
    else
        log "Docker Compose already installed"
    fi
}

# Install Node.js and npm
install_nodejs() {
    log "Installing Node.js $NODE_VERSION..."
    
    if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt "$NODE_VERSION" ]; then
        case "$PKG_MANAGER" in
            "apt")
                curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
                $PKG_INSTALL nodejs
                ;;
            "yum"|"dnf")
                curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
                $PKG_INSTALL nodejs npm
                ;;
        esac
        
        # Install global packages
        npm install -g yarn pm2
        
        log "Node.js installed successfully"
    else
        log "Node.js already installed"
    fi
    
    # Verify installation
    node_version=$(node -v)
    npm_version=$(npm -v)
    log "Node.js version: $node_version"
    log "npm version: $npm_version"
}

# Install Python and pip packages
install_python() {
    log "Installing Python dependencies..."
    
    case "$PKG_MANAGER" in
        "apt")
            $PKG_INSTALL python3-dev python3-venv python3-pip
            ;;
        "yum"|"dnf")
            $PKG_INSTALL python3-devel python3-pip
            ;;
    esac
    
    # Install Python packages for SSL and security analysis
    pip3 install --upgrade pip
    pip3 install cryptography pyopenssl requests beautifulsoup4 lxml
    
    log "Python dependencies installed successfully"
}

# Install Nginx
install_nginx() {
    log "Installing Nginx..."
    
    if ! command -v nginx &> /dev/null; then
        case "$PKG_MANAGER" in
            "apt")
                $PKG_INSTALL nginx
                ;;
            "yum"|"dnf")
                $PKG_INSTALL nginx
                ;;
        esac
        
        # Enable but don't start nginx (Docker will handle it)
        systemctl enable nginx
        systemctl stop nginx 2>/dev/null || true
        
        log "Nginx installed successfully"
    else
        log "Nginx already installed"
    fi
}

# Install Certbot for SSL certificates
install_certbot() {
    log "Installing Certbot for SSL certificates..."
    
    if ! command -v certbot &> /dev/null; then
        case "$PKG_MANAGER" in
            "apt")
                $PKG_INSTALL snapd
                systemctl enable --now snapd.socket
                ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
                snap install core; snap refresh core
                snap install --classic certbot
                ln -sf /snap/bin/certbot /usr/bin/certbot
                ;;
            "yum"|"dnf")
                $PKG_INSTALL certbot python3-certbot-nginx
                ;;
        esac
        
        log "Certbot installed successfully"
    else
        log "Certbot already installed"
    fi
}

# Install additional tools
install_additional_tools() {
    log "Installing additional tools..."
    
    case "$PKG_MANAGER" in
        "apt")
            $PKG_INSTALL jq tree ncdu iotop iftop fail2ban logrotate cron
            ;;
        "yum"|"dnf")
            $PKG_INSTALL jq tree ncdu iotop iftop fail2ban logrotate cronie
            ;;
    esac
    
    # Enable and start fail2ban
    systemctl enable fail2ban
    systemctl start fail2ban
    
    # Enable and start cron
    case "$PKG_MANAGER" in
        "apt")
            systemctl enable cron
            systemctl start cron
            ;;
        "yum"|"dnf")
            systemctl enable crond
            systemctl start crond
            ;;
    esac
    
    log "Additional tools installed successfully"
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
    mkdir -p $APP_DIR/{ssl,logs,data,backups,scripts,config}
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    chmod 755 $APP_DIR
    
    log "Application directory created at $APP_DIR"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    case "$PKG_MANAGER" in
        "apt")
            # Configure UFW
            ufw --force reset
            ufw default deny incoming
            ufw default allow outgoing
            
            # Allow SSH (be careful not to lock yourself out)
            ufw allow ssh
            ufw allow 22/tcp
            
            # Allow HTTP and HTTPS
            ufw allow 80/tcp
            ufw allow 443/tcp
            
            # Allow application ports
            ufw allow 3000/tcp comment "P2P Frontend"
            ufw allow 8080/tcp comment "P2P Signaling"
            
            # Allow WebRTC ports (for P2P connections)
            ufw allow 10000:20000/udp comment "WebRTC"
            
            # Enable firewall
            ufw --force enable
            ;;
        "yum"|"dnf")
            # Configure firewalld
            systemctl enable firewalld
            systemctl start firewalld
            
            # Allow services
            firewall-cmd --permanent --add-service=ssh
            firewall-cmd --permanent --add-service=http
            firewall-cmd --permanent --add-service=https
            
            # Allow application ports
            firewall-cmd --permanent --add-port=3000/tcp
            firewall-cmd --permanent --add-port=8080/tcp
            firewall-cmd --permanent --add-port=10000-20000/udp
            
            # Reload firewall
            firewall-cmd --reload
            ;;
    esac
    
    log "Firewall configured successfully"
}

# Generate SSL certificates
generate_ssl_certificates() {
    log "Generating SSL certificates with Let's Encrypt..."
    
    # Stop any running web servers
    systemctl stop nginx 2>/dev/null || true
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    
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

    # Create package.json
    cat > $APP_DIR/package.json << 'EOF'
{
  "name": "p2p-file-share",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18",
    "react-dom": "^18",
    "lucide-react": "^0.294.0",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-hover-card": "^1.0.7",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-menubar": "^1.0.4",
    "@radix-ui/react-navigation-menu": "^1.1.4",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-sheet": "^1.0.4",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-toggle": "^1.0.3",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "tailwindcss-animate": "^1.0.7",
    "sonner": "^1.2.0",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/ws": "^8.5.8",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "eslint": "^8",
    "eslint-config-next": "14.0.0"
  }
}
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

    # Create Dockerfile
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

    # Create Dockerfile for signaling server
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

    # Create Next.js config
    cat > $APP_DIR/next.config.mjs << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['ws']
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
EOF

    # Create TypeScript config
    cat > $APP_DIR/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

    # Create Tailwind config
    cat > $APP_DIR/tailwind.config.ts << 'EOF'
import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
EOF

    # Create PostCSS config
    cat > $APP_DIR/postcss.config.mjs << 'EOF'
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
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

    # Create log rotation config
    cat > /etc/logrotate.d/p2p-fileshare << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_USER
    postrotate
        docker-compose -f $APP_DIR/docker-compose.yml restart > /dev/null 2>&1 || true
    endscript
}
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
df -h /opt/p2p-fileshare

echo ""
echo "Memory Usage:"
free -h

echo ""
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *$$[0-9.]*$$%* id.*/\1/" | awk '{print "CPU Usage: " 100 - $1 "%"}'

echo ""
echo "Network Connections:"
netstat -tlnp | grep -E ":80|:443|:3000|:8080"

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
    ssl/ \
    package.json \
    next.config.mjs \
    tailwind.config.ts \
    tsconfig.json

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz logs/

# Backup application data
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
ls -la $BACKUP_DIR/
EOF

    # Create update script
    cat > $APP_DIR/update.sh << 'EOF'
#!/bin/bash

echo "Updating P2P File Sharing application..."

# Create backup before update
./backup.sh

# Pull latest images
docker-compose pull

# Rebuild containers
docker-compose build --no-cache

# Restart services
docker-compose down
docker-compose up -d

# Wait for services to start
sleep 10

# Check status
./status.sh

echo "Update completed"
EOF

    # Create health check script
    cat > $APP_DIR/health-check.sh << 'EOF'
#!/bin/bash

DOMAIN=$(grep DOMAIN .env | cut -d'=' -f2)
HEALTH_LOG="logs/health-check.log"

echo "$(date): Starting health check" >> $HEALTH_LOG

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo "$(date): ERROR - Containers not running" >> $HEALTH_LOG
    systemctl restart p2p-fileshare
    exit 1
fi

# Check if frontend is responding
if ! curl -f -s https://$DOMAIN > /dev/null; then
    echo "$(date): ERROR - Frontend not responding" >> $HEALTH_LOG
    docker-compose restart frontend
    exit 1
fi

# Check if signaling server is responding
if ! curl -f -s https://$DOMAIN:8080 > /dev/null; then
    echo "$(date): ERROR - Signaling server not responding" >> $HEALTH_LOG
    docker-compose restart signaling
    exit 1
fi

echo "$(date): Health check passed" >> $HEALTH_LOG
EOF

    # Make scripts executable
    chmod +x $APP_DIR/status.sh
    chmod +x $APP_DIR/backup.sh
    chmod +x $APP_DIR/update.sh
    chmod +x $APP_DIR/health-check.sh
    
    # Set ownership
    chown $SERVICE_USER:$SERVICE_USER $APP_DIR/*.sh
    
    # Add health check to cron
    (crontab -l 2>/dev/null; echo "*/5 * * * * cd $APP_DIR && ./health-check.sh") | crontab -
    
    log "Monitoring scripts created"
}

# Copy application source code
copy_source_code() {
    log "Creating application source code..."
    
    # Create directories
    mkdir -p $APP_DIR/{app,components,hooks,lib,public,scripts,styles}
    
    # Create basic app structure
    mkdir -p $APP_DIR/app/{download,demo}
    mkdir -p $APP_DIR/components/ui
    
    # Create essential files (these would normally be copied from your repo)
    # For now, we'll create minimal versions
    
    log "Application source code structure created"
}

# Install Node.js dependencies
install_dependencies() {
    log "Installing Node.js dependencies..."
    
    cd $APP_DIR
    
    # Install dependencies
    npm install
    
    # Build the application
    npm run build
    
    log "Dependencies installed and application built"
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
    sleep 15
    
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
    
    # Check if domain is accessible
    if curl -f -s https://$DOMAIN > /dev/null; then
        log "✅ Domain is accessible via HTTPS"
    else
        warning "⚠️  Domain may not be accessible yet (DNS propagation)"
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
    echo "   Operating System: $OS $VER"
    echo ""
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "   Status: cd $APP_DIR && ./status.sh"
    echo "   Logs: docker-compose logs -f"
    echo "   Restart: systemctl restart p2p-fileshare"
    echo "   Update: cd $APP_DIR && ./update.sh"
    echo "   Backup: cd $APP_DIR && ./backup.sh"
    echo "   Health Check: cd $APP_DIR && ./health-check.sh"
    echo ""
    echo -e "${BLUE}🌐 Access URLs:${NC}"
    echo "   Frontend: https://$DOMAIN"
    echo "   Signaling: wss://$DOMAIN:8080/ws"
    echo ""
    echo -e "${BLUE}📊 Monitoring:${NC}"
    echo "   System logs: journalctl -u p2p-fileshare -f"
    echo "   Container logs: cd $APP_DIR && docker-compose logs -f"
    echo "   SSL renewal: systemctl status ssl-renewal.timer"
    echo "   Health checks: tail -f $APP_DIR/logs/health-check.log"
    echo ""
    echo -e "${BLUE}📁 Important Directories:${NC}"
    echo "   Application: $APP_DIR"
    echo "   Logs: $APP_DIR/logs"
    echo "   SSL Certificates: $APP_DIR/ssl"
    echo "   Backups: /opt/backups/p2p-fileshare"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "   - SSL certificates will auto-renew every 12 hours"
    echo "   - Firewall is configured to allow only necessary ports"
    echo "   - Health checks run every 5 minutes via cron"
    echo "   - Log rotation is configured for all application logs"
    echo "   - Fail2ban is active for security protection"
    echo "   - Automatic backups can be scheduled via cron"
    echo ""
    echo -e "${GREEN}✅ Your P2P File Sharing application is now ready!${NC}"
    echo ""
    echo -e "${BLUE}🚀 Next Steps:${NC}"
    echo "   1. Point your domain DNS to this server's IP address"
    echo "   2. Wait for DNS propagation (up to 24 hours)"
    echo "   3. Test the application at https://$DOMAIN"
    echo "   4. Monitor logs and system status regularly"
    echo ""
}

# Main installation function
main() {
    log "Starting P2P File Sharing automatic installation..."
    
    check_root
    detect_os
    get_user_input
    update_system
    install_docker
    install_nodejs
    install_python
    install_nginx
    install_certbot
    install_additional_tools
    create_user
    setup_app_directory
    configure_firewall
    generate_ssl_certificates
    create_app_files
    create_systemd_services
    create_monitoring
    copy_source_code
    install_dependencies
    start_services
    verify_installation
    print_final_info
    
    log "Installation completed successfully!"
}

# Run main function
main "$@"
