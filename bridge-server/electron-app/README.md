# Dante Audio Client - Electron App

A standalone desktop application for broadcasting and listening to multi-room audio streams. Features Supabase authentication for broadcasters and room code/password access for listeners.

## Features

- 🎙️ **Broadcast Mode**: Stream audio from your computer to multiple rooms
- 🎧 **Listen Mode**: Join rooms using room codes and passwords
- 🔐 **Supabase Authentication**: Secure broadcaster login
- 🎚️ **Admin Panel**: Manage rooms, devices, and channel assignments
- 🔊 **Multi-channel Support**: Stream up to 16 channels
- 📊 **Audio Visualization**: Real-time waveform display
- 🔄 **Auto-reconnect**: Automatic reconnection with exponential backoff
- 🎛️ **Volume Control**: Per-listener volume adjustment

## Quick Start

### For End Users

1. **Download** the installer for your platform from [GitHub Releases](https://github.com/soundrolling/electrondante/releases):
   - macOS: `.dmg` file (Intel and Apple Silicon)
   - Windows: `.exe` installer (64-bit and 32-bit)
   - Linux: `.AppImage` file (64-bit)

2. **Install** the app (standard installer process)

3. **Configure**:
   - Enter your Railway WebSocket URL (e.g., `wss://your-app.railway.app`)
   - For broadcasting: Sign in with your Supabase credentials
   - For listening: Enter room code and password

### For Developers

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

```bash
cd electron-app
npm install
npm run rebuild  # Rebuild native modules (naudiodon)
```

#### Running in Development

```bash
npm start
```

#### Building Installers

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

Built installers will be in the `dist/` directory.

## Configuration

### Railway WebSocket URL

The app needs to know where your bridge server is running. Enter the WebSocket URL in the app's UI:

- Format: `wss://your-app.railway.app` (for HTTPS)
- Format: `ws://localhost:3000` (for local development)

### Broadcasting Setup

1. **Sign In**: Click "Broadcaster Login" and enter your Supabase email/password
2. **Create Room**: Enter room name, code, and password
3. **Select Device**: Choose your audio input device
4. **Start Broadcasting**: Click "Start Broadcast"

### Listening Setup

1. **Enter Room Code**: Get the room code from the broadcaster
2. **Enter Password**: Enter the room password
3. **Join Room**: Click "Join Room"
4. **Adjust Volume**: Use the volume slider
5. **Mute/Unmute**: Click the mute button

## Admin Panel

The admin panel allows broadcasters to:
- View all their rooms
- Assign audio devices to rooms
- Configure channel mappings
- Delete rooms
- View room analytics

**Access**: Click the "Admin" button in the status bar (only visible when logged in as broadcaster)

## Project Structure

```
electron-app/
├── main.js              # Main Electron process
├── renderer.js          # Renderer process (UI logic)
├── preload.js           # IPC bridge (secure communication)
├── index.html           # UI structure
├── client-core.js       # WebSocket client core
├── opus-encoder.js      # Opus audio encoding
├── opus-decoder.js      # Opus audio decoding
├── admin.html           # Admin panel UI
├── admin.js             # Admin panel logic
├── services/
│   ├── auth-client.js      # Authentication API client
│   └── audio-listener.js   # Audio playback engine
├── utils/
│   ├── audio-buffer.js     # Adaptive jitter buffer
│   └── reconnection.js     # Reconnection logic
└── config/
    └── constants.js        # Configuration constants
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `RAILWAY_WS_URL` | WebSocket URL of your Railway server | Yes |
| `RAILWAY_URL` | Alternative (will be converted to WebSocket) | Yes |

## Troubleshooting

### "naudiodon not available" Error

The native audio library wasn't built correctly. Rebuild:
```bash
npm run rebuild
```

### No Audio Devices Found

- **macOS**: Grant microphone permissions in System Preferences → Security & Privacy → Privacy → Microphone
- **Windows**: Check Device Manager for audio devices
- **Linux**: Ensure ALSA is installed and audio devices are recognized

### Connection Failed

- Verify Railway URL is correct and uses `wss://` for HTTPS
- Check that Railway server is running
- Ensure your access token is valid (they expire - sign in again)

### Authentication Failed

- Verify your Supabase credentials are correct
- Check that your Supabase project is configured correctly
- Ensure the Railway server has the correct Supabase environment variables

### App Crashes on Startup

- Check console for error messages
- Ensure all native modules are rebuilt: `npm run rebuild`
- Try deleting `node_modules` and reinstalling: `rm -rf node_modules && npm install`

## Development Notes

### IPC Communication

The app uses Electron's IPC (Inter-Process Communication) for secure communication between main and renderer processes:

- **Main Process**: Handles native modules, WebSocket connections, file system access
- **Renderer Process**: Handles UI, user interactions, audio visualization
- **Preload Script**: Provides secure API bridge between processes

### Audio Processing

- **Encoding**: Opus encoding happens in the main process (native module)
- **Decoding**: Opus decoding happens in the main process, PCM sent to renderer
- **Playback**: Web Audio API in renderer process for low-latency playback
- **Buffering**: Adaptive jitter buffer handles network jitter and packet loss

### Security

- Context isolation enabled (renderer cannot access Node.js APIs directly)
- Preload script provides controlled API surface
- Tokens stored securely in main process
- No direct access to Supabase keys from renderer

## License

See LICENSE file for details.

## Support

For issues or questions, please open an issue on GitHub:
https://github.com/soundrolling/electrondante/issues
