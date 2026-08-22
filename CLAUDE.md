# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Stateful AI-Driven Payment Engine** — A concurrent, stateful payment gateway built on Node.js/TypeScript with Redis-backed idempotency and an AI-simulated failure injection system for QA testing.

**Key capabilities:**
- Atomic idempotency via Redis `SET NX` (rejects duplicates before DB)
- AI compiler (Groq LLM) translating natural language → executable JSON rulebooks
- Stateful execution engine tracking chronological sequence across async requests
- Configurable mock responses (200, 408, 409, 500) per step for chaos engineering
- Feature-flagged architecture: toggle production mode vs AI-driven QA mode via Redis key presence

---

## Commands

### Backend (from `backend/`)
```bash
npm install              # Install dependencies
npm run dev              # Start dev server with tsx watch (port 3000)
npm run build            # TypeScript compile to dist/
npm start                # Run compiled server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations (dev)
npm run prisma:studio    # Open Prisma Studio
```

### Frontend (from `frontend/`)
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (port 5173)
npm run build            # TypeScript compile + Vite build
npm run preview          # Preview production build
```

### Full Stack (Docker Compose, from root)
```bash
docker-compose up -d postgres redis     # Start infrastructure only
docker-compose up -d                    # Start all services (backend + frontend + infra)
docker-compose logs -f backend          # View backend logs
docker-compose down                     # Stop all services
```

### Tests (from `tests/`)
```bash
node test-script.js      # 10 concurrent requests with same key (race test)
k6 run load-test.js      # k6 load test (10 VUs, 2s)
npx tsx validation.ts    # Zod validation example
npx tsx client.ts        # Single test request
```

### Environment Setup
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with real GROQ_API_KEY (from https://console.groq.com/)

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit if needed (defaults work for local dev)
```

---

## Architecture

### High-Level
```
┌─────────────┐     HTTP/REST      ┌─────────────┐
│  Frontend   │ ──────────────────►│   Backend   │
│ React/Vite  │                    │ Express/TS  │
└─────────────┘                    └──────┬──────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
             ┌─────────────┐      ┌─────────────┐       ┌─────────────┐
             │    Redis    │      │ PostgreSQL  │       │    Groq     │
             │ (Locks +    │      │  (Prisma    │       │  (compound- │
             │  Scenarios) │      │   ORM)      │       │    mini)    │
             └─────────────┘      └─────────────┘       └─────────────┘
```

### Backend Structure (`backend/src/`)
| File | Responsibility |
|------|----------------|
| `server.ts` | Express app, routes (`/payment`, `/refund`, `/qa/compile`), global scenario state |
| `ai-compiler.ts` | Groq LLM → validated JSON rulebook via Zod "firewall" |
| `validation.ts` | Zod schemas (reference only — actual validation inline in server.ts) |

### Frontend Structure (`frontend/src/`)
```
pages/           # Dashboard, ScenarioBuilder, ExecutionView, History, Reports, Settings
components/      # UI primitives (Button, Card, Table, Modal, Terminal, etc.) + layout
services/        # apiClient.ts, demoDataService.ts, scenarioService.ts
hooks/           # useScenario.ts, useHistory.ts
config/          # endpoints.ts, mode.ts (demo vs live)
types/           # TypeScript interfaces for API, demo, scenario
```

### Data Models

**Prisma (`backend/prisma/schema.prisma`):**
```prisma
model Payment {
  id              String   @id @default(uuid())
  idempotencyKey  String   @unique
  amount          Int      // in cents
  createdAt       DateTime @default(now())
}

model Refund {
  id                   String   @id @default(uuid())
  originalTransactionId String
  idempotencyKey       String   @unique
  createdAt            DateTime @default(now())
}
```

**Redis Keys:**
| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `{idempotencyKey}` | String | 86400s (24h) | Distributed lock for idempotency |
| `active_qa_scenario` | JSON String | 600s (10min) | Compiled rulebook for AI mode |

### Request Flow (Payment/Refund)
```
POST /payment or /refund
        │
        ▼
┌───────────────┐
│ Zod Validate  │──fail──► 400
└───────────────┘
        │
        ▼
┌───────────────┐
│ Redis SET NX  │──fail──► 409 (duplicate key)
│ (idempotency) │
└───────────────┘
        │
        ▼
┌───────────────┐
│ Active QA     │──no──► Normal DB processing (Prisma create)
│ Scenario?     │
└───────────────┘
        │ yes
        ▼
┌───────────────┐
│ Sequence      │──fail──► 400 (sequence mismatch)
│ Match?        │
└───────────────┘
        │
        ▼
┌───────────────┐
│ Mock ≥ 400?   │──yes──► Return mock error, DEL lock
└───────────────┘
        │ no
        ▼
┌───────────────┐
│ Prisma Create │──unique──► 409 (DB conflict)
│               │──error──► 500 + DEL lock
└───────────────┘
        │
        ▼
200 Success (+ mock or real response)
```

### AI Compiler Pipeline (`/qa/compile`)
```
Client POST /qa/compile {prompt}
        │
        ▼
Groq LLM (system prompt + JSON schema)
        │
        ▼
Raw JSON response
        │
        ▼
Zod Validation ("Firewall") ──fail──► 500 AI Compilation Failed
        │
        ▼
Store in Redis (active_qa_scenario, EX 600)
Reset currentStepIndex, currentStepVolumeCount
        │
        ▼
Return {message, rulebook}
```

### Global Scenario State (In-Memory ⚠️)
- `currentStepIndex`: Which rulebook step is active
- `currentStepVolumeCount`: How many requests processed for current step
- **Not horizontally scalable** — single-instance QA tool only

### Execution Strategies
| Strategy | Idempotency Keys | Expected Result |
|----------|------------------|-----------------|
| **Sequential** | Unique per request (UUID) | All succeed (200) |
| **Concurrent Attack** | Same key for all | 1× 200, N-1× 409 |

---

## Key Files to Understand

| File | Why It Matters |
|------|----------------|
| `backend/src/server.ts` | All HTTP endpoints, idempotency logic, scenario execution, global state |
| `backend/src/ai-compiler.ts` | Groq integration, Zod validation firewall, prompt engineering |
| `backend/prisma/schema.prisma` | Database models (Payment, Refund with unique idempotency keys) |
| `frontend/src/services/scenarioService.ts` | Core frontend logic for compiling/executing scenarios |
| `frontend/src/hooks/useScenario.ts` | React state for scenario builder + execution |
| `docker-compose.yml` | Local dev stack (PostgreSQL + Redis + backend + frontend) |
| `demo-datasets/demo.json` | 6 pre-built scenarios + executions + rulebooks for demo mode |

---

## Important Behaviors & Gotchas

1. **Global state is in-memory** — `currentStepIndex` and `currentStepVolumeCount` reset on server restart. Not suitable for multi-instance deployments.

2. **Idempotency lock releases on mock errors** — If mock response ≥ 400, the Redis lock is deleted immediately so retries can proceed.

3. **DB unique constraint is second line of defense** — Redis lock prevents most duplicates; Prisma `@unique` catches any that slip through (returns 409 with "already exists").

4. **Demo mode runs entirely in browser** — No backend needed. Uses `demo-datasets/demo.json` with pre-computed scenarios, rulebooks, and execution logs.

5. **Groq model is `compound-mini`** — Free tier available at console.groq.com. Temperature=0 for deterministic output.

6. **Zod schemas in server.ts are the source of truth** — `validation.ts` is just a reference example.

7. **CORS configured for production Vercel + localhost:5173** — Add origins if deploying elsewhere.

---

## Development Notes

- **TypeScript**: Strict mode, ESM (`"type": "module"`), Node 22+
- **Prisma**: Uses `@prisma/adapter-pg` for Neon/serverless compatibility
- **Frontend**: React 19, React Router 7, Tailwind CSS 4 (via Vite plugin)
- **No test framework configured** — Manual/concurrency tests in `tests/`
- **Port 3000 (backend)**, **Port 5173 (frontend)**

---

## Common Tasks

### Add a new API endpoint
1. Add route in `backend/src/server.ts`
2. Add Zod validation schema inline (guard clause pattern)
3. Update `frontend/src/config/endpoints.ts` if frontend needs it
4. Add TypeScript types in `frontend/src/types/api.ts`

### Modify AI compiler prompt
Edit `backend/src/ai-compiler.ts` — system prompt (lines 48-68) defines behavior. Update JSON schema via `zodToJsonSchema` if rulebook structure changes.

### Add a new demo scenario
Add to `demo-datasets/demo.json` under `scenarios[]`, `executions[]`, and `rulebooks[]` arrays.

### Change database schema
1. Edit `backend/prisma/schema.prisma`
2. Run `npm run prisma:migrate` in backend
3. Run `npm run prisma:generate` to update client

---

## Deployment Considerations

| Concern | Current | Production Need |
|---------|---------|-----------------|
| Global state | In-memory | Redis-backed or single-instance |
| Horizontal scaling | Not supported | Sticky sessions or state externalization |
| Redis | Upstash/local | Cluster mode for HA |
| PostgreSQL | Single instance | Read replicas, connection pooling |
| AI Compiler | Sync HTTP | Async job queue for reliability |