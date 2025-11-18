const fs = require('fs');
const path = require('path');

console.log('\n=== Prepare Entitlements Script Started ===');

// Get team ID from environment
console.log('\n=== Checking Environment Variables ===');
console.log(`APPLE_TEAM_ID: ${process.env.APPLE_TEAM_ID ? 'SET' : 'NOT SET'}`);
console.log(`ELECTRON_TEAM_ID: ${process.env.ELECTRON_TEAM_ID ? 'SET' : 'NOT SET'}`);
console.log(`CSC_TEAM_ID: ${process.env.CSC_TEAM_ID ? 'SET' : 'NOT SET'}`);

const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;

if (!teamId) {
  console.warn('\n⚠️  No team ID found in environment variables');
  console.warn('Checked: APPLE_TEAM_ID, ELECTRON_TEAM_ID, CSC_TEAM_ID');
  console.warn('Continuing anyway - team ID will be extracted from certificate or set later');
  console.warn('@electron/osx-sign can extract team ID from the signing certificate');
} else {
  console.log(`✓ Using team ID: ${teamId.substring(0, 3)}***`);
}

// NOTE: Do NOT replace $(TeamIdentifierPrefix) in entitlements!
// @electron/osx-sign needs the placeholder to extract team ID from certificate.
// The ELECTRON_TEAM_ID environment variable is set as a fallback.
// If we replace $(TeamIdentifierPrefix) here, @electron/osx-sign cannot extract the team ID.

// Read entitlements file to verify it has the placeholder
console.log('\n=== Checking Entitlements File ===');
const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
console.log(`Entitlements path: ${entitlementsPath}`);

if (!fs.existsSync(entitlementsPath)) {
  console.error(`❌ Entitlements file not found: ${entitlementsPath}`);
  process.exit(1);
}
console.log('✓ Entitlements file exists');

let entitlements;
try {
  entitlements = fs.readFileSync(entitlementsPath, 'utf8');
  console.log(`✓ Entitlements file read successfully (${entitlements.length} bytes)`);
} catch (error) {
  console.error(`❌ Failed to read entitlements file: ${error.message}`);
  process.exit(1);
}

if (!entitlements.includes('$(TeamIdentifierPrefix)')) {
  console.warn('\n⚠ WARNING: entitlements.mac.plist does not contain $(TeamIdentifierPrefix)');
  console.warn('@electron/osx-sign may not be able to extract team ID from certificate');
  console.warn('Make sure ELECTRON_TEAM_ID environment variable is set as fallback');
  console.warn('Current entitlements content preview:');
  console.warn(entitlements.substring(0, 200) + '...');
} else {
  console.log('✓ Entitlements file contains $(TeamIdentifierPrefix) placeholder');
  console.log('  @electron/osx-sign will extract team ID from certificate or use ELECTRON_TEAM_ID');
}

// Read and patch package.json to replace ${APPLE_TEAM_ID} in identity field
const packageJsonPath = path.join(__dirname, 'package.json');
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.build && packageJson.build.mac && packageJson.build.mac.identity) {
  if (teamId) {
    const identity = packageJson.build.mac.identity.replace(/\$\{APPLE_TEAM_ID\}/g, teamId);
    packageJson.build.mac.identity = identity;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
    console.log(`✓ Package.json identity updated: ${identity}`);
  } else {
    console.log('⚠️  Skipping package.json identity update - team ID not available yet');
    console.log('   Identity will be set by electron-builder using certificate or environment variables');
  }
} else {
  console.log('No identity field found in package.json mac config');
}

