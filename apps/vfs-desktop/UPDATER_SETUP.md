# Tauri Updater Setup Guide

The Tauri updater is currently **disabled** by default. To enable it, you need to:

## 1. Generate Updater Keys

```bash
cd apps/vfs-desktop/src-tauri
cargo tauri signer generate -w ~/.tauri/myapp.key
```

This will generate:

- **Private key**: `~/.tauri/myapp.key` (keep this secret!)
- **Public key**: Displayed in terminal (copy this)

## 2. Configure Updater in `tauri.conf.json`

Update the `plugins.updater` section:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://releases.ursly.io/{{target}}/{{current_version}}"],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_FROM_STEP_1"
    }
  }
}
```

## 3. Set Up Update Server

The updater expects a JSON manifest at the endpoint URL. Example structure:

```json
{
  "version": "1.1.5",
  "notes": "Bug fixes and improvements",
  "pub_date": "2024-12-26T00:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://releases.ursly.io/.../Ursly-VFS_1.1.5_x64.dmg"
    },
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://releases.ursly.io/.../Ursly-VFS_1.1.5_aarch64.dmg"
    },
    "windows-x86_64": {
      "signature": "...",
      "url": "https://releases.ursly.io/.../Ursly-VFS_1.1.5_x64-setup.exe"
    },
    "linux-x86_64": {
      "signature": "...",
      "url": "https://releases.ursly.io/.../Ursly-VFS_1.1.5_amd64.AppImage"
    }
  }
}
```

## 4. Sign Release Files

After building, sign your release files:

```bash
cargo tauri signer sign ~/.tauri/myapp.key apps/vfs-desktop/src-tauri/target/release/bundle/dmg/Ursly-VFS_1.1.5_x64.dmg
```

## 5. Upload to Update Server

Upload signed files and manifest JSON to your update server.

## Current Status

- **Updater**: Disabled (set `active: false`)
- **Reason**: Requires proper key generation and server setup
- **Workaround**: Users can download updates manually from GitHub Releases

## Testing

To test the updater locally:

1. Enable updater in `tauri.conf.json`
2. Set a test endpoint pointing to a local server
3. Build the app: `npm run tauri:build`
4. Run the app and trigger update check

## Resources

- [Tauri Updater Documentation](https://tauri.app/v1/guides/distribution/updater)
- [Tauri Signer Guide](https://tauri.app/v1/guides/distribution/signer)
