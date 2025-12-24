# Ursly.io

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange?logo=rust)](https://www.rust-lang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-e0234e?logo=nestjs)](https://nestjs.com/)

**AI Agent Orchestration Platform** — Build, deploy, and manage intelligent agents with automatic context management, enterprise security, and a **cloud-agnostic virtual file system** for seamless media asset management across any provider, OS, and storage type.

---

## What is Ursly.io?

Ursly.io is an open-source platform for orchestrating AI agents at scale. It provides:

- **Agent Lifecycle Management** — Create agents with custom prompts, control execution, monitor context windows
- **Multi-Model Support** — LLaMA 3.x, Mistral, CodeLlama, Phi3, Gemma, Qwen via Ollama
- **Cloud-Agnostic Virtual File System** — OS-independent Rust vFS with unified access to AWS S3, Google Cloud Storage, Azure Blob Storage, on-premise NAS, and local storage—seamlessly share media assets across any cloud provider
- **Enterprise Security** — RBAC, granular permissions, multi-org support with Keycloak OIDC
- **Native Desktop App** — Tauri-powered with GPU monitoring and cyberpunk-themed file browser

---

## Tech Stack

| Layer        | Technologies                                     |
| ------------ | ------------------------------------------------ |
| **Backend**  | NestJS · TypeScript · MongoDB · gRPC · WebSocket |
| **Frontend** | React · MUI · Tailwind CSS · Vite                |
| **Desktop**  | Tauri · Rust · Native GPU APIs                   |
| **AI/ML**    | Ollama · LLaMA 3.x · Mistral · Phi3              |
| **Auth**     | Keycloak · OIDC · JWT                            |
| **Infra**    | Docker · Nx Monorepo                             |

---

## Quick Start

```bash
git clone https://github.com/stonyp90/ursly.git
cd ursly

cp env.example .env
npm install
docker-compose up -d
npm run dev
```

| Service | Port  |
| ------- | ----- |
| Web UI  | 4200  |
| API     | 3000  |
| gRPC    | 50051 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Web UI / Desktop App (Tauri + Rust)            │
├─────────────────────────────────────────────────────────────┤
│                    API Gateway (NestJS)                     │
├──────────────┬──────────────┬───────────────────────────────┤
│ Agent Engine │ Audit Logger │ Entitlements (RBAC)           │
├──────────────┴──────────────┴───────────────────────────────┤
│                  gRPC Service → Ollama                      │
├─────────────────────────────────────────────────────────────┤
│              Keycloak (Identity) │ MongoDB (Data)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Cloud-Agnostic Virtual File System

Ursly's Rust-based vFS is **fully OS-agnostic** and works seamlessly across:

| Storage Type             | Support   | Features                                       |
| ------------------------ | --------- | ---------------------------------------------- |
| **AWS S3**               | ✅ Native | Real-time sync, versioning, lifecycle policies |
| **Google Cloud Storage** | ✅ Native | Multi-region redundancy, bucket policies       |
| **Azure Blob Storage**   | ✅ Native | Hot/cool/archive tiers, managed identities     |
| **On-Premise NAS**       | ✅ Native | SMB/NFS, local network optimization            |
| **Local Storage**        | ✅ Native | Direct filesystem access with caching          |

**Key Capabilities:**

- Unified namespace across all storage backends
- Automatic failover and replication
- Media asset transcoding on-the-fly
- Compression and intelligent tiering
- Role-based access per storage location
- Zero vendor lock-in

---

## Project Structure

```
apps/
  api/        # NestJS REST API
  web/        # React frontend
  grpc/       # Ollama gRPC bridge
  desktop/    # Tauri desktop app

libs/
  agent-core/           # Context window management
  audit-logger/         # Type-safe logging
  shared/types/         # Zod schemas & types
  shared/access-control # Permissions engine
```

---

## Development

```bash
npm run dev          # Start all services
npm test             # Run tests (150+ JS, 163 Rust)
npm run lint         # Lint codebase
npm run build        # Production build

# Desktop
cd apps/desktop
npm run tauri dev    # Dev mode
npm run tauri build  # Build release
```

---

## Deployment

### API & Services

Run locally or self-host anywhere that supports Docker:

```bash
docker-compose up -d
```

### Website (S3 + CloudFront)

Deploy the website to AWS S3 + CloudFront for global CDN distribution:

**Secure Setup (Recommended):**

1. **Configure AWS Credentials** (stored locally, not in git):

   ```bash
   aws configure
   # Follow prompts to enter AWS Access Key ID and Secret Access Key
   # These are stored in ~/.aws/credentials
   ```

2. **Set Deployment Variables**:

   ```bash
   cd website

   # Create .env.deploy with your S3 bucket and CloudFront distribution ID
   # See DEPLOY_ENV_TEMPLATE.txt for template
   cat > .env.deploy << 'EOF'
   S3_BUCKET=your-ursly-bucket
   CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id
   AWS_REGION=us-east-1
   EOF
   ```

3. **Deploy**:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

**Full Setup Instructions:**
See [DEPLOYMENT_AWS.md](./DEPLOYMENT_AWS.md) for comprehensive AWS infrastructure setup, including:

- IAM user creation
- S3 bucket configuration
- CloudFront distribution setup
- GitHub Actions CI/CD workflow
- Security best practices
- Monitoring and rollback procedures

⚠️ **Security Note**: Never commit `.env.deploy` file. AWS credentials should be stored locally in `~/.aws/credentials` or as GitHub Secrets for CI/CD.

---

## Contributing

1. Fork → Branch → Code → Test → PR
2. All code requires tests
3. Follow existing style (ESLint + Prettier)

---

## License

MIT — See [LICENSE](LICENSE)

---

<p align="center">
  <strong>Build the future of AI agents</strong>
</p>
