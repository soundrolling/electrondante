# Local Build Guide for Mac Testing

This guide explains how to build the app locally on your Mac for testing without creating installers or requiring code signing.

## Prerequisites

**⚠️ IMPORTANT: You need full Xcode (not just Command Line Tools) to build this app.**

The native audio module (naudiodon) requires Xcode to compile. Here's how to set it up:

1. **Install Xcode** from the Mac App Store (it's free, ~12GB download)
2. **Open Xcode once** to accept the license agreement
3. **Set Xcode as the active developer directory:**
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   ```

You can verify Xcode is working:
```bash
xcodebuild -version
```

## Quick Start

There are two ways to build:

### Option 1: Simple Build (Recommended for Quick Testing)

This builds to an `out` folder and won't fail if native modules can't be built:

```bash
cd electron-app
./build-simple.sh
```

This will:
1. ✅ Install dependencies (if needed)
2. ⚠️ Try to rebuild native modules (continues even if it fails)
3. ✅ Build the app bundle (no DMG, no signing)
4. ✅ Place it in `out/mac-arm64/Dante Audio Client.app` (or `out/mac/` on Intel Macs)

**Note**: If native modules fail to build, the app will still be created but audio features won't work. This is useful for testing the UI.

### Option 2: Full Build (Requires Xcode)

This ensures native modules are properly built:

```bash
cd electron-app
./build-local.sh
```

This will:
1. ✅ Check for Xcode (required)
2. ✅ Install dependencies (if needed)
3. ✅ Rebuild native modules (naudiodon) - **requires Xcode**
4. ✅ Build the app bundle (no DMG, no signing)
5. ✅ Place it in `out/mac/Dante Audio Client.app`

## Running the Built App

After building, you can run the app in several ways:

**Option 1: Double-click**
- Open Finder
- Navigate to `electron-app/dist/mac/`
- Double-click `Dante Audio Client.app`

**Option 2: Command line**
```bash
open 'dist/mac/Dante Audio Client.app'
```

**Option 3: From the build script**
The build script will show you the exact path after building.

## macOS Security Warning

Since the app isn't code signed for local builds, macOS may show a security warning when you first open it:

> "Dante Audio Client.app" cannot be opened because the developer cannot be verified.

**To allow it:**
1. Go to **System Preferences** → **Security & Privacy**
2. Click **"Open Anyway"** next to the warning message
3. Or right-click the app and select **Open** (this bypasses Gatekeeper once)

## Manual Build Steps

If you prefer to build manually:

```bash
# 1. Install dependencies
npm install

# 2. Rebuild native modules
npm run rebuild

# 3. Build app bundle (no signing)
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:local
```

## What Gets Built

- **Location**: `out/mac-arm64/Dante Audio Client.app` (Apple Silicon) or `out/mac/Dante Audio Client.app` (Intel)
- **Type**: App bundle (not a DMG installer)
- **Size**: ~150-200 MB (includes Electron runtime and all dependencies)
- **Signing**: None (for local testing only)
- **Output Folder**: `out/` (standard Electron build output location)

## Troubleshooting

### "Command not found: electron-builder"
```bash
npm install
```

### "naudiodon build failed"
Make sure you have Xcode Command Line Tools:
```bash
xcode-select --install
```

### App won't open / crashes immediately
1. Check the console for errors: `Console.app` → Look for "Dante Audio Client"
2. Try rebuilding native modules: `npm run rebuild`
3. Delete and rebuild: `rm -rf node_modules dist && npm install && ./build-local.sh`

### "Cannot find module" errors
Make sure all dependencies are installed:
```bash
rm -rf node_modules
npm install
npm run rebuild
```

## Development vs Local Build vs Distribution Build

| Type | Command | Output | Signing | Use Case |
|------|---------|--------|---------|----------|
| **Development** | `npm start` | Runs directly | No | Quick testing during development |
| **Local Build** | `./build-local.sh` | `.app` bundle | No | Testing the built app locally |
| **Distribution** | `npm run build:mac` | `.dmg` installer | Yes | Releasing to users |

## Next Steps

- For development: Use `npm start`
- For local testing: Use `./build-local.sh`
- For distribution: See [BUILD_AND_UPLOAD_RELEASE.md](./BUILD_AND_UPLOAD_RELEASE.md)

