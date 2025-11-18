const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Recursively find all binaries that need signing
function findBinaries(dir, binaries = []) {
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
    // Find all binaries that need signing (nested in Frameworks, etc.)
    console.log('Finding all binaries to sign...');
    const frameworksPath = path.join(appPath, 'Contents', 'Frameworks');
    const binaries = [];
    
    if (fs.existsSync(frameworksPath)) {
      findBinaries(frameworksPath, binaries);
    }
    
    // Also check Resources for ShipIt and other executables
    const resourcesPath = path.join(appPath, 'Contents', 'Resources');
    if (fs.existsSync(resourcesPath)) {
      findBinaries(resourcesPath, binaries);
    }
    
    // Sign all nested binaries first (bottom-up signing)
    // Separate binaries into categories: helpers first, then frameworks, then others
    const helpers = [];
    const frameworks = [];
    const others = [];
    
    for (const binary of binaries) {
      if (binary.includes('Helpers/') || binary.includes('Helper')) {
        helpers.push(binary);
      } else if (binary.includes('.framework')) {
        frameworks.push(binary);
      } else {
        others.push(binary);
      }
    }
    
    // Sort each category by depth (deepest first)
    const sortByDepth = (a, b) => {
      const depthA = a.split(path.sep).length;
      const depthB = b.split(path.sep).length;
      return depthB - depthA;
    };
    
    helpers.sort(sortByDepth);
    frameworks.sort(sortByDepth);
    others.sort(sortByDepth);
    
    // Sign in order: helpers first, then others, then frameworks
    const signingOrder = [...helpers, ...others, ...frameworks];
    
    console.log(`Found ${binaries.length} binaries to sign (${helpers.length} helpers, ${frameworks.length} frameworks, ${others.length} others)`);
    
    for (const binary of signingOrder) {
      const relativePath = path.relative(appOutDir, binary);
      console.log(`Signing: ${relativePath}`);
      
      try {
        // Sign with hardened runtime and timestamp
        // For frameworks, we need to sign nested components first, so use --deep
        // Note: --deep is deprecated but necessary for frameworks with nested components
        if (binary.includes('.framework')) {
          // Sign framework with --deep to handle nested components
          execSync(`codesign --force --deep --sign "${identity}" --options runtime --timestamp "${binary}"`, {
            stdio: 'pipe'
          });
        } else {
          // Regular binary signing
          execSync(`codesign --force --sign "${identity}" --options runtime --timestamp "${binary}"`, {
            stdio: 'pipe'
          });
        }
      } catch (error) {
        console.error(`Failed to sign ${relativePath}: ${error.message}`);
        // Re-throw to fail the build
        throw error;
      }
    }
    
    // Sign the main app bundle with entitlements
    console.log(`Signing main app bundle: ${appPath}`);
    execSync(`codesign --force --sign "${identity}" --entitlements "${entitlementsPath}" --options runtime --timestamp "${appPath}"`, {
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

