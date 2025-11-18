# User Guide - Dante Audio Client v1.1.0

Welcome to the Dante Audio Client! This guide will help you get started with broadcasting and listening to multi-room audio.

---

## 📖 Table of Contents
1. [Quick Start](#quick-start)
2. [For Listeners](#for-listeners)
3. [For Broadcasters](#for-broadcasters)
4. [Understanding the Interface](#understanding-the-interface)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

---

## Quick Start

### What is Dante Audio Client?
A multi-room audio streaming application that allows you to:
- **Broadcast** live audio to multiple listeners
- **Listen** to live audio streams from anywhere
- **Create rooms** for isolated audio streams
- **Join rooms** with simple room codes

### Installation
1. Download the installer for your platform
2. Run the installer
3. Launch "Dante Audio Client"

---

## For Listeners 🎧

### Joining a Room (No Account Required!)

1. **Launch the App**
   - The app starts in "Listen Mode" by default
   - You'll see the "Listen Mode" button highlighted in blue

2. **Browse Available Rooms**
   - The room browser shows all active public rooms
   - Each room shows:
     - 🔴 **Live** = Broadcasting now
     - ⏸️ **Waiting** = Room created but no audio yet
     - Number of listeners currently in the room

3. **Join via Room Browser**
   - Click any room in the list
   - The room code auto-fills
   - Enter the room password (ask the broadcaster)
   - Click "Join Room"

4. **Join via Room Code**
   - Get the 6-character room code from the broadcaster (e.g., "ABC123")
   - Enter the code in the "Room Code" field
   - Enter the password
   - Click "Join Room"

5. **Listen to Audio**
   - Audio starts playing automatically
   - See the waveform visualizer showing audio activity
   - Monitor connection quality in the top-right

### Controls While Listening

#### Volume Control
- **Slider**: Drag to adjust volume (0-100%)
- **Mute Button** (🔊): Click to mute/unmute instantly
- When muted, the button changes to 🔇

#### Audio Visualizer
- Black box with blue waveform
- Shows real-time audio activity
- Flat line = no audio / silence
- Wiggly line = audio playing

#### Connection Quality Indicator
Located in top-right status bar:
- 🟢 **Excellent**: < 100ms latency, < 20ms jitter
- 🔵 **Good**: < 200ms latency, < 50ms jitter
- 🟡 **Fair**: < 400ms latency, < 100ms jitter
- 🔴 **Poor**: > 400ms latency or high packet loss

Stats shown: `(123ms, J:45ms, L:0.5%)`
- First number = Latency
- J = Jitter
- L = Packet Loss %

#### Leaving a Room
- Click "Leave Room" button
- Audio stops immediately
- Returns to room selection

---

## For Broadcasters 🎤

### Creating an Account

**Note**: Broadcasting requires a Supabase account. Contact your system administrator for credentials.

### Starting a Broadcast

1. **Switch to Broadcast Mode**
   - Click the "🎤 Broadcast Mode" button
   - Login section appears

2. **Login**
   - Enter your email
   - Enter your password
   - Click "Sign In"
   - Wait for authentication

3. **Create a Room**
   - Enter a **Room Password** (minimum 6 characters)
     - This is what listeners will use to join
     - Make it memorable!
   - Enter a **Room Name** (optional)
     - Helps listeners identify your stream
     - Example: "Stage 1", "Main Venue", "Podcast Studio"
   - Click "Create Room"
   - Your 6-character **Room Code** appears (e.g., "ABC123")
   - Share this code with your listeners!

4. **Select Audio Device**
   - The app lists all available audio input devices
   - Look for:
     - Dante Virtual Soundcard
     - USB audio interface
     - Built-in microphone
   - Click on your device to select it
   - Selected device is highlighted in blue

5. **Configure Audio Settings**
   - **Railway WebSocket URL**: Server address (usually pre-filled)
   - **Channel Count**: Number of Dante channels (1-32)
   - **Audio Bitrate**: 
     - 32 kbps = Lower quality, less bandwidth
     - 64 kbps = Good quality (recommended)
     - 128 kbps = High quality, more bandwidth

6. **Start Broadcasting**
   - Click "Start Broadcasting"
   - Status changes to "Broadcasting"
   - You'll see listener count update as people join
   - Monitor the logs for activity

7. **During Broadcast**
   - **Listener Count**: Shows how many people are listening
   - **End Broadcast**: Closes the room and disconnects all listeners
   - **Stop Broadcasting**: Temporarily stops audio but keeps room open

### Room Management

#### Sharing Your Room
Give listeners:
1. **Room Code** (6 characters, e.g., "ABC123")
2. **Room Password** (the one you set)
3. **Server URL** (if using custom server)

Quick copy option:
- Click "📋 Copy Link" button
- Pastes room details to clipboard
- Share via email, chat, etc.

#### Managing Listeners
- See current listener count in real-time
- Future: Kick/ban functionality (coming in Phase 2)

#### Ending Your Broadcast
- **Stop Broadcasting**: Pauses audio, keeps room open
  - Listeners stay connected
  - Resume by clicking "Start Broadcasting" again
  
- **End Broadcast**: Closes room permanently
  - All listeners disconnected
  - Room code becomes invalid
  - Must create new room for next session

---

## Understanding the Interface

### Mode Toggle (Top)
```
[🎤 Broadcast Mode]  [🎧 Listen Mode]
```
- Blue button = Active mode
- Gray button = Inactive mode
- Click to switch between modes

### Status Bar
```
🔴 Not Connected          🟢 Connection Quality ●●●
```
- Left: Connection status
- Right: Network quality (only in Listen mode)

### Logs Section (Bottom)
- Shows all activity
- Color coded:
  - Green = Success
  - Red = Error
  - White = Info
- Auto-scrolls to latest
- Maximum 100 entries

---

## Troubleshooting

### I can't hear any audio (Listener)

1. **Check Volume**
   - Ensure volume slider not at 0%
   - Check mute button not active (should show 🔊)
   - Check your computer's system volume

2. **Check Connection**
   - Connection quality indicator showing "Poor"? Try:
     - Moving closer to WiFi router
     - Using wired ethernet
     - Closing other apps using network

3. **Check Room Status**
   - Is the broadcaster actually streaming?
   - Room status should show "Broadcasting"
   - If "Waiting", the broadcaster hasn't started audio yet

4. **Verify Permissions**
   - macOS: System Preferences → Security & Privacy → Microphone
   - Windows: Settings → Privacy → Microphone

### I can't join a room (Listener)

1. **Wrong Password**
   - Double-check password with broadcaster
   - Passwords are case-sensitive

2. **Invalid Room Code**
   - Code must be exactly 6 characters
   - Only letters A-Z and numbers 0-9
   - No spaces or special characters

3. **Room Expired**
   - Room may have closed
   - Check "Refresh Rooms" to see active rooms
   - Ask broadcaster to create new room

### My broadcast keeps disconnecting (Broadcaster)

1. **Network Issues**
   - Check internet connection stable
   - Use wired connection if possible
   - Check firewall not blocking app

2. **Device Issues**
   - Verify audio device still connected
   - Check device not being used by another app
   - Try selecting device again

3. **Server Issues**
   - Check Railway server is running
   - Verify WebSocket URL correct
   - Check server logs for errors

### Audio quality is poor

1. **Lower Bitrate**
   - Try 32 kbps instead of 128 kbps
   - Less quality but more stable

2. **Check Network**
   - Connection quality indicator shows current status
   - Red/Yellow = poor network
   - Try:
     - Closing other apps
     - Stopping downloads/uploads
     - Moving closer to router

3. **Reduce Listeners**
   - More listeners = more server load
   - Consider splitting into multiple rooms

### The visualizer isn't moving

1. **No Audio**
   - Broadcaster might not be sending audio yet
   - Check room status

2. **Muted**
   - Visualizer shows audio even if muted
   - If flat line, no audio is being received

3. **Connection Lost**
   - Check connection status
   - Try rejoining the room

---

## FAQ

### Do I need an account to listen?
**No!** Listeners can join anonymously with just a room code and password.

### Do I need an account to broadcast?
**Yes.** Broadcasting requires authentication. Contact your administrator for credentials.

### How many people can listen to one room?
Theoretically unlimited, but server capacity may vary. Typical limit: 50-100 concurrent listeners per room.

### Can I have multiple rooms at once?
**Yes!** Each broadcaster can create their own room. Multiple rooms can run simultaneously.

### How long do rooms stay active?
Rooms stay active as long as the broadcaster is connected. If the broadcaster disconnects, there's a 5-minute grace period for reconnection.

### Can I record my broadcasts?
Not yet! Recording functionality is planned for Phase 2.

### What audio formats are supported?
The app uses Opus codec for streaming (64 kbps default). Supports sample rates up to 48 kHz.

### How much bandwidth does it use?
- **32 kbps**: ~4 KB/s or ~14 MB/hour
- **64 kbps**: ~8 KB/s or ~28 MB/hour
- **128 kbps**: ~16 KB/s or ~56 MB/hour

### Can I use this on mobile?
Not yet! A mobile app is planned for Phase 2. Currently desktop only (Mac, Windows, Linux).

### Is the audio encrypted?
Yes, all connections use WSS (WebSocket Secure) with TLS encryption.

### Can I change my room password after creating it?
Not currently. You'll need to end the broadcast and create a new room with a new password.

### What's the difference between "Stop Broadcasting" and "End Broadcast"?
- **Stop Broadcasting**: Pauses audio but keeps room open
- **End Broadcast**: Closes room completely and disconnects all listeners

### My room disappeared from the browser!
Room browser only shows "public" rooms. Your room might be:
- Already full
- Set to private (future feature)
- Closed by the broadcaster

### Can I broadcast to multiple rooms at once?
Not from one instance. You'd need to run multiple copies of the app (not recommended).

### The app crashed! What should I do?
1. Restart the app
2. Check logs (Help → View Logs)
3. Report the issue with log file attached

---

## Keyboard Shortcuts

Coming in future update!

---

## Tips & Best Practices

### For Broadcasters
1. ✅ **Test before going live**: Join your own room with another device
2. ✅ **Use wired audio**: Bluetooth/WiFi can add latency
3. ✅ **Monitor listener count**: Know your audience size
4. ✅ **Use strong passwords**: Prevent unauthorized access
5. ✅ **Name your rooms clearly**: Helps listeners find you

### For Listeners
1. ✅ **Use headphones**: Prevents feedback if broadcaster can hear you
2. ✅ **Check quality indicator**: Switch to wired if showing "Poor"
3. ✅ **Bookmark room codes**: For your favorite streams
4. ✅ **Report issues early**: Help broadcasters fix problems
5. ✅ **Be patient during buffering**: Network needs time to stabilize

---

## Support & Community

### Getting Help
- 📧 Email: support@yourdomain.com
- 🐛 Report bugs: https://github.com/soundrolling/electrondante/issues
- 💬 Discord: [Coming soon]

### Stay Updated
- Follow releases: https://github.com/soundrolling/electrondante/releases
- Changelog: Check release notes for new features

---

## About

**Version**: 1.1.0
**Release Date**: November 18, 2024
**Developer**: Sound Rolling
**License**: [Your License]

Built with: Electron, Node.js, Supabase, Railway, Opus

---

Enjoy streaming! 🎵

