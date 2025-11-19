# ElectroDante - Standalone Dante Audio Client

Stream and monitor Dante audio over the network with low latency.

## 🎯 What is ElectroDante?

ElectroDante is a **standalone Dante audio streaming solution** that allows you to:
- Capture audio from Dante Virtual Soundcard (up to 16 channels)
- Stream audio over the network via WebSocket relay
- Monitor audio levels in real-time with VU meters
- Mix and adjust individual channel levels
- Create rooms for multiple listeners
- Works locally or over the internet

## 🏗️ Architecture

```
Recorder → Dante Virtual Soundcard → Electron App → Railway Server → Web Listeners
```

### Components

1. **Electron App** (`bridge-server/electron-app/`)
   - Desktop application for broadcasters
   - Captures audio from Dante Virtual Soundcard
   - Sends audio to Railway server via WebSocket
   - Requires naudiodon for audio I/O

2. **Railway Bridge Server** (`bridge-server/server.js`)
   - WebSocket relay server
   - Receives audio from broadcaster
   - Broadcasts to all connected listeners
   - Handles room management and authentication

3. **Web Listener** (`src/components/tools/DanteMonitorMixer.vue`)
   - Browser-based audio monitor
   - Real-time VU meters for all channels
   - Individual channel volume controls
   - Works on any device with a browser

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Dante Virtual Soundcard (for broadcasters)
- Railway account (for hosting relay server)
- Supabase account (for authentication)

### 1. Install Dependencies

```bash
# Install web app dependencies
npm install

# Install bridge server dependencies
cd bridge-server
npm install

# Install Electron app dependencies
cd electron-app
npm install
npm run rebuild  # Rebuild native modules
cd ../..
```

### 2. Configure Environment Variables

Create `.env` in the project root:

```bash
# Supabase (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption (required - generate with: openssl rand -hex 16)
VITE_ENCRYPTION_KEY=your-32-char-key

# Railway WebSocket URL (required)
VITE_BRIDGE_WS_URL=wss://your-app.railway.app
```

Create `bridge-server/.env`:

```bash
# Railway WebSocket URL
RAILWAY_WS_URL=wss://your-app.railway.app

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Dante configuration
CHANNEL_COUNT=16
DANTE_DEVICE_ID=-1  # Auto-detect
```

### 3. Deploy Railway Server

1. Create new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Set root directory to `bridge-server`
4. Add environment variables (see above)
5. Deploy

### 4. Run the Applications

**Web Listener (Development):**
```bash
npm run dev
```

**Electron Broadcaster:**
```bash
cd bridge-server/electron-app
npm start
```

**Railway Server (Local Testing):**
```bash
cd bridge-server
npm start
```

## 📖 User Guide

### For Broadcasters

1. **Install Dante Virtual Soundcard** on your machine
2. **Configure your DAW/Recorder** to output to Dante Virtual Soundcard
3. **Launch Electron App** (`bridge-server/electron-app`)
4. **Login** with your Supabase credentials
5. **Create a room** or start broadcasting
6. **Select audio device** (Dante Virtual Soundcard)
7. Audio is now streaming to all listeners

### For Listeners

1. **Open web browser** and navigate to your app URL
2. **Login** with your credentials
3. **Join a room** using the room code
4. **Adjust channel volumes** as needed
5. **Monitor VU meters** in real-time

## 🔧 Configuration

### Audio Settings

Edit `bridge-server/.env`:

```bash
CHANNEL_COUNT=16          # Number of audio channels (1-64)
DANTE_DEVICE_ID=-1        # Audio device ID (-1 = auto-detect)
```

### Buffer Settings

Edit `bridge-server/electron-app/client-core.js`:

```javascript
bufferSize: 4096,  // Samples per buffer (higher = more latency, better quality)
batchSize: 4,      // Buffers to batch before sending (reduces overhead)
```

**Latency calculation:**
```
Latency (ms) = (bufferSize / sampleRate) * batchSize * 1000
Example: (4096 / 48000) * 4 * 1000 ≈ 341ms
```

## 🛠️ Development

### Project Structure

```
electrondante/
├── bridge-server/
│   ├── electron-app/        # Broadcaster desktop app
│   │   ├── main.js         # Electron main process
│   │   ├── client-core.js  # Audio capture logic
│   │   ├── opus-encoder.js # Audio encoding
│   │   └── services/       # Auth, audio playback
│   ├── server.js           # Railway relay server
│   └── package.json
│
├── src/
│   ├── components/
│   │   ├── Login.vue              # Authentication
│   │   ├── tools/
│   │   │   └── DanteMonitorMixer.vue  # Main listener UI
│   │   └── ...
│   ├── composables/
│   │   ├── useDanteMixer.js       # Audio mixing logic
│   │   ├── useAudioCapture.js     # Audio capture
│   │   └── useOpusDecoder.js      # Audio decoding
│   ├── stores/
│   │   └── userStore.js           # User state
│   └── main.js
│
└── package.json
```

### Building for Production

**Web App:**
```bash
npm run build
```

**Electron App:**
```bash
cd bridge-server/electron-app
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

## 🐛 Troubleshooting

### No Audio Devices Found

**Solution:** Rebuild native modules
```bash
cd bridge-server/electron-app
npm run rebuild
```

### Connection Failed

**Check:**
- Railway server is running
- `VITE_BRIDGE_WS_URL` uses `wss://` (not `https://`)
- Firewall allows WebSocket connections
- Authentication token is valid

### High Latency

**Adjust buffer settings** in `client-core.js`:
- Reduce `bufferSize` (e.g., 2048)
- Reduce `batchSize` (e.g., 2)
- Trade-off: Lower values = less latency but higher CPU usage

### Electron App Won't Start

**V8 Out of Memory:**
- Already fixed in `main.js` line 1-5
- Restart the app

**Missing Dependencies:**
```bash
cd bridge-server/electron-app
npm install
npm run rebuild
```

## 📚 API Reference

### Supabase Schema

Required tables:
- `users` - User authentication
- `user_profiles` - User profile data
- `dante_rooms` - Broadcasting rooms

See `supabase/schema.sql` for full schema.

### WebSocket Messages

**Client → Server:**
```javascript
// Register as broadcaster
{ type: 'registerSource', roomId: 'xxx', roomToken: 'yyy' }

// Register as listener
{ type: 'registerListener', roomId: 'xxx', roomToken: 'yyy' }

// Send audio
{ type: 'audio', channel: 0, data: [...], encoding: 'opus' }
```

**Server → Client:**
```javascript
// Source registered
{ type: 'sourceRegistered', channels: 16, sampleRate: 48000 }

// Audio data
{ type: 'audio', channel: 0, data: [...], encoding: 'opus' }

// Room status
{ type: 'roomStatus', hasBroadcaster: true, listenerCount: 3 }
```

## 🤝 Contributing

This is a standalone project. For the parent production management app, see the main repository.

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Links

- [Supabase Documentation](https://supabase.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Dante Virtual Soundcard](https://www.audinate.com/products/software/dante-virtual-soundcard)
- [Electron Documentation](https://www.electronjs.org/docs)

## 💬 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Railway server logs
3. Check browser console for errors
4. Open an issue on GitHub
