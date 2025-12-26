<div align="center">

<img src="website/logo.svg" alt="Ursly Logo" width="80" height="80" style="max-width: 100%; height: auto;" />

# Ursly VFS

### The File Manager Built for Creatives

**One app. All your clouds. Zero friction.**

✅ **Enterprise-Grade**: Production-ready desktop application with native performance, comprehensive testing, and enterprise-quality code.

Connect AWS, Azure, Google Cloud, your NAS, and 15+ more storage services. Search with AI. Stay in flow.

<br />

<img src="website/screenshots/vfs-main-dark.png" alt="Ursly VFS file browser on macOS 15 with Apple M4 Pro showing unified file management interface with sidebar navigation (Favorites, Storage locations, Tags, System metrics), main content area displaying file list with Name, Date Modified, Size, and Tier columns, header with Files/Metrics tabs, navigation bar with search, and footer with Shortcuts/Search/Theme buttons" width="800" style="max-width: 100%; height: auto;" />

<br />
<br />

[![CI](https://github.com/stonyp90/Ursly/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/stonyp90/Ursly/actions/workflows/ci.yml)
[![Release](https://github.com/stonyp90/Ursly/actions/workflows/release.yml/badge.svg)](https://github.com/stonyp90/Ursly/actions/workflows/release.yml)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square)](https://github.com/stonyp90/Ursly/actions)
[![Code Quality](https://img.shields.io/badge/code%20quality-enterprise--grade-success?style=flat-square)](https://github.com/stonyp90/Ursly)
[![Download](https://img.shields.io/badge/Download-Free-00d4ff?style=for-the-badge)](https://github.com/stonyp90/Ursly/releases/latest)
[![License](https://img.shields.io/badge/License-AGPL_v3-blue?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)
[![GitHub Stars](https://img.shields.io/github/stars/stonyp90/Ursly?style=for-the-badge&logo=github)](https://github.com/stonyp90/Ursly/stargazers)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8?style=flat-square&logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Stable-orange?style=flat-square&logo=rust)](https://www.rust-lang.org/)

<br />

[**Download**](https://github.com/stonyp90/Ursly/releases/latest) · [Website](https://ursly.io) · [Report Bug](https://github.com/stonyp90/Ursly/issues/new)

</div>

---

## 🚀 Why Ursly VFS?

Your files are scattered across AWS S3, Azure Blob, Google Cloud, your NAS, local drives, and Dropbox. Each requires a different app. You waste hours hunting for files.

**Ursly VFS changes everything.** One beautiful, native app that unifies all your storage. See everything in one place. Move files anywhere with drag & drop. Find anything instantly with AI-powered search that runs 100% locally.

---

## 📸 Screenshots

<div align="center">

### Main File Browser

<img src="website/screenshots/vfs-main-dark.png" alt="Ursly VFS file browser" width="100%" style="max-width: 1200px; height: auto; border-radius: 8px;" />

### Performance Monitor

<img src="website/screenshots/vfs-performance-metrics.png" alt="Performance Monitor dashboard" width="100%" style="max-width: 1200px; height: auto; border-radius: 8px;" />

### Keyboard Shortcuts

<img src="website/screenshots/vfs-keyboard-shortcuts.png" alt="Keyboard Shortcuts dialog" width="100%" style="max-width: 1200px; height: auto; border-radius: 8px;" />

</div>

---

## ✨ What Makes Ursly VFS Different

<div style="overflow-x: auto;">

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

</div>

---

## 📥 Download

**Free for personal use. No account required. No credit card.**

<div style="overflow-x: auto;">

| Platform    | Download                                                                                            | Requirements  |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------- |
| **macOS**   | [Download .dmg](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.dmg)           | macOS 11+     |
| **Windows** | [Download .msi](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.msi)           | Windows 10/11 |
| **Linux**   | [Download .AppImage](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.AppImage) | glibc 2.31+   |

</div>

> **macOS:** If you see "App is damaged", run: `xattr -cr /Applications/Ursly\ VFS.app`

---

## 🛠️ Built With Modern Tech

<div style="overflow-x: auto;">

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| **Desktop App**  | Tauri 2.0 + Rust             |
| **Frontend**     | React 18 + TypeScript        |
| **Local AI**     | Ollama + Whisper             |
| **Build System** | Nx Monorepo                  |
| **Styling**      | Tailwind CSS + CSS Variables |

</div>

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
