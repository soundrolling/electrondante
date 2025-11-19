# Download Dante Audio Client

## Pre-built Installers

Pre-built installers for the Dante Audio Client Electron app are available from:

**GitHub Releases:** https://github.com/soundrolling/electrondante/releases

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
   git clone https://github.com/soundrolling/electrondante.git
   cd electrondante
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npm run rebuild  # Rebuild native modules
   ```

3. **Build installer:**
   ```bash
   npm run build
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
   - Enter your Railway deployment URL (e.g., `wss://your-app.railway.app`)
   - Or use `ws://localhost:3000` for local development

2. **For Broadcasting:**
   - Click "Broadcaster Login"
   - Enter your Supabase email and password
   - Create a room with name, code, and password
   - Select your audio input device
   - Start broadcasting

3. **For Listening:**
   - Enter the room code provided by the broadcaster
   - Enter the room password
   - Click "Join Room"
   - Adjust volume as needed

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
- Ensure your credentials are valid

### Authentication Failed
- Verify your Supabase credentials are correct
- Check that your Supabase project is configured correctly
- Ensure the Railway server has the correct Supabase environment variables

## Support

For issues or questions, please open an issue on GitHub:
https://github.com/soundrolling/electrondante/issues
