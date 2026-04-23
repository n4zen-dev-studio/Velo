<a id="top"></a>
# 🚀 Velo — Offline-First Project Management Engine

![React Native](https://img.shields.io/badge/React%20Native-0.76-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green.svg)
![Fastify](https://img.shields.io/badge/Fastify-API-black.svg)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg)
![PostgreSQL](https://img.shields.io/badge/Postgres-15-blue.svg)
![Offline First](https://img.shields.io/badge/Architecture-Offline--First-purple.svg)
![Status](https://img.shields.io/badge/Status-Active-success.svg)


---

<a id="table-of-contents"></a>
## 📖 Table of Contents

- [Executive Summary](#executive-summary)
- [System Architecture](#system-architecture)
- [Architecture Diagrams](#architecture-diagrams)
- [Data Pipeline & Sync Model](#data-pipeline--sync-model)
- [Technical Deep Dive](#technical-deep-dive)
- [Performance & Metrics](#performance--metrics)
- [Developer Experience & Setup](#developer-experience--setup)
- [Visuals & Media](#visuals--media)
- [Why Velo is Different](#why-velo-is-different)
- [Conclusion](#conclusion)
- [License](#license)

---

<a id="executive-summary"></a>
## 🧠 Executive Summary

Modern project management tools assume **constant connectivity**, which introduces latency, failure points, and degraded UX in real-world mobile environments.

**Velo was engineered to solve this problem.**

### Core Problem

* Network dependency → degraded UX
* High-latency operations (task updates, comments)
* Poor offline support → user frustration
* Sync conflicts → inconsistent state

### Solution

Velo implements a **local-first architecture** where:

* All operations execute **instantly on-device**
* Changes are stored as **operation logs (op-based sync)**
* Backend acts as a **synchronization and reconciliation layer**

### Business Impact

* ⚡ **Zero-latency interactions** (local writes)
* 📡 **Resilient offline usage**
* 🔄 **Eventual consistency across devices**
* 📈 Scales from personal use → team collaboration

[⬆ Back to Top](#top)

---

<a id="system-architecture"></a>
## 🏗️ System Architecture

![System Architecture Diagram](docs/architecture.png)

### High-Level Components

```text
Mobile App (React Native)
   ↓
Local Database (Offline-first state)
   ↓
Sync Engine (Op-based queue)
   ↓
Backend API (Fastify)
   ↓
Database (PostgreSQL via Prisma)
````

### Key Architectural Decisions

| Decision             | Rationale                        |
| -------------------- | -------------------------------- |
| Offline-first        | Eliminates network dependency    |
| Operation-based sync | Enables conflict resolution      |
| Fastify backend      | High-performance, low overhead   |
| Prisma ORM           | Type-safe schema management      |
| PostgreSQL           | Strong consistency + scalability |

[⬆ Back to Top](#top)

---

<a id="architecture-diagrams"></a>

## Architecture Diagrams

### Local-first data flow

````mermaid
flowchart TD
  UI[UI] -->|mutate| Repo[Repositories]
  Repo -->|write| SQLite[(SQLite)]
  Repo -->|enqueue| ChangeLog[change_log]
  ChangeLog --> SyncEngine[SyncEngine]
  SyncEngine -->|push| Server[/Sync API/]
````

### Sync push/pull cycle

````mermaid
sequenceDiagram
  participant Client
  participant Server
  Client->>Server: POST /sync (ops, cursor)
  Server->>Server: apply ops + dedupe + log server_changes
  Server-->>Client: ackOpIds + changes + newCursor
  Client->>Client: mark ops SENT
  Client->>Client: apply changes or create conflicts
````

### Conflict resolution flow

````mermaid
flowchart TD
  Change[Incoming server change] --> Check{Local pending or newer?}
  Check -- No --> Apply[Apply to local DB]
  Check -- Yes --> Conflict[Create conflict row]
  Conflict --> Resolve[User resolves]
  Resolve --> Enqueue[Enqueue resolution op]
````

[⬆ Back to Top](#top)

---

<a id="data-pipeline--sync-model"></a>

## 🔄 Data Pipeline & Sync Model

### Core Concept: Operation-Based Sync

Instead of syncing raw state, Velo syncs **intent-based operations**:

````ts
type SyncOperation = {
  id: string
  entity: "task" | "project" | "comment"
  type: "UPSERT" | "DELETE"
  payload: object
  timestamp: number
}
````

### Flow

1. User action → stored locally
2. Operation added to **sync queue**
3. Sync triggered manually or via settings
4. Backend processes operations:

   * Deduplicates (`opId`)
   * Applies mutations
   * Generates server changes
5. Client pulls updates via cursor

### Example Sync Request

````json
{
  "ops": [
    {
      "id": "op_123",
      "entity": "task",
      "type": "UPSERT",
      "payload": {
        "id": "task_1",
        "title": "Fix login bug"
      }
    }
  ],
  "cursor": "abc123"
}
````

### Example Server Response

````json
{
  "ack": ["op_123"],
  "changes": [
    {
      "entity": "task",
      "type": "UPSERT",
      "payload": {
        "id": "task_2",
        "title": "New task from another device"
      }
    }
  ],
  "nextCursor": "abc124"
}
````

[⬆ Back to Top](#top)

---

<a id="technical-deep-dive"></a>

## 🔬 Technical Deep Dive

### 📱 Mobile (React Native)

* React Native `0.76+`
* State management: MobX (multi-store architecture)
* Offline storage:

  * MMKV / AsyncStorage
* Navigation: React Navigation
* UI: Custom glassmorphism system

### ⚙️ Backend

````ts
// Core stack
import Fastify from "fastify"
import { PrismaClient } from "@prisma/client"
````

* **Framework:** Fastify (low overhead, high throughput)
* **ORM:** Prisma (type-safe DB access)
* **Database:** PostgreSQL 15
* **Deployment:** Docker + Caddy reverse proxy

### 🧩 Data Modeling

Entities:

* Users
* Workspaces
* Projects
* Tasks
* Comments
* Workspace Members

Relational structure managed via Prisma schema.

### 🔁 Sync Engine Internals

* Operation queue (client-side)
* Deduplication via `opId`
* Server change log (`serverChange`)
* Cursor-based incremental sync

### 🧠 Conflict Resolution Strategy

* Last-write-wins (timestamp-based)
* Operation idempotency
* Server reconciliation layer

### 📈 Improving Data Integrity

* Strict schema validation
* Optimistic updates with rollback support
* Sync retries with exponential backoff

[⬆ Back to Top](#top)

---

<a id="performance--metrics"></a>

## 📊 Performance & Metrics

### Key Metrics

| Metric              | Value                |
| ------------------- | -------------------- |
| Local write latency | ~0ms (instant)       |
| Sync latency        | <300ms typical       |
| Conflict rate       | Low (op-based model) |
| App startup         | ~1–2s                |

### Testing Strategy

* Unit tests for sync logic
* Integration tests for API routes
* Manual multi-device sync validation

### Example Workflow Benchmark

| Action        | Traditional App | Velo    |
| ------------- | --------------- | ------- |
| Create task   | Network call    | Instant |
| Edit task     | Network call    | Instant |
| Offline usage | Limited         | Full    |

[⬆ Back to Top](#top)

---

<a id="developer-experience--setup"></a>

## 🧑‍💻 Developer Experience & Setup

### 📦 Installation

````bash
git clone https://github.com/yourusername/velo
cd velo
pnpm install
````

### 🖥️ Backend Setup

````bash
cd backend
cp .env.example .env
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
````

### 📱 Mobile Setup

````bash
cd mobile
pnpm start
````

### 🐳 Docker (Production)

````bash
docker compose -f docker-compose.velo.yml up -d
````

### Environment Configuration

````env
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_SECRET=your_secret
````

[⬆ Back to Top](#top)

---

<a id="visuals--media"></a>

## 🎥 Visuals & Media

* 📹 Demo Video: `docs/demo.mp4`
* 🧭 Architecture Diagram: `docs/architecture.png`
* 📊 Sync Flow Diagram: `docs/sync-flow.png`
* 📈 Metrics Dashboard: `docs/performance.png`

[⬆ Back to Top](#top)

---

<a id="why-velo-is-different"></a>

## 🚀 Why Velo is Different

### 1. True Offline-First (Not “Offline Support”)

Most apps degrade offline.

**Velo operates fully offline by design.**

### 2. Operation-Based Sync (Not State Sync)

* More scalable
* Conflict-tolerant
* Efficient over low bandwidth

### 3. Instant UX

* No loading states for core actions
* No blocking network calls

### 4. Production-Grade Architecture

* Typed backend (Prisma)
* Structured sync pipeline
* Containerized deployment

### 5. Designed for Real-World Constraints

* Poor connectivity environments
* Mobile-first workflows
* Distributed teams

[⬆ Back to Top](#top)

---

<a id="conclusion"></a>

## 🔚 Conclusion

Velo demonstrates a **production-grade approach to offline-first application design**, combining:

* Local-first data modeling
* Robust sync architecture
* High-performance backend systems

It showcases the ability to design systems that are **resilient, scalable, and user-centric under real-world constraints**.

[⬆ Back to Top](#top)

---

<a id="license"></a>

## 📄 License

MIT License — feel free to use and adapt.

[⬆ Back to Top](#top)

