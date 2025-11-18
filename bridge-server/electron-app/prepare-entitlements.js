const fs = require('fs');
const path = require('path');

// Get team ID from environment
const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;

if (!teamId) {
  console.warn('No team ID found in environment variables. Cannot prepare entitlements or package.json.');
  process.exit(1);
}

console.log(`Using team ID: ${teamId}`);

// NOTE: Do NOT replace $(TeamIdentifierPrefix) in entitlements!
// @electron/osx-sign needs the placeholder to extract team ID from certificate.
// The ELECTRON_TEAM_ID environment variable is set as a fallback.
// If we replace $(TeamIdentifierPrefix) here, @electron/osx-sign cannot extract the team ID.

// Read entitlements file to verify it has the placeholder
const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
let entitlements = fs.readFileSync(entitlementsPath, 'utf8');

if (!entitlements.includes('$(TeamIdentifierPrefix)')) {
  console.warn('⚠ WARNING: entitlements.mac.plist does not contain $(TeamIdentifierPrefix)');
  console.warn('@electron/osx-sign may not be able to extract team ID from certificate');
  console.warn('Make sure ELECTRON_TEAM_ID environment variable is set as fallback');
} else {
  console.log('✓ Entitlements file contains $(TeamIdentifierPrefix) placeholder');
  console.log('  @electron/osx-sign will extract team ID from certificate or use ELECTRON_TEAM_ID');
}

// Read and patch package.json to replace ${APPLE_TEAM_ID} in identity field
const packageJsonPath = path.join(__dirname, 'package.json');
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.build && packageJson.build.mac && packageJson.build.mac.identity) {
  const identity = packageJson.build.mac.identity.replace(/\$\{APPLE_TEAM_ID\}/g, teamId);
  packageJson.build.mac.identity = identity;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`✓ Package.json identity updated: ${identity}`);
} else {
  console.log('No identity field found in package.json mac config');
}

