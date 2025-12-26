# Ursly VFS Documentation

A cloud-native virtual file system built with Rust and Tauri. Unify all your storage in one beautiful, native app.

> **Documentation Rule**: This project maintains a single `vfs.md` file for all VFS-related documentation.

---

## Related Projects & Inspiration

| Project      | Description                         | Link                                          |
| ------------ | ----------------------------------- | --------------------------------------------- |
| **rclone**   | Command-line program to sync files  | [GitHub](https://github.com/rclone/rclone)    |
| **Mountain** | Mount cloud storage as local drives | [Website](https://mountainduck.io/)           |
| **RaiDrive** | Network drive mapping tool          | [Website](https://www.raidrive.com/)          |
| **Tauri**    | Build smaller, faster desktop apps  | [GitHub](https://github.com/tauri-apps/tauri) |
| **OpenDAL**  | Universal data access layer         | [GitHub](https://github.com/apache/opendal)   |

---

## Architecture Principles

### 1. Clean Architecture (Ports & Adapters)

The VFS follows Clean Architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      VFS Module                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │   Domain    │   │    Ports    │   │  Adapters   │        │
│  │  entities   │   │  (traits)   │   │ (concrete)  │        │
│  │  values     │   │ IStorage    │   │ S3Adapter   │        │
│  │  events     │   │ ICache      │   │ LocalAdapter│        │
│  └─────────────┘   └─────────────┘   └─────────────┘        │
│           │               ▲                 │                │
│           └───────────────┼─────────────────┘                │
│                           │                                  │
│                  ┌────────┴────────┐                         │
│                  │   Application   │                         │
│                  │   (use cases)   │                         │
│                  └─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

**Layers:**

- **Domain**: Core business entities (`StorageSource`, `VirtualFile`, `StorageTier`)
- **Ports**: Abstract interfaces (`StorageAdapter`, `CacheAdapter`, `IFileOperations`)
- **Adapters**: Concrete implementations (`S3Adapter`, `AzureAdapter`, `LocalStorageAdapter`)
- **Application**: Use cases (`VfsService`, business logic)
- **Infrastructure**: Tauri commands, FUSE filesystem (optional)

### 2. Tauri 2.0 + Rust Backend

- **Native Performance**: Rust backend for file operations
- **Small Bundle Size**: ~10MB vs 100MB+ Electron apps
- **Security**: Built-in security features, no Node.js runtime
- **Cross-Platform**: macOS, Windows, Linux support

### 3. React + TypeScript Frontend

- **Modern UI**: React 18 with TypeScript
- **Component-Based**: Reusable, testable components
- **Theme System**: Dark/light themes with CSS variables
- **Keyboard-First**: Full keyboard navigation support

### 4. Nx Monorepo

- **Unified Codebase**: VFS desktop app and website in one repo
- **Shared Config**: Common TypeScript, ESLint, Jest configs
- **Affected Commands**: Only rebuild/test what changed
- **Dependency Graph**: Visual understanding of project relationships

---

## Core Features

### Multi-Cloud Storage Support

Connect to 15+ storage backends:

| Provider                | Status | Features                 |
| ----------------------- | ------ | ------------------------ |
| **AWS S3**              | ✅     | Standard, Glacier tiers  |
| **Azure Blob**          | ✅     | Hot, Cool, Archive tiers |
| **Google Cloud**        | ✅     | Standard, Nearline, Cold |
| **FSx for ONTAP**       | ✅     | NVMe cache support       |
| **Local Storage**       | ✅     | Native file system       |
| **SMB/CIFS**            | ✅     | Network shares           |
| **NFS**                 | ✅     | Network file system      |
| **SFTP**                | ✅     | Secure file transfer     |
| **WebDAV**              | ✅     | Web-based file access    |
| **Dropbox**             | 🔄     | Cloud storage            |
| **Google Drive**        | 🔄     | Cloud storage            |
| **OneDrive**            | 🔄     | Cloud storage            |
| **Backblaze B2**        | 🔄     | Object storage           |
| **MinIO**               | 🔄     | S3-compatible storage    |
| **Wasabi**              | 🔄     | Hot cloud storage        |
| **DigitalOcean Spaces** | 🔄     | S3-compatible storage    |

### Spotlight Search

Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) for instant search:

- **Operators**: `tag:`, `type:`, `ext:`, `size:`
- **Keyboard Navigation**: Arrow keys, Enter, Tab, Escape
- **Recent Searches**: Persisted in localStorage
- **File & Folder Results**: Unified search across all storage

### System Performance Monitor

Real-time metrics dashboard:

- **CPU**: Per-core usage, load averages
- **Memory**: RAM, Swap usage
- **GPU**: Temperature, power, fan speed, core clock
- **Disk I/O**: Read/write speeds
- **Network**: Upload/download speeds
- **Alert Thresholds**: Customizable warnings

### Keyboard Shortcuts

Every action has a shortcut:

| Category       | Shortcut          | Action              |
| -------------- | ----------------- | ------------------- |
| **Navigation** | `⌘+[` / `⌘+]`     | Go back/forward     |
|                | `⌘+↑`             | Go to parent folder |
|                | `Enter`           | Open selected       |
|                | `↑↓←→`            | Navigate files      |
| **Selection**  | `⌘+A`             | Select all          |
|                | `⌘+Click`         | Toggle selection    |
|                | `Shift+Click`     | Range select        |
|                | `Escape`          | Clear selection     |
| **Clipboard**  | `⌘+C` / `⌘+V`     | Copy/Paste          |
|                | `⌘+D`             | Duplicate           |
| **File Ops**   | `⌘+Shift+N`       | New folder          |
|                | `Enter` (on file) | Rename              |
|                | `⌘+Delete`        | Move to Trash       |
|                | `Delete`          | Delete permanently  |
| **Search**     | `⌘+K` / `Ctrl+K`  | Spotlight Search    |
|                | `?`               | Show shortcuts      |

### Onboarding Tour

Interactive tour guides new users through:

1. **Search**: Spotlight Search functionality
2. **Metrics**: System performance monitoring
3. **Shortcuts**: Keyboard shortcuts overview
4. **Favorites**: Managing favorite locations
5. **Asset Management**: File operations and tags

### Auto-Updates

Seamless updates with progress tracking:

- **Tauri Updater**: Built-in update mechanism
- **Progress Bar**: Visual feedback during updates
- **Background Updates**: Check for updates automatically
- **Version Management**: Semantic versioning

---

## Deployment Modes

### Cloud GPU Mode

Windows Server 2025 with GPU support:

- **Storage**: FSx ONTAP mounted, NVMe cache
- **Use Case**: Video editing, rendering, ML training
- **Performance**: Sub-millisecond I/O, full data access

### Workstation Mode

Local machine with LucidLink:

- **Storage**: Local SSD + LucidLink mount
- **Use Case**: Daily editing, local work
- **Performance**: Fast local access + cloud sync

### Browser-Only Mode

API-based access without local mounts:

- **Storage**: Elasticsearch metadata, API thumbnails
- **Use Case**: Review, approval, asset discovery
- **Features**: Search, preview, download via API

---

## Storage Tiers

| Tier         | Provider              | Retrieval Time   | Metadata     | Cost     |
| ------------ | --------------------- | ---------------- | ------------ | -------- |
| **Hot**      | FSx ONTAP             | Instant (sub-ms) | Full         | $$$$$    |
| **Nearline** | FSxN S3 (Fabric Pool) | 1-5 seconds      | Full (local) | $$       |
| **Cold**     | S3 Glacier Instant    | Instant          | Full (API)   | $        |
| **Archive**  | S3 Glacier Deep       | 12-48 hours      | Full (API)   | Cheapest |

---

## Development Setup

### Prerequisites

- **Node.js**: 24.x
- **Rust**: 1.70+
- **Tauri CLI**: `npm install -g @tauri-apps/cli`
- **Platform Tools**:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools
  - **Linux**: `libwebkit2gtk-4.0-dev`, `libssl-dev`, `libayatana-appindicator3-dev`

### Quick Start

```bash
# Clone repository
git clone https://github.com/stonyp90/Ursly.git
cd Ursly

# Install dependencies
npm install

# Run development server
cd apps/vfs-desktop
npm run tauri:dev
```

### Build for Production

```bash
# Build for current platform
npm run tauri:build

# Build for all platforms (requires CI/CD)
npm run build:all
```

### Testing

```bash
# Run all tests
npm test

# Run tests for VFS desktop only
nx test vfs-desktop

# Run linting
npm run lint
```

---

## File Structure

```
apps/vfs-desktop/
├── src/                          # React frontend
│   ├── components/              # UI components
│   │   ├── SpotlightSearch/     # Search overlay
│   │   ├── MetricsPanel/         # System metrics
│   │   ├── KeyboardShortcutHelper/ # Shortcuts dialog
│   │   └── ...
│   ├── pages/                    # Page components
│   │   ├── FinderPage.tsx        # Main file browser
│   │   └── MetricsPage.tsx      # Metrics dashboard
│   ├── services/                 # Frontend services
│   ├── hooks/                    # React hooks
│   └── styles/                   # CSS files
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── vfs/                  # VFS core
│   │   │   ├── domain/           # Entities, value objects
│   │   │   ├── ports/           # Trait definitions
│   │   │   ├── adapters/        # Storage implementations
│   │   │   ├── application/     # Use cases
│   │   │   └── infrastructure/  # Tauri commands
│   │   ├── commands.rs           # Tauri command handlers
│   │   ├── system.rs             # System info collection
│   │   └── gpu.rs                # GPU metrics
│   └── Cargo.toml                # Rust dependencies
└── package.json                  # Node.js dependencies
```

---

## File Separation Standard

| Type   | Location                       |
| ------ | ------------------------------ |
| Styles | `.css`, `.module.css` files    |
| Logic  | `.ts` or `.tsx` files          |
| Tests  | `.spec.ts` or `.test.ts` files |

#### File Naming Convention

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.css
├── ComponentName.spec.tsx
└── index.ts
```

---

## Unit Testing

Every new code file must have a corresponding test file.

| Layer          | What to Test                                    |
| -------------- | ----------------------------------------------- |
| **Services**   | Business logic, method behavior, error handling |
| **Components** | Rendering, user interactions, state changes     |
| **Hooks**      | State management, side effects                  |
| **Commands**   | Tauri command handlers, validation              |

---

## Tech Stack

### Core

| Technology | Version | Purpose               |
| ---------- | ------- | --------------------- |
| Node.js    | 24.x    | Runtime               |
| Rust       | 1.70+   | Backend               |
| Tauri      | 2.0     | Desktop framework     |
| React      | 18.2.0  | Frontend framework    |
| TypeScript | ~5.3.3  | Type-safe JavaScript  |
| Nx         | ^18.0.0 | Monorepo build system |
| Vite       | ^5.0.10 | Bundler               |

### Storage & File Operations

| Technology | Version | Purpose           |
| ---------- | ------- | ----------------- |
| OpenDAL    | 0.45    | Universal storage |
| Tokio      | 1.x     | Async runtime     |
| Serde      | 1.x     | Serialization     |

### UI & Styling

| Technology    | Version  | Purpose           |
| ------------- | -------- | ----------------- |
| Tailwind CSS  | ^3.4.0   | Utility-first CSS |
| Lucide React  | ^0.303.0 | Icons             |
| React Joyride | ^2.x     | Onboarding tours  |

### Testing & Development

| Technology            | Version | Purpose           |
| --------------------- | ------- | ----------------- |
| Jest                  | ^29.7.0 | Unit testing      |
| React Testing Library | ^14.x   | Component testing |
| ESLint                | ^8.x    | Code linting      |

---

## Contributing

### Code Style

- **Rust**: Follow `rustfmt` defaults
- **TypeScript**: Follow ESLint rules, use Prettier
- **CSS**: Use Tailwind utilities, CSS variables for theming
- **Commits**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run tests and linting (`npm test && npm run lint`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Adding a New Storage Backend

1. Implement `StorageAdapter` trait in `src-tauri/src/vfs/adapters/`
2. Add configuration schema in `src-tauri/src/vfs/domain/`
3. Register adapter in `VfsService`
4. Add UI for configuration in `src/components/AddStorageModal/`
5. Write tests for the adapter
6. Update documentation

---

## License

**AGPL-3.0** — Free for personal use. See [LICENSE](LICENSE) for details.

---

## Resources

- **Website**: [ursly.io](https://ursly.io)
- **GitHub**: [github.com/stonyp90/Ursly](https://github.com/stonyp90/Ursly)
- **Issues**: [Report a bug](https://github.com/stonyp90/Ursly/issues/new)
- **Releases**: [Download latest](https://github.com/stonyp90/Ursly/releases/latest)

---

**Built with ❤️ by [Anthony Paquet](https://www.linkedin.com/in/anthony-paquet-94a31085/)**
