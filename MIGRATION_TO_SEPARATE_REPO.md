# Migration Guide: Moving Electron App to Separate Repository

This guide explains how to move the electron app to a separate public GitHub repository.

## ✅ Pre-Migration Checklist

The electron app has been made **self-contained** and is ready to be moved:

- ✅ `opus-encoder.js` has been copied into the electron app directory
- ✅ `client-core.js` now references `opus-encoder.js` locally (not from parent directory)
- ✅ `package.json` includes `opus-encoder.js` in build files
- ✅ All dependencies are self-contained in `package.json`

## Steps to Move to Separate Repository

### 1. Create New GitHub Repository

1. Create a new **public** GitHub repository (e.g., `dante-audio-client` or `proapp-electron-client`)
2. Initialize it with a README (optional)

### 2. Copy Electron App Directory

1. Copy the entire `bridge-server/electron-app/` directory to your new repository
2. The directory should be the **root** of the new repository (not in a subdirectory)

### 3. Update Repository-Specific Files

1. **Update README.md**:
   - Remove any references to `bridge-server/electron-app` paths
   - Update installation instructions to reflect the new repository structure
   - Update any links to the main repository

2. **Create/Update .gitignore** (if needed):
   ```
   node_modules/
   dist/
   *.log
   .DS_Store
   ```

3. **Initialize Git** (if starting fresh):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Dante Audio Client Electron app"
   git remote add origin https://github.com/your-org/your-repo.git
   git push -u origin main
   ```

### 4. Update Main Repository

1. **Remove electron-app from main repo** (after confirming new repo works):
   ```bash
   # In main repository
   git rm -r bridge-server/electron-app
   git commit -m "Move electron app to separate repository"
   ```

2. **Update Vue app download URL**:
   - In `src/components/tools/DanteMonitorMixer.vue`
   - Update the default `electronAppDownloadUrl` to point to your new repository's releases
   - Or set environment variable: `VITE_ELECTRON_APP_DOWNLOAD_URL=https://github.com/your-org/your-repo/releases`

### 5. Set Up GitHub Releases

1. **Build installers** for each platform:
   ```bash
   npm run build:mac    # macOS
   npm run build:win    # Windows
   npm run build:linux  # Linux
   ```

2. **Create GitHub Release**:
   - Go to your repository → Releases → Draft a new release
   - Tag version (e.g., `v1.0.0`)
   - Upload the built installers from `dist/` directory:
     - `Dante Audio Client-1.0.0.dmg` (macOS)
     - `Dante Audio Client Setup 1.0.0.exe` (Windows)
     - `Dante Audio Client-1.0.0.AppImage` (Linux)

3. **Update Vue app** to point to releases:
   ```
   VITE_ELECTRON_APP_DOWNLOAD_URL=https://github.com/your-org/your-repo/releases
   ```

## Architecture Notes

### How It Works

The electron app is **completely independent** from the main repository:

- **Bridge Server**: Runs on Railway, acts as WebSocket relay
- **Electron App**: Desktop client that connects to bridge server via WebSocket
- **Vue App**: Web app that also connects to bridge server via WebSocket

**No code dependencies** - they only communicate via WebSocket protocol.

### Communication Flow

```
Electron App → WebSocket → Bridge Server (Railway) → WebSocket → Vue Apps
```

The bridge server doesn't need the electron app code - it just receives WebSocket connections from any client (electron app or Vue app).

## Verification

After moving to separate repository:

1. ✅ Clone the new repository
2. ✅ Run `npm install`
3. ✅ Run `npm start` to test the app
4. ✅ Build installers: `npm run build`
5. ✅ Verify installers work on target platforms
6. ✅ Update Vue app environment variable
7. ✅ Test download link in Vue app

## Benefits of Separation

- ✅ **Cleaner main repository** - Focus on web app and bridge server
- ✅ **Independent versioning** - Electron app can have its own release cycle
- ✅ **Public distribution** - Users can download without accessing main repo
- ✅ **Separate CI/CD** - Build and release electron app independently
- ✅ **Better organization** - Desktop app separate from web infrastructure

## Notes

- The bridge server (`bridge-server/server.js`) does **not** need to reference the electron app
- The electron app only needs the Railway WebSocket URL to connect
- The Vue app references the electron app only via download URL (environment variable)
- All three components are independent and communicate via WebSocket protocol

