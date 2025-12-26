#!/bin/bash
# ============================================================================
# Ursly VFS Installer for macOS
# ============================================================================
# This script removes the quarantine flag and installs the app to /Applications
# Run this by double-clicking the file after mounting the DMG
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# App name
APP_NAME="Ursly VFS.app"

# Get the directory where this script is located (the DMG mount point)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to print styled messages
print_header() {
    echo ""
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[X]${NC} $1"
}

# Clear screen and show header
clear
print_header "Ursly VFS Installer"

echo -e "${BOLD}Welcome to the Ursly VFS installer!${NC}"
echo ""
echo "This installer will:"
echo "  1. Copy Ursly VFS to your Applications folder"
echo "  2. Remove the macOS quarantine flag (bypasses Gatekeeper)"
echo "  3. Launch the app for you"
echo ""

# Check if app exists in DMG
if [ ! -d "$SCRIPT_DIR/$APP_NAME" ]; then
    print_error "Could not find '$APP_NAME' in the disk image."
    print_info "Looking in: $SCRIPT_DIR"
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

print_success "Found $APP_NAME"

# Check if already installed
if [ -d "/Applications/$APP_NAME" ]; then
    print_warning "Ursly VFS is already installed in /Applications"
    echo ""
    echo -n "Do you want to replace it? [y/N] "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled."
        echo ""
        echo "Press any key to exit..."
        read -n 1
        exit 0
    fi
    print_info "Removing existing installation..."
    rm -rf "/Applications/$APP_NAME"
fi

# Copy to Applications
print_info "Copying to /Applications..."
cp -R "$SCRIPT_DIR/$APP_NAME" /Applications/

if [ ! -d "/Applications/$APP_NAME" ]; then
    print_error "Failed to copy app to /Applications"
    echo "You may need to run this with administrator privileges."
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

print_success "Copied to /Applications"

# Remove quarantine flag
print_info "Removing quarantine flag..."
xattr -cr "/Applications/$APP_NAME" 2>/dev/null || true
print_success "Quarantine flag removed"

# Verify the app
print_info "Verifying installation..."
if [ -d "/Applications/$APP_NAME" ]; then
    print_success "Installation verified"
else
    print_error "Installation verification failed"
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

# Success message
echo ""
print_header "Installation Complete!"
echo -e "${GREEN}${BOLD}Ursly VFS has been successfully installed!${NC}"
echo ""
echo "The app is now available in your Applications folder."
echo ""

# Ask to launch
echo -n "Would you like to launch Ursly VFS now? [Y/n] "
read -r launch_response
if [[ ! "$launch_response" =~ ^[Nn]$ ]]; then
    print_info "Launching Ursly VFS..."
    open "/Applications/$APP_NAME"
    print_success "Ursly VFS is starting!"
fi

echo ""
echo -e "${CYAN}Thank you for using Ursly VFS!${NC}"
echo "Visit https://ursly.io for documentation and support."
echo ""
echo "Press any key to close this window..."
read -n 1




