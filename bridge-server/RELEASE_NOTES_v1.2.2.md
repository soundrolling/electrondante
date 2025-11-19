# Release Notes - Dante Audio Client v1.2.2

## Release Date
November 19, 2024

## 🧹 Major Cleanup: Standalone Version

This release transforms the project into a **100% standalone version** with Supabase integration, removing all dependencies on the original proapp project.

### ✨ What's New

#### Standalone Architecture
- ✅ **Removed all hardcoded URLs** - Now uses environment variables or user input
- ✅ **Removed proapp2149 references** - Completely independent project
- ✅ **Clean dependency tree** - Removed unused dependencies from server
- ✅ **Updated documentation** - Comprehensive standalone setup guides

#### Files Cleaned Up
- Removed `client.js` (standalone Node.js client, not part of Electron app)
- Removed duplicate `public/admin.html` and `public/admin.js` (admin panel is in electron-app/)
- Removed old release notes (v1.1.0 - v1.2.0)
- Removed research/documentation files (BUFFERING, MULTI_ROOM, SONOBUS)

#### Code Improvements
- All Railway URLs now configurable via environment variables
- Empty string defaults (user must enter URL)
- Placeholder text in UI inputs
- Removed unused dependencies (`naudiodon`, `opusscript` from server)

### 📝 Documentation Updates

- **New standalone `README.md`** - Complete setup guide for server
- **Updated `electron-app/README.md`** - Standalone instructions
- **Updated `electron-app/DOWNLOAD.md`** - Correct repository URLs
- **Enhanced `supabase-migration.sql`** - Comprehensive header with usage instructions

### 🔧 Configuration Changes

**Server Environment Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=3000  # Auto-set by Railway
```

**Electron App:**
- Users must enter Railway WebSocket URL in UI (no defaults)
- Or set `RAILWAY_WS_URL` environment variable

### 🗑️ Files Removed from Repository

The following files have been deleted from GitHub:
- `client.js`
- `public/admin.html`
- `public/admin.js`
- `BUFFERING_AND_RAILWAY_OPTIMIZATIONS.md`
- `MULTI_ROOM_IMPLEMENTATION.md`
- `SONOBUS_RESEARCH.md`
- `RELEASE_NOTES_v1.1.0.md`
- `RELEASE_NOTES_v1.1.2.md`
- `RELEASE_NOTES_v1.1.3.md`
- `RELEASE_NOTES_v1.2.0.md`
- `RELEASE_v1.1.0.txt`
- `RELEASE_v1.1.2.txt`
- `RELEASE_v1.1.3.txt`
- `RELEASE_v1.2.0.txt`

### 📦 What's Included

**Server (`bridge-server/`):**
- Supabase authentication integration
- Multi-room audio streaming
- JWT token management
- Database persistence
- No hardcoded URLs or credentials

**Electron App (`electron-app/`):**
- Self-contained desktop client
- Broadcast and listen modes
- Admin panel integrated
- All dependencies included

### 🚀 Migration Guide

If upgrading from v1.2.1 or earlier:

1. **Update Environment Variables:**
   - Remove any hardcoded Railway URLs from your configuration
   - Ensure `RAILWAY_WS_URL` is set or users enter it in the UI

2. **Run Supabase Migration:**
   - Execute `supabase-migration.sql` in your Supabase SQL Editor (if not already done)

3. **Update Server:**
   - No code changes needed - just ensure environment variables are set correctly

4. **Update Electron App:**
   - Users will need to enter Railway URL (no longer has default)
   - All other functionality remains the same

### 🐛 Bug Fixes

- Fixed hardcoded URL references throughout codebase
- Removed unused dependencies to reduce bundle size
- Improved error messages for missing configuration

### 📚 Full Changelog

### v1.2.2 (Current)
- Major cleanup: Standalone version with Supabase integration
- Removed all hardcoded URLs
- Removed proapp2149 references
- Cleaned up unnecessary files
- Updated all documentation
- Enhanced supabase-migration.sql with usage instructions

### v1.2.1
- Fixed V8 OOM error on startup
- Increased memory limit to 4GB
- Added initialization retry limits

### v1.2.0
- Fixed blank page crash
- Fixed all button functionality
- Moved Opus decoding to main process
- Added CI/CD pipeline

---

**Version**: 1.2.2
**Previous Version**: 1.2.1

**Breaking Changes**: None - but users must now configure Railway URL (no default)

