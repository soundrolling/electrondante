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
      // Check if it's a binary (executable or dylib or .node file)
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          // Check for .node files (native Node.js modules) first
          if (fullPath.endsWith('.node')) {
            binaries.push(fullPath);
          }
          // Check if it's a Mach-O binary or dylib
          else {
            const fileOutput = execSync(`file "${fullPath}"`, { encoding: 'utf8', stdio: 'pipe' }).trim();
            if (fileOutput.includes('Mach-O') || fullPath.endsWith('.dylib') || fullPath.endsWith('.so')) {
              binaries.push(fullPath);
            }
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
  console.log('=== Custom Signing Script Started ===');
  console.log(`Platform: ${context.electronPlatformName}`);
  console.log(`App Out Dir: ${context.appOutDir}`);
  
  const { appOutDir, packager, electronPlatformName } = context;
  
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping custom signing (not macOS)');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  
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
  console.log('\n=== Environment Variables ===');
  console.log(`APPLE_TEAM_ID: ${process.env.APPLE_TEAM_ID ? '***' : 'NOT SET'}`);
  console.log(`ELECTRON_TEAM_ID: ${process.env.ELECTRON_TEAM_ID ? '***' : 'NOT SET'}`);
  console.log(`CSC_TEAM_ID: ${process.env.CSC_TEAM_ID ? '***' : 'NOT SET'}`);
  
  const teamId = process.env.APPLE_TEAM_ID || process.env.ELECTRON_TEAM_ID || process.env.CSC_TEAM_ID;
  if (!teamId) {
    console.error('\n❌ No team ID found in environment variables');
    console.error('Checked: APPLE_TEAM_ID, ELECTRON_TEAM_ID, CSC_TEAM_ID');
    throw new Error('Team ID required for code signing');
  }
  console.log(`✓ Using team ID: ${teamId.substring(0, 3)}***`);

  console.log(`\n=== Starting Custom Signing ===`);
  console.log(`App: ${appPath}`);
  
  const entitlementsPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
  
  // Use the certificate SHA or name - try to find it
  console.log('\n=== Finding Signing Certificate ===');
  let identity;
  try {
    console.log('Searching for Developer ID Application certificate...');
    const certOutput = execSync(`security find-identity -v -p codesigning | grep "Developer ID Application.*(${teamId})" | head -1`, { encoding: 'utf8' });
    if (certOutput) {
      console.log(`Certificate search output: ${certOutput.trim()}`);
      // Extract the identity name from the output
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
    // Fallback to constructing the identity name
    identity = `Developer ID Application: matthew price (${teamId})`;
    console.log(`Using constructed identity: ${identity}`);
  }
  
  if (!identity) {
    throw new Error('Could not determine signing identity');
  }
  
  try {
    // Find all binaries that need signing (nested in Frameworks, Resources, etc.)
    console.log('\n=== Finding All Binaries to Sign ===');
    const frameworksPath = path.join(appPath, 'Contents', 'Frameworks');
    const resourcesPath = path.join(appPath, 'Contents', 'Resources');
    const binaries = [];
    
    console.log(`Checking Frameworks: ${frameworksPath}`);
    if (fs.existsSync(frameworksPath)) {
      findBinaries(frameworksPath, binaries);
      console.log(`  Found ${binaries.length} binaries in Frameworks`);
    } else {
      console.log(`  Frameworks directory not found`);
    }
    
    // Check Resources for ShipIt and other executables
    console.log(`Checking Resources: ${resourcesPath}`);
    if (fs.existsSync(resourcesPath)) {
      const beforeCount = binaries.length;
      findBinaries(resourcesPath, binaries);
      const foundInResources = binaries.length - beforeCount;
      console.log(`  Found ${foundInResources} additional binaries in Resources`);
    } else {
      console.log(`  Resources directory not found`);
    }
    
    // Specifically check app.asar.unpacked for native modules
    const asarUnpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
    console.log(`Checking app.asar.unpacked: ${asarUnpackedPath}`);
    if (fs.existsSync(asarUnpackedPath)) {
      const beforeCount = binaries.length;
      console.log(`  Recursively searching app.asar.unpacked...`);
      findBinaries(asarUnpackedPath, binaries);
      const foundInAsarUnpacked = binaries.length - beforeCount;
      console.log(`  Found ${foundInAsarUnpacked} additional binaries in app.asar.unpacked`);
      
      // List what we found for debugging
      if (foundInAsarUnpacked > 0) {
        console.log(`  Binaries found in app.asar.unpacked:`);
        for (let i = beforeCount; i < binaries.length; i++) {
          const relPath = path.relative(appPath, binaries[i]);
          console.log(`    - ${relPath}`);
        }
      }
    } else {
      console.log(`  ⚠ app.asar.unpacked directory not found`);
      console.log(`  This is expected if asarUnpack is not configured, but may cause signing issues`);
    }
    
    console.log(`\nTotal binaries found: ${binaries.length}`);
    
    if (binaries.length === 0) {
      console.warn('⚠ WARNING: No binaries found to sign!');
      console.warn('  This may indicate a problem with the app bundle structure');
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
    
    let signedCount = 0;
    let failedCount = 0;
    
    for (const binary of signingOrder) {
      const relativePath = path.relative(appOutDir, binary);
      console.log(`\n[${signedCount + 1}/${signingOrder.length}] Signing: ${relativePath}`);
      
      try {
        // Sign with hardened runtime and timestamp
        // For frameworks, we need to sign nested components first, so use --deep
        // Note: --deep is deprecated but necessary for frameworks with nested components
        let command;
        if (binary.includes('.framework')) {
          command = `codesign --force --deep --sign "${identity}" --options runtime --timestamp "${binary}"`;
          console.log(`  Using --deep flag for framework`);
        } else {
          command = `codesign --force --sign "${identity}" --options runtime --timestamp "${binary}"`;
        }
        
        console.log(`  Command: ${command.replace(identity, 'IDENTITY')}`);
        const startTime = Date.now();
        execSync(command, { stdio: 'pipe' });
        const duration = Date.now() - startTime;
        console.log(`  ✓ Signed successfully (${duration}ms)`);
        signedCount++;
        
        // Verify immediately after signing
        try {
          execSync(`codesign -v "${binary}"`, { stdio: 'pipe' });
          console.log(`  ✓ Signature verified`);
        } catch (verifyError) {
          console.warn(`  ⚠ Signature verification failed: ${verifyError.message}`);
        }
      } catch (error) {
        failedCount++;
        console.error(`\n❌ Failed to sign ${relativePath}`);
        console.error(`  Error: ${error.message}`);
        if (error.stdout) {
          console.error(`  stdout: ${error.stdout.toString()}`);
        }
        if (error.stderr) {
          console.error(`  stderr: ${error.stderr.toString()}`);
        }
        // Re-throw to fail the build
        throw error;
      }
    }
    
    console.log(`\n=== Signing Summary ===`);
    console.log(`  Signed: ${signedCount}/${signingOrder.length}`);
    console.log(`  Failed: ${failedCount}`);
    
    // Sign the main app bundle with entitlements
    console.log(`\n=== Signing Main App Bundle ===`);
    console.log(`App: ${appPath}`);
    console.log(`Entitlements: ${entitlementsPath}`);
    
    if (!fs.existsSync(entitlementsPath)) {
      throw new Error(`Entitlements file not found: ${entitlementsPath}`);
    }
    console.log(`✓ Entitlements file exists`);
    
    const mainSignCommand = `codesign --force --sign "${identity}" --entitlements "${entitlementsPath}" --options runtime --timestamp "${appPath}"`;
    console.log(`Command: ${mainSignCommand.replace(identity, 'IDENTITY')}`);
    
    try {
      const startTime = Date.now();
      execSync(mainSignCommand, { stdio: 'inherit' });
      const duration = Date.now() - startTime;
      console.log(`✓ Main app bundle signed successfully (${duration}ms)`);
    } catch (error) {
      console.error(`\n❌ Failed to sign main app bundle`);
      console.error(`  Error: ${error.message}`);
      if (error.stdout) console.error(`  stdout: ${error.stdout.toString()}`);
      if (error.stderr) console.error(`  stderr: ${error.stderr.toString()}`);
      throw error;
    }
    
    // Verify signing
    console.log(`\n=== Verifying Final Signature ===`);
    try {
      execSync(`codesign -vv --deep --strict "${appPath}"`, { stdio: 'pipe' });
      console.log('✓ Deep signature verification passed');
    } catch (verifyError) {
      console.warn('⚠ Deep verification failed, trying basic verification...');
      try {
        execSync(`codesign -dv --verbose=4 "${appPath}"`, { stdio: 'inherit' });
        console.log('✓ Basic signature verification passed');
      } catch (basicError) {
        console.error('❌ Basic verification also failed');
        throw basicError;
      }
    }
    
    console.log('\n=== Custom Signing Complete ===');
  } catch (error) {
    console.error('\n❌ Custom signing failed');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    if (error.stdout) console.error(`stdout: ${error.stdout.toString()}`);
    if (error.stderr) console.error(`stderr: ${error.stderr.toString()}`);
    throw error;
  }
};

