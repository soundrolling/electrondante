const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  
  if (process.platform !== 'darwin') {
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  
  if (!fs.existsSync(appPath)) {
    console.error(`App not found at ${appPath}`);
    return;
  }

  const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;
  if (!teamId) {
    console.error('No team ID found in environment variables');
    return;
  }

  console.log(`Custom signing ${appPath} with team ID: ${teamId}`);
  
  const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
  const identity = `Developer ID Application: matthew price (${teamId})`;
  
  try {
    // Sign with explicit team ID
    console.log(`Signing with identity: ${identity}`);
    execSync(`codesign --force --deep --sign "${identity}" --entitlements "${entitlementsPath}" --options runtime "${appPath}"`, {
      stdio: 'inherit'
    });
    console.log('✓ Custom signing complete');
    
    // Verify signing
    execSync(`codesign -dv --verbose=4 "${appPath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Custom signing failed:', error.message);
    throw error;
  }
};

