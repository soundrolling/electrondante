# Building and Uploading Release Installers

## Automated Builds with GitHub Actions (Recommended)

The easiest way to build and release installers is using the automated GitHub Actions workflow. This will automatically build installers for macOS, Windows, and Linux when you create a release tag.

### How to Use Automated Builds

1. **Create and push a version tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Actions will automatically:**
   - Build installers for macOS, Windows, and Linux
   - Create a GitHub release
   - Upload all installers to the release

3. **Check the workflow:**
   - Go to: https://github.com/soundrolling/electrondante/actions
   - You'll see the "Build and Release" workflow running
   - Once complete, the release will be available at: https://github.com/soundrolling/electrondante/releases

### Manual Workflow Trigger

You can also manually trigger the workflow:
1. Go to: https://github.com/soundrolling/electrondante/actions
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Choose the branch and click "Run workflow"

**Note:** Manual runs will build the installers but won't create a release unless you push a tag.

---

## Manual Build Process

If you prefer to build locally or need to test builds:

## Step 1: Build the Installers

### On macOS (Current Platform)

1. **Navigate to the project directory:**
   ```bash
   cd electrondante
   ```

2. **Install dependencies (if not already done):**
   ```bash
   npm install
   ```

3. **Rebuild native modules for Electron:**
   ```bash
   npm run rebuild
   ```

4. **Build the macOS installer:**
   ```bash
   npm run build:mac
   ```

   This will create a `.dmg` file in the `dist/` directory.

### For Other Platforms

**Windows:** You need a Windows machine or CI/CD:
```bash
npm run build:win
```

**Linux:** You need a Linux machine or CI/CD:
```bash
npm run build:linux
```

**All platforms at once:**
```bash
npm run build
```

## Step 2: Find the Built Installers

After building, the installers will be in the `dist/` directory:

- **macOS:** `dist/Dante Audio Client-1.0.0.dmg` (or similar name)
- **Windows:** `dist/Dante Audio Client Setup 1.0.0.exe` (or similar name)
- **Linux:** `dist/Dante Audio Client-1.0.0.AppImage` (or similar name)

## Step 3: Upload to GitHub Release

### Option A: Using GitHub Web Interface (Easiest)

1. **Go to your release page:**
   - Visit: https://github.com/soundrolling/electrondante/releases
   - Click on your release (e.g., "v1.0.0")

2. **Edit the release:**
   - Click the "Edit" button (pencil icon) next to your release

3. **Upload assets:**
   - Scroll down to the "Attach binaries" section
   - Click "Choose files" or drag and drop your installer files
   - Select the files from your `dist/` directory:
     - `Dante Audio Client-1.0.0.dmg` (macOS)
     - `Dante Audio Client Setup 1.0.0.exe` (Windows - if you have it)
     - `Dante Audio Client-1.0.0.AppImage` (Linux - if you have it)

4. **Save:**
   - Click "Update release" at the bottom

### Option B: Using GitHub CLI (gh)

If you have GitHub CLI installed:

```bash
# Navigate to dist directory
cd dist

# Upload files to release
gh release upload v1.0.0 "Dante Audio Client-1.0.0.dmg" \
  --repo soundrolling/electrondante
```

### Option C: Using Git (Manual)

You can also manually attach files by:
1. Going to the release page
2. Clicking "Edit release"
3. Dragging files into the "Attach binaries" area

## Notes

- **macOS builds:** You can build macOS installers on macOS
- **Windows builds:** You need a Windows machine or use GitHub Actions CI/CD
- **Linux builds:** You need a Linux machine or use GitHub Actions CI/CD

## Quick Build Script

You can also use the provided build script:

```bash
./build.sh
```

This will automatically:
- Check prerequisites
- Install dependencies if needed
- Rebuild native modules
- Build the installer for your platform

## After Uploading

Once the installers are uploaded to the release, users clicking "Download from GitHub Releases" in the Vue app will see the installers and can download the appropriate one for their platform.


