#!/bin/bash
# Build script for Dante Audio Client
# This script handles the complete build process including native module rebuilding

set -e

echo "🎤 Dante Audio Client - Build Script"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the electron-app directory."
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    exit 1
fi

echo "✅ Node.js $(node -v) found"
echo ""

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Rebuild native modules for Electron
echo "🔧 Rebuilding native modules for Electron..."
npm run rebuild

echo ""
echo "📦 Building installer..."

# Build based on platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Building macOS installer..."
    npm run build:mac
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Building Linux installer..."
    npm run build:linux
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "🪟 Building Windows installer..."
    npm run build:win
else
    echo "⚠️  Unknown platform, building for all platforms..."
    npm run build
fi

echo ""
echo "✅ Build complete! Installer is in the dist/ directory"
echo ""

