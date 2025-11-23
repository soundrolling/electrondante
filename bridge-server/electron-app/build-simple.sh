#!/bin/bash
# Simple build script - builds to 'out' folder, skips native module rebuild if it fails
# This is useful for quick testing of the UI even if audio modules can't be built

set -e

echo "🎤 Dante Audio Client - Simple Build"
echo "====================================="
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

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Try to rebuild native modules, but don't fail if it doesn't work
echo "🔧 Attempting to rebuild native modules..."
if npm run rebuild 2>&1; then
    echo "✅ Native modules rebuilt successfully"
else
    echo "⚠️  Native module rebuild failed (this is okay for basic UI testing)"
    echo "   Audio features won't work, but you can test the UI"
fi
echo ""

# Build the app - output will be in 'out' folder
echo "📦 Building app bundle..."
echo "   (Version will be auto-incremented during build)"
echo "   Output will be in: out/mac-arm64/Dante Audio Client.app"
echo ""

# Skip code signing and native rebuild for local builds
CSC_IDENTITY_AUTO_DISCOVERY=false \
SKIP_SIGNING=true \
SKIP_NATIVE_REBUILD=true \
ELECTRON_SKIP_BINARY_DOWNLOAD=0 \
npm run build:simple

echo ""
echo "✅ Build complete!"
echo ""

# Get the version that was built
BUILT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Built version: $BUILT_VERSION"
echo ""

# Find the actual app path (could be out/mac or out/mac-arm64)
APP_PATH=$(find out -name "Dante Audio Client.app" -type d 2>/dev/null | head -1)

if [ -n "$APP_PATH" ]; then
    echo "📱 Your app is ready at:"
    echo "   $APP_PATH"
    echo ""
    echo "🚀 To run it:"
    echo "   open '$APP_PATH'"
else
    echo "⚠️  App bundle not found in expected location"
    echo "   Check the 'out' directory for the built app"
fi
echo ""
echo "   Or double-click it in Finder!"
echo ""

