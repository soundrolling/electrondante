# Release Notes - Dante Audio Client v1.1.0

## 🎉 Major Release: Multi-Room Audio System

### Release Date
November 18, 2024

### Overview
This is a major feature release that transforms the Dante Audio Client from a single-stream system into a full multi-room audio platform with broadcast and listen capabilities.

---

## 🚀 New Features

### Multi-Room System
- **Create Rooms**: Broadcasters can create password-protected audio rooms
- **Join Rooms**: Listeners can browse and join rooms with just a room code
- **Room Discovery**: Public room browser shows all active rooms
- **Room Management**: Real-time listener count and status tracking

### Dual Mode Interface
- **Broadcast Mode**: Login-protected room creation and audio streaming
- **Listen Mode**: Anonymous room joining with code + password (default mode)
- Easy toggle between modes with mode persistence

### Audio Enhancements
- **Opus Codec**: High-quality, low-bandwidth audio (32/64/128 kbps options)
- **Adaptive Jitter Buffer**: Automatically adjusts to network conditions
- **Precise Scheduling**: Gapless audio playback with hardware-level timing
- **Clock Drift Correction**: Maintains perfect sync over long sessions
- **Real-time Visualizer**: Waveform display for audio monitoring

### User Experience
- **Connection Quality Indicators**: Live network quality monitoring (Excellent/Good/Fair/Poor)
- **Toast Notifications**: Modern, non-intrusive notifications
- **Audio Visualizer**: Real-time waveform canvas
- **Mute Button**: Quick audio mute/unmute
- **Copy Invite Link**: Easy room sharing
- **Room Browser**: Click to auto-fill room codes

### Backend Infrastructure
- **Supabase Integration**: Persistent room and user data
- **JWT Authentication**: Secure token-based auth for broadcasters
- **Rate Limiting**: Protection against abuse
- **Room Persistence**: Rooms survive broadcaster reconnections (5min grace period)
- **Database Schema**: Complete with RLS policies and audit logging

---

## 🔧 Technical Improvements

### Audio Pipeline
- Opus encoding/decoding with opusscript
- Adaptive jitter buffer (5-100 packets, dynamic sizing)
- Packet loss detection and handling
- Network quality metrics (latency, jitter, loss rate)
- Playback rate adjustment for drift correction (0.99x - 1.01x)

### Architecture
- Room-based audio routing (isolated streams per room)
- Per-room jitter buffers and relay intervals
- WebSocket heartbeat for connection health
- Exponential backoff reconnection logic
- Client-side audio scheduling with Web Audio API

### Security
- Broadcaster authentication via Supabase
- Password hashing with bcrypt
- JWT tokens (access: 15min, refresh: 7day, room: 24hr)
- Row Level Security (RLS) policies
- Rate limiting on all endpoints

### Database
- `audio_rooms`: Room definitions and metadata
- `room_participants`: Listener tracking
- `room_analytics`: Usage metrics
- `audit_log`: Security audit trail
- Automated triggers for participant tracking

---

## 📋 Breaking Changes

### Configuration
- Requires new environment variables:
  ```
  JWT_SECRET=your-secret-key
  SUPABASE_URL=your-supabase-url
  SUPABASE_SERVICE_KEY=your-service-key
  ```

### API Changes
- **New Endpoints**:
  - `POST /auth/broadcaster` - Broadcaster login
  - `POST /auth/refresh` - Token refresh
  - `POST /auth/room/create` - Create room
  - `POST /auth/room/join` - Join room
  - `GET /api/rooms/public` - List public rooms
  - `GET /metrics` - Server metrics

- **WebSocket Changes**:
  - Rooms now require authentication tokens
  - Audio routing is room-scoped
  - New message types: `roomStatus`, `roomClosed`, `roomSuspended`

---

## 🐛 Bug Fixes
- Fixed audio timing issues with precise scheduling
- Resolved buffer underruns with adaptive sizing
- Fixed memory leaks in audio decoders
- Corrected WebSocket reconnection logic

---

## 📦 Installation & Upgrade

### Desktop App
1. Download the latest release for your platform:
   - macOS: `Dante-Audio-Client-1.1.0-mac.dmg`
   - Windows: `Dante-Audio-Client-Setup-1.1.0.exe`
   - Linux: `Dante-Audio-Client-1.1.0-x86_64.AppImage`

2. Install and run

### Server (Railway/Self-hosted)
1. Pull latest code: `git pull origin main`
2. Install dependencies: `npm install`
3. Set environment variables (see `SUPABASE_SETUP.md`)
4. Run database migration (see `supabase-migration.sql`)
5. Restart server: `npm start`

---

## 📚 Documentation

- **Database Setup**: `SUPABASE_SETUP.md`
- **Database Usage**: `DATABASE_USAGE.md`
- **Implementation Details**: `MULTI_ROOM_IMPLEMENTATION.md`

---

## 🧪 Testing Checklist

- [ ] Broadcaster login and room creation
- [ ] Listener room joining (with correct password)
- [ ] Listener room joining (with incorrect password - should fail)
- [ ] Audio playback smoothness (listen for 5+ minutes)
- [ ] Network quality indicators update correctly
- [ ] Room browser shows active rooms
- [ ] Multiple listeners in same room
- [ ] Multiple concurrent rooms
- [ ] Broadcaster disconnect/reconnect (5min grace period)
- [ ] Volume control and mute button
- [ ] Audio visualizer displays waveform
- [ ] Mode switching (Broadcast ↔ Listen)

---

## 🔜 Future Enhancements

### Phase 2 (Planned)
- [ ] Text chat in rooms
- [ ] Mobile app (React Native)
- [ ] Multi-channel selection for listeners
- [ ] Recording functionality
- [ ] Room scheduling
- [ ] Listener kick/ban
- [ ] Redis for horizontal scaling
- [ ] Webhooks for room events

---

## 👥 Credits
- Audio processing: naudiodon, opusscript
- Database: Supabase
- Hosting: Railway
- Framework: Electron

---

## 📝 License
Same as project license

---

## 🆘 Support
For issues, please visit: https://github.com/soundrolling/electrondante/issues

