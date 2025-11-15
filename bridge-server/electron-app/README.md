# Dante Audio Client - Electron App

A packaged desktop application for streaming audio from your computer to Railway. This app includes all dependencies and works out of the box - no Node.js or build tools required for end users.

## Quick Start

### For End Users

1. **Download** the installer for your platform:
   - macOS: `Dante Audio Client-1.0.0.dmg`
   - Windows: `Dante Audio Client Setup 1.0.0.exe`
   - Linux: `Dante Audio Client-1.0.0.AppImage`

2. **Install** the app (standard installer process)

3. **Run** the app and configure:
   - Enter Railway WebSocket URL
   - Paste your Supabase Access Token (get from browser DevTools)
   - Select your audio device
   - Click "Start Client"

### For Developers (Building Installers)

#### Prerequisites

**macOS:**
```bash
xcode-select --install  # Install Xcode Command Line Tools
```

**Windows:**
- Install Visual Studio Build Tools with "Desktop development with C++" workload
- Download from: https://visualstudio.microsoft.com/downloads/

**Linux:**
```bash
sudo apt-get install build-essential libasound2-dev
```

#### Setup

Run the setup script:
```bash
cd bridge-server/electron-app
./install.sh
```

Or manually:
```bash
npm install
npm run rebuild  # Rebuild native modules for Electron
```

#### Build Installers

**macOS:**
```bash
npm run build:mac
```

**Windows:**
```bash
npm run build:win
```

**Linux:**
```bash
npm run build:linux
```

**All platforms:**
```bash
npm run build
```

Built installers will be in the `dist/` directory.

#### Development

Test the app before building:
```bash
npm start
```

## Features

- ✅ **Self-contained**: All dependencies included, no Node.js needed
- ✅ **Native audio support**: Full multi-channel audio capture (up to 32 channels)
- ✅ **GUI configuration**: No command line required
- ✅ **Device selection**: Choose from all available audio input devices
- ✅ **Real-time status**: See connection and streaming status
- ✅ **Auto-reconnect**: Automatically reconnects if connection drops
- ✅ **Works with Dante Virtual Soundcard**: Full support for all channels

## Configuration

### Getting Your Supabase Access Token

1. Sign in to your Vue app at https://pro.soundrolling.com
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run:
   ```javascript
   JSON.parse(localStorage.getItem('sb-mcetzgzwldytnalfaldo-auth-token')).access_token
   ```
5. Copy the token and paste it into the app

### Railway WebSocket URL

Default: `wss://proapp2149-production.up.railway.app`

If you're using a different Railway deployment, update the URL in the app.

## Troubleshooting

### "naudiodon not available" Error

This means native modules weren't built correctly. Run:
```bash
npm run rebuild
```

### No Audio Devices Found

- Make sure your audio device is connected and recognized by your OS
- On macOS, grant microphone permissions in System Preferences → Security & Privacy
- On Windows, check Device Manager for audio devices

### Connection Failed

- Verify Railway URL is correct
- Check that Railway server is running
- Ensure your access token is valid (they expire - get a new one)

### Build Errors

**macOS:**
- Ensure Xcode Command Line Tools are installed: `xcode-select --install`

**Windows:**
- Install Visual Studio Build Tools with C++ workload
- Ensure Python 3.x is installed and in PATH

**Linux:**
- Install build essentials: `sudo apt-get install build-essential libasound2-dev`

## Distribution

The built installers are completely standalone:
- ✅ Include Electron runtime
- ✅ Include all JavaScript dependencies
- ✅ Include native audio libraries
- ✅ Include system libraries (where possible)

Users can install and run without any additional setup.

## File Structure

```
electron-app/
├── main.js           # Electron main process
├── preload.js        # Preload script (security bridge)
├── renderer.js       # UI logic
├── client-core.js    # Audio client core logic
├── opus-encoder.js   # Opus audio encoder utility
├── index.html        # UI markup
├── package.json      # Dependencies and build config
├── install.sh        # Setup script
└── build/            # Build resources (icons, entitlements)
```

## License

Same as main project.
