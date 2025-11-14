# Dante Audio Client - Electron App

A packaged desktop application for streaming audio from your computer to Railway.

## Building the App

### Prerequisites
- Node.js 20+ installed
- npm or yarn

### Install Dependencies
```bash
cd electron-app
npm install
```

### Development
```bash
npm start
```

### Build for Production

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

Built applications will be in the `dist/` directory.

## Usage

1. **Download and Install**: Download the built app for your platform and install it.

2. **Get Access Token**: 
   - Sign in to your Vue app at https://pro.soundrolling.com
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run: `JSON.parse(localStorage.getItem('sb-mcetzgzwldytnalfaldo-auth-token')).access_token`
   - Copy the token

3. **Configure**:
   - Enter Railway WebSocket URL (default: `wss://proapp2149-production.up.railway.app`)
   - Paste your Supabase Access Token
   - Set Channel Count (1-32, default: 32)

4. **Start Client**:
   - Click "Start Client"
   - Select your audio device from the list
   - The client will connect to Railway and start streaming

5. **Monitor**: Watch the status bar and logs for connection status and any errors.

## Features

- ✅ GUI-based configuration (no command line needed)
- ✅ Device selection with live switching
- ✅ Real-time status monitoring
- ✅ Error logging and display
- ✅ Automatic reconnection
- ✅ Multi-channel audio support (up to 32 channels)
- ✅ Works with Dante Virtual Soundcard and other audio devices

## Troubleshooting

- **No devices found**: Make sure your audio device is connected and recognized by your OS
- **Connection failed**: Check that the Railway URL is correct and the server is running
- **Authentication failed**: Verify your access token is valid (they expire, get a new one)
- **Audio not streaming**: Check that you've selected a device and it's not muted

## Distribution

After building, you can distribute:
- **macOS**: `.dmg` file from `dist/`
- **Windows**: `.exe` installer from `dist/`
- **Linux**: `.AppImage` from `dist/`

