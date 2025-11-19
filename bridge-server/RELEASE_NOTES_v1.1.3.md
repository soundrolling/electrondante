# Release Notes - Dante Audio Client v1.1.3

## Release Date
November 18, 2024

## 🐛 Bug Fixes & Stability Improvements

### Critical Fixes
- **Fixed App Freezing Issue**: Resolved JavaScript errors that were causing the app to freeze
- **Button Click Handlers**: Fixed "Broadcaster Login" and "Admin" buttons not responding
- **Mode Switching**: Fixed `switchMode` function to properly handle 'broadcast-login' mode
- **Missing Variables**: Added missing `broadcastRoomSection` and `broadcastAudioSection` variable declarations

### Developer Experience
- **Dev Tools Enabled by Default**: Developer tools now open automatically for easier debugging
- **Keyboard Shortcut**: Added `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to toggle dev tools
- **Global Error Handlers**: Added comprehensive error catching for unhandled errors and promise rejections
- **Better Error Logging**: Errors are now logged to both console and log file
- **Debug Logging**: Added console logs for button clicks and mode switching

### Technical Improvements
- **Error Handling**: Wrapped initialization in try-catch to prevent crashes
- **Render Process Monitoring**: Added handlers for render process crashes
- **Console Logging**: Improved console message forwarding from renderer to main process
- **Log File**: Errors are written to `dante-audio-client.log` in app data directory

### Files Changed
- `renderer.js`: Fixed button handlers, added error handling, improved mode switching
- `main.js`: Enabled dev tools, added error handlers, improved logging

---

## Installation

### Desktop App
Download the latest release for your platform:
- macOS: `Dante-Audio-Client-1.1.3-mac.dmg`
- Windows: `Dante-Audio-Client-Setup-1.1.3.exe`
- Linux: `Dante-Audio-Client-1.1.3-x86_64.AppImage`

### Server
No changes required - fixes are client-side only.

---

## Upgrade Notes

This is a bug fix release. No breaking changes.

**If you experienced freezing issues in v1.1.2, this release should resolve them.**

---

## Full Changelog

### v1.1.3 (Current)
- Fixed app freezing on startup
- Fixed button click handlers
- Enabled dev tools by default
- Added comprehensive error handling
- Improved debugging capabilities

### v1.1.2
- Built-in admin panel
- Device-to-room assignment
- Channel management

### v1.1.0
- Multi-room architecture
- Authentication system
- Room browser
- Audio visualizer
- And more...

---

**Version**: 1.1.3
**Previous Version**: 1.1.2

