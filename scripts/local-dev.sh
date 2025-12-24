#!/bin/bash

# Ursly Local Development Server
# Serves the website locally and starts development services

set -e

echo "🚀 Starting Ursly Local Development Environment"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to start web server
start_web_server() {
    echo -e "${BLUE}📱 Starting website on http://localhost:8080...${NC}"
    cd website
    
    # Check if Python is available for simple HTTP server
    if command -v python3 &> /dev/null; then
        python3 -m http.server 8080 > /tmp/web-server.log 2>&1 &
        WEB_PID=$!
        echo $WEB_PID > /tmp/web-server.pid
        echo -e "${GREEN}✓ Website server running (PID: $WEB_PID)${NC}"
    elif command -v python &> /dev/null; then
        python -m SimpleHTTPServer 8080 > /tmp/web-server.log 2>&1 &
        WEB_PID=$!
        echo $WEB_PID > /tmp/web-server.pid
        echo -e "${GREEN}✓ Website server running (PID: $WEB_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  Python not found. Install Python 3 to run web server.${NC}"
    fi
    cd ..
}

# Function to start development services
start_dev_services() {
    echo -e "${BLUE}🛠️  Starting development services...${NC}"
    echo ""
    echo -e "  Available commands:"
    echo -e "    ${YELLOW}npm run dev${NC}       - Start API + Web UI (recommended)"
    echo -e "    ${YELLOW}npm run dev:all${NC}   - Start API + gRPC + Web UI"
    echo -e "    ${YELLOW}npm run test${NC}      - Run all tests"
    echo -e "    ${YELLOW}npm run lint${NC}      - Lint all code"
    echo ""
}

# Function to print service status
print_status() {
    echo ""
    echo -e "${GREEN}✨ Services Status:${NC}"
    echo "  Website:  http://localhost:8080"
    echo "  API:      http://localhost:3000 (when started)"
    echo "  Web UI:   http://localhost:4200 (when started)"
    echo "  gRPC:     localhost:50051 (when started)"
    echo ""
}

# Function to cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    
    # Kill web server if running
    if [ -f /tmp/web-server.pid ]; then
        WEB_PID=$(cat /tmp/web-server.pid)
        if kill -0 $WEB_PID 2>/dev/null; then
            kill $WEB_PID 2>/dev/null || true
            echo -e "${GREEN}✓ Website server stopped${NC}"
        fi
        rm -f /tmp/web-server.pid
    fi
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Trap signals for cleanup
trap cleanup EXIT INT TERM

# Change to project root
cd /Users/tony/ursly

# Start web server
start_web_server

# Print status
print_status

# Start development services instructions
start_dev_services

# Wait for signals
echo -e "${YELLOW}Press Ctrl+C to stop services${NC}"
echo ""

# Keep the script running
tail -f /tmp/web-server.log 2>/dev/null || wait

