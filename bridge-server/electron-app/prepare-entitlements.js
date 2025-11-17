const fs = require('fs');
const path = require('path');

// Read the entitlements file
const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
let entitlements = fs.readFileSync(entitlementsPath, 'utf8');

// Get team ID from environment
const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;

if (teamId) {
  console.log(`Replacing $(TeamIdentifierPrefix) with ${teamId} in entitlements...`);
  // Replace $(TeamIdentifierPrefix) with the actual team ID
  entitlements = entitlements.replace(/\$\(TeamIdentifierPrefix\)/g, teamId);
  
  // Write back the entitlements file
  fs.writeFileSync(entitlementsPath, entitlements, 'utf8');
  console.log('Entitlements file updated with team ID');
} else {
  console.warn('No team ID found in environment variables. Entitlements will use $(TeamIdentifierPrefix) placeholder.');
}

