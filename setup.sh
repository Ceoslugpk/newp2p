#!/bin/bash

# P2P File Share - Automated Setup Script
# This script handles complete application setup with a single command

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="P2P File Share"
NODE_VERSION="18"
REQUIRED_PORTS=(3000 8080)
CONFIG_FILE=".env.local"
SETUP_LOG="setup.log"

# Progress tracking
TOTAL_STEPS=12
CURRENT_STEP=0

# Utility functions
log() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$SETUP_LOG"
}

success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$SETUP_LOG"
}

error() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$SETUP_LOG"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$SETUP_LOG"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}" | tee -a "$SETUP_LOG"
}

progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo -e "${PURPLE}[${CURRENT_STEP}/${TOTAL_STEPS}] $1${NC}" | tee -a "$SETUP_LOG"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check port availability
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Install Node.js if not present
install_nodejs() {
    if command_exists node; then
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -ge "$NODE_VERSION" ]; then
            success "Node.js v$(node --version) is already installed"
            return 0
        else
            warning "Node.js version is too old (v$(node --version)). Installing newer version..."
        fi
    fi

    local os=$(detect_os)
    info "Installing Node.js v${NODE_VERSION}+ for $os..."

    case $os in
        "linux")
            if command_exists apt-get; then
                curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif command_exists yum; then
                curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | sudo bash -
                sudo yum install -y nodejs npm
            else
                error "Unsupported Linux distribution. Please install Node.js manually."
                exit 1
            fi
            ;;
        "macos")
            if command_exists brew; then
                brew install node@${NODE_VERSION}
            else
                error "Homebrew not found. Please install Node.js manually or install Homebrew first."
                exit 1
            fi
            ;;
        "windows")
            error "Please install Node.js manually from https://nodejs.org/"
            exit 1
            ;;
        *)
            error "Unsupported operating system. Please install Node.js manually."
            exit 1
            ;;
    esac

    if command_exists node; then
        success "Node.js v$(node --version) installed successfully"
    else
        error "Failed to install Node.js"
        exit 1
    fi
}

# Setup project dependencies
setup_dependencies() {
    info "Installing project dependencies..."
    
    if [ ! -f "package.json" ]; then
        error "package.json not found. Are you in the correct directory?"
        exit 1
    fi

    # Install dependencies with retry logic
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        info "Installation attempt $attempt/$max_attempts..."
        
        if npm install; then
            success "Dependencies installed successfully"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                error "Failed to install dependencies after $max_attempts attempts"
                exit 1
            else
                warning "Installation failed, retrying in 5 seconds..."
                sleep 5
                attempt=$((attempt + 1))
            fi
        fi
    done
}

# Check system requirements
check_requirements() {
    info "Checking system requirements..."
    
    local requirements_met=true
    
    # Check Node.js
    if ! command_exists node; then
        warning "Node.js not found"
        requirements_met=false
    else
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt "$NODE_VERSION" ]; then
            warning "Node.js version too old (v$(node --version)). Required: v${NODE_VERSION}+"
            requirements_met=false
        else
            success "Node.js v$(node --version) ✓"
        fi
    fi
    
    # Check npm
    if ! command_exists npm; then
        warning "npm not found"
        requirements_met=false
    else
        success "npm v$(npm --version) ✓"
    fi
    
    # Check ports
    for port in "${REQUIRED_PORTS[@]}"; do
        if ! check_port $port; then
            warning "Port $port is already in use"
            requirements_met=false
        else
            success "Port $port is available ✓"
        fi
    done
    
    # Check disk space (minimum 1GB)
    local available_space=$(df . | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 1048576 ]; then  # 1GB in KB
        warning "Low disk space. At least 1GB recommended."
    else
        success "Sufficient disk space ✓"
    fi
    
    return $([ "$requirements_met" = true ] && echo 0 || echo 1)
}

# Configure environment
setup_environment() {
    info "Setting up environment configuration..."
    
    # Create .env.local file
    cat > "$CONFIG_FILE" << EOF
# P2P File Share Configuration
# Generated on $(date)

# Application Settings
NEXT_PUBLIC_APP_NAME="P2P File Share"
NEXT_PUBLIC_APP_VERSION="1.0.0"

# Network Configuration
NEXT_PUBLIC_SIGNALING_SERVER_URL="ws://localhost:8080"
NEXT_PUBLIC_STUN_SERVERS="stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"

# Security Settings
NEXT_PUBLIC_MAX_FILE_SIZE="1073741824"  # 1GB in bytes
NEXT_PUBLIC_CHUNK_SIZE="262144"         # 256KB in bytes
NEXT_PUBLIC_ENCRYPTION_ALGORITHM="AES-256-GCM"

# Performance Settings
NEXT_PUBLIC_MAX_PEERS="8"
NEXT_PUBLIC_CONNECTION_TIMEOUT="30000"
NEXT_PUBLIC_HEARTBEAT_INTERVAL="30000"

# Development Settings
NODE_ENV="development"
NEXT_PUBLIC_DEBUG="false"

# Custom Server Configuration (will be updated during setup)
CUSTOM_SIGNALING_SERVER=""
CUSTOM_STUN_SERVERS=""
CUSTOM_TURN_SERVERS=""
EOF

    success "Environment configuration created"
}

# Setup signaling server
setup_signaling_server() {
    info "Setting up signaling server..."
    
    # Check if signaling server script exists
    if [ ! -f "scripts/signaling-server.js" ]; then
        error "Signaling server script not found"
        exit 1
    fi
    
    # Install signaling server dependencies
    info "Installing signaling server dependencies..."
    if ! npm list ws >/dev/null 2>&1; then
        npm install ws
    fi
    
    success "Signaling server configured"
}

# Test server connectivity
test_server_connectivity() {
    local server_url="$1"
    info "Testing connectivity to $server_url..."
    
    # Extract host and port from URL
    local host=$(echo "$server_url" | sed -E 's/^ws:\/\/([^:]+):?([0-9]*).*/\1/')
    local port=$(echo "$server_url" | sed -E 's/^ws:\/\/[^:]+:?([0-9]*).*/\1/')
    
    if [ -z "$port" ]; then
        port="80"
    fi
    
    # Test TCP connectivity
    if timeout 5 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        success "Server $server_url is reachable"
        return 0
    else
        warning "Server $server_url is not reachable"
        return 1
    fi
}

# Configure custom server
configure_custom_server() {
    echo
    info "Server Configuration"
    echo "===================="
    
    read -p "Do you want to configure a custom signaling server? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        while true; do
            read -p "Enter signaling server URL (e.g., ws://your-server.com:8080): " server_url
            
            if [ -z "$server_url" ]; then
                warning "Server URL cannot be empty"
                continue
            fi
            
            # Validate URL format
            if [[ ! "$server_url" =~ ^ws:// ]] && [[ ! "$server_url" =~ ^wss:// ]]; then
                warning "Server URL must start with ws:// or wss://"
                continue
            fi
            
            # Test connectivity
            if test_server_connectivity "$server_url"; then
                # Update configuration
                sed -i.bak "s|NEXT_PUBLIC_SIGNALING_SERVER_URL=.*|NEXT_PUBLIC_SIGNALING_SERVER_URL=\"$server_url\"|" "$CONFIG_FILE"
                sed -i.bak "s|CUSTOM_SIGNALING_SERVER=.*|CUSTOM_SIGNALING_SERVER=\"$server_url\"|" "$CONFIG_FILE"
                success "Custom server configured: $server_url"
                break
            else
                read -p "Server is not reachable. Continue anyway? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    sed -i.bak "s|NEXT_PUBLIC_SIGNALING_SERVER_URL=.*|NEXT_PUBLIC_SIGNALING_SERVER_URL=\"$server_url\"|" "$CONFIG_FILE"
                    sed -i.bak "s|CUSTOM_SIGNALING_SERVER=.*|CUSTOM_SIGNALING_SERVER=\"$server_url\"|" "$CONFIG_FILE"
                    warning "Custom server configured (not verified): $server_url"
                    break
                fi
            fi
        done
        
        # Configure STUN/TURN servers
        read -p "Enter custom STUN servers (comma-separated, or press Enter for defaults): " stun_servers
        if [ ! -z "$stun_servers" ]; then
            sed -i.bak "s|NEXT_PUBLIC_STUN_SERVERS=.*|NEXT_PUBLIC_STUN_SERVERS=\"$stun_servers\"|" "$CONFIG_FILE"
            sed -i.bak "s|CUSTOM_STUN_SERVERS=.*|CUSTOM_STUN_SERVERS=\"$stun_servers\"|" "$CONFIG_FILE"
            success "Custom STUN servers configured"
        fi
        
        read -p "Enter TURN servers (comma-separated, optional): " turn_servers
        if [ ! -z "$turn_servers" ]; then
            sed -i.bak "s|CUSTOM_TURN_SERVERS=.*|CUSTOM_TURN_SERVERS=\"$turn_servers\"|" "$CONFIG_FILE"
            echo "NEXT_PUBLIC_TURN_SERVERS=\"$turn_servers\"" >> "$CONFIG_FILE"
            success "TURN servers configured"
        fi
    else
        info "Using default local signaling server"
    fi
}

# Build the application
build_application() {
    info "Building the application..."
    
    if npm run build; then
        success "Application built successfully"
    else
        error "Failed to build application"
        exit 1
    fi
}

# Setup development tools
setup_dev_tools() {
    info "Setting up development tools..."
    
    # Create useful scripts
    cat > "start-dev.sh" << 'EOF'
#!/bin/bash
echo "Starting P2P File Share in development mode..."
echo "Starting signaling server..."
node scripts/signaling-server.js &
SIGNALING_PID=$!
echo "Signaling server started (PID: $SIGNALING_PID)"

echo "Starting Next.js development server..."
npm run dev &
NEXTJS_PID=$!
echo "Next.js server started (PID: $NEXTJS_PID)"

echo "Both servers are running. Press Ctrl+C to stop."
trap "kill $SIGNALING_PID $NEXTJS_PID" EXIT
wait
EOF

    cat > "start-prod.sh" << 'EOF'
#!/bin/bash
echo "Starting P2P File Share in production mode..."
echo "Starting signaling server..."
node scripts/signaling-server.js &
SIGNALING_PID=$!
echo "Signaling server started (PID: $SIGNALING_PID)"

echo "Starting Next.js production server..."
npm start &
NEXTJS_PID=$!
echo "Next.js server started (PID: $NEXTJS_PID)"

echo "Both servers are running. Press Ctrl+C to stop."
trap "kill $SIGNALING_PID $NEXTJS_PID" EXIT
wait
EOF

    chmod +x start-dev.sh start-prod.sh
    
    success "Development tools configured"
}

# Run tests
run_tests() {
    info "Running application tests..."
    
    # Basic connectivity test
    if node -e "console.log('Node.js is working')" >/dev/null 2>&1; then
        success "Node.js runtime test passed"
    else
        error "Node.js runtime test failed"
        exit 1
    fi
    
    # Test Next.js build
    if [ -d ".next" ]; then
        success "Next.js build test passed"
    else
        warning "Next.js build directory not found"
    fi
    
    # Test environment configuration
    if [ -f "$CONFIG_FILE" ]; then
        success "Environment configuration test passed"
    else
        error "Environment configuration test failed"
        exit 1
    fi
}

# Generate setup report
generate_report() {
    local report_file="setup-report.md"
    
    cat > "$report_file" << EOF
# P2P File Share Setup Report

**Setup completed on:** $(date)
**Setup duration:** $SECONDS seconds

## Configuration Summary

### Environment
- **Operating System:** $(detect_os)
- **Node.js Version:** $(node --version)
- **npm Version:** $(npm --version)

### Application Settings
$(cat "$CONFIG_FILE" | grep -E "^[^#]" | head -10)

### Server Configuration
- **Signaling Server:** $(grep "NEXT_PUBLIC_SIGNALING_SERVER_URL" "$CONFIG_FILE" | cut -d'=' -f2 | tr -d '"')
- **STUN Servers:** $(grep "NEXT_PUBLIC_STUN_SERVERS" "$CONFIG_FILE" | cut -d'=' -f2 | tr -d '"')

### Available Commands
- \`./start-dev.sh\` - Start development servers
- \`./start-prod.sh\` - Start production servers
- \`npm run dev\` - Start Next.js development server only
- \`npm run build\` - Build application for production
- \`npm start\` - Start production server

### URLs
- **Application:** http://localhost:3000
- **Signaling Server:** ws://localhost:8080

### Next Steps
1. Run \`./start-dev.sh\` to start the development environment
2. Open http://localhost:3000 in your browser
3. Test file sharing functionality
4. Configure firewall rules if needed for external access

### Troubleshooting
- Check the setup log: \`$SETUP_LOG\`
- Verify ports 3000 and 8080 are available
- Ensure Node.js version is $NODE_VERSION or higher

---
*Generated by P2P File Share Setup Script*
EOF

    success "Setup report generated: $report_file"
}

# Main setup function
main() {
    echo
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    P2P File Share Setup                     ║${NC}"
    echo -e "${CYAN}║                  Automated Configuration                    ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    log "Starting automated setup for $APP_NAME"
    log "Setup log will be saved to: $SETUP_LOG"
    
    # Clear previous log
    > "$SETUP_LOG"
    
    # Step 1: Check requirements
    progress "Checking system requirements"
    if ! check_requirements; then
        warning "Some requirements are not met. Attempting to fix..."
    fi
    
    # Step 2: Install Node.js if needed
    progress "Installing Node.js"
    install_nodejs
    
    # Step 3: Setup environment
    progress "Setting up environment configuration"
    setup_environment
    
    # Step 4: Configure custom server
    progress "Configuring server connection"
    configure_custom_server
    
    # Step 5: Install dependencies
    progress "Installing project dependencies"
    setup_dependencies
    
    # Step 6: Setup signaling server
    progress "Setting up signaling server"
    setup_signaling_server
    
    # Step 7: Build application
    progress "Building application"
    build_application
    
    # Step 8: Setup development tools
    progress "Setting up development tools"
    setup_dev_tools
    
    # Step 9: Run tests
    progress "Running system tests"
    run_tests
    
    # Step 10: Generate report
    progress "Generating setup report"
    generate_report
    
    # Step 11: Final verification
    progress "Performing final verification"
    if [ -f "$CONFIG_FILE" ] && [ -d ".next" ] && [ -f "start-dev.sh" ]; then
        success "All components verified successfully"
    else
        error "Some components failed verification"
        exit 1
    fi
    
    # Step 12: Complete
    progress "Setup complete!"
    
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                     Setup Successful!                       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    success "P2P File Share has been successfully configured!"
    echo
    info "Quick Start:"
    echo -e "  ${YELLOW}./start-dev.sh${NC}     - Start development environment"
    echo -e "  ${YELLOW}./start-prod.sh${NC}    - Start production environment"
    echo
    info "Application will be available at: ${CYAN}http://localhost:3000${NC}"
    info "Setup report saved to: ${CYAN}setup-report.md${NC}"
    echo
    
    read -p "Would you like to start the development environment now? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        info "Starting development environment..."
        exec ./start-dev.sh
    else
        info "Setup complete. Run './start-dev.sh' when ready to start."
    fi
}

# Handle script interruption
trap 'error "Setup interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"
