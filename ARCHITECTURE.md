# Architecture Documentation

## System Overview

The Stateful AI-Driven Payment Engine is a concurrent payment gateway designed for QA testing of idempotency, race conditions, and failure scenarios. It consists of a TypeScript/Express backend with Redis-backed idempotency locks, PostgreSQL persistence via Prisma, and a React/Vite frontend for scenario building and execution visualization.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        FE[Frontend: React + Vite + Tailwind]
        CLI[Test Scripts: client.ts, test-script.js, k6]
    end

    subgraph "API Layer"
        BE[Backend: Express + TypeScript]
    end

    subgraph "State & Coordination"
        REDIS[(Redis: Idempotency Locks + Scenario State)]
    end

    subgraph "Persistence"
        PG[(PostgreSQL: Payments + Refunds)]
    end

    subgraph "AI Services"
        GROQ[Groq LLM: compound-mini]
    end

    FE -->|HTTP/REST| BE
    CLI -->|HTTP/REST| BE
    BE -->|SET NX / GET| REDIS
    BE -->|Prisma ORM| PG
    BE -->|Compile Prompt| GROQ
    GROQ -->|Rulebook JSON| BE
    BE -->|Store Rulebook| REDIS
```

---

## Component Responsibilities

### Backend (`backend/src/`)

| Component | File | Responsibility |
|-----------|------|----------------|
| **Express Server** | `server.ts` | HTTP routing, middleware, global scenario state |
| **AI Compiler** | `ai-compiler.ts` | Natural language → validated JSON rulebook via Groq |
| **Validation** | `validation.ts` | Zod schemas (shared reference) |

#### Server.ts Key Flows

```mermaid
flowchart TD
    A[HTTP Request] --> B{Zod Validation}
    B -->|Invalid| C[400 Bad Request]
    B -->|Valid| D[Redis SET key NX]
    D -->|Lock Failed| E[409 Conflict]
    D -->|Lock Acquired| F{Active Scenario?}
    F -->|No| G[Normal DB Processing]
    F -->|Yes| H[Parse Rulebook]
    H --> I{Step Index Valid?}
    I -->|No| J[400 No More Steps]
    I -->|Yes| K{Action Matches?}
    K -->|No| L[400 Sequence Mismatch]
    K -->|Yes| M{Mock Status >= 400?}
    M -->|Yes| N[Return Mock Error]
    M -->|No| O[Prisma Create]
    O -->|Unique Violation| P[409 DB Conflict]
    O -->|Other Error| Q[500 + Release Lock]
    O -->|Success| R[200 + Mock/Real Response]
```

### Global Scenario State (In-Memory)

```mermaid
stateDiagram-v2
    [*] --> Idle: No active scenario
    Idle --> Running: POST /qa/compile
    Running --> Running: Payment/Refund request
    Running --> StepComplete: requestVolume reached
    StepComplete --> Running: Next step exists
    StepComplete --> Idle: Rulebook exhausted
    Running --> Idle: Error/Reset
    
    note right of Running
        currentStepIndex: number
        currentStepVolumeCount: number
        Stored in server memory only
        Not horizontally scalable
    end note
```

### AI Compiler Pipeline

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Groq
    participant Redis
    
    Client->>Server: POST /qa/compile {prompt}
    Server->>Groq: Chat completion (system prompt + schema)
    Groq-->>Server: Raw JSON response
    Server->>Server: Zod validation (firewall)
    alt Validation passes
        Server->>Redis: SET active_qa_scenario EX 600
        Server->>Server: Reset currentStepIndex, currentStepVolumeCount
        Server-->>Client: 200 {rulebook}
    else Validation fails
        Server-->>Client: 500 AI Compilation Failed
    end
```

### Idempotency Lock Mechanism

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Redis
    participant PostgreSQL
    
    Client->>Server: POST /payment {amount, idempotencyKey}
    Server->>Redis: SET idempotencyKey 'locked' EX 86400 NX
    alt Lock acquired (first request)
        Redis-->>Server: OK
        Server->>Redis: GET active_qa_scenario
        alt Scenario active + mock error
            Redis-->>Server: Rulebook
            Server-->>Client: Mock error (400/500)
            Server->>Redis: DEL idempotencyKey
        else Normal processing
            Server->>PostgreSQL: INSERT Payment
            alt Success
                PostgreSQL-->>Server: Created
                Server-->>Client: 200 Success
            else Unique violation
                PostgreSQL-->>Server: P2002
                Server-->>Client: 409 Duplicate
            else Other error
                PostgreSQL-->>Server: Error
                Server->>Redis: DEL idempotencyKey
                Server-->>Client: 500
            end
        end
    else Lock rejected (duplicate)
        Redis-->>Server: null
        Server-->>Client: 409 Payment already in process
    end
```

---

## Data Models

### Prisma Schema

```mermaid
erDiagram
    PAYMENT {
        String id PK "uuid()"
        String idempotencyKey UK "unique"
        Int amount "in cents"
    }
    REFUND {
        String id PK "uuid()"
        String originalTransactionId
        String idempotencyKey UK "unique"
    }
```

### Redis Keys

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `{idempotencyKey}` | String | 86400s (24h) | Distributed lock for idempotency |
| `active_qa_scenario` | JSON String | 600s (10min) | Compiled rulebook for AI mode |

---

## Frontend Architecture (`frontend/src/`)

```mermaid
graph TD
    subgraph "Pages"
        Dashboard[Dashboard.tsx]
        Builder[ScenarioBuilder.tsx]
        Execute[ExecutionView.tsx]
        History[History.tsx]
        Reports[Reports.tsx]
        Settings[Settings.tsx]
    end

    subgraph "Services"
        API[apiClient.ts]
        Demo[demoDataService.ts]
        Scenario[scenarioService.ts]
    end

    subgraph "State"
        HistoryHook[useHistory.ts]
        ScenarioHook[useScenario.ts]
    end

    subgraph "Config"
        Endpoints[endpoints.ts]
        Mode[mode.ts]
    end

    subgraph "UI Components"
        Layout[AppLayout.tsx]
        UI[ui/*: Button, Card, Table, Modal, Terminal...]
    end

    Dashboard --> ScenarioHook
    Dashboard --> API
    Builder --> ScenarioHook
    Builder --> API
    Execute --> ScenarioHook
    Execute --> API
    History --> HistoryHook
    Reports --> HistoryHook
    ScenarioHook --> Scenario
    Scenario --> API
    Scenario --> Demo
    API --> Endpoints
    API --> Mode
    Demo --> Mode
```

### Mode System

```mermaid
stateDiagram-v2
    [*] --> CheckEnv: App Load
    CheckEnv --> DemoMode: VITE_DEMO_MODE=true
    CheckEnv --> LiveMode: VITE_DEMO_MODE=false
    
    DemoMode --> DemoData: Fetch /data/demo.json
    DemoData --> SimulateCompile: Return pre-built rulebook
    DemoData --> SimulateExecution: Return pre-built logs/metrics
    
    LiveMode --> APIClient: Real HTTP to backend
    APIClient --> CompileScenario: POST /qa/compile
    APIClient --> ProcessPayment: POST /payment
    APIClient --> ProcessRefund: POST /refund
    APIClient --> ExecuteBatch: Concurrent requests
```

---

## Request/Response Contracts

### Compile Scenario
```
POST /qa/compile
Request:  { "prompt": "string" }
Response: { "message": "Compiled successfully", "rulebook": ScenarioStep[] }
Errors:   400 (no prompt), 500 (Groq/validation failure)
```

### Payment
```
POST /payment
Request:  { "amount": number, "idempotencyKey": "string" }
Success:  { "message": "Raw payment processed..." } or mock response
Errors:   400 (validation), 409 (Redis lock / DB unique), 500 (DB error)
```

### Refund
```
POST /refund
Request:  { "originalTransactionId": "string", "idempotencyKey": "string" }
Success:  { "message": "Raw refund processed..." } or mock response
Errors:   400 (validation), 409 (Redis lock / DB unique), 500 (DB error)
```

### Scenario Step Types

```typescript
// Payment Step
{
  stepId: string,
  action: "PAYMENT",
  amount: number,           // in cents
  requestVolume: number,    // how many requests for this step
  executionStrategy: "Sequential" | "Concurrent Attack",
  mockResponse: {
    httpStatus: number,     // 100-599
    body: { message: string }
  }
}

// Refund Step
{
  stepId: string,
  action: "REFUND",
  originalTransactionId: string,
  requestVolume: number,
  executionStrategy: "Sequential" | "Concurrent Attack",
  mockResponse: {
    httpStatus: number,
    body: { message: string }
  }
}
```

---

## Execution Strategies

| Strategy | Idempotency Keys | Use Case |
|----------|------------------|----------|
| **Sequential** | Unique per request (UUID) | Normal processing, all should succeed |
| **Concurrent Attack** | Same key for all requests | Stress test idempotency — expect 1× 200, N-1× 409 |

---

## Deployment Architecture

### Local Development (Docker Compose)

```mermaid
graph LR
    subgraph "Docker Network"
        PG[(postgres:5432)]
        RD[(redis:6379)]
        BE[backend:3000]
        FE[frontend:5173]
    end
    
    Dev[Developer Browser] --> FE
    Dev -->|API Calls| BE
    BE --> PG
    BE --> RD
    FE -.->|Vite Proxy| BE
```

### Production Considerations

| Concern | Current State | Production Need |
|---------|---------------|-----------------|
| **Global State** | In-memory (`currentStepIndex`) | Redis-backed or single-instance only |
| **Horizontal Scaling** | Not supported | Sticky sessions or state externalization |
| **Redis** | Upstash (TLS) or local | Cluster mode for HA |
| **PostgreSQL** | Single instance | Read replicas, connection pooling |
| **AI Compiler** | Sync HTTP to Groq | Async job queue for reliability |

---

## Security Notes

- **CORS**: Configured for production Vercel + localhost:5173
- **Idempotency Keys**: 24h TTL in Redis, unique constraint in PostgreSQL
- **Validation**: Zod schemas on all inputs (guard clause pattern)
- **Environment**: Secrets via `.env` files (not committed)
- **Demo Mode**: Zero backend dependency — safe for public hosting

---

## Testing Architecture

```mermaid
graph TD
    subgraph "Unit/Integration"
        Validation[validation.ts: Zod parse test]
    end
    
    subgraph "Concurrency"
        RaceTest[test-script.js: 10 parallel fetch]
        K6Test[load-test.js: k6 10 VUs × 2s]
    end
    
    subgraph "Manual"
        Client[client.ts: Single request]
    end
    
    RaceTest -->|Expected: 1×200, 9×409| Backend
    K6Test -->|Expected: Mix 200/409| Backend
    Client -->|Smoke test| Backend
```

---

## File Structure Reference

```
backend/
├── src/
│   ├── server.ts          # Express app, routes, global state
│   ├── ai-compiler.ts     # Groq + Zod compiler pipeline
│   └── validation.ts      # Zod schemas (reference)
├── prisma/
│   ├── schema.prisma      # Payment, Refund models
│   └── migrations/        # SQL migrations
├── Dockerfile
├── package.json
├── tsconfig.json
└── prisma.config.ts

frontend/
├── src/
│   ├── pages/             # Route components
│   ├── components/        # UI + layout
│   ├── services/          # API, demo data, scenario logic
│   ├── hooks/             # React state hooks
│   ├── config/            # Endpoints, mode detection
│   └── types/             # TypeScript interfaces
├── public/data/demo.json  # Demo scenarios (served by Vite)
├── Dockerfile
├── package.json
├── tsconfig.json
└── vite.config.ts

tests/
├── client.ts              # Single request test
├── test-script.js         # 10 concurrent (race condition)
├── load-test.js           # k6 load test
└── validation.ts          # Zod example

demo-datasets/
├── demo.json              # 6 scenarios + executions + rulebooks
└── rulebook.json          # Standalone rulebook example
```