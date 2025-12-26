#!/bin/bash

# Version Bump Script for Ursly VFS
# Usage: ./scripts/version-bump.sh [patch|minor|major|1.1.5]

set -e

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Determine new version
if [ -z "$1" ]; then
    echo "Usage: ./scripts/version-bump.sh [patch|minor|major|1.1.5]"
    exit 1
fi

if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW_VERSION="$1"
else
    # Use npm version to calculate next version
    NEW_VERSION=$(npm version "$1" --dry-run --no-git-tag-version 2>&1 | grep -oP '\d+\.\d+\.\d+' | head -1)
fi

echo "New version: $NEW_VERSION"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Update root package.json
cd /Users/tony/ursly
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
echo "✅ Updated root package.json"

# Update app package.json
cd apps/vfs-desktop
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
echo "✅ Updated app package.json"

# Update Cargo.toml
sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
echo "✅ Updated Cargo.toml"

# Update tauri.conf.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
echo "✅ Updated tauri.conf.json"

echo ""
echo "✅ Version bumped from $CURRENT_VERSION to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  1. Test: npm run tauri:dev"
echo "  2. Build: npm run tauri:build"
echo "  3. Commit: git add . && git commit -m \"chore: bump version to $NEW_VERSION\""

