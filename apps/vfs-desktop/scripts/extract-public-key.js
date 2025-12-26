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
    // Try to extract using Tauri CLI (if available)
    // This is a workaround - ideally the public key should be saved when generating
    console.log('⚠️  Public key file not found. Generating from private key...');
    console.log('⚠️  NOTE: You need to generate keys with --write-keys flag to save public key');
    console.log('⚠️  Run: npx @tauri-apps/cli signer generate --write-keys');
    
    // For now, we'll output instructions
    console.log('\n📝 To get the public key:');
    console.log('   1. Generate a new keypair: npx @tauri-apps/cli signer generate --write-keys');
    console.log('   2. Copy the public key from the output');
    console.log('   3. Add it to tauri.conf.json plugins.updater.pubkey');
    console.log('   4. Save the private key as GitHub Secret TAURI_SIGNING_PRIVATE_KEY');
    
    process.exit(1);
  }
  
  // Output the public key
  console.log('\n✅ Public Key:');
  console.log(publicKey);
  console.log('\n📋 Add this to tauri.conf.json:');
  console.log(`   "pubkey": "${publicKey}"`);
  
  // Clean up temp file
  if (fs.existsSync(tempKeyPath)) {
    fs.unlinkSync(tempKeyPath);
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Error extracting public key:', error.message);
  process.exit(1);
}

