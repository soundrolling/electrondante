# Required GitHub Secrets for macOS Build and Release

This document lists all GitHub repository secrets required for the automated build, code signing, notarization, and release process.

## Code Signing Secrets

### CSC_LINK
**Description**: Base64-encoded .p12 certificate file containing the Developer ID Application certificate.

**How to obtain**:
1. Export your Developer ID Application certificate from Keychain Access
2. Export as `.p12` format with a password
3. Convert to base64: `base64 -i certificate.p12 -o certificate.txt`
4. Copy the contents of `certificate.txt` to this secret

**Required**: Yes

### CSC_KEY_PASSWORD
**Description**: Password for the .p12 certificate file.

**How to obtain**: This is the password you set when exporting the certificate from Keychain Access.

**Required**: Yes

## Apple Notarization Secrets

### APPLE_ID
**Description**: Your Apple Developer account email address.

**How to obtain**: This is the email address associated with your Apple Developer account.

**Required**: Yes (for notarization)

### APPLE_APP_SPECIFIC_PASSWORD
**Description**: App-specific password generated for notarization.

**How to obtain**:
1. Go to https://appleid.apple.com/
2. Sign in with your Apple ID
3. In the Security section, generate an app-specific password
4. Label it something like "Electron App Notarization"
5. Copy the generated password

**Required**: Yes (for notarization)

### APPLE_TEAM_ID
**Description**: Your 10-character Apple Developer Team ID.

**How to obtain**:
1. Go to https://developer.apple.com/account
2. Sign in with your Apple Developer account
3. Your Team ID is displayed in the top right (e.g., "E2BVJ4CM5V")
4. Alternatively, you can find it in your certificate: Open Keychain Access, find your Developer ID Application certificate, and the Team ID is shown in parentheses in the certificate name (e.g., "Developer ID Application: Your Name (E2BVJ4CM5V)")

**Required**: Yes (for notarization and signing)

## GitHub Token

### GITHUB_TOKEN
**Description**: GitHub Actions automatically provides this token for authentication.

**How to obtain**: Automatically provided by GitHub Actions - no manual configuration needed.

**Required**: Yes (automatically available)

## Setting Secrets in GitHub

1. Go to your repository on GitHub
2. Click "Settings"
3. In the left sidebar, click "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Enter the secret name and value
6. Click "Add secret"

## Verification

You can verify secrets are configured correctly by:

1. Checking the workflow run logs for environment variable output (secrets are masked with ***)
2. Ensuring the build step shows the signing identities are found
3. Confirming notarization completes successfully
4. Verifying the DMG files are uploaded to releases

## Security Notes

- Never commit these secrets to version control
- Rotate app-specific passwords periodically
- Keep your certificate password secure
- Review GitHub Actions logs to ensure secrets are properly masked

