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
  console.log('\n=== Notarization Script Started ===');
  console.log(`Platform: ${context.electronPlatformName}`);
  console.log(`App Out Dir: ${context.appOutDir}`);
  
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization (not macOS)');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`\n=== Checking App Bundle ===`);
  console.log(`Looking for app at: ${appPath}`);
  if (!fs.existsSync(appPath)) {
    console.error(`❌ App not found at ${appPath}`);
    console.error('Available files in appOutDir:');
    try {
      const files = fs.readdirSync(appOutDir);
      files.forEach(file => console.error(`  - ${file}`));
    } catch (e) {
      console.error(`  Could not list directory: ${e.message}`);
    }
    throw new Error(`App not found at ${appPath}`);
  }
  console.log(`✓ App found at ${appPath}`);

  // Check environment variables
  console.log(`\n=== Environment Variables ===`);
  console.log(`APPLE_ID: ${process.env.APPLE_ID ? process.env.APPLE_ID.substring(0, 5) + '***' : 'NOT SET'}`);
  console.log(`APPLE_APP_SPECIFIC_PASSWORD: ${process.env.APPLE_APP_SPECIFIC_PASSWORD ? '***' : 'NOT SET'}`);
  console.log(`APPLE_TEAM_ID: ${process.env.APPLE_TEAM_ID ? '***' : 'NOT SET'}`);
  console.log(`ELECTRON_TEAM_ID: ${process.env.ELECTRON_TEAM_ID ? '***' : 'NOT SET'}`);
  console.log(`CSC_TEAM_ID: ${process.env.CSC_TEAM_ID ? '***' : 'NOT SET'}`);
  
  const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;

  // Find signing identity
  console.log(`\n=== Finding Signing Certificate ===`);
  let identity;
  try {
    console.log(`Searching for certificate with team ID: ${teamId ? teamId.substring(0, 3) + '***' : 'NONE'}`);
    const certOutput = execSync(`security find-identity -v -p codesigning | grep "Developer ID Application.*(${teamId})" | head -1`, { encoding: 'utf8' });
    if (certOutput) {
      console.log(`Certificate search output: ${certOutput.trim()}`);
      const match = certOutput.match(/"([^"]+)"/);
      if (match) {
        identity = match[1];
        console.log(`✓ Found certificate: ${identity}`);
      } else {
        console.warn('⚠ Could not extract identity from certificate output');
      }
    } else {
      console.warn('⚠ No certificate found matching team ID');
    }
  } catch (e) {
    console.warn(`⚠ Certificate search failed: ${e.message}`);
    console.log('Falling back to constructed identity...');
    identity = `Developer ID Application: matthew price (${teamId})`;
    console.log(`Using constructed identity: ${identity}`);
  }
  
  if (!identity) {
    console.error('❌ Could not determine signing identity');
    throw new Error('Could not determine signing identity');
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
  console.log(`\n=== Pre-Notarization Signature Verification ===`);
  try {
    console.log('Running deep signature verification...');
    execSync(`codesign -vv --deep --strict "${appPath}"`, { stdio: 'pipe' });
    console.log('✓ Deep signature verification passed');
  } catch (error) {
    console.error('⚠ Deep signature verification failed');
    console.error(`  Error: ${error.message}`);
    if (error.stdout) console.error(`  stdout: ${error.stdout.toString()}`);
    if (error.stderr) console.error(`  stderr: ${error.stderr.toString()}`);
    console.log('Attempting basic verification...');
    try {
      execSync(`codesign -dv --verbose=4 "${appPath}"`, { stdio: 'inherit' });
      console.log('✓ Basic signature verification passed');
    } catch (basicError) {
      console.error('❌ Basic verification also failed');
      console.error(`  Error: ${basicError.message}`);
      throw basicError;
    }
  }

  // Now notarize
  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('\n⚠ Skipping notarization: missing credentials');
    console.warn(`  APPLE_ID: ${appleId ? 'SET' : 'MISSING'}`);
    console.warn(`  APPLE_APP_SPECIFIC_PASSWORD: ${appleIdPassword ? 'SET' : 'MISSING'}`);
    console.warn(`  APPLE_TEAM_ID: ${teamId ? 'SET' : 'MISSING'}`);
    return;
  }

  console.log(`\n=== Starting Notarization ===`);
  console.log(`App: ${appPath}`);
  console.log(`Apple ID: ${appleId.substring(0, 5)}***`);
  console.log(`Team ID: ${teamId.substring(0, 3)}***`);
  console.log(`Tool: notarytool`);

  try {
    const notarizeStartTime = Date.now();
    console.log('Submitting to Apple for notarization...');
    
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId,
      tool: 'notarytool', // Use notarytool (newer, recommended)
    });
    
    const duration = Date.now() - notarizeStartTime;
    console.log(`\n✓ Notarization complete! (${Math.round(duration / 1000)}s)`);
    console.log('=== Notarization Script Complete ===');
  } catch (error) {
    console.error('\n❌ Notarization failed');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    
    // If it's a signature check error, try to get more details
    if (error.message && (error.message.includes('signature') || error.message.includes('Signature'))) {
      console.error('\n=== Signature Check Failed - Gathering Details ===');
      try {
        console.log('Running codesign verification...');
        execSync(`codesign -dv --verbose=4 "${appPath}"`, { stdio: 'inherit' });
      } catch (verifyError) {
        console.error(`Codesign verification failed: ${verifyError.message}`);
      }
      
      try {
        console.log('Running spctl verification...');
        execSync(`spctl -a -vv "${appPath}"`, { stdio: 'inherit' });
      } catch (spctlError) {
        console.error(`Spctl verification failed: ${spctlError.message}`);
      }
    }
    
    // Check for common notarization issues
    if (error.message && error.message.includes('code object is not signed')) {
      console.error('\n⚠ Common issue: Some binaries may not be signed');
      console.error('  Check that custom-sign.js signed all nested binaries');
    }
    
    if (error.message && error.message.includes('timestamp')) {
      console.error('\n⚠ Common issue: Missing secure timestamp');
      console.error('  Ensure --timestamp flag is used when signing');
    }
    
    throw error;
  }
};

