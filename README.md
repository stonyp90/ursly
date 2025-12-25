<div align="center">

# Ursly.io

**AI Agent Orchestration Platform with Cloud-Agnostic Virtual File System**

[![Website](https://img.shields.io/badge/Website-ursly.io-00ff88?style=flat&logo=safari)](https://ursly.io)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange?logo=rust)](https://www.rust-lang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-e0234e?logo=nestjs)](https://nestjs.com/)
[![Nx](https://img.shields.io/badge/Nx-18.x-143055?logo=nx)](https://nx.dev/)

[🌐 Website](https://ursly.io) · [Demo](https://app.ursly.io) · [Documentation](./agents.md) · [Report Bug](https://github.com/stonyp90/ursly/issues)

</div>

---

## Overview

Ursly.io is an open-source platform for orchestrating AI agents with enterprise-grade security and a unified virtual file system that works across any cloud provider.

### Key Features

- **Agent Lifecycle Management** — Create, deploy, and monitor AI agents with automatic context window management
- **Multi-Model Support** — LLaMA 3.x, Mistral, CodeLlama, Phi3, Gemma, Qwen via Ollama
- **Cloud-Agnostic VFS** — Unified access to S3, GCS, Azure, NAS, and local storage
- **Enterprise Security** — RBAC, granular permissions, multi-org support with Keycloak OIDC
- **Real-time Metrics** — GPU/CPU monitoring with native Rust APIs

---

## Desktop Applications

Two native desktop apps built with Tauri and Rust, each focused on a distinct use case:

| App             | Description            | Features                                                               |
| --------------- | ---------------------- | ---------------------------------------------------------------------- |
| **Ursly Agent** | AI agent orchestration | Agent management, model control, GPU metrics, performance monitoring   |
| **Ursly VFS**   | Virtual file system    | Finder-style browser, multi-tier storage, file operations, GPU metrics |

### Architecture Separation

- **Agent Desktop** — Embeds the web app for AI/agent features. Storage/File System section is hidden.
- **VFS Desktop** — Dedicated file browser with native Rust VFS operations. Includes collapsible metrics panel.

Both apps share Keycloak authentication for unified identity management.

---

## Tech Stack

| Layer        | Technologies                                     |
| ------------ | ------------------------------------------------ |
| **Backend**  | NestJS · TypeScript · MongoDB · gRPC · WebSocket |
| **Frontend** | React · MUI · Tailwind CSS · Vite                |
| **Desktop**  | Tauri · Rust · wgpu · Metal/DirectX              |
| **AI/ML**    | Ollama · LLaMA 3.x · Mistral · Phi3              |
| **Auth**     | Keycloak · OIDC · JWT                            |
| **Build**    | Nx Monorepo · Docker                             |

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/stonyp90/ursly.git
cd ursly
npm install

# Start infrastructure
docker-compose up -d

# Run development servers
npm run dev
```

### Service Ports

| Service | Port  |
| ------- | ----- |
| Web UI  | 4200  |
| API     | 3000  |
| gRPC    | 50051 |

---

## Project Structure

```
apps/
├── api/              # NestJS REST API
├── web/              # React web application
├── grpc/             # Ollama gRPC bridge
├── agent-desktop/    # Tauri agent management app
└── vfs-desktop/      # Tauri virtual file system app

libs/
├── agent-core/       # Context window management
├── audit-logger/     # Type-safe logging
└── shared/
    ├── types/        # Zod schemas & types
    └── access-control/ # Permissions engine
```

---

## Development

```bash
# All services
npm run dev

# Individual apps
npm run start:web        # Web UI
npm run start:api        # API server
npm run start:agent      # Agent Desktop (Tauri)
npm run start:vfs        # VFS Desktop (Tauri)

# Testing
npm test                 # Run all tests
npm run lint             # Lint codebase

# Build
npm run build            # Production build
npm run build:agent      # Build Agent Desktop
npm run build:vfs        # Build VFS Desktop
```

---

## Virtual File System

The Rust-based VFS provides unified access across storage providers:

| Storage                  | Features                                       |
| ------------------------ | ---------------------------------------------- |
| **AWS S3**               | Real-time sync, versioning, lifecycle policies |
| **Google Cloud Storage** | Multi-region, bucket policies                  |
| **Azure Blob Storage**   | Hot/cool/archive tiers                         |
| **On-Premise NAS**       | SMB/NFS, local network optimization            |
| **Local Storage**        | Direct filesystem with NVMe caching            |

**Capabilities:**

- Unified namespace across all backends
- Automatic failover and replication
- Media asset transcoding
- Intelligent tiering and hydration
- Role-based access per storage location

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Desktop Apps (Tauri + Rust)                   │
│              ┌─────────────────┬─────────────────┐              │
│              │  Ursly Agent    │    Ursly VFS    │              │
│              │  (Web App +     │  (File Browser  │              │
│              │   GPU Metrics)  │   + Metrics)    │              │
│              └─────────────────┴─────────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                     Web UI (React + MUI)                         │
├─────────────────────────────────────────────────────────────────┤
│                    API Gateway (NestJS)                          │
├──────────────┬──────────────┬───────────────────────────────────┤
│ Agent Engine │ Audit Logger │ Entitlements (RBAC)               │
├──────────────┴──────────────┴───────────────────────────────────┤
│                  gRPC Service → Ollama                           │
├─────────────────────────────────────────────────────────────────┤
│              Keycloak (Identity) │ MongoDB (Data)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Guidelines

- All code requires tests
- Follow existing code style (ESLint + Prettier)
- Update documentation as needed

---

## License

AGPL-3.0 License - see [LICENSE](LICENSE) for details.

This project is licensed under the GNU Affero General Public License v3.0, the same license used by [Spacedrive](https://www.spacedrive.com/). This ensures that the software remains open source and any modifications or network deployments must also be open source.

---

<div align="center">

**[ursly.io](https://ursly.io)** · Built with ❤️ by the Ursly team

</div>
