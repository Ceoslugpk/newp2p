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

# Fix hostname resolution issue
fix_hostname() {
    log "Fixing hostname resolution..."
    CURRENT_HOSTNAME=$(hostname)
    if ! grep -q "$CURRENT_HOSTNAME" /etc/hosts; then
        echo "127.0.0.1 $CURRENT_HOSTNAME" >> /etc/hosts
        log "Added $CURRENT_HOSTNAME to /etc/hosts"
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
    
    # Check for command line arguments
    if [ "$1" != "" ] && [ "$2" != "" ]; then
        DOMAIN="$1"
        EMAIL="$2"
        log "Using command line arguments: Domain=$DOMAIN, Email=$EMAIL"
    else
        # Interactive mode
        while [ -z "$DOMAIN" ]; do
            read -p "Enter your domain name (e.g., example.com): " DOMAIN
            if [ -z "$DOMAIN" ]; then
                warning "Domain name is required!"
            fi
        done
        
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
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    case "$PKG_MANAGER" in
        "apt")
            export DEBIAN_FRONTEND=noninteractive
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
    mkdir -p $APP_DIR/{app,components,hooks,lib,public,styles}
    mkdir -p $APP_DIR/app/{download,demo}
    mkdir -p $APP_DIR/components/ui
    
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
    log "Creating application files..."
    
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

    # Create P2P network hook
    cat > $APP_DIR/hooks/use-p2p-network.ts << 'EOF'
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface PeerConnection {
  id: string
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  status: 'connecting' | 'connected' | 'disconnected'
}

interface FileTransfer {
  id: string
  fileName: string
  fileSize: number
  progress: number
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  peerId: string
}

export function useP2PNetwork() {
  const [isConnected, setIsConnected] = useState(false)
  const [peers, setPeers] = useState<PeerConnection[]>([])
  const [transfers, setTransfers] = useState<FileTransfer[]>([])
  const [signalingStatus, setSignalingStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  
  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef<string>('')
  const roomIdRef = useRef<string>('')

  // TURN servers configuration
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  }

  const connectToSignalingServer = useCallback(() => {
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'wss://localhost:8080'
    
    setSignalingStatus('connecting')
    
    try {
      wsRef.current = new WebSocket(signalingUrl)
      
      wsRef.current.onopen = () => {
        console.log('Connected to signaling server')
        setSignalingStatus('connected')
        setIsConnected(true)
      }
      
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data)
        handleSignalingMessage(message)
      }
      
      wsRef.current.onclose = () => {
        console.log('Disconnected from signaling server')
        setSignalingStatus('disconnected')
        setIsConnected(false)
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectToSignalingServer()
          }
        }, 3000)
      }
      
      wsRef.current.onerror = (error) => {
        console.error('Signaling server error:', error)
        setSignalingStatus('disconnected')
      }
    } catch (error) {
      console.error('Failed to connect to signaling server:', error)
      setSignalingStatus('disconnected')
    }
  }, [])

  const handleSignalingMessage = useCallback(async (message: any) => {
    switch (message.type) {
      case 'connected':
        clientIdRef.current = message.clientId
        break
        
      case 'room-joined':
        roomIdRef.current = message.roomId
        // Create connections to existing peers
        for (const peerId of message.peers) {
          await createPeerConnection(peerId, true)
        }
        break
        
      case 'peer-joined':
        await createPeerConnection(message.peerId, false)
        break
        
      case 'peer-left':
      case 'peer-disconnected':
        removePeerConnection(message.peerId)
        break
        
      case 'offer':
        await handleOffer(message)
        break
        
      case 'answer':
        await handleAnswer(message)
        break
        
      case 'ice-candidate':
        await handleIceCandidate(message)
        break
        
      case 'file-request':
        handleFileRequest(message)
        break
        
      case 'file-response':
        handleFileResponse(message)
        break
    }
  }, [])

  const createPeerConnection = useCallback(async (peerId: string, isInitiator: boolean) => {
    const peerConnection = new RTCPeerConnection(rtcConfig)
    
    const newPeer: PeerConnection = {
      id: peerId,
      connection: peerConnection,
      status: 'connecting'
    }
    
    // Set up data channel
    if (isInitiator) {
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true
      })
      
      dataChannel.onopen = () => {
        console.log(`Data channel opened with peer ${peerId}`)
        setPeers(prev => prev.map(p => 
          p.id === peerId ? { ...p, status: 'connected' as const, dataChannel } : p
        ))
      }
      
      dataChannel.onmessage = (event) => {
        handleDataChannelMessage(peerId, event.data)
      }
      
      newPeer.dataChannel = dataChannel
    } else {
      peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel
        
        dataChannel.onopen = () => {
          console.log(`Data channel received from peer ${peerId}`)
          setPeers(prev => prev.map(p => 
            p.id === peerId ? { ...p, status: 'connected' as const, dataChannel } : p
          ))
        }
        
        dataChannel.onmessage = (event) => {
          handleDataChannelMessage(peerId, event.data)
        }
        
        setPeers(prev => prev.map(p => 
          p.id === peerId ? { ...p, dataChannel } : p
        ))
      }
    }
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetId: peerId,
          candidate: event.candidate
        }))
      }
    }
    
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      console.log(`Peer ${peerId} connection state: ${state}`)
      
      setPeers(prev => prev.map(p => 
        p.id === peerId ? { 
          ...p, 
          status: state === 'connected' ? 'connected' : 
                 state === 'failed' || state === 'disconnected' ? 'disconnected' : 'connecting'
        } : p
      ))
    }
    
    setPeers(prev => [...prev.filter(p => p.id !== peerId), newPeer])
    
    // Create offer if initiator
    if (isInitiator) {
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          targetId: peerId,
          offer: offer
        }))
      }
    }
  }, [rtcConfig])

  const handleOffer = useCallback(async (message: any) => {
    const peer = peers.find(p => p.id === message.fromId)
    if (!peer) return
    
    await peer.connection.setRemoteDescription(message.offer)
    const answer = await peer.connection.createAnswer()
    await peer.connection.setLocalDescription(answer)
    
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'answer',
        targetId: message.fromId,
        answer: answer
      }))
    }
  }, [peers])

  const handleAnswer = useCallback(async (message: any) => {
    const peer = peers.find(p => p.id === message.fromId)
    if (!peer) return
    
    await peer.connection.setRemoteDescription(message.answer)
  }, [peers])

  const handleIceCandidate = useCallback(async (message: any) => {
    const peer = peers.find(p => p.id === message.fromId)
    if (!peer) return
    
    await peer.connection.addIceCandidate(message.candidate)
  }, [peers])

  const removePeerConnection = useCallback((peerId: string) => {
    setPeers(prev => {
      const peer = prev.find(p => p.id === peerId)
      if (peer) {
        peer.connection.close()
        peer.dataChannel?.close()
      }
      return prev.filter(p => p.id !== peerId)
    })
  }, [])

  const handleDataChannelMessage = useCallback((peerId: string, data: any) => {
    try {
      const message = JSON.parse(data)
      
      switch (message.type) {
        case 'file-chunk':
          handleFileChunk(peerId, message)
          break
        case 'file-complete':
          handleFileComplete(peerId, message)
          break
        case 'file-error':
          handleFileError(peerId, message)
          break
      }
    } catch (error) {
      console.error('Error parsing data channel message:', error)
    }
  }, [])

  const handleFileChunk = useCallback((peerId: string, message: any) => {
    setTransfers(prev => prev.map(t => 
      t.id === message.transferId ? {
        ...t,
        progress: message.progress,
        status: 'transferring' as const
      } : t
    ))
  }, [])

  const handleFileComplete = useCallback((peerId: string, message: any) => {
    setTransfers(prev => prev.map(t => 
      t.id === message.transferId ? {
        ...t,
        progress: 100,
        status: 'completed' as const
      } : t
    ))
  }, [])

  const handleFileError = useCallback((peerId: string, message: any) => {
    setTransfers(prev => prev.map(t => 
      t.id === message.transferId ? {
        ...t,
        status: 'failed' as const
      } : t
    ))
  }, [])

  const handleFileRequest = useCallback((message: any) => {
    // Handle incoming file requests
    console.log('File request received:', message)
  }, [])

  const handleFileResponse = useCallback((message: any) => {
    // Handle file responses
    console.log('File response received:', message)
  }, [])

  const joinRoom = useCallback((roomId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join-room',
        roomId: roomId
      }))
    }
  }, [])

  const sendFile = useCallback(async (file: File, targetPeerId?: string) => {
    const transferId = Math.random().toString(36).substr(2, 9)
    
    const newTransfer: FileTransfer = {
      id: transferId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
      peerId: targetPeerId || ''
    }
    
    setTransfers(prev => [...prev, newTransfer])
    
    // If no specific peer, send to all connected peers
    const targetPeers = targetPeerId ? 
      peers.filter(p => p.id === targetPeerId && p.status === 'connected') :
      peers.filter(p => p.status === 'connected')
    
    for (const peer of targetPeers) {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        await sendFileToDataChannel(peer.dataChannel, file, transferId)
      }
    }
  }, [peers])

  const sendFileToDataChannel = useCallback(async (dataChannel: RTCDataChannel, file: File, transferId: string) => {
    const chunkSize = 16384 // 16KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    let chunkIndex = 0
    
    // Send file metadata
    dataChannel.send(JSON.stringify({
      type: 'file-start',
      transferId: transferId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks: totalChunks
    }))
    
    const reader = new FileReader()
    
    const sendNextChunk = () => {
      const start = chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      
      reader.onload = (e) => {
        if (e.target?.result) {
          dataChannel.send(JSON.stringify({
            type: 'file-chunk',
            transferId: transferId,
            chunkIndex: chunkIndex,
            data: Array.from(new Uint8Array(e.target.result as ArrayBuffer)),
            progress: Math.round((chunkIndex / totalChunks) * 100)
          }))
          
          chunkIndex++
          
          if (chunkIndex < totalChunks) {
            setTimeout(sendNextChunk, 10) // Small delay to prevent overwhelming
          } else {
            // File transfer complete
            dataChannel.send(JSON.stringify({
              type: 'file-complete',
              transferId: transferId
            }))
            
            setTransfers(prev => prev.map(t => 
              t.id === transferId ? {
                ...t,
                progress: 100,
                status: 'completed' as const
              } : t
            ))
          }
        }
      }
      
      reader.onerror = () => {
        dataChannel.send(JSON.stringify({
          type: 'file-error',
          transferId: transferId,
          error: 'Failed to read file chunk'
        }))
        
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? {
            ...t,
            status: 'failed' as const
          } : t
        ))
      }
      
      reader.readAsArrayBuffer(chunk)
    }
    
    sendNextChunk()
  }, [])

  // Initialize connection on mount
  useEffect(() => {
    connectToSignalingServer()
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      
      // Close all peer connections
      peers.forEach(peer => {
        peer.connection.close()
        peer.dataChannel?.close()
      })
    }
  }, [connectToSignalingServer])

  return {
    isConnected,
    signalingStatus,
    peers: peers.filter(p => p.status === 'connected'),
    transfers,
    joinRoom,
    sendFile,
    connectToSignalingServer
  }
}
EOF

    # Create download page
    cat > $APP_DIR/app/download/[shareId]/page.tsx << 'EOF'
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, FileIcon, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useP2PNetwork } from '@/hooks/use-p2p-network'

interface FileInfo {
  name: string
  size: number
  type: string
  shareId: string
}

export default function DownloadPage() {
  const params = useParams()
  const shareId = params.shareId as string
  
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState<'searching' | 'found' | 'downloading' | 'completed' | 'failed' | 'not-found'>('searching')
  const [error, setError] = useState<string>('')
  
  const { isConnected, signalingStatus, peers, joinRoom, connectToSignalingServer } = useP2PNetwork()

  useEffect(() => {
    if (shareId) {
      // Join a room based on the share ID to find peers with the file
      joinRoom(`share-${shareId}`)
      
      // Start searching for the file
      searchForFile(shareId)
    }
  }, [shareId, joinRoom])

  const searchForFile = async (shareId: string) => {
    setDownloadStatus('searching')
    setError('')
    
    // In a real implementation, this would query peers for the file
    // For now, we'll simulate the search process
    
    setTimeout(() => {
      // Simulate file not found for demo
      setDownloadStatus('not-found')
      setError('File not found. The file may have expired or the sharer is offline.')
    }, 3000)
  }

  const handleDownload = async () => {
    if (!fileInfo) return
    
    setDownloadStatus('downloading')
    setDownloadProgress(0)
    
    try {
      // In a real implementation, this would initiate P2P file transfer
      // For now, we'll simulate the download process
      
      const interval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            setDownloadStatus('completed')
            return 100
          }
          return prev + 10
        })
      }, 500)
      
    } catch (error) {
      setDownloadStatus('failed')
      setError('Download failed. Please try again.')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = () => {
    switch (downloadStatus) {
      case 'searching':
        return <Loader2 className="h-5 w-5 animate-spin" />
      case 'found':
        return <FileIcon className="h-5 w-5" />
      case 'downloading':
        return <Download className="h-5 w-5" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
      case 'not-found':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileIcon className="h-5 w-5" />
    }
  }

  const getStatusMessage = () => {
    switch (downloadStatus) {
      case 'searching':
        return 'Searching for file...'
      case 'found':
        return 'File found! Ready to download.'
      case 'downloading':
        return 'Downloading file...'
      case 'completed':
        return 'Download completed successfully!'
      case 'failed':
        return 'Download failed.'
      case 'not-found':
        return 'File not found.'
      default:
        return 'Unknown status'
    }
  }

  if (signalingStatus === 'disconnected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Connection Error
            </CardTitle>
            <CardDescription>
              Unable to connect to the P2P network
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cannot connect to the signaling server. Please check your internet connection and try again.
              </AlertDescription>
            </Alert>
            <Button onClick={connectToSignalingServer} className="w-full">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            P2P File Download
          </h1>
          <p className="text-gray-600">
            Secure peer-to-peer file sharing
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              File Download
            </CardTitle>
            <CardDescription>
              Share ID: {shareId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{getStatusMessage()}</p>
                <p className="text-sm text-gray-500">
                  Connected peers: {peers.length}
                </p>
              </div>
            </div>

            {fileInfo && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <FileIcon className="h-8 w-8 text-blue-500" />
                    <div>
                      <h3 className="font-medium">{fileInfo.name}</h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(fileInfo.size)} • {fileInfo.type}
                      </p>
                    </div>
                  </div>
                </div>

                {downloadStatus === 'downloading' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Download Progress</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <Progress value={downloadProgress} className="w-full" />
                  </div>
                )}

                {downloadStatus === 'found' && (
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                )}

                {downloadStatus === 'completed' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      File downloaded successfully! Check your downloads folder.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {downloadStatus === 'not-found' && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  File Not Found
                </h3>
                <p className="text-gray-500 mb-4">
                  The file you're looking for is not available. This could happen if:
                </p>
                <ul className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-1">
                  <li>• The file has expired</li>
                  <li>• The person sharing the file is offline</li>
                  <li>• The share link is invalid</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            Powered by peer-to-peer technology • No central servers required
          </p>
        </div>
      </div>
    </div>
  )
}
EOF

    # Create main page
    cat > $APP_DIR/app/page.tsx << 'EOF'
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Share2, Download, Shield, Zap, Globe, Copy, CheckCircle, AlertCircle } from 'lucide-react'
import { useP2PNetwork } from '@/hooks/use-p2p-network'

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [shareLink, setShareLink] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  
  const { isConnected, signalingStatus, peers, joinRoom, sendFile } = useP2PNetwork()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setShareLink('')
      setUploadProgress(0)
    }
  }

  const handleShare = async () => {
    if (!selectedFile) return
    
    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      // Generate a unique share ID
      const shareId = Math.random().toString(36).substr(2, 9)
      
      // Join a room for this file share
      joinRoom(`share-${shareId}`)
      
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            setIsUploading(false)
            
            // Generate share link
            const link = `${window.location.origin}/download/${shareId}`
            setShareLink(link)
            
            return 100
          }
          return prev + 10
        })
      }, 200)
      
    } catch (error) {
      console.error('Error sharing file:', error)
      setIsUploading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">P2P File Share</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  signalingStatus === 'connected' ? 'bg-green-500' : 
                  signalingStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-600">
                  {signalingStatus === 'connected' ? 'Connected' : 
                   signalingStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
                </span>
              </div>
              <span className="text-sm text-gray-600">
                Peers: {peers.length}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Share Files Securely with P2P Technology
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            No servers, no limits, no tracking. Direct peer-to-peer file sharing.
          </p>
        </div>

        {/* Connection Status */}
        {signalingStatus !== 'connected' && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {signalingStatus === 'connecting' 
                ? 'Connecting to P2P network...' 
                : 'Unable to connect to P2P network. Please check your connection.'}
            </AlertDescription>
          </Alert>
        )}

        {/* File Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Share a File
            </CardTitle>
            <CardDescription>
              Select a file to share with others via peer-to-peer connection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Choose File</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </div>

            {selectedFile && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <Button 
                    onClick={handleShare} 
                    disabled={isUploading || signalingStatus !== 'connected'}
                  >
                    {isUploading ? 'Preparing...' : 'Share File'}
                  </Button>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Preparing file for sharing</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {shareLink && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>File is ready to share! Send this link to recipients:</p>
                    <div className="flex items-center gap-2">
                      <Input value={shareLink} readOnly className="flex-1" />
                      <Button 
                        size="sm" 
                        onClick={copyToClipboard}
                        variant={linkCopied ? "default" : "outline"}
                      >
                        {linkCopied ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Secure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Direct peer-to-peer connections with end-to-end encryption. No data passes through our servers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Fast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Direct connections mean faster transfers. No upload to servers, no download delays.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                Decentralized
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                No central servers to fail or be compromised. The network is as strong as its users.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Simple, secure, and decentralized file sharing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-medium mb-2">1. Select & Share</h3>
                <p className="text-sm text-gray-600">
                  Choose your file and get a secure share link
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium mb-2">2. Send Link</h3>
                <p className="text-sm text-gray-600">
                  Share the link with anyone you want to receive the file
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Download className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-medium mb-2">3. Direct Transfer</h3>
                <p className="text-sm text-gray-600">
                  Files transfer directly between devices, no servers involved
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
EOF

    # Create layout
    cat > $APP_DIR/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'P2P File Share - Secure Decentralized File Sharing',
  description: 'Share files securely using peer-to-peer technology. No servers, no limits, no tracking.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
EOF

    # Create globals.css
    cat > $APP_DIR/app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
EOF

    # Create essential UI components
    cat > $APP_DIR/components/ui/button.tsx << 'EOF'
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
EOF

    cat > $APP_DIR/components/ui/card.tsx << 'EOF'
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
EOF

    cat > $APP_DIR/components/ui/input.tsx << 'EOF'
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
EOF

    cat > $APP_DIR/components/ui/label.tsx << 'EOF'
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
EOF

    cat > $APP_DIR/components/ui/progress.tsx << 'EOF'
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
EOF

    cat > $APP_DIR/components/ui/alert.tsx << 'EOF'
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
EOF

    cat > $APP_DIR/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    chmod 644 $APP_DIR/.env
    chmod 644 $APP_DIR/docker-compose.yml
    chmod 644 $APP_DIR/nginx.conf
    
    log "Application files created successfully"
}

# Main installation function
main() {
    log "Starting P2P File Sharing automatic installation..."
    
    fix_hostname
    check_root
    detect_os
    get_user_input "$1" "$2"
    update_system
    install_docker
    install_nodejs
    install_certbot
    create_user
    setup_app_directory
    configure_firewall
    generate_ssl_certificates
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
    
    log "Installation completed successfully!"
    
    echo ""
    echo -e "${GREEN}🎉 P2P File Sharing installation completed!${NC}"
    echo ""
    echo -e "${BLUE}Access your application at: https://$DOMAIN${NC}"
    echo ""
}

# Run main function with arguments
main "$@"
