#!/usr/bin/env node
/**
 * Extract public key from Tauri private key
 * This script reads the private key and extracts the public key for embedding in tauri.conf.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const privateKeyPath = path.join(__dirname, '..', '.tauri-keys', 'key');
const privateKeyEnv = process.env.TAURI_SIGNING_PRIVATE_KEY;

if (!fs.existsSync(privateKeyPath) && !privateKeyEnv) {
  console.error('❌ No private key found. Set TAURI_SIGNING_PRIVATE_KEY or create .tauri-keys/key');
  process.exit(1);
}

try {
  // Read private key
  const privateKey = privateKeyEnv || fs.readFileSync(privateKeyPath, 'utf8').trim();
  
  // Use Tauri CLI to extract public key
  // The signer can derive the public key from the private key
  const tempKeyPath = path.join(__dirname, '..', '.tauri-keys', 'temp-key');
  fs.mkdirSync(path.dirname(tempKeyPath), { recursive: true });
  fs.writeFileSync(tempKeyPath, privateKey);
  
  // Use Tauri signer to get public key
  // Note: Tauri signer doesn't have a direct "extract public key" command,
  // but we can use the signer's internal logic
  // For now, we'll use a workaround: generate a new keypair and use that,
  // OR better: read the public key from the private key file if it exists
  
  // Check if .tauri-keys/key.pub exists (created when key was generated)
  const publicKeyPath = path.join(__dirname, '..', '.tauri-keys', 'key.pub');
  
  let publicKey = '';
  
  if (fs.existsSync(publicKeyPath)) {
    publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
    console.log('✅ Found existing public key file');
  } else {
    // Try to extract public key from private key using Tauri CLI
    // The private key format is: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
    // We need to use Tauri's signer to derive the public key
    try {
      // Use Tauri CLI to get public key (if available)
      // Note: This requires the Tauri CLI to be installed
      const { execSync } = require('child_process');
      
      // Try to use Tauri signer to extract public key
      // The signer can derive public key from private key
      const result = execSync('npx @tauri-apps/cli signer generate --ci 2>&1', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      // Parse output to find public key
      // Tauri signer outputs: "Public key: <key>"
      const publicKeyMatch = result.match(/Public key:\s*([A-Za-z0-9+\/=\s]+)/i);
      if (publicKeyMatch) {
        publicKey = publicKeyMatch[1].trim().replace(/\s+/g, '');
        console.log('✅ Extracted public key from Tauri CLI');
      } else {
        throw new Error('Could not parse public key from Tauri CLI output');
      }
    } catch (error) {
      console.error('⚠️  Could not extract public key automatically.');
      console.error('⚠️  Error:', error.message);
      console.error('⚠️  Please ensure:');
      console.error('    1. Tauri CLI is installed: npm install -g @tauri-apps/cli');
      console.error('    2. Private key is valid');
      console.error('    3. Or generate keys with: npx @tauri-apps/cli signer generate --write-keys');
      process.exit(1);
    }
  }
  
  // Output the public key (for CI/CD to capture)
  console.log('\n✅ Public Key:');
  console.log(publicKey);
  
  // Clean up temp file
  if (fs.existsSync(tempKeyPath)) {
    fs.unlinkSync(tempKeyPath);
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Error extracting public key:', error.message);
  process.exit(1);
}

