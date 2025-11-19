# Release Notes - Dante Audio Client v1.1.2

## Release Date
November 18, 2024

## 🎯 Admin Panel Integration

### New Features
- **Built-in Admin Panel**: Complete device and room management interface within the Electron app
- **Device Assignment**: Assign audio devices to rooms with channel-level control (1-32 channels)
- **Room Management**: Create, view, and delete rooms from a dedicated admin interface
- **Channel Management**: Visual grid showing which channels are active and which device they're assigned to
- **Real Device Detection**: Uses actual audio devices from your system (naudiodon)

### Admin Panel Features
- **My Rooms Tab**: View all your rooms with stats (listeners, channels, status)
- **Audio Devices Tab**: See all available audio input devices from your system
- **Channel Management Tab**: Assign devices to rooms and manage individual channels
- **Auto-Authentication**: Uses your logged-in session (no separate login needed)
- **One-Click Access**: Open via "⚙️ Admin" button in status bar

### Technical Improvements
- Electron-only admin panel (no web access needed)
- Real-time device enumeration from naudiodon
- Device-to-room assignment with channel mapping
- Room structure now tracks `assignedDevices` and `assignedChannels`
- Backend API endpoints for device/room management

### Backend API Endpoints Added
- `GET /api/broadcaster/me` - Get current broadcaster info
- `GET /api/broadcaster/rooms` - List broadcaster's rooms
- `GET /api/broadcaster/devices` - List available audio devices
- `POST /api/broadcaster/assign-device` - Assign device to room with channels
- `GET /api/broadcaster/rooms/:roomId/channels` - Get channel assignments
- `DELETE /api/broadcaster/rooms/:roomId` - Delete room

### Bug Fixes
- Fixed admin panel authentication flow
- Improved device loading in admin panel
- Better error handling for Electron-only features

### How to Use
1. Launch the Electron app
2. Login as a broadcaster (if not already)
3. Click "⚙️ Admin" button in the status bar
4. Admin panel opens in a new window
5. Manage your rooms, devices, and channels!

---

## Installation

### Desktop App
Download the latest release for your platform:
- macOS: `Dante-Audio-Client-1.1.2-mac.dmg`
- Windows: `Dante-Audio-Client-Setup-1.1.2.exe`
- Linux: `Dante-Audio-Client-1.1.2-x86_64.AppImage`

### Server
No changes required - admin panel is client-side only.

---

## Upgrade Notes

This is a minor feature release. No breaking changes.

---

## Full Changelog

See `RELEASE_NOTES_v1.1.0.md` for complete feature list from v1.1.0.

---

**Version**: 1.1.2
**Previous Version**: 1.1.1

