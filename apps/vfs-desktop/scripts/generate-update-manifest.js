#!/usr/bin/env node
/**
 * Generate update manifest JSON for Tauri updater
 * This creates the latest.json file that the updater checks
 */

const fs = require('fs');
const path = require('path');

const version = process.env.VERSION || process.argv[2] || '1.1.4';
const repo = process.env.GITHUB_REPOSITORY || 'stonyp90/Ursly';
const [owner, repoName] = repo.split('/');

// Get actual artifact filenames from release
// Tauri generates these during build, we need to match them
const versionClean = version.replace(/^v/, '');
const repoNameClean = repoName || 'Ursly';

// Platform-specific update URLs - these match Tauri's output format
const manifest = {
  version: versionClean,
  notes: `Update to version ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'darwin-aarch64': {
      signature: '', // Will be filled by signing process during build
      url: `https://github.com/${owner}/${repoNameClean}/releases/download/${version}/Ursly-VFS_${versionClean}_aarch64.app.tar.gz`,
    },
    'darwin-x86_64': {
      signature: '',
      url: `https://github.com/${owner}/${repoNameClean}/releases/download/${version}/Ursly-VFS_${versionClean}_x64.app.tar.gz`,
    },
    'windows-x86_64': {
      signature: '',
      url: `https://github.com/${owner}/${repoNameClean}/releases/download/${version}/Ursly-VFS_${versionClean}_x64-setup.msi`,
    },
    'linux-x86_64': {
      signature: '',
      url: `https://github.com/${owner}/${repoNameClean}/releases/download/${version}/Ursly-VFS_${versionClean}_amd64.AppImage`,
    },
  },
};

const outputPath = path.join(__dirname, '..', 'latest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
console.log(`✅ Generated update manifest: ${outputPath}`);
console.log(`   Version: ${manifest.version}`);
console.log(`   Platforms: ${Object.keys(manifest.platforms).join(', ')}`);

