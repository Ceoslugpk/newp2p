#!/bin/bash

# P2P File Sharing - Development Installation Script (No SSL)
# This script installs without SSL certificates for testing

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
DOMAIN="localhost"
EMAIL="test@example.com"
NODE_VERSION="18"

# Fix hostname resolution issue
fix_hostname() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] Fixing hostname resolution...${NC}"
    CURRENT_HOSTNAME=$(hostname)
    if ! grep -q "$CURRENT_HOSTNAME" /etc/hosts; then
        echo "127.0.0.1 $CURRENT_HOSTNAME" >> /etc/hosts
        echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] Added $CURRENT_HOSTNAME to /etc/hosts${NC}"
    fi
}

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

# Update system packages
update_system() {
    log "Updating system packages..."
    export DEBIAN_FRONTEND=noninteractive
    apt update
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release build-essential python3 python3-pip net-tools htop nano vim
    log "System packages updated successfully"
}

# Install Docker and Docker Compose
install_docker() {
    log "Installing Docker..."
    
    if ! command -v docker &> /dev/null; then
        # Remove old versions
        apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
        
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
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt install -y nodejs
        
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
    mkdir -p $APP_DIR/{app,components,hooks,lib,public,styles}
    mkdir -p $APP_DIR/app/{download,demo}
    mkdir -p $APP_DIR/components/ui
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    chmod 755 $APP_DIR
    
    log "Application directory created at $APP_DIR"
}

# Create self-signed SSL certificates for development
create_dev_ssl() {
    log "Creating self-signed SSL certificates for development..."
    
    # Create self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $APP_DIR/ssl/key.pem \
        -out $APP_DIR/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR/ssl
    chmod 600 $APP_DIR/ssl/*.pem
    
    log "Self-signed SSL certificates created"
}

# Create application files
create_app_files() {
    log "Creating application files..."
    
    # Create environment file
    cat > $APP_DIR/.env << EOF
NODE_ENV=development
NEXT_PUBLIC_SIGNALING_SERVER_URL=ws://localhost:8080
PORT=3000
SIGNALING_PORT=8080
DOMAIN=localhost
EMAIL=test@example.com
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

    # Create Docker Compose file for development
    cat > $APP_DIR/docker-compose.yml << 'EOF'
version: '3.8'

services:
  frontend:
    build: .
    container_name: p2p-frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_SIGNALING_SERVER_URL=ws://localhost:8080
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
      - NODE_ENV=development
      - PORT=8080
    networks:
      - p2p-network
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

networks:
  p2p-network:
    driver: bridge
EOF

    # Create signaling server
    cat > $APP_DIR/scripts/signaling-server.js << 'EOF'
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    
    // Write to log file
    fs.appendFileSync(path.join(LOG_DIR, 'signaling.log'), logMessage);
}

// Create WebSocket server
const wss = new WebSocket.Server({ 
    port: PORT,
    path: '/ws'
});

// Store active connections
const connections = new Map();
const rooms = new Map();

wss.on('connection', (ws, req) => {
    const clientId = generateId();
    connections.set(clientId, ws);
    
    log(`Client ${clientId} connected from ${req.socket.remoteAddress}`);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(clientId, message);
        } catch (error) {
            log(`Error parsing message from ${clientId}: ${error.message}`);
        }
    });
    
    ws.on('close', () => {
        log(`Client ${clientId} disconnected`);
        connections.delete(clientId);
        
        // Remove from all rooms
        for (const [roomId, clients] of rooms.entries()) {
            if (clients.has(clientId)) {
                clients.delete(clientId);
                if (clients.size === 0) {
                    rooms.delete(roomId);
                } else {
                    // Notify other clients in room
                    broadcastToRoom(roomId, {
                        type: 'peer-disconnected',
                        peerId: clientId
                    }, clientId);
                }
            }
        }
    });
    
    ws.on('error', (error) => {
        log(`WebSocket error for client ${clientId}: ${error.message}`);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        clientId: clientId
    }));
});

function handleMessage(clientId, message) {
    log(`Message from ${clientId}: ${message.type}`);
    
    switch (message.type) {
        case 'join-room':
            joinRoom(clientId, message.roomId);
            break;
            
        case 'leave-room':
            leaveRoom(clientId, message.roomId);
            break;
            
        case 'offer':
        case 'answer':
        case 'ice-candidate':
            relayMessage(clientId, message);
            break;
            
        case 'file-request':
            handleFileRequest(clientId, message);
            break;
            
        case 'file-response':
            handleFileResponse(clientId, message);
            break;
            
        default:
            log(`Unknown message type: ${message.type}`);
    }
}

function joinRoom(clientId, roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    room.add(clientId);
    
    log(`Client ${clientId} joined room ${roomId}`);
    
    // Send list of existing peers
    const peers = Array.from(room).filter(id => id !== clientId);
    const ws = connections.get(clientId);
    
    if (ws) {
        ws.send(JSON.stringify({
            type: 'room-joined',
            roomId: roomId,
            peers: peers
        }));
        
        // Notify other peers
        broadcastToRoom(roomId, {
            type: 'peer-joined',
            peerId: clientId
        }, clientId);
    }
}

function leaveRoom(clientId, roomId) {
    if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(clientId);
        
        if (room.size === 0) {
            rooms.delete(roomId);
        } else {
            broadcastToRoom(roomId, {
                type: 'peer-left',
                peerId: clientId
            }, clientId);
        }
        
        log(`Client ${clientId} left room ${roomId}`);
    }
}

function relayMessage(fromClientId, message) {
    const targetId = message.targetId;
    const targetWs = connections.get(targetId);
    
    if (targetWs) {
        targetWs.send(JSON.stringify({
            ...message,
            fromId: fromClientId
        }));
    } else {
        log(`Target client ${targetId} not found for relay`);
    }
}

function handleFileRequest(clientId, message) {
    log(`File request from ${clientId} for share ${message.shareId}`);
    
    // Broadcast file request to all peers in the room
    const roomId = message.roomId || 'global';
    broadcastToRoom(roomId, {
        type: 'file-request',
        shareId: message.shareId,
        requesterId: clientId
    }, clientId);
}

function handleFileResponse(clientId, message) {
    log(`File response from ${clientId} for share ${message.shareId}`);
    
    // Send response to requester
    const requesterWs = connections.get(message.requesterId);
    if (requesterWs) {
        requesterWs.send(JSON.stringify({
            type: 'file-response',
            shareId: message.shareId,
            providerId: clientId,
            available: message.available,
            fileInfo: message.fileInfo
        }));
    }
}

function broadcastToRoom(roomId, message, excludeId = null) {
    if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        for (const clientId of room) {
            if (clientId !== excludeId) {
                const ws = connections.get(clientId);
                if (ws) {
                    ws.send(JSON.stringify(message));
                }
            }
        }
    }
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

log(`Signaling server started on port ${PORT}`);

// Health check endpoint
const http = require('http');
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            connections: connections.size,
            rooms: rooms.size,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT + 1, () => {
    log(`Health check server started on port ${PORT + 1}`);
});
EOF

    # Create all the other necessary files...
    # (I'll continue with the rest of the files in the next part)
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    chmod 644 $APP_DIR/.env
    chmod 644 $APP_DIR/docker-compose.yml
    
    log "Application files created successfully"
}

# Main installation function
main() {
    log "Starting P2P File Sharing development installation..."
    
    fix_hostname
    check_root
    update_system
    install_docker
    install_nodejs
    create_user
    setup_app_directory
    create_dev_ssl
    create_app_files
    
    cd $APP_DIR
    
    # Install dependencies
    log "Installing Node.js dependencies..."
    npm install
    
    # Build application
    log "Building application..."
    npm run build
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    log "Development installation completed successfully!"
    
    echo ""
    echo -e "${GREEN}🎉 P2P File Sharing development installation completed!${NC}"
    echo ""
    echo -e "${BLUE}Access your application at: http://localhost:3000${NC}"
    echo -e "${BLUE}Signaling server: ws://localhost:8080${NC}"
    echo ""
}

# Run main function
main "$@"
