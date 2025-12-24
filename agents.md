# Ursly.io Agent Orchestrator

A clean architecture AI agent orchestration platform built with modern technologies.

> **Documentation Rule**: This project maintains a single `agents.md` file for all documentation.

---

## Related Projects & Inspiration

| Project       | Description                                        | Link                                                      |
| ------------- | -------------------------------------------------- | --------------------------------------------------------- |
| **Botpress**  | Open-source hub to build & deploy GPT/LLM Agents   | [GitHub](https://github.com/botpress/botpress)            |
| **LangChain** | Framework for developing LLM-powered applications  | [GitHub](https://github.com/langchain-ai/langchain)       |
| **AutoGPT**   | Autonomous AI agent framework                      | [GitHub](https://github.com/Significant-Gravitas/AutoGPT) |
| **CrewAI**    | Framework for orchestrating role-playing AI agents | [GitHub](https://github.com/joaomdmoura/crewAI)           |
| **Dify**      | LLM app development platform with visual workflows | [GitHub](https://github.com/langgenius/dify)              |
| **Flowise**   | Drag & drop UI to build LLM flows                  | [GitHub](https://github.com/FlowiseAI/Flowise)            |

---

## Best Practices & Architecture Principles

### 1. Domain-Driven Design (DDD)

- **Bounded Contexts**: Clear separation between domains (agents, tasks, audit, models)
- **Entities & Value Objects**: Rich domain models with business logic encapsulation
- **Domain Events**: Event-driven communication between bounded contexts
- **Ubiquitous Language**: Consistent terminology across code, docs, and team communication

### 2. Clean Architecture (Ports & Adapters)

- **Ports**: Abstract interfaces defining contracts (`IAgentRepository`, `IOllamaService`)
- **Adapters**: Concrete implementations (`AgentRepositoryAdapter` for MongoDB)
- **Use Cases**: Single-responsibility business logic classes
- **Dependency Inversion**: Core business logic has no external dependencies

### 3. Nx Monorepo

- **Unified Codebase**: All apps and libs in single repository
- **Shared Libraries**: Reusable code in `libs/` (`@ursly/shared-types`, `@ursly/agent-core`)
- **Affected Commands**: Only rebuild/test what changed
- **Dependency Graph**: Visual understanding of project relationships

### 4. [MUI (Material UI)](https://mui.com/) React Components

- **Production-Ready**: Comprehensive component library
- **Accessibility**: WCAG-compliant components
- **Theming**: Custom dark theme with Ursly.io brand colors

### 5. Tailwind CSS & CSS Variables

- **Utility-First**: Rapid UI development with utility classes
- **CSS Variables**: Design tokens for consistent theming
- **JIT Mode**: On-demand CSS generation for minimal bundle size

### 6. Serverless & Stateless Architecture

- **Stateless Services**: No server-side session storage
- **JWT Authentication**: Token-based auth with Keycloak OIDC
- **Horizontal Scaling**: Any instance can handle any request
- **Container-Ready**: Docker images with health checks

### 7. Real-Time Architecture with WebSockets

- **Bidirectional Communication**: Push updates to clients instantly via Socket.io
- **Entity-Scoped Subscriptions**: Subscribe to specific agents, models, tasks
- **Organization-Scoped Broadcasting**: Events scoped to organization context
- **Reconnection**: Automatic reconnection with exponential backoff

### 8. File Separation Standard

| Type   | Location                             |
| ------ | ------------------------------------ |
| Styles | `.css`, `.scss`, `.module.css` files |
| Logic  | `.ts` or `.tsx` files                |
| Tests  | `.spec.ts` or `.test.ts` files       |

#### File Naming Convention

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.module.css
├── ComponentName.spec.tsx
└── index.ts
```

### 9. Unit Testing

Every new code file must have a corresponding test file.

| Layer           | What to Test                                    |
| --------------- | ----------------------------------------------- |
| **Services**    | Business logic, method behavior, error handling |
| **Controllers** | Request/response handling, validation           |
| **Use Cases**   | Business workflow, validation, side effects     |
| **Components**  | Rendering, user interactions, state changes     |
| **Hooks**       | State management, side effects                  |

---

## Tech Stack

### Core

| Technology | Version | Purpose               |
| ---------- | ------- | --------------------- |
| Node.js    | 24.x    | Runtime               |
| NestJS     | ^10.3.0 | Backend framework     |
| React      | ^18.2.0 | Frontend framework    |
| TypeScript | ~5.3.3  | Type-safe JavaScript  |
| Nx         | ^18.0.0 | Monorepo build system |
| Vite       | ^5.0.10 | Bundler               |

### Database & Validation

| Technology | Version | Purpose           |
| ---------- | ------- | ----------------- |
| MongoDB    | 7       | Document database |
| Mongoose   | ^8.0.3  | MongoDB ODM       |
| Zod        | ^3.22.4 | Schema validation |

### Authentication

| Technology   | Version | Purpose                   |
| ------------ | ------- | ------------------------- |
| Keycloak     | 23.0    | Identity provider         |
| Passport     | ^0.7.0  | Authentication middleware |
| passport-jwt | ^4.0.1  | JWT strategy              |

### Communication

| Technology    | Version | Purpose             |
| ------------- | ------- | ------------------- |
| Socket.io     | ^4.6.0  | Real-time WebSocket |
| @grpc/grpc-js | ^1.9.14 | gRPC communication  |
| Axios         | ^1.6.2  | HTTP client         |

### UI

| Technology   | Version  | Purpose             |
| ------------ | -------- | ------------------- |
| Tailwind CSS | ^3.4.0   | Utility-first CSS   |
| MUI          | ^6.x     | React UI components |
| Lucide React | ^0.303.0 | Icons               |

### Testing & Development

| Technology  | Version | Purpose             |
| ----------- | ------- | ------------------- |
| Jest        | ^29.7.0 | Unit testing        |
| Husky       | ^9.x    | Git hooks           |
| lint-staged | ^16.x   | Staged file linting |

---

## Domain Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           URSLY.IO AGENT PLATFORM                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  CONVERSATION   │  │  TASK EXECUTION │  │  KNOWLEDGE      │             │
│  │  DOMAIN         │  │  DOMAIN         │  │  DOMAIN         │             │
│  │  • Chat Agents  │  │  • Workers      │  │  • RAG Agents   │             │
│  │  • Context Mgmt │  │  • Pipelines    │  │  • Embeddings   │             │
│  │  • Memory       │  │  • Scheduling   │  │  • Vector Store │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────▼───────────┐                                │
│                    │    EVENT BUS          │                                │
│                    │  (Domain Events)      │                                │
│                    └───────────┬───────────┘                                │
│                                │                                            │
│  ┌─────────────────┐  ┌───────▼─────────┐  ┌─────────────────┐             │
│  │  INTEGRATION    │  │  ORCHESTRATION  │  │  AUDIT          │             │
│  │  • Connectors   │  │  • Workflows    │  │  • Logging      │             │
│  │  • Webhooks     │  │  • Coordination │  │  • Compliance   │             │
│  │  • External APIs│  │  • Multi-Agent  │  │  • Analytics    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Domain Structure

```
libs/domains/
├── conversation/
│   ├── src/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── events/
│   │   │   └── repositories/
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   ├── queries/
│   │   │   └── handlers/
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   └── messaging/
│   │   └── presentation/
│   └── index.ts
├── task-execution/
├── knowledge/
├── integration/
├── orchestration/
└── audit/
```

### Decoupling Principles

Domains communicate via **domain events**, never direct method calls:

```typescript
@Injectable()
export class SendMessageHandler {
  constructor(private eventBus: EventBus) {}

  async execute(command: SendMessageCommand) {
    const message = await this.saveMessage(command);
    await this.eventBus.publish(
      new MessageSentEvent({
        conversationId: command.conversationId,
        messageId: message.id,
        agentId: command.agentId,
        tokenCount: message.tokenCount,
      }),
    );
  }
}
```

---

## Entitlement-Based Authorization

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Keycloak   │  │ Azure AD    │  │  Citadelle  │  │  Any OIDC   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         └─────────────────┼─────────────────┼─────────────────┘          │
│                    JWT Token + Email                                      │
└───────────────────────────┼───────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHORIZATION LAYER                              │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐           │
│  │  PERMISSIONS   │   │    GROUPS      │   │ USER ENTITLEMENTS│          │
│  │ agents:create  │──▶│  Admin         │◀──│  user@ursly.io  │          │
│  │ agents:read    │   │  Developer     │   │  └─ Admin       │          │
│  │ models:read    │   │  Viewer        │   │                 │          │
│  └────────────────┘   └────────────────┘   └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Permission Format

```
<resource>:<action>

agents:create    - Create new AI agents
agents:read      - View agent details
agents:update    - Modify agent settings
agents:delete    - Delete agents
agents:execute   - Start/stop/interact with agents
models:read      - View available models
tasks:manage     - Full task management
```

### System Groups

| Group         | Description       | Key Permissions                   |
| ------------- | ----------------- | --------------------------------- |
| **Admin**     | Full access       | All permissions                   |
| **Developer** | Create and manage | `agents:*`, `models:*`, `tasks:*` |
| **Operator**  | Execute and view  | `agents:read`, `agents:execute`   |
| **Viewer**    | Read-only         | `*:read`                          |

### Guard Usage

```typescript
@RequirePermissions('agents:create', 'agents:update')
@Get('my-endpoint')
async myEndpoint() { ... }

@RequireAllPermissions('groups:update', 'groups:assign')
@Post('assign-group')
async assignGroup() { ... }

@SkipEntitlementCheck()
@Get('public-info')
async publicInfo() { ... }
```

---

## Access Control Models

| Model     | Description                       | Use Case                       |
| --------- | --------------------------------- | ------------------------------ |
| **RBAC**  | Role-Based Access Control         | Standard role assignments      |
| **ABAC**  | Attribute-Based Access Control    | Context-aware decisions        |
| **ReBAC** | Relationship-Based Access Control | Social graph relationships     |
| **JIT**   | Just-In-Time Access               | Temporary elevated permissions |
| **JEA**   | Just Enough Access                | Minimal permissions for task   |

---

## Novu Notifications

| Template ID            | Channel       | Purpose               |
| ---------------------- | ------------- | --------------------- |
| `agent-status-changed` | In-App, Email | Agent started/stopped |
| `agent-created`        | In-App        | New agent created     |
| `task-completed`       | In-App, Email | Task finished         |
| `access-granted`       | In-App, Email | User added to group   |
| `security-alert`       | In-App, Email | Suspicious activity   |

---

## Real-Time Events

| Event Type       | Description        |
| ---------------- | ------------------ |
| `created`        | New entity created |
| `updated`        | Entity modified    |
| `deleted`        | Entity removed     |
| `status_changed` | Status transition  |
| `progress`       | Progress update    |
| `stream`         | Streaming data     |

### Subscription Scopes

| Scope         | Room Pattern  | Use Case                     |
| ------------- | ------------- | ---------------------------- |
| Single Entity | `agent:{id}`  | Track specific agent         |
| All of Type   | `agent:all`   | Dashboard showing all agents |
| Organization  | `org:{orgId}` | All events in organization   |

---

## Project Architecture

```
apps/api/src/
├── application/
│   ├── ports/
│   └── use-cases/
├── infrastructure/
│   ├── adapters/
│   └── openapi/
├── domain/
└── agents/
```

### Ports & Adapters

```typescript
export interface IAgentRepository {
  create(dto: CreateAgentDto, createdBy: string): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
}
export const AGENT_REPOSITORY = Symbol('IAgentRepository');

@Injectable()
export class AgentRepositoryAdapter implements IAgentRepository {
  constructor(
    @InjectModel('Agent') private readonly agentModel: Model<AgentDocument>,
  ) {}

  async create(dto: CreateAgentDto, createdBy: string): Promise<Agent> {
    // MongoDB implementation
  }
}
```

---

## Context Window Management

The `@ursly/agent-core` library provides automatic context window management:

| Model           | Max Context |
| --------------- | ----------- |
| llama3          | 8,192       |
| llama3.1/3.2    | 131,072     |
| mistral/mixtral | 32,768      |
| codellama       | 16,384      |
| phi3            | 128,000     |
| qwen            | 32,768      |

```typescript
import { ContextWindowManager } from '@ursly/agent-core';

const manager = new ContextWindowManager();

manager.createWindow('agent-123', {
  maxTokens: 8192,
  thresholdPercent: 80,
  modelName: 'llama3',
});

if (manager.shouldRotate('agent-123')) {
  await manager.rotateWindow('agent-123');
}
```

---

## Virtual File System (VFS) Architecture

The Ursly Desktop app provides a unified file management experience across three deployment modes:

### Deployment Modes

| Mode             | Description                  | Storage Access                         | Use Case                              |
| ---------------- | ---------------------------- | -------------------------------------- | ------------------------------------- |
| **Cloud GPU**    | Windows Server 2025 with GPU | FSx ONTAP mounted, NVMe cache          | Video editing, rendering, ML training |
| **Workstation**  | Local machine with LucidLink | Local SSD + LucidLink mount            | Daily editing, local work             |
| **Browser Only** | API-based access             | Elasticsearch metadata, API thumbnails | Review, approval, asset discovery     |

### Storage Tiers (AWS Configuration)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE TIER ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │      HOT        │  │    NEARLINE     │  │      COLD       │             │
│  │   FSx ONTAP     │  │    FSxN S3      │  │  S3 Glacier IR  │             │
│  │  (NVMe/SSD)     │  │  (Fabric Pool)  │  │  (Instant Ret)  │             │
│  │                 │  │                 │  │                 │             │
│  │  - Sub-ms I/O   │  │  - Metadata     │  │  - Metadata     │             │
│  │  - Full data    │  │    accessible   │  │    accessible   │             │
│  │  - Edit ready   │  │  - Data in S3   │  │  - Low cost     │             │
│  │  - $$$$         │  │  - $$           │  │  - $            │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────▼───────────┐                                │
│                    │    NVMe LOCAL CACHE   │                                │
│                    │  (Windows Server 2025)│                                │
│                    │  - LRU eviction       │                                │
│                    │  - Read-ahead         │                                │
│                    │  - Write-behind       │                                │
│                    └───────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tier Characteristics

| Tier         | Provider              | Retrieval Time   | Metadata     | Cost     |
| ------------ | --------------------- | ---------------- | ------------ | -------- |
| **Hot**      | FSx ONTAP             | Instant (sub-ms) | Full         | $$$$$    |
| **Nearline** | FSxN S3 (Fabric Pool) | 1-5 seconds      | Full (local) | $$       |
| **Cold**     | S3 Glacier Instant    | Instant          | Full (API)   | $        |
| **Archive**  | S3 Glacier Deep       | 12-48 hours      | Full (API)   | Cheapest |

### NVMe Cache Strategy

```typescript
// Windows Server 2025 NVMe optimization
const cacheConfig: NvmeCacheConfig = {
  cachePath: 'D:\\UrslyCache',
  maxSizeBytes: 500 * 1024 * 1024 * 1024, // 500 GB
  evictionPolicy: 'lru',
  enableReadAhead: true,
  readAheadBytes: 256 * 1024 * 1024,
  enableWriteBehind: true,
  accessRecencyWeight: 0.7,
  accessFrequencyWeight: 0.3,
};
```

### Browser-Only Mode (API Access)

For users without local mounts, the API provides:

| Feature             | Endpoint                     | Description                              |
| ------------------- | ---------------------------- | ---------------------------------------- |
| **Metadata Search** | `POST /api/vfs/search`       | Elasticsearch-backed full-text search    |
| **Thumbnails**      | `GET /api/vfs/thumbnail/:id` | Generated thumbnails (photo, video, PDF) |
| **Video Preview**   | `GET /api/vfs/stream/:id`    | HLS transcoded proxy for playback        |
| **Download**        | `GET /api/vfs/download/:id`  | Presigned URL for full file download     |
| **Tagging**         | `POST /api/vfs/tag`          | Apply tags across any storage tier       |

### Unified Tagging System

Tags are stored in Elasticsearch and apply across all storage sources:

```typescript
// Tag a file regardless of storage tier
await api.tagFile({
  sourceId: 'fsx-ontap-prod',
  path: '/projects/commercial/final_v3.mov',
  tags: ['approved', 'client-acme', '2024-q4'],
});

// Search by tag (searches metadata, not file content)
const results = await api.search({
  filters: { tags: ['approved', 'client-acme'] },
  includeAggregations: true,
});
```

### Future API Compatibility

This architecture is designed for v2 API compatibility. The TypeScript interfaces in `apps/desktop/src/types/storage.ts` define:

- `DeploymentMode` - Three deployment modes
- `NvmeCacheConfig` - NVMe cache settings
- `MetadataSourceConfig` - Elasticsearch configuration
- `ApiSearchRequest` / `ApiFileListResponse` - Search API contracts
- `ApiStreamResponse` - Video streaming API

---

## Quick Start

```bash
docker-compose up -d
npm test
npm run start:api
npm run start:web
```

## Service Ports

| Service  | Port  |
| -------- | ----- |
| Web UI   | 4200  |
| API      | 3000  |
| gRPC     | 50051 |
| Keycloak | 8080  |
| MongoDB  | 27017 |
| Ollama   | 11434 |
