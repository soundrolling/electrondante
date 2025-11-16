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
4. **First time opening:** The app is signed but may not be notarized yet. To open it:
   - **Option 1 (Recommended):** Go to **System Settings** → **Privacy & Security** → Scroll down to see "Dante Audio Client.app was blocked" → Click **"Open Anyway"**
   - **Option 2:** Right-click the app in Applications → Select "Open" → Click "Open" in the security dialog
   - **Option 3:** Open Terminal and run:
     ```bash
     xattr -d com.apple.quarantine "/Applications/Dante Audio Client.app"
     sudo spctl --master-disable  # Temporarily disable Gatekeeper (re-enable after)
     open "/Applications/Dante Audio Client.app"
     sudo spctl --master-enable  # Re-enable Gatekeeper
     ```
5. After the first open, the app will be added to your exceptions and will open normally

**Note:** The app is code-signed with a Developer ID certificate. If notarization is working, you won't see these warnings. If you do see warnings, it means notarization is still being set up.

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

2. **Supabase API Key:**
   - Go to your Supabase project dashboard
   - Navigate to **Project Settings** → **API**
   - Scroll down to **Secret keys** section
   - Find the API key named **"dante"**
   - Copy the key and paste into the app
   - <small>These keys allow privileged access - use in backend components</small>

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
- Ensure your API key is valid and correctly copied

## Support

For issues or questions, please open an issue on GitHub:
https://github.com/soundrolling/proapp2149/issues

