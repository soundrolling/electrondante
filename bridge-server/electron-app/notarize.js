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

  // Skip re-signing since custom-sign.js already signed everything in afterPack hook
  // Just verify the signature is valid
  console.log('Verifying app is properly signed (custom-sign.js should have already signed everything)...');
  try {
    execSync(`codesign -vv --deep --strict "${appPath}"`, { stdio: 'pipe' });
    console.log('✓ App signature is valid');
  } catch (error) {
    console.warn('⚠ Signature verification failed, attempting to fix...');
    // Only re-sign if verification fails (shouldn't happen if custom-sign.js worked)
    if (teamId && identity) {
      const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
      ensureAllBinariesSigned(appPath, identity, entitlementsPath);
    } else {
      throw new Error('Cannot fix signature: missing teamId or identity');
    }
  }

  // Now notarize
  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('Skipping notarization: missing APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID');
    return;
  }

  // Verify the app is properly signed before notarization
  console.log('Verifying app signature before notarization...');
  try {
    execSync(`codesign -vv --deep --strict "${appPath}"`, { stdio: 'inherit' });
    console.log('✓ App signature verified');
  } catch (error) {
    console.error('⚠ Signature verification failed, but continuing with notarization...');
    console.error('Error:', error.message);
  }

  console.log(`Notarizing ${appPath}...`);

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId,
      tool: 'notarytool', // Use notarytool (newer, recommended)
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    
    // If it's a signature check error, try to get more details
    if (error.message && error.message.includes('signature')) {
      console.error('Signature check failed. Verifying manually...');
      try {
        execSync(`codesign -dv --verbose=4 "${appPath}"`, { stdio: 'inherit' });
        execSync(`spctl -a -vv "${appPath}"`, { stdio: 'inherit' });
      } catch (verifyError) {
        console.error('Manual verification also failed:', verifyError.message);
      }
    }
    
    throw error;
  }
};

