# Dante Bridge Server

Bridge server for Dante Personal Monitor Mixer. Receives Dante audio channels and streams to web clients via WebSocket.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your Supabase credentials:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CHANNEL_COUNT=16
```

4. Start server:
```bash
npm start
```

The server will run on `http://localhost:3000` with WebSocket at `ws://localhost:3000`.

## Railway Deployment

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
   - `DANTE_DEVICE_ID` only needed if you have local audio hardware

4. **Build Configuration:**
   - Railway uses RAILPACK builder (configured in `railway.json`)
   - Auto-detects Node.js and installs dependencies
   - Start command comes from `package.json` scripts
   - If build fails, verify Root Directory is set to `bridge-server`

5. **Deploy:**
   - Railway will automatically build and deploy
   - Get your deployment URL (e.g., `https://your-app.railway.app`)

6. **Update Frontend:**
   - In Vercel, add environment variable:
   ```
   VUE_APP_BRIDGE_WS_URL=wss://your-app.railway.app
   ```
   - Note: Use `wss://` (secure WebSocket) for Railway HTTPS URLs

## Important Notes

- **Audio Hardware:** Dante Virtual Soundcard requires local machine access. For cloud deployment, you'll need to stream audio from a local machine to the cloud server, or use a VPS with audio hardware.

- **WebSocket URL:** Railway provides HTTPS, so use `wss://` (secure WebSocket) in production.

- **Health Check:** The server exposes `/health` endpoint for monitoring.

## Troubleshooting

- **Connection Issues:** Check that Railway deployment is running and WebSocket URL uses `wss://`
- **Audio Not Working:** Verify Dante Virtual Soundcard is installed and configured locally
- **CORS Errors:** Ensure frontend URL is in allowed origins (Vercel URLs are auto-allowed)

