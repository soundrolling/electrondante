const fs = require('fs');
const path = require('path');

// Get team ID from environment
const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;

if (!teamId) {
  console.warn('No team ID found in environment variables. Cannot prepare entitlements or package.json.');
  process.exit(1);
}

console.log(`Using team ID: ${teamId}`);

// Read and patch entitlements file
const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
let entitlements = fs.readFileSync(entitlementsPath, 'utf8');
console.log(`Replacing $(TeamIdentifierPrefix) with ${teamId} in entitlements...`);
entitlements = entitlements.replace(/\$\(TeamIdentifierPrefix\)/g, teamId);
fs.writeFileSync(entitlementsPath, entitlements, 'utf8');
console.log('✓ Entitlements file updated with team ID');

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

