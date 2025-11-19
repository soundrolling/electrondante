# Release Notes - v1.3.0

**Release Date:** November 19, 2025  
**Build:** v1.3.0  

## 🎉 Major Features

### ✨ Supabase Authentication Integration
- **Direct authentication** with pro.soundrolling.com using Supabase
- Seamless login experience for broadcasters
- Secure JWT token management with auto-refresh
- Server validates both Supabase and legacy tokens

### 🎚️ Multi-Channel Selection (Broadcaster)
- **Select specific Dante channels** to broadcast (1-32)
- Beautiful grid UI with visual feedback
- Quick selection presets: "All", "Deselect All", "First 8"
- Real-time channel count display
- Reduces bandwidth by only streaming selected channels

### 🎧 Multi-Channel Selection (Listener)
- **Choose which channels to hear** from the broadcast
- Mix multiple channels in real-time
- Quick presets: "All Channels", "Channel 1 Only"
- Auto-detects available channels from stream
- Dynamic channel grid updates when stream starts

### 📊 Buffer Latency Display
- Real-time latency monitoring (~425ms target for 400ms delay)
- Shows current buffer size vs target
- Visual feedback on jitter buffer status
- Helps diagnose playback issues

## 🐛 Bug Fixes

### Fixed: Buttons Not Responding
- **Developer Tools** now opens automatically on launch
- All buttons have comprehensive error handling
- Added extensive logging for debugging (`[Init]`, `[Event]`, `[Mode]` tags)
- Wrapped all event handlers in try-catch blocks

### Fixed: Unable to Debug
- DevTools opens automatically after window loads
- Added keyboard shortcuts: F12, Cmd+Option+I (Mac), Ctrl+Shift+I (Windows)
- Console logs now track every user action
- Error stack traces displayed in UI

## 🔧 Improvements

### Enhanced Error Handling
- Every button click is logged with `[Event]` tag
- Mode switches show `[Mode]` logs with state changes
- Authentication shows `[Auth]` logs with user email
- Channel operations show `[Channels]` logs

### Optimized Jitter Buffer
- Reconfigured for stable ~400ms delay
- Target: 5 packets (~425ms) instead of 20 packets
- Adaptive buffering based on network quality
- Reduced max buffer to prevent excessive latency

### Code Quality
- Added `.gitignore` for cleaner repository
- Removed OS-specific files (.DS_Store)
- Comprehensive implementation documentation
- Better separation of concerns

## 📋 Configuration Changes

### Environment Variables Required

**Electron App (Client):**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**Railway Server:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
CHANNEL_COUNT=32
```

### GitHub Actions Secrets
Set these in your repository for automated builds:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APPLE_ID` (for macOS signing)
- `APPLE_APP_PASSWORD`
- `APPLE_TEAM_ID`

## 🚀 Deployment Instructions

### 1. Deploy Railway Server
```bash
cd bridge-server
# Railway will auto-deploy from git push
# Or use: railway up
```

Ensure these are set in Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `CHANNEL_COUNT`

### 2. Build Electron App

**GitHub Actions (Recommended):**
```bash
git tag v1.3.0
git push origin v1.3.0
# GitHub Actions will build and create release
```

**Local Build:**
```bash
cd electron-app
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
npm ci
npm run rebuild
npm run build:mac  # or build:win, build:linux
```

## 🧪 Testing Checklist

- [ ] DevTools opens automatically
- [ ] Broadcaster login button works
- [ ] Can authenticate with pro.soundrolling.com
- [ ] Room creation shows 6-character code
- [ ] Channel selection UI displays (1-32)
- [ ] Selected channels are highlighted
- [ ] Broadcasting starts with selected channels
- [ ] Listener can join room with code + password
- [ ] Available channels populate in listener UI
- [ ] Can select/deselect listen channels
- [ ] Buffer latency displays (~425ms)
- [ ] Audio plays with ~400ms delay
- [ ] Volume control works
- [ ] Audio visualizer shows activity

## 📝 Known Issues

1. **Microphone Permission (macOS):** Requires explicit grant in System Preferences
2. **Native Modules:** May need rebuild after npm install (`npm run rebuild`)
3. **First Launch:** DevTools may take a moment to open
4. **Channel Detection:** Listener channels populate after first audio packet received

## 🔄 Migration from v1.2.2

### Breaking Changes
- **Authentication:** Now uses Supabase instead of custom tokens
- **Environment Variables:** Requires SUPABASE_URL and SUPABASE_ANON_KEY

### Backwards Compatibility
- Railway server still accepts legacy tokens during transition
- Old clients can connect but won't have channel selection features

## 📚 Documentation

See `IMPLEMENTATION_SUMMARY.md` for:
- Detailed architecture overview
- Complete testing instructions
- Debug tips and troubleshooting
- Environment setup guide

## 🙏 Credits

- **Supabase Integration:** Full JWT authentication flow
- **Multi-Channel Selection:** Grid UI with visual feedback
- **Jitter Buffer Optimization:** Precise 400ms delay targeting
- **Enhanced Debugging:** Comprehensive logging system

---

## Version Comparison

| Feature | v1.2.2 | v1.3.0 |
|---------|--------|--------|
| Authentication | Custom | Supabase ✨ |
| Broadcaster Channel Selection | All channels | Selective 1-32 ✨ |
| Listener Channel Selection | All channels | Selective mixing ✨ |
| DevTools Access | Manual | Automatic ✨ |
| Latency Display | None | Real-time ✨ |
| Error Logging | Basic | Comprehensive ✨ |
| Button Debugging | Difficult | Easy ✨ |

---

**Full Changelog:** https://github.com/soundrolling/electrondante/compare/v1.2.2...v1.3.0

**Download:** Will be available after GitHub Actions build completes

**Support:** Check DevTools console for detailed logs with `[Init]`, `[Event]`, `[Mode]`, `[Auth]`, and `[Channels]` tags

