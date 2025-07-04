#!/bin/bash

# Quick installer script - downloads and runs the full setup
# Usage: curl -sSL https://your-domain.com/install.sh | bash

set -e

REPO_URL="https://github.com/your-org/p2p-file-share.git"
APP_DIR="p2p-file-share"

echo "🚀 P2P File Share - Quick Installer"
echo "===================================="

# Check if git is available
if ! command -v git >/dev/null 2>&1; then
    echo "❌ Git is required but not installed. Please install Git first."
    exit 1
fi

# Clone repository
if [ -d "$APP_DIR" ]; then
    echo "📁 Directory $APP_DIR already exists. Updating..."
    cd "$APP_DIR"
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Make setup script executable
chmod +x setup.sh

# Run setup
echo "🔧 Running automated setup..."
./setup.sh

echo "✅ Installation complete!"
