# Release Notes - Dante Audio Client v1.2.1

## Release Date
November 18, 2024

## 🐛 Critical Bug Fix

### Fixed V8 JavaScript Out of Memory (OOM) Error
- **Issue**: App was crashing on startup with "V8 javascript OOM" error
- **Root Cause**: Default V8 memory limit (512MB) was insufficient for app initialization
- **Solution**: Increased V8 memory limit to 4GB via `--max-old-space-size` flag
  - Set in `main.js` before Electron loads (critical timing)
  - Also added to `package.json` start script as backup
  - Prevents OOM during initialization and heavy operations

### Additional Improvements
- Added initialization retry limit to prevent infinite loops
- Added JitterBuffer availability check with helpful error message
- Improved error handling and diagnostics
- Optimized webPreferences for better memory usage

### Technical Details
- Memory limit now set via `process.argv` before Electron initialization
- Removed duplicate/conflicting memory settings
- Added safety checks for script loading order

---

## Installation

### Desktop App
Download the latest release for your platform:
- macOS: `Dante-Audio-Client-1.2.1-mac.dmg`
- Windows: `Dante-Audio-Client-Setup-1.2.1.exe`
- Linux: `Dante-Audio-Client-1.2.1-x86_64.AppImage`

### Server
No changes required - fixes are client-side only.

---

## Upgrade Notes

**This is a critical bug fix release. All users experiencing startup crashes should upgrade immediately.**

If you experienced:
- "V8 javascript OOM" error on startup
- App crashing immediately after launch
- Memory-related errors

These issues are now resolved.

---

## Full Changelog

### v1.2.1 (Current)
- Fixed V8 OOM error on startup
- Increased memory limit to 4GB
- Added initialization retry limits
- Improved error diagnostics

### v1.2.0
- Fixed blank page crash
- Fixed all button functionality
- Moved Opus decoding to main process
- Added CI/CD pipeline

### v1.1.3
- Fixed app freezing on startup
- Fixed button click handlers
- Enabled dev tools by default

---

**Version**: 1.2.1
**Previous Version**: 1.2.0

