#!/bin/bash
# Installation script for Dante Audio Client
# This script helps set up the Electron app for building

set -e

echo "🎤 Dante Audio Client - Setup Script"
echo "======================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  Node.js version is less than 20. Recommended: Node.js 20+"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Node.js $(node -v) found"
echo ""

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) found"
echo ""

# Platform-specific checks
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 macOS detected"
    
    # Check for Xcode Command Line Tools
    if ! xcode-select -p &> /dev/null; then
        echo "⚠️  Xcode Command Line Tools not found"
        echo "   Installing Xcode Command Line Tools..."
        xcode-select --install
        echo "   Please complete the installation, then run this script again."
        exit 1
    fi
    echo "✅ Xcode Command Line Tools found"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Linux detected"
    
    # Check for build essentials
    if ! command -v g++ &> /dev/null; then
        echo "⚠️  Build tools not found"
        echo "   Installing build-essential..."
        sudo apt-get update
        sudo apt-get install -y build-essential libasound2-dev
    fi
    echo "✅ Build tools found"
    
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "🪟 Windows detected"
    echo "⚠️  Please ensure Visual Studio Build Tools are installed"
    echo "   Download from: https://visualstudio.microsoft.com/downloads/"
    echo "   Install 'Desktop development with C++' workload"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔧 Rebuilding native modules for Electron..."
npm run rebuild

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the app in development mode:"
echo "  npm start"
echo ""
echo "To build installers:"
echo "  npm run build:mac    # macOS"
echo "  npm run build:win    # Windows"
echo "  npm run build:linux  # Linux"
echo "  npm run build        # All platforms"
echo ""

