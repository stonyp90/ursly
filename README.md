<div align="center">

<img src="website/logo.svg" alt="Ursly Logo" width="80" height="80" />

# Ursly

### The File Manager Built for Creatives

**One app. All your clouds. Zero friction.**

Connect AWS, Azure, Google Cloud, your NAS, and 15+ more storage services. Search with AI. Stay in flow.

<br />

<img src="website/screenshots/vfs-main-dark.png" alt="Ursly VFS file browser on macOS 15 with Apple M4 Pro showing unified file management interface with sidebar navigation, favorites, storage locations, tags, real-time system metrics, and keyboard-first controls" width="800" />

<br />
<br />

[![Download](https://img.shields.io/badge/Download-Free-00d4ff?style=for-the-badge)](https://github.com/stonyp90/Ursly/releases/latest)
[![License](https://img.shields.io/badge/License-AGPL_v3-blue?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)
[![GitHub Stars](https://img.shields.io/github/stars/stonyp90/Ursly?style=for-the-badge&logo=github)](https://github.com/stonyp90/Ursly/stargazers)

<br />

[**Download**](https://github.com/stonyp90/Ursly/releases/latest) · [Website](https://ursly.io) · [Report Bug](https://github.com/stonyp90/Ursly/issues/new)

</div>

---

## 🚀 Why Ursly?

Your files are scattered across AWS S3, Azure Blob, Google Cloud, your NAS, local drives, and Dropbox. Each requires a different app. You waste hours hunting for files.

**Ursly changes everything.** One beautiful, native app that unifies all your storage. See everything in one place. Move files anywhere with drag & drop. Find anything instantly with AI-powered search that runs 100% locally.

---

## ✨ What Makes Ursly Different

| Feature                    | What You Get                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🔗 **Multi-Cloud Unified** | Connect AWS S3, Azure Blob, Google Cloud Storage, Dropbox, Google Drive, OneDrive, NAS, SFTP, WebDAV, and more — all in one view                 |
| 🔍 **Spotlight Search**    | Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) for instant search across files, folders, tags, and operators (`tag:`, `type:`, `ext:`, `size:`) |
| 🤖 **AI-Powered Search**   | Find files by content, not just names. Runs 100% locally with Ollama — your data never leaves your machine                                       |
| 🎬 **Video Transcription** | Auto-transcribe videos in 99 languages with Whisper. Search spoken words across your entire library                                              |
| 🏷️ **Smart Tagging**       | AI auto-tags photos and images. Organize with color-coded tags that sync across all storage                                                      |
| ⌨️ **Keyboard-First**      | Every action has a shortcut. Built for power users who value speed                                                                               |
| 📊 **System Monitor**      | Real-time GPU, CPU, RAM metrics. Perfect for monitoring renders and heavy workloads                                                              |
| 🎯 **Onboarding Tour**     | Interactive tour guides you through Search, Metrics, Shortcuts, Favorites, and Asset Management                                                  |
| 🔄 **Auto-Updates**        | Seamless updates with progress tracking. Always stay on the latest version                                                                       |
| 🔒 **100% Private**        | All AI processing runs locally. Zero cloud dependencies. Your files never leave your machine                                                     |
| 🚀 **Blazing Fast**        | Built with Tauri 2.0 + Rust. Native performance, not a slow web wrapper                                                                          |

---

## 📥 Download

**Free for personal use. No account required. No credit card.**

| Platform    | Download                                                                                            | Requirements  |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------- |
| **macOS**   | [Download .dmg](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.dmg)           | macOS 11+     |
| **Windows** | [Download .msi](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.msi)           | Windows 10/11 |
| **Linux**   | [Download .AppImage](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.AppImage) | glibc 2.31+   |

> **macOS:** If you see "App is damaged", run: `xattr -cr /Applications/Ursly\ VFS.app`

---

## 🔌 Supported Storage

### ☁️ Cloud Storage

- **AWS S3** (all regions)
- **Google Cloud Storage**
- **Azure Blob Storage**
- **Dropbox**
- **Google Drive**
- **OneDrive**

### 🏠 Network & Local

- **NAS** (Synology, QNAP, and more)
- **SMB/CIFS** Shares
- **NFS** Mounts
- **SFTP** Servers
- **WebDAV**
- **Local Drives**

### 🏢 Enterprise

- **AWS FSx for ONTAP**
- **Backblaze B2**
- **Wasabi**
- **MinIO**
- **DigitalOcean Spaces**

---

## 🖼️ See It in Action

### Spotlight Search

Press `Cmd+K` to instantly search across all your storage. Use powerful operators like `tag:important`, `type:video`, `ext:mp4`, or `size:>1gb`.

<p align="center">
  <img src="website/screenshots/vfs-spotlight-search.png" alt="Spotlight Search" width="700" />
</p>

### System Performance Monitor

Real-time performance monitoring with detailed CPU core activity (14 cores), memory usage (58.4% - 28.0/48 GB), GPU metrics (58% Apple M4 Pro), VRAM (61%), temperature (61°C), disk I/O, network stats (117.7 KB/s), and system load averages (4.48 / 4.55 / 4.63). Perfect for keeping an eye on renders and heavy workloads.

<p align="center">
  <img src="website/screenshots/vfs-performance-metrics.png" alt="Performance Monitor dashboard showing macOS 15 with 14 Cores Apple M4 Pro, CPU usage (16%), Memory (58.4% - 28.0/48 GB), GPU (58% Apple M4 Pro), VRAM (61%), Temperature (61°C), Load (32% - 4.48), Disk I/O (0 B/s), Network (117.7 KB/s), and System Load Average (4.48 / 4.55 / 4.63) with real-time graphs and per-core CPU visualization" width="700" />
</p>

### Keyboard-First Experience

Every action has a shortcut. Stay in your flow without touching the mouse.

<p align="center">
  <img src="website/screenshots/vfs-keyboard-shortcuts.png" alt="Keyboard Shortcuts dialog showing Navigation (Go back ⌘+[, Go forward ⌘+], Go to parent folder ⌘+↑, Open selected Enter, Navigate files ↑↓←→), Selection (Select all ⌘+A, Toggle selection ⌘+Click, Range select Shift+Click, Clear selection Escape), Clipboard (Copy ⌘+C, Paste ⌘+V, Duplicate ⌘+D), and File Operations (New folder ⌘+Shift+N, Rename Enter, Move to Trash ⌘+Delete, Delete Delete)" width="700" />
</p>

---

## 🛠️ Built With Modern Tech

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| **Desktop App**  | Tauri 2.0 + Rust             |
| **Frontend**     | React 18 + TypeScript        |
| **Local AI**     | Ollama + Whisper             |
| **Build System** | Nx Monorepo                  |
| **Styling**      | Tailwind CSS + CSS Variables |

---

## 🚦 Quick Start

```bash
# Clone the repository
git clone https://github.com/stonyp90/Ursly.git
cd Ursly

# Install dependencies
npm install

# Run the desktop app
cd apps/vfs-desktop
npm run tauri:dev
```

---

## 🤝 Contributing

We welcome contributions! Check out our [architecture documentation](./agents.md) to get started.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🗺️ Roadmap

- [ ] Adobe Premiere Pro plugin
- [ ] DaVinci Resolve integration
- [ ] VS Code extension
- [ ] Real-time collaboration
- [ ] Team workspaces
- [ ] Advanced search operators
- [ ] Custom storage providers

---

## 📄 License

**AGPL-3.0** — Free for personal use. [View license](LICENSE)

---

<div align="center">

**[ursly.io](https://ursly.io)** · [Download](https://github.com/stonyp90/Ursly/releases/latest) · [GitHub](https://github.com/stonyp90/Ursly)

<br />

Created by **[Anthony Paquet](https://www.linkedin.com/in/anthony-paquet-94a31085/)**

<br />

⭐ **Star us on GitHub** — it helps others discover Ursly!

</div>
