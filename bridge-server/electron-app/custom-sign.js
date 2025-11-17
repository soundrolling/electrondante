const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  
  if (electronPlatformName !== 'darwin') {
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
    throw new Error('Team ID required for code signing');
  }

  console.log(`Custom signing ${appPath} with team ID: ${teamId}`);
  
  const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
  // Use the certificate SHA or name - try to find it
  let identity;
  try {
    // Try to find the certificate by team ID
    const certOutput = execSync(`security find-identity -v -p codesigning | grep "Developer ID Application.*(${teamId})" | head -1`, { encoding: 'utf8' });
    if (certOutput) {
      // Extract the identity name from the output
      const match = certOutput.match(/"([^"]+)"/);
      if (match) {
        identity = match[1];
        console.log(`Found certificate: ${identity}`);
      }
    }
  } catch (e) {
    // Fallback to constructing the identity name
    identity = `Developer ID Application: matthew price (${teamId})`;
    console.log(`Using constructed identity: ${identity}`);
  }
  
  try {
    // Sign with explicit identity and team ID
    console.log(`Signing with identity: ${identity}`);
    execSync(`codesign --force --deep --sign "${identity}" --entitlements "${entitlementsPath}" --options runtime "${appPath}"`, {
      stdio: 'inherit'
    });
    console.log('✓ Custom signing complete');
    
    // Verify signing
    console.log('Verifying signature...');
    execSync(`codesign -dv --verbose=4 "${appPath}"`, { stdio: 'inherit' });
    console.log('✓ Signature verified');
  } catch (error) {
    console.error('Custom signing failed:', error.message);
    throw error;
  }
};

