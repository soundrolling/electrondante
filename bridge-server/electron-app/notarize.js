const { notarize } = require('@electron/notarize');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Recursively find all binaries that need signing
function findBinaries(dir, binaries = []) {
  if (!fs.existsSync(dir)) {
    return binaries;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip certain directories
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        findBinaries(fullPath, binaries);
      }
    } else if (entry.isFile()) {
      // Check if it's a binary (executable or dylib)
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          // Check if it's a Mach-O binary or dylib
          const fileOutput = execSync(`file "${fullPath}"`, { encoding: 'utf8', stdio: 'pipe' }).trim();
          if (fileOutput.includes('Mach-O') || fullPath.endsWith('.dylib') || fullPath.endsWith('.so')) {
            binaries.push(fullPath);
          }
        }
      } catch (e) {
        // Skip files we can't check
      }
    }
  }
  
  return binaries;
}

// Ensure all nested binaries are properly signed with timestamps and hardened runtime
function ensureAllBinariesSigned(appPath, identity, entitlementsPath) {
  console.log('Ensuring all nested binaries are properly signed...');
  
  const frameworksPath = path.join(appPath, 'Contents', 'Frameworks');
  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  const binaries = [];
  
  if (fs.existsSync(frameworksPath)) {
    findBinaries(frameworksPath, binaries);
  }
  
  if (fs.existsSync(resourcesPath)) {
    findBinaries(resourcesPath, binaries);
  }
  
  console.log(`Found ${binaries.length} binaries to verify/sign`);
  
  for (const binary of binaries) {
    const relativePath = path.relative(appPath, binary);
    
    // Check if binary is already signed
    try {
      execSync(`codesign -v "${binary}"`, { stdio: 'pipe' });
      // Check if it has a timestamp
      const verifyOutput = execSync(`codesign -dv "${binary}" 2>&1`, { encoding: 'utf8', stdio: 'pipe' });
      if (!verifyOutput.includes('Signature=') || !verifyOutput.includes('Timestamp=')) {
        console.log(`Re-signing ${relativePath} (missing timestamp or signature)`);
        execSync(`codesign --force --sign "${identity}" --options runtime --timestamp "${binary}"`, {
          stdio: 'pipe'
        });
      }
    } catch (e) {
      // Binary is not signed, sign it
      console.log(`Signing unsigned binary: ${relativePath}`);
      execSync(`codesign --force --sign "${identity}" --options runtime --timestamp "${binary}"`, {
        stdio: 'pipe'
      });
    }
  }
  
  // Re-sign the main app bundle to ensure it includes all nested signatures
  console.log('Re-signing main app bundle to include all nested signatures...');
  execSync(`codesign --force --sign "${identity}" --entitlements "${entitlementsPath}" --options runtime --timestamp "${appPath}"`, {
    stdio: 'inherit'
  });
  
  console.log('✓ All binaries signed and verified');
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.error(`App not found at ${appPath}`);
    return;
  }

  const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;

  // Find signing identity
  let identity;
  try {
    const certOutput = execSync(`security find-identity -v -p codesigning | grep "Developer ID Application.*(${teamId})" | head -1`, { encoding: 'utf8' });
    if (certOutput) {
      const match = certOutput.match(/"([^"]+)"/);
      if (match) {
        identity = match[1];
        console.log(`Found certificate: ${identity}`);
      }
    }
  } catch (e) {
    identity = `Developer ID Application: matthew price (${teamId})`;
    console.log(`Using constructed identity: ${identity}`);
  }

  // Ensure all binaries are properly signed before notarization
  if (teamId && identity) {
    const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
    ensureAllBinariesSigned(appPath, identity, entitlementsPath);
  }

  // Now notarize
  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('Skipping notarization: missing APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID');
    return;
  }

  console.log(`Notarizing ${appPath}...`);

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

