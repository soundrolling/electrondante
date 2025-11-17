# macOS Code Signing and Notarization Guide

This document captures the complete, working configuration for code signing and notarizing the Dante Audio Client Electron app for macOS distribution.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Requirements](#configuration-requirements)
3. [Package.json Configuration](#packagejson-configuration)
4. [Entitlements File](#entitlements-file)
5. [Notarization Script](#notarization-script)
6. [GitHub Actions Workflow](#github-actions-workflow)
7. [Required Secrets](#required-secrets)
8. [Common Issues and Solutions](#common-issues-and-solutions)
9. [Testing the Build](#testing-the-build)

## Overview

The app must be:
1. **Code Signed** with a Developer ID Application certificate
2. **Notarized** by Apple to avoid Gatekeeper warnings
3. **Packaged** as DMG files for both x64 and arm64 architectures

This process is automated via GitHub Actions using electron-builder.

## Configuration Requirements

### Key Principles Learned

1. **DO NOT set `identity: null`** - This explicitly disables code signing
2. **DO NOT set `CSC_IDENTITY_AUTO_DISCOVERY: false`** - This prevents electron-builder from finding the certificate
3. **DO use `$(TeamIdentifierPrefix)` in entitlements** - This allows @electron/osx-sign to extract the team ID
4. **DO use `type: "distribution"`** - This specifies Developer ID Application (not Mac App Store)
5. **DO use `CSC_LINK` and `CSC_KEY_PASSWORD`** - Standard way to provide certificate in CI

## Package.json Configuration

### Build Configuration

```json
{
  "build": {
    "appId": "com.soundrolling.dante-audio-client",
    "productName": "Dante Audio Client",
    "afterSign": "notarize.js",
    "mac": {
      "category": "public.app-category.utilities",
      "type": "distribution",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "notarize": {
        "teamId": "${APPLE_TEAM_ID}"
      }
    }
  }
}
```

### Critical Configuration Points

- **`type: "distribution"`**: Specifies Developer ID Application certificate (required for distribution outside Mac App Store)
- **`hardenedRuntime: true`**: Required for notarization
- **`gatekeeperAssess: false`**: Prevents Gatekeeper assessment during build (not needed before notarization)
- **`afterSign: "notarize.js"`**: Custom hook to run notarization after signing
- **`notarize.teamId`**: Uses environment variable for team ID
- **NO `identity` field**: Let electron-builder auto-discover from CSC_LINK/CSC_KEY_PASSWORD
- **NO `osxSign` field**: This is not a valid electron-builder configuration option

### Dependencies

```json
{
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-rebuild": "^3.2.9",
    "@electron/notarize": "^2.3.0"
  }
}
```

## Entitlements File

**File**: `build/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Application identifier with team prefix - CRITICAL for team ID resolution -->
  <key>com.apple.application-identifier</key>
  <string>$(TeamIdentifierPrefix)com.soundrolling.dante-audio-client</string>
  
  <!-- Must be YES for microphone permission to work -->
  <key>com.apple.security.app-sandbox</key>
  <true/>
  
  <!-- Absolutely required for mic access -->
  <key>com.apple.security.device.audio-input</key>
  <true/>
  
  <!-- Optional but recommended -->
  <key>com.apple.security.network.client</key>
  <true/>
  
  <!-- Existing entitlements for native modules -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.security.device.microphone</key>
  <true/>
</dict>
</plist>
```

### Critical Entitlement

**`com.apple.application-identifier`** with `$(TeamIdentifierPrefix)`:
- This is **REQUIRED** for @electron/osx-sign to extract the team ID from the certificate
- The `$(TeamIdentifierPrefix)` variable is automatically replaced with your team ID during signing
- Without this, you'll get: "Could not automatically determine ElectronTeamID from identity"

## Notarization Script

**File**: `notarize.js`

```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('Skipping notarization: missing APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID');
    return;
  }

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
```

This script:
- Runs after code signing completes
- Uses environment variables for credentials
- Gracefully skips if credentials are missing
- Provides clear error messages

## GitHub Actions Workflow

### Certificate Import Step

```yaml
- name: Import code signing certificate
  env:
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    if [ -n "$CSC_LINK" ] && [ -n "$CSC_KEY_PASSWORD" ]; then
      echo "Importing code signing certificate..."
      # Create keychain
      security create-keychain -p "" build.keychain || true
      security default-keychain -s build.keychain
      security unlock-keychain -p "" build.keychain
      security set-keychain-settings -t 3600 -u build.keychain
      
      # Import certificate
      echo "$CSC_LINK" | base64 --decode > certificate.p12
      security import certificate.p12 -k build.keychain -P "$CSC_KEY_PASSWORD" -T /usr/bin/codesign -T /usr/bin/productsign || true
      security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "" build.keychain
      
      # Also import to login keychain for electron-builder to find it
      security import certificate.p12 -k ~/Library/Keychains/login.keychain-db -P "$CSC_KEY_PASSWORD" -T /usr/bin/codesign -T /usr/bin/productsign || true
      
      # List identities
      echo "=== Available signing identities ==="
      security find-identity -v -p codesigning build.keychain || security find-identity -v build.keychain
      
      echo "Certificate import completed"
      echo "APPLE_TEAM_ID=$APPLE_TEAM_ID" >> $GITHUB_ENV
    fi
```

### Build Step

```yaml
- name: Build installer (macOS)
  working-directory: ${{ env.ELECTRON_APP_DIR }}
  env:
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    ELECTRON_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    # Ensure keychain is accessible and in search list
    if [ -f "$HOME/Library/Keychains/build.keychain-db" ]; then
      security unlock-keychain -p "" "$HOME/Library/Keychains/build.keychain-db" || true
      security list-keychains -s "$HOME/Library/Keychains/build.keychain-db" "$HOME/Library/Keychains/login.keychain-db" || true
    fi
    
    # Verify environment
    echo "Building with signing and notarization..."
    echo "APPLE_ID: ${APPLE_ID:0:5}***"
    echo "APPLE_TEAM_ID: $APPLE_TEAM_ID"
    
    # Verify certificates in keychain
    echo "=== Certificates available for signing ==="
    security find-identity -v -p codesigning || echo "No codesigning identities found"
    
    # Run build
    npm run build:mac
```

### Critical Workflow Points

- **DO set `ELECTRON_TEAM_ID`** - Required by @electron/osx-sign to extract team ID before processing entitlements
- **DO NOT set `CSC_IDENTITY_AUTO_DISCOVERY: false`** - Let electron-builder auto-discover
- **DO NOT set `CSC_NAME`** - electron-builder will find the certificate automatically
- **DO import to both build.keychain AND login.keychain** - Ensures electron-builder can find it
- **DO set keychain search list** - Makes certificates accessible

## Required Secrets

See `GITHUB_SECRETS.md` for detailed instructions on setting up secrets.

Required secrets:
- `CSC_LINK` - Base64-encoded .p12 certificate
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_ID` - Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password from appleid.apple.com
- `APPLE_TEAM_ID` - 10-character team ID (e.g., "E2BVJ4CM5V")

## Common Issues and Solutions

### Issue: "Could not automatically determine ElectronTeamID from identity"

**Cause**: @electron/osx-sign cannot extract team ID from certificate SHA alone. It needs either:
1. `ELECTRON_TEAM_ID` environment variable, OR
2. `com.apple.application-identifier` with `$(TeamIdentifierPrefix)` in entitlements

**Solution**: Set BOTH for maximum compatibility:
1. Add `ELECTRON_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}` to workflow environment
2. Add to entitlements.mac.plist:
```xml
<key>com.apple.application-identifier</key>
<string>$(TeamIdentifierPrefix)com.soundrolling.dante-audio-client</string>
```

### Issue: "skipped macOS code signing reason=identity explicitly is set to null"

**Cause**: `identity: null` in package.json mac config

**Solution**: Remove the `identity` field entirely - let electron-builder auto-discover

### Issue: "skipped macOS code signing reason=CSC_IDENTITY_AUTO_DISCOVERY=false"

**Cause**: `CSC_IDENTITY_AUTO_DISCOVERY: false` in workflow environment

**Solution**: Remove this environment variable - use default auto-discovery

### Issue: "code object is not signed at all" during notarization

**Cause**: App wasn't signed before notarization hook runs

**Solution**: Ensure signing happens first by:
- Not setting `identity: null`
- Not setting `CSC_IDENTITY_AUTO_DISCOVERY: false`
- Providing `CSC_LINK` and `CSC_KEY_PASSWORD`

### Issue: "Invalid configuration object... unknown property 'osxSign'"

**Cause**: `osxSign` is not a valid electron-builder configuration option

**Solution**: Remove `osxSign` from package.json - all signing config goes in `mac` section

### Issue: Certificate not found

**Cause**: Certificate not in keychain search list

**Solution**: 
- Import to both build.keychain and login.keychain
- Set keychain search list: `security list-keychains -s build.keychain login.keychain`
- Unlock keychain before build

## Testing the Build

### Local Testing (without notarization)

1. Set environment variables:
   ```bash
   export CSC_LINK="<base64-encoded-p12>"
   export CSC_KEY_PASSWORD="<password>"
   ```

2. Build:
   ```bash
   npm run build:mac
   ```

3. Verify signing:
   ```bash
   codesign -dv --verbose=4 "dist/mac/Dante Audio Client.app"
   ```

### CI/CD Testing

1. Push a tag: `git tag v1.0.X && git push origin v1.0.X`
2. Monitor workflow at: https://github.com/soundrolling/electrondante/actions
3. Check for:
   - ✅ "signing file=dist/mac/Dante Audio Client.app"
   - ✅ "Notarizing..."
   - ✅ "Notarization complete!"
   - ✅ DMG files created

### Verifying Notarization

After download, check notarization status:
```bash
spctl -a -vv "Dante Audio Client.app"
```

Should show: "source=Notarized Developer ID"

## Summary of Working Configuration

✅ **DO:**
- Use `type: "distribution"` in mac config
- Set `ELECTRON_TEAM_ID` environment variable (CRITICAL)
- Include `$(TeamIdentifierPrefix)` in entitlements
- Use `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables
- Let electron-builder auto-discover identity
- Import certificate to both keychains
- Use `afterSign: "notarize.js"` hook

❌ **DON'T:**
- Set `identity: null`
- Set `CSC_IDENTITY_AUTO_DISCOVERY: false`
- Use `osxSign` configuration (not valid)
- Skip the `com.apple.application-identifier` entitlement
- Forget to unlock keychains before build

## Additional Resources

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [electron-builder Mac Configuration](https://www.electron.build/configuration/mac)
- [@electron/notarize Documentation](https://github.com/electron/notarize)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

