# Building Dante Audio Client - Installers

This guide explains how to build standalone installers for the Dante Audio Client that include all dependencies.

## Prerequisites

### macOS
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 20+ and npm

### Windows
- Visual Studio Build Tools or Visual Studio Community
- Node.js 20+ and npm
- Python 3.x (for node-gyp)

### Linux
- Build essentials: `sudo apt-get install build-essential`
- Node.js 20+ and npm

## Building

### 1. Install Dependencies

```bash
cd bridge-server/electron-app
npm install
```

This will:
- Install all npm packages
- Automatically rebuild native modules (naudiodon) for Electron

### 2. Build Installers

**For macOS:**
```bash
npm run build:mac
```

**For Windows:**
```bash
npm run build:win
```

**For Linux:**
```bash
npm run build:linux
```

**For all platforms:**
```bash
npm run build
```

### 3. Output

Built installers will be in the `dist/` directory:
- **macOS**: `Dante Audio Client-1.0.0.dmg`
- **Windows**: `Dante Audio Client Setup 1.0.0.exe`
- **Linux**: `Dante Audio Client-1.0.0.AppImage`

## Distribution

The installers are self-contained and include:
- ✅ Electron runtime
- ✅ All JavaScript dependencies
- ✅ Native audio libraries (naudiodon)
- ✅ All required system libraries

Users can download and install without needing:
- ❌ Node.js
- ❌ npm
- ❌ Build tools
- ❌ Manual dependency installation

## Troubleshooting

### Native Module Build Fails

If `naudiodon` fails to build:

1. **macOS**: Install Xcode Command Line Tools
   ```bash
   xcode-select --install
   ```

2. **Windows**: Install Visual Studio Build Tools
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Install "Desktop development with C++" workload

3. **Linux**: Install build essentials
   ```bash
   sudo apt-get install build-essential libasound2-dev
   ```

### Rebuild Native Modules

If you need to rebuild naudiodon for Electron:

```bash
npm run rebuild
```

### Test Before Building

Test the app in development mode:

```bash
npm start
```

## Code Signing and Notarization (macOS)

For macOS distribution, the app must be code signed and notarized. See **[MACOS_SIGNING_GUIDE.md](./MACOS_SIGNING_GUIDE.md)** for complete documentation on:

- Code signing configuration
- Apple notarization setup
- GitHub Actions workflow
- Common issues and solutions
- Required secrets and certificates

**Quick Reference:**
- Code signing is handled automatically in CI/CD via GitHub Actions
- Requires Developer ID Application certificate
- App is notarized automatically after signing
- See `GITHUB_SECRETS.md` for required secrets

## Notes

- The app requires microphone/audio input permissions
- On macOS, users may need to grant permissions in System Preferences
- On Windows, the installer will request necessary permissions
- The app connects to Railway WebSocket server (configured in UI)

