<div align="center">

<img src="website/logo.svg" alt="Ursly Logo" width="80" height="80" />

# Ursly

### One App. All Your Files.

**The modern file manager for creatives.**<br>
**Connect all your storage. Search with AI. Stay in flow.**

<br />

<img src="website/screenshots/vfs-main-dark.png" alt="Ursly - All your files in one place" width="800" />

<br />
<br />

[![Download](https://img.shields.io/badge/Download-Free-00d4ff?style=for-the-badge)](https://github.com/stonyp90/Ursly/releases/latest)
[![License](https://img.shields.io/badge/License-AGPL_v3-blue?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)
[![GitHub Stars](https://img.shields.io/github/stars/stonyp90/Ursly?style=for-the-badge&logo=github)](https://github.com/stonyp90/Ursly/stargazers)

<br />

[**Download**](https://github.com/stonyp90/Ursly/releases/latest) · [Website](https://ursly.io) · [Report Bug](https://github.com/stonyp90/Ursly/issues/new)

</div>

---

## Why Ursly?

Your files are scattered everywhere — project files on your NAS, archives in the cloud, renders on local drives. Different apps for each. Wasted time hunting for files.

**Ursly brings it all together.** One beautiful app that connects to all your storage. See everything in one place. Move files anywhere with drag & drop. Find anything instantly with AI.

---

## ✨ Features

|     | Feature                 | Description                                                  |
| --- | ----------------------- | ------------------------------------------------------------ |
| 🔗  | **15+ Connections**     | AWS, Azure, Google Cloud, Dropbox, NAS, SFTP, and more       |
| 🔍  | **AI-Powered Search**   | Find files by content, not just names. Runs 100% locally.    |
| 🎬  | **Video Transcription** | Auto-transcribe videos in 99 languages. Search spoken words. |
| 🏷️  | **Smart Tagging**       | Auto-tag photos and images with AI                           |
| ⌨️  | **Keyboard First**      | Every action has a shortcut. Stay in your flow.              |
| 📊  | **System Monitor**      | GPU, CPU, RAM at a glance — perfect for renders              |
| 🔒  | **100% Private**        | AI runs locally. Your files never leave your machine.        |
| 🚀  | **Blazing Fast**        | Native app, not a slow web wrapper                           |

---

## 📥 Download

Free for personal use. No account required.

| Platform    | Download                                                                                            | Requirements  |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------- |
| **macOS**   | [Download .dmg](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.dmg)           | macOS 11+     |
| **Windows** | [Download .msi](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.msi)           | Windows 10/11 |
| **Linux**   | [Download .AppImage](https://github.com/stonyp90/Ursly/releases/latest/download/ursly-vfs.AppImage) | glibc 2.31+   |

> **macOS:** If you see "App is damaged", run: `xattr -cr /Applications/Ursly\ VFS.app`

---

## 🔌 Supported Storage

<table>
<tr>
<td width="33%">

**☁️ Cloud**

- AWS S3
- Google Cloud Storage
- Azure Blob
- Dropbox
- Google Drive
- OneDrive

</td>
<td width="33%">

**🏠 Network & Local**

- NAS (Synology, QNAP)
- SMB/CIFS Shares
- NFS Mounts
- SFTP Servers
- WebDAV
- Local Drives

</td>
<td width="33%">

**🏢 Enterprise**

- AWS FSx for ONTAP
- Backblaze B2
- Wasabi
- MinIO
- DigitalOcean Spaces

</td>
</tr>
</table>

---

## 🖼️ Screenshots

<p align="center">
  <img src="website/screenshots/vfs-performance-metrics.png" alt="System Monitor" width="600" />
</p>
<p align="center"><em>System Monitor — Keep an eye on GPU, CPU, RAM while you work</em></p>

<p align="center">
  <img src="website/screenshots/vfs-keyboard-shortcuts.png" alt="Keyboard Shortcuts" width="600" />
</p>
<p align="center"><em>Keyboard First — Every action has a shortcut</em></p>

<p align="center">
  <img src="website/screenshots/vfs-spotlight-search.png" alt="Spotlight Search" width="600" />
</p>
<p align="center"><em>Spotlight Search — Press Cmd+K to instantly search files, folders, tags, and AI-powered options</em></p>

---

## 🛠️ Tech Stack

| Layer            | Technology         |
| ---------------- | ------------------ |
| **Desktop App**  | Tauri 2.0 + Rust   |
| **Frontend**     | React + TypeScript |
| **Local AI**     | Ollama + Whisper   |
| **Build System** | Nx Monorepo        |

---

## 🤝 Contributing

We welcome contributions! See our [documentation](./agents.md) for architecture details.

```bash
git clone https://github.com/stonyp90/Ursly.git
cd ursly && npm install
cd apps/vfs-desktop && npm run tauri dev
```

---

## 🗺️ Roadmap

- [ ] Adobe Premiere Pro plugin
- [ ] DaVinci Resolve integration
- [ ] VS Code extension
- [ ] Real-time collaboration
- [ ] Team workspaces

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
