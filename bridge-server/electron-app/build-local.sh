#!/bin/bash
# Local build script for testing on Mac
# This builds just the app bundle (no DMG, no code signing) for quick local testing

set -e

echo "🎤 Dante Audio Client - Local Build for Testing"
echo "================================================"
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

# Get current version before incrementing
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Current version: $CURRENT_VERSION"
echo "   (Version will be incremented before build)"
echo ""

# Check for Xcode (required for building native modules)
echo "🔍 Checking for Xcode..."
if command -v xcodebuild &> /dev/null && xcodebuild -version &> /dev/null; then
    XCODE_VERSION=$(xcodebuild -version 2>&1 | head -1)
    echo "✅ $XCODE_VERSION found"
elif [ -d "/Applications/Xcode.app" ]; then
    echo "⚠️  Xcode.app found but xcodebuild not working"
    echo "   Try: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
    echo "   Then run this script again."
    exit 1
else
    echo "❌ Xcode not found!"
    echo ""
    echo "   ⚠️  IMPORTANT: Full Xcode (not just Command Line Tools) is required"
    echo "      to build the native audio module (naudiodon)."
    echo ""
    echo "   To install Xcode:"
    echo "   1. Open the Mac App Store"
    echo "   2. Search for 'Xcode' and install it (it's free, ~12GB)"
    echo "   3. After installation, open Xcode once to accept the license"
    echo "   4. Run: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
    echo "   5. Then run this script again"
    echo ""
    # exit 1
    echo "⚠️  Continuing without Xcode (Native modules may fail to build)..."
fi
echo ""

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Rebuild native modules for Electron
echo "🔧 Rebuilding native modules for Electron..."

# Check if native module is already built
if [ -f "node_modules/naudiodon/build/Release/naudiodon.node" ] || find node_modules/naudiodon/build -name "*.node" -o -name "*.dylib" 2>/dev/null | grep -q .; then
    echo "✅ Native module appears to already be built. Skipping rebuild..."
else
    echo "   Attempting to rebuild..."
    if ! npm run rebuild 2>&1; then
        echo ""
        echo "❌ Rebuild failed!"
        echo ""
        echo "   This usually means Xcode is not properly configured."
        echo "   Try: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
        echo "   Then run this script again."
        # exit 1
        echo "⚠️  Continuing with build (Audio features may be limited)..."
    fi
fi

echo ""
echo "📦 Building app bundle for local testing..."
echo "   (Version will be auto-incremented during build)"
echo "   (No code signing, no DMG - just the .app bundle)"
echo ""

# Build just the app bundle (--dir flag creates .app without DMG)
# Skip code signing by setting these environment variables
CSC_IDENTITY_AUTO_DISCOVERY=false \
SKIP_SIGNING=true \
npm run build:local

echo ""
echo "✅ Build complete!"
echo ""

# Get the version that was built
BUILT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Built version: $BUILT_VERSION"
echo ""

echo "📱 Your app is ready at:"
echo "   out/mac-arm64/Dante Audio Client.app"
echo ""
echo "🚀 To run it:"
echo "   open 'out/mac/Dante Audio Client.app'"
echo ""
echo "   Or double-click it in Finder!"
echo ""

