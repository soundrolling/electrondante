# Download Dante Audio Client

## Pre-built Installers

Pre-built installers for the Dante Audio Client Electron app are available from:

**GitHub Releases:** https://github.com/soundrolling/proapp2149/releases

### Available Platforms

- **macOS**: `.dmg` file (Intel and Apple Silicon)
- **Windows**: `.exe` installer (64-bit and 32-bit)
- **Linux**: `.AppImage` file (64-bit)

## Building from Source

If you need to build the app yourself:

### Prerequisites

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

### Build Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/soundrolling/proapp2149.git
   cd proapp2149/bridge-server/electron-app
   ```

2. **Run setup script:**
   ```bash
   ./install.sh
   ```

3. **Build installer:**
   ```bash
   ./build.sh
   ```

   Or build for specific platform:
   ```bash
   npm run build:mac    # macOS
   npm run build:win    # Windows
   npm run build:linux  # Linux
   ```

4. **Find installer:**
   The built installer will be in the `dist/` directory.

## Installation

### macOS
1. Download the `.dmg` file
2. Open the `.dmg` file
3. Drag "Dante Audio Client" to Applications folder
4. Open from Applications (may need to allow in System Preferences → Security)

### Windows
1. Download the `.exe` installer
2. Run the installer
3. Follow the installation wizard
4. Launch from Start Menu or desktop shortcut

### Linux
1. Download the `.AppImage` file
2. Make it executable:
   ```bash
   chmod +x Dante-Audio-Client-*.AppImage
   ```
3. Run it:
   ```bash
   ./Dante-Audio-Client-*.AppImage
   ```

## Configuration

After installing, you'll need to configure:

1. **Railway WebSocket URL:**
   - Default: `wss://proapp2149-production.up.railway.app`
   - Or your custom Railway deployment URL

2. **Supabase Access Token:**
   - Sign in to https://pro.soundrolling.com
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run:
     ```javascript
     JSON.parse(localStorage.getItem('sb-mcetzgzwldytnalfaldo-auth-token')).access_token
     ```
   - Copy the token and paste into the app

3. **Select Audio Device:**
   - Choose your audio input device from the dropdown
   - For Dante Virtual Soundcard, select it from the list

4. **Start Client:**
   - Click "Start Client" to begin streaming

## Troubleshooting

### "naudiodon not available" Error
The native audio library wasn't built correctly. Rebuild:
```bash
npm run rebuild
```

### No Audio Devices Found
- Ensure your audio device is connected and recognized by your OS
- On macOS: Grant microphone permissions in System Preferences → Security & Privacy
- On Windows: Check Device Manager for audio devices

### Connection Failed
- Verify Railway URL is correct
- Check that Railway server is running
- Ensure your access token is valid (they expire - get a new one)

## Support

For issues or questions, please open an issue on GitHub:
https://github.com/soundrolling/proapp2149/issues

