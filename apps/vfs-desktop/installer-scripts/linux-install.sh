#!/bin/bash
# ============================================================================
# Ursly VFS Linux Installer
# ============================================================================
# This script helps install the Ursly VFS AppImage on Linux
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

APP_NAME="Ursly VFS"
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"

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

clear
print_header "Ursly VFS Linux Installer"

echo -e "${BOLD}Welcome to the Ursly VFS installer!${NC}"
echo ""

# Find the AppImage
APPIMAGE=""
DOWNLOAD_DIR="$HOME/Downloads"

# Check common locations
for file in "$DOWNLOAD_DIR"/ursly-vfs*.AppImage "$DOWNLOAD_DIR"/Ursly*.AppImage ./ursly-vfs*.AppImage ./Ursly*.AppImage; do
    if [ -f "$file" ]; then
        APPIMAGE="$file"
        break
    fi
done

if [ -z "$APPIMAGE" ]; then
    print_warning "Could not find Ursly VFS AppImage automatically."
    echo ""
    echo -n "Enter the path to the AppImage: "
    read -r APPIMAGE
    
    if [ ! -f "$APPIMAGE" ]; then
        print_error "File not found: $APPIMAGE"
        exit 1
    fi
fi

print_success "Found AppImage: $APPIMAGE"

# Create directories
print_info "Creating installation directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

# Make executable
print_info "Making AppImage executable..."
chmod +x "$APPIMAGE"
print_success "AppImage is now executable"

# Copy to install directory
print_info "Installing to $INSTALL_DIR..."
INSTALLED_PATH="$INSTALL_DIR/ursly-vfs.AppImage"
cp "$APPIMAGE" "$INSTALLED_PATH"
chmod +x "$INSTALLED_PATH"
print_success "Installed to $INSTALLED_PATH"

# Create desktop entry
print_info "Creating desktop entry..."
cat > "$DESKTOP_DIR/ursly-vfs.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Ursly VFS
Comment=Virtual Cloud File System - Multi-tier storage browser
Exec=$INSTALLED_PATH
Icon=ursly-vfs
Terminal=false
Categories=Utility;FileManager;
Keywords=cloud;storage;s3;azure;files;browser;
StartupWMClass=ursly-vfs
EOF

print_success "Desktop entry created"

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    print_info "Updating desktop database..."
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

# Add to PATH if needed
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    print_warning "$INSTALL_DIR is not in your PATH"
    echo ""
    echo "Add this line to your ~/.bashrc or ~/.zshrc:"
    echo -e "${CYAN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    echo ""
fi

print_header "Installation Complete!"
echo -e "${GREEN}${BOLD}Ursly VFS has been successfully installed!${NC}"
echo ""
echo "You can now:"
echo "  - Find it in your application menu"
echo "  - Run it from terminal: ursly-vfs.AppImage"
echo "  - Or run: $INSTALLED_PATH"
echo ""

# Ask to launch
echo -n "Would you like to launch Ursly VFS now? [Y/n] "
read -r launch_response
if [[ ! "$launch_response" =~ ^[Nn]$ ]]; then
    print_info "Launching Ursly VFS..."
    nohup "$INSTALLED_PATH" &>/dev/null &
    print_success "Ursly VFS is starting!"
fi

echo ""
echo -e "${CYAN}Thank you for using Ursly VFS!${NC}"
echo "Visit https://ursly.io for documentation and support."
echo ""

