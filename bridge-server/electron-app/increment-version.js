#!/usr/bin/env node
// Script to increment the patch version in package.json
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'package.json');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Parse current version (e.g., "1.3.0" -> [1, 3, 0])
  const versionParts = packageJson.version.split('.').map(Number);
  
  // Increment patch version (last number)
  versionParts[2] = (versionParts[2] || 0) + 1;
  
  // Construct new version string
  const newVersion = versionParts.join('.');
  
  // Store old version for display
  const oldVersion = packageJson.version;
  
  // Update package.json
  packageJson.version = newVersion;
  
  // Write back to file with proper formatting
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8'
  );
  
  console.log(`✅ Version incremented: ${oldVersion} → ${newVersion}`);
  
  // Return new version for use in scripts
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to increment version:', error.message);
  process.exit(1);
}

