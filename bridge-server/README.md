# Dante Audio Bridge Server

A standalone multi-room audio streaming server with Supabase authentication. Broadcasters can create rooms and stream audio, while listeners join rooms using room codes and passwords.

## Architecture

```
Broadcaster (Electron App) → WebSocket → Bridge Server (Railway) → WebSocket → Listeners (Electron App)
```

- **Bridge Server**: Runs on Railway, manages rooms, authentication, and relays audio
- **Electron App**: Desktop client for both broadcasting and listening
- **Supabase**: User authentication and room persistence

## Features

- ✅ Multi-room audio streaming
- ✅ Supabase authentication for broadcasters
- ✅ Room code/password system for listeners
- ✅ Opus audio encoding/decoding
- ✅ Adaptive jitter buffering
- ✅ Automatic reconnection with exponential backoff
- ✅ Admin panel for room and device management
- ✅ Database persistence for rooms and analytics

## Quick Start

### 1. Railway Server Deployment

1. **Connect Repository:**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub
   - Select your repository

2. **Configure Service:**
   - Set **Root Directory** to `bridge-server`
   - Railway will auto-detect `package.json` start script

3. **Set Environment Variables:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   PORT=3000
   ```

4. **Deploy:**
   - Railway will automatically build and deploy
   - Get your deployment URL (e.g., `https://your-app.railway.app`)
   - WebSocket URL: `wss://your-app.railway.app`

### 2. Supabase Database Setup

1. **Create Tables:**
   - Go to your Supabase project → SQL Editor
   - Run the SQL from `supabase-migration.sql`
   - This creates: `audio_rooms`, `room_participants`, `room_analytics`, `audit_log`

2. **Configure RLS:**
   - Row Level Security is enabled by default
   - Service role key bypasses RLS (used by server)
   - Users can only access their own rooms

### 3. Electron App Setup

See `electron-app/README.md` for detailed instructions.

**Quick Start:**
```bash
cd electron-app
npm install
npm start
```

## Environment Variables

### Server (Railway)

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `PORT` | HTTP server port (auto-set by Railway) | No |
| `JWT_SECRET` | Secret for signing JWT tokens (auto-generated if not set) | No |

### Electron App

| Variable | Description | Required |
|----------|-------------|----------|
| `RAILWAY_WS_URL` | WebSocket URL of your Railway server | Yes |
| `RAILWAY_URL` | Alternative (will be converted to WebSocket) | Yes |

## API Endpoints

### Authentication
- `POST /auth/broadcaster` - Broadcaster login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/room/create` - Create a new room
- `POST /auth/room/join` - Join a room with code/password

### Room Management
- `GET /api/rooms/public` - List public rooms
- `GET /api/broadcaster/me` - Get current broadcaster info
- `GET /api/broadcaster/rooms` - List broadcaster's rooms
- `GET /api/broadcaster/devices` - List available audio devices
- `POST /api/broadcaster/assign-device` - Assign device to room
- `GET /api/broadcaster/rooms/:roomId/channels` - Get room channels
- `DELETE /api/broadcaster/rooms/:roomId` - Delete room

### Monitoring
- `GET /health` - Health check
- `GET /metrics` - Server metrics (Prometheus format)

## WebSocket Protocol

### Message Types

**From Broadcaster:**
- `registerSource` - Register as audio source for a room
- `audio` - Audio data packets

**From Listener:**
- `registerListener` - Register as listener for a room
- `ping` - Heartbeat

**From Server:**
- `sourceRegistered` - Confirmation of source registration
- `listenerRegistered` - Confirmation of listener registration
- `roomStatus` - Room status updates
- `audio` - Audio data packets (relayed to listeners)
- `pong` - Heartbeat response
- `roomClosed` - Room was closed
- `roomSuspended` - Room was suspended

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-role-key

# Start server
npm start
```

### Testing

```bash
# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics
```

## Project Structure

```
bridge-server/
├── server.js              # Main server file
├── package.json           # Server dependencies
├── utils/
│   ├── token.js          # JWT token utilities
│   └── password.js        # Password hashing utilities
├── middleware/
│   └── rate-limit.js      # Rate limiting middleware
├── electron-app/         # Electron desktop client
│   ├── main.js           # Main process
│   ├── renderer.js       # Renderer process
│   ├── preload.js        # IPC bridge
│   ├── services/
│   │   ├── auth-client.js    # Authentication client
│   │   └── audio-listener.js # Audio playback
│   └── utils/
│       ├── audio-buffer.js   # Jitter buffer
│       └── reconnection.js    # Reconnection logic
├── supabase-migration.sql    # Database schema
└── README.md              # This file
```

## Troubleshooting

### Server Issues

- **"Supabase connection failed"**: Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- **"Port already in use"**: Change `PORT` environment variable
- **"Database error"**: Ensure Supabase tables are created (run migration SQL)

### Electron App Issues

- **"Cannot connect"**: Verify `RAILWAY_WS_URL` is correct and uses `wss://` for HTTPS
- **"Authentication failed"**: Check Supabase credentials and user account
- **"No audio devices"**: Grant microphone permissions in system settings

## License

See LICENSE file for details.

## Support

For issues or questions, please open an issue on GitHub.
