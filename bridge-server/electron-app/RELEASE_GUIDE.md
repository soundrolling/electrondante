# Release Guide for Dante Audio Client

This guide explains how to create releases for the Dante Audio Client Electron app.

## Quick Start (Automated - Recommended)

The easiest way to create a release is using GitHub Actions:

1. **Create and push a version tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Actions automatically:**
   - Builds installers for macOS, Windows, and Linux
   - Creates a GitHub release
   - Uploads all installers to the release

3. **Check progress:**
   - View workflow: https://github.com/soundrolling/electrondante/actions
   - View releases: https://github.com/soundrolling/electrondante/releases

## What Gets Built

When you push a version tag (e.g., `v1.0.0`), the GitHub Actions workflow will:

- **Build on macOS runner:** Creates a `.dmg` file for macOS (supports both Intel and Apple Silicon)
- **Build on Windows runner:** Creates a `.exe` installer for Windows
- **Build on Linux runner:** Creates an `.AppImage` file for Linux

All installers are automatically uploaded to the GitHub release.

## Version Numbering

- Use semantic versioning: `v1.0.0`, `v1.0.1`, `v1.1.0`, etc.
- The version in `package.json` should match the tag (without the `v` prefix)
- Update `package.json` version before creating the tag

## Manual Release Process

If you need to build locally (for testing or if GitHub Actions fails):

1. See `BUILD_AND_UPLOAD_RELEASE.md` for detailed instructions
2. Build installers manually
3. Upload to GitHub release using web interface or GitHub CLI

## Troubleshooting

### Local Build Issues

If local builds fail due to Xcode/compiler issues:
- This is normal - use GitHub Actions instead
- GitHub Actions runs on clean environments with proper tooling
- Local builds are only needed for testing

### GitHub Actions Failures

1. Check the workflow logs: https://github.com/soundrolling/electrondante/actions
2. Common issues:
   - Missing dependencies (should be handled automatically)
   - Network issues (retry the workflow)
   - Code signing issues (macOS builds may need certificates for distribution)

### Missing Icons

The build process expects icon files:
- `build/icon.icns` for macOS
- `build/icon.ico` for Windows  
- `build/icon.png` for Linux

If icons are missing, electron-builder will use defaults. For production releases, add proper icons.

## Next Steps After Release

Once the release is created and installers are uploaded:

1. Test the installers on each platform
2. Update any download links in your Vue app to point to the new release
3. Announce the release to users

## Workflow File

The automated build workflow is located at:
`.github/workflows/build-and-release.yml`

You can modify this file to change build settings, add code signing, or customize the release process.

