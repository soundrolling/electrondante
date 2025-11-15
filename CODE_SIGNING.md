# Code Signing and Notarization Guide

To distribute your Electron app on macOS without Gatekeeper warnings and permission issues, you need to code sign and notarize it with Apple.

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/
   - You'll need an active membership

2. **Code Signing Certificate**
   - Log into https://developer.apple.com/account
   - Go to Certificates, Identifiers & Profiles
   - Create a "Developer ID Application" certificate
   - Download and install it in Keychain Access

3. **App-Specific Password** (for notarization)
   - Go to https://appleid.apple.com
   - Sign in → App-Specific Passwords
   - Generate a password for "Notarization"
   - Save this password securely

## Setup

### 1. Install Certificate

1. Download the certificate from Apple Developer portal
2. Double-click to install in Keychain Access
3. Verify it's installed: `security find-identity -v -p codesigning`

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository:
- Settings → Secrets and variables → Actions → New repository secret

**Required secrets:**
- `APPLE_ID`: Your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD`: The app-specific password you created
- `APPLE_TEAM_ID`: Your Apple Team ID (found in Apple Developer account)

**Optional (if using certificate file):**
- `CSC_LINK`: Base64 encoded certificate file (if not using keychain)
- `CSC_KEY_PASSWORD`: Certificate password

### 3. Update Build Configuration

The `package.json` already has the basic configuration. For code signing, you'll need to:

1. Update `package.json` to include signing configuration
2. The workflow will automatically use the secrets if they're set

## Manual Signing (Alternative)

If you prefer to sign manually after building:

```bash
# Sign the app
codesign --force --deep --sign "Developer ID Application: Your Name (TEAM_ID)" \
  "dist/mac/Dante Audio Client.app"

# Verify signature
codesign --verify --verbose "dist/mac/Dante Audio Client.app"

# Notarize
xcrun notarytool submit "dist/Dante Audio Client-1.0.0.dmg" \
  --apple-id "your@email.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "app-specific-password" \
  --wait
```

## Benefits of Code Signing

✅ No Gatekeeper warnings  
✅ Automatic microphone permission prompts  
✅ Users can install and run without workarounds  
✅ Better security and trust  
✅ Required for distribution outside Mac App Store

## Current Status

The app is currently built unsigned. To enable signing:

1. Get Apple Developer account
2. Add secrets to GitHub
3. Update workflow to use signing (or sign manually)

The workflow is ready to support signing once you add the secrets.

