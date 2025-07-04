#!/bin/bash

# Health check script for monitoring the application

check_service() {
    local service_name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo -n "Checking $service_name... "
    
    if command -v curl >/dev/null 2>&1; then
        status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
        if [ "$status" = "$expected_status" ]; then
            echo "✅ OK ($status)"
            return 0
        else
            echo "❌ FAIL ($status)"
            return 1
        fi
    else
        echo "⚠️  curl not available"
        return 1
    fi
}

check_websocket() {
    local ws_url="$1"
    echo -n "Checking WebSocket... "
    
    if node -e "
        const WebSocket = require('ws');
        const ws = new WebSocket('$ws_url');
        ws.on('open', () => { console.log('✅ OK'); process.exit(0); });
        ws.on('error', () => { console.log('❌ FAIL'); process.exit(1); });
        setTimeout(() => { console.log('❌ TIMEOUT'); process.exit(1); }, 5000);
    " 2>/dev/null; then
        return 0
    else
        echo "❌ FAIL"
        return 1
    fi
}

echo "🏥 P2P File Share Health Check"
echo "=============================="

# Check Next.js application
check_service "Next.js App" "http://localhost:3000" "200"

# Check signaling server
check_websocket "ws://localhost:8080"

# Check system resources
echo -n "Checking disk space... "
available=$(df . | tail -1 | awk '{print $4}')
if [ "$available" -gt 1048576 ]; then  # 1GB
    echo "✅ OK ($(($available / 1024))MB available)"
else
    echo "⚠️  LOW ($(($available / 1024))MB available)"
fi

echo -n "Checking memory... "
if command -v free >/dev/null 2>&1; then
    available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$available_mem" -gt 512 ]; then
        echo "✅ OK (${available_mem}MB available)"
    else
        echo "⚠️  LOW (${available_mem}MB available)"
    fi
else
    echo "⚠️  Unable to check"
fi

echo
echo "Health check complete!"
