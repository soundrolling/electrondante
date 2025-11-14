# Dante Bridge Server

Bridge server for Dante Personal Monitor Mixer with relay architecture:
- **Railway Server**: Acts as relay - receives audio from source, broadcasts to all listeners
- **Local Client**: Captures audio from virtual soundcard, sends to Railway
- **Vue Apps**: Connect to Railway as listeners, receive audio for VU meters and playback

## Architecture

```
Recorder → Dante Virtual Soundcard → Local Client → Railway (WebSocket) → All Listeners (Vue Apps)
```

- **Source**: One local machine with virtual soundcard runs the client (`client.js`)
- **Railway**: Relay server that receives audio from source and broadcasts to all listeners
- **Listeners**: Vue apps (local and remote) connect to Railway to receive audio

## Setup Instructions

### 1. Railway Server Deployment (Relay)

The Railway server acts as a relay that receives audio from the source and broadcasts to all listeners.

1. **Connect Repository:**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub
   - Select your repository

2. **Configure Service:**
   - Set **Root Directory** to `bridge-server` (IMPORTANT!)
   - Railway will use RAILPACK builder (configured in `railway.json`)
   - Start command is auto-detected from `package.json` ("start": "node server.js")

3. **Set Environment Variables:**
   In Railway dashboard → Variables, add:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   CHANNEL_COUNT=16
   ```
   - `PORT` is automatically set by Railway (don't override)

4. **Deploy:**
   - Railway will automatically build and deploy
   - Get your deployment URL (e.g., `https://your-app.railway.app`)
   - Note the WebSocket URL: `wss://your-app.railway.app`

### 2. Local Client Setup (Audio Source)

The local client captures audio from your virtual soundcard and sends it to Railway.

1. **Install dependencies:**
```bash
cd bridge-server
npm install
```

2. **Create `.env` file:**
```bash
# Railway WebSocket URL (use wss:// for HTTPS)
RAILWAY_WS_URL=wss://your-app.railway.app

# Supabase access token (get from browser after signing in to Vue app)
# In browser DevTools console: JSON.parse(localStorage.getItem('sb-<project-ref>-auth-token')).access_token
SUPABASE_ACCESS_TOKEN=your-access-token-here

# Optional: Supabase credentials (for future enhancements)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Audio configuration
CHANNEL_COUNT=16
DANTE_DEVICE_ID=-1  # Auto-detect, or specify device ID
```

3. **Start the client:**
```bash
npm run client
```

**Important:**
- **Get Access Token**: Sign in to the Vue app, then get your access token:
  1. Open browser DevTools (F12)
  2. Go to Console tab
  3. Run: `JSON.parse(localStorage.getItem('sb-<your-project-ref>-auth-token')).access_token`
  4. Copy the token and set it as `SUPABASE_ACCESS_TOKEN` in your `.env` file
- The client will automatically reconnect if connection is lost
- Only one source can be registered at a time

### 3. Vue App Configuration (Listeners)

All Vue apps (local and remote) connect to Railway as listeners.

1. **Set environment variable in Vercel:**
```
VITE_BRIDGE_WS_URL=wss://your-app.railway.app
```

2. **Or in local `.env` file:**
```
VITE_BRIDGE_WS_URL=wss://your-app.railway.app
```

3. **Vue apps will:**
   - Connect to Railway WebSocket
   - Authenticate with Supabase
   - Receive audio data for VU meters and playback
   - Support preset management

## How It Works

### Connection Flow

1. **Source Registration:**
   - Local client connects to Railway WebSocket
   - Authenticates with Supabase token
   - Sends `registerSource` message
   - Railway registers connection as audio source
   - Client starts capturing audio from virtual soundcard

2. **Audio Streaming:**
   - Client processes audio buffers from virtual soundcard
   - Sends audio packets to Railway via WebSocket
   - Railway receives audio and relays to all connected listeners
   - Listeners receive audio for VU meters and playback

3. **Listener Connection:**
   - Vue apps connect to Railway WebSocket
   - Authenticate with Supabase token
   - Receive config message with channel count
   - Start receiving audio packets
   - Support preset save/load operations

### Message Types

**From Source (Client):**
- `registerSource` - Register as audio source
- `audio` - Audio data packets

**From Listeners (Vue Apps):**
- `authenticate` - Authenticate with Supabase token
- `loadPreset` - Load saved preset
- `savePreset` - Save current preset

**From Railway (Server):**
- `config` - Initial configuration (channels, sample rate)
- `sourceRegistered` - Confirmation of source registration
- `authenticated` - Authentication confirmation
- `audio` - Audio data packets (relayed to listeners)
- `preset` - Preset data
- `error` - Error messages

## Important Notes

- **One Source Only:** Only one source can be registered at a time. If another source tries to register, it will receive an error.

- **Authentication Required:** Both source and listeners must authenticate with Supabase. The source client needs a valid Supabase session token (sign in to the Vue app first).

- **WebSocket URL:** Railway provides HTTPS, so use `wss://` (secure WebSocket) for Railway URLs. Local development can use `ws://`.

- **Health Check:** Railway server exposes `/health` endpoint showing:
  - `connectedListeners` - Number of connected listeners
  - `hasSource` - Whether a source is registered

- **Audio Hardware:** The local client requires `naudiodon` and audio hardware access. Railway server does not need audio hardware (it's a relay only).

## Troubleshooting

### Source Client Issues

- **"naudiodon not available"**: Install naudiodon: `npm install naudiodon`. Requires audio hardware access.
- **"No Supabase session"**: Sign in to the Vue app first, then restart the client to get authentication token.
- **"Source already registered"**: Another source is already connected. Only one source allowed at a time.
- **"Cannot connect to Railway"**: Check `RAILWAY_WS_URL` is correct and uses `wss://` for HTTPS.

### Railway Server Issues

- **No audio received**: Check that source client is running and registered successfully.
- **Listeners not receiving audio**: Verify source is registered (check `/health` endpoint shows `hasSource: true`).
- **Connection Issues**: Check that Railway deployment is running and WebSocket URL uses `wss://`.

### Vue App Issues

- **Cannot connect**: Verify `VITE_BRIDGE_WS_URL` is set correctly in environment variables.
- **No audio**: Check that source is registered and sending audio to Railway.
- **CORS Errors**: Railway server auto-allows Vercel URLs. Check that your frontend URL is in allowed origins.

## Development

### Running Locally (Testing)

For local testing, you can run both server and client locally:

1. **Terminal 1 - Railway Server (local):**
```bash
cd bridge-server
npm start
```

2. **Terminal 2 - Client (local):**
```bash
cd bridge-server
RAILWAY_WS_URL=ws://localhost:3000 npm run client
```

3. **Vue App:**
```bash
VITE_BRIDGE_WS_URL=ws://localhost:3000 npm run dev
```

