# Release Notes - Dante Audio Client v1.2.0

## Release Date
November 18, 2024

## 🎯 Operational Release - Critical Fixes

This release fixes critical UI crashes and makes the app fully operational for production use.

### Critical Fixes

- **Fixed Blank Page Crash**: Resolved renderer process crash caused by using Node.js `require()` in browser context
  - Moved `JitterBuffer` to browser-compatible script loading
  - Moved Opus decoding to main process (where native modules work)
  - Renderer now receives pre-decoded PCM audio

- **Fixed Button Functionality**: All buttons now work correctly
  - Broadcaster Login button
  - Admin button
  - Join Room button
  - All other UI interactions

- **Fixed Audio Playback**: Audio decoding now happens in main process
  - Opus decoding moved from renderer to main process
  - Eliminates renderer crashes during audio playback
  - Better performance (decoding in Node.js vs browser)

### Technical Improvements

- **Architecture Changes**:
  - `JitterBuffer` now loaded as browser script (no `require` needed)
  - Opus decoding centralized in main process
  - Better separation of concerns (main = native modules, renderer = UI)

- **Error Handling**:
  - Improved error boundaries
  - Better crash recovery
  - More informative error messages

- **DevTools**:
  - Now only auto-opens in development mode
  - Keyboard shortcut (Ctrl+Shift+I) still works in production

### Documentation & Setup

- **New Documentation**:
  - `DB_AND_ENV_SETUP.md` - Complete setup instructions for Supabase and Railway
  - Clear step-by-step verification process

- **CI/CD**:
  - Added `.github/workflows/build.yml` for automated builds
  - Supports macOS, Windows, and Linux
  - Automatically rebuilds native modules (`naudiodon`)

### Files Changed

- `renderer.js`: Removed `require()` calls, fixed audio handling
- `main.js`: Added Opus decoding logic, improved error handling
- `utils/audio-buffer.js`: Made browser-compatible
- `index.html`: Added script tag for `JitterBuffer`
- `.github/workflows/build.yml`: New CI/CD pipeline
- `DB_AND_ENV_SETUP.md`: New setup documentation

---

## Installation

### Desktop App
Download the latest release for your platform:
- macOS: `Dante-Audio-Client-1.2.0-mac.dmg`
- Windows: `Dante-Audio-Client-Setup-1.2.0.exe`
- Linux: `Dante-Audio-Client-1.2.0-x86_64.AppImage`

### Server
No changes required - fixes are client-side only.

---

## Upgrade Notes

**This is a critical bug fix release. All users should upgrade immediately.**

If you experienced:
- Blank page when joining rooms
- Buttons not working
- App freezing or crashing

These issues are now resolved.

---

## Full Changelog

### v1.2.0 (Current)
- Fixed renderer process crash (blank page issue)
- Fixed all button functionality
- Moved Opus decoding to main process
- Made JitterBuffer browser-compatible
- Added CI/CD pipeline
- Added setup documentation
- Improved error handling

### v1.1.3
- Fixed app freezing on startup
- Fixed button click handlers
- Enabled dev tools by default
- Added comprehensive error handling

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

**Version**: 1.2.0
**Previous Version**: 1.1.3

