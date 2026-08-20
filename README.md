# Stateful AI-Driven Payment Engine

A concurrent, stateful payment gateway built on Node.js and TypeScript with Redis-backed idempotency and an AI-simulated failure injection system for QA testing.

---

## The Problem

Payment systems face critical challenges in high-concurrency environments:

1. **Race Conditions**: Multiple simultaneous requests with the same idempotency key can cause double-charging
2. **Testing Real-World Failures**: Traditional testing cannot easily simulate API outages, timeouts, or partial failures in sequence
3. **Stateful Scenarios**: Real payment flows involve sequences (payment → refund → payment) where order matters
4. **Concurrency Validation**: Need to verify idempotency keys work under "thundering herd" attacks

---

## The Solution

This engine provides:

- **Atomic Idempotency**: Redis `SET key 'locked' EX 86400 NX` — rejects duplicate payloads instantly at the cache layer before hitting the database
- **AI-Powered Scenario Compiler**: Translates plain English ("50 concurrent payments, then 30 refunds on same key") into executable JSON rulebooks
- **Stateful Execution Engine**: Tracks chronological sequence across async requests — the server "remembers" where it is in the scenario
- **Failure Injection**: Configurable mock responses (200, 408, 409, 500) per step for chaos engineering
- **Feature-Flagged Architecture**: Toggle between production mode and AI-driven QA mode via Redis key presence

---

## How It Works

### 1. AI Compiler (`/qa/compile`)
```
Natural Language Prompt
        │
        ▼
   Groq LLM (compound-mini)
        │
        ▼
   JSON Rulebook (validated by Zod)
        │
        ▼
   Stored in Redis (TTL: 10 min)
```

### 2. Rulebook Structure
```json
[
  {
    "stepId": "1",
    "action": "PAYMENT",
    "amount": 10000,
    "requestVolume": 50,
    "executionStrategy": "Concurrent Attack",
    "mockResponse": { "httpStatus": 200, "body": { "message": "Success" } }
  },
  {
    "stepId": "2",
    "action": "REFUND",
    "originalTransactionId": "txn_123",
    "requestVolume": 30,
    "executionStrategy": "Sequential",
    "mockResponse": { "httpStatus": 500, "body": { "message": "Internal Server Error" } }
  }
]
```

### 3. Request Execution Flow
```
POST /payment or /refund
        │
        ▼
┌───────────────────┐
│ Zod Validation    │──fail──► 400 Bad Request
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Redis SET NX      │──fail──► 409 Conflict (duplicate key)
│ (idempotency lock)│
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Active Scenario?  │──no──► Normal DB processing
│ (Redis check)     │
└───────────────────┘
        │ yes
        ▼
┌───────────────────┐
│ Sequence Match?   │──fail──► 400 Sequence Mismatch
│ (step action)     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Mock Response ≥400│──yes──► Return mock (simulated failure)
└───────────────────┘
        │ no
        ▼
┌───────────────────┐
│ Prisma Create     │──fail──► 409 (DB unique) / 500
│ (Payment/Refund)  │
└───────────────────┘
        │
        ▼
   200 Success + Mock or Real Response
```

### 4. Concurrency Handling

| Strategy | Idempotency Key | Expected Behavior |
|----------|-----------------|-------------------|
| **Sequential** | Unique per request | All succeed (200) |
| **Concurrent Attack** | Same key for all | 1 succeeds (200), rest rejected (409) |

### 5. Global State Tracking (In-Memory)
- `currentStepIndex`: Which rulebook step is active
- `currentStepVolumeCount`: How many requests processed for current step
- ⚠️ **Note**: In-memory — not horizontally scalable (single-instance QA tool)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 22+ (ESM) |
| **Language** | TypeScript 5.9 (strict mode) |
| **Framework** | Express 5 |
| **Database** | PostgreSQL 16 + Prisma ORM 7.6 |
| **Cache/Locks** | Redis 7 (ioredis) + Upstash compatible |
| **Validation** | Zod 3.23 |
| **AI Compiler** | Groq SDK (compound-mini model) |
| **Frontend** | React 19 + Vite 8 + Tailwind CSS 4 |
| **Routing** | React Router 7 |
| **Testing** | k6 load test, custom concurrent test scripts |
| **Dev Tools** | tsx (watch), concurrently, Prisma Studio |

---

## Quick Start

### Prerequisites
- Node.js 22+
- Docker & Docker Compose (for local DB/Redis)
- Groq API key (free tier at console.groq.com)

### 1. Clone & Configure
```bash
cd Stateful-AI-Payment-Engine
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit backend/.env with your GROQ_API_KEY
```

### 2. Start Infrastructure
```bash
docker-compose up -d postgres redis
```

### 3. Setup Database
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Development
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm install && npm run dev
```

### 5. Access
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Prisma Studio**: `cd backend && npm run prisma:studio`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/qa/compile` | Compile natural language → rulebook |
| `POST` | `/payment` | Process payment with idempotency key |
| `POST` | `/refund` | Process refund with idempotency key |

### Example: Compile Scenario
```bash
curl -X POST http://localhost:3000/qa/compile \
  -H "Content-Type: application/json" \
  -d '{"prompt": "50 concurrent payments on same key, then 20 refunds"}'
```

### Example: Payment
```bash
curl -X POST http://localhost:3000/payment \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "idempotencyKey": "unique-key-123"}'
```

---

## Demo Mode (No Backend Required)

Run the frontend in demo mode with pre-generated scenarios:

```bash
cd frontend
echo "VITE_DEMO_MODE=true" > .env.local
npm run dev
```

This loads `demo-datasets/demo.json` with 6 scenarios covering:
- Basic success flows
- Concurrent attack (idempotency stress)
- Mixed payment/refund sequences
- 500 error injection
- Timeout simulation
- Idempotency stress (1000+ requests)

---

## Project Structure

```
Stateful-AI-Payment-Engine/
├── README.md                 # This file
├── ARCHITECTURE.md           # Detailed architecture & diagrams
├── LOCAL_SETUP.md            # Fresh machine setup guide
├── docker-compose.yml        # Local dev stack (PostgreSQL + Redis)
├── demo-datasets/            # Demo scenarios & rulebooks
├── sample-reports/           # Sample QA execution reports
├── screenshots/              # UI screenshots (add your own)
├── backend/
│   ├── src/
│   │   ├── server.ts         # Express server + endpoints
│   │   ├── ai-compiler.ts    # Groq LLM → rulebook compiler
│   │   └── validation.ts     # Zod schemas
│   ├── prisma/
│   │   ├── schema.prisma     # Payment, Refund models
│   │   └── migrations/       # DB migrations
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma.config.ts
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/                  # React app (pages, components, hooks, services)
│   ├── public/data/          # Demo data (served by Vite)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── .env.example
└── tests/
    ├── client.ts             # Single test request
    ├── test-script.js        # 10 concurrent requests (race test)
    ├── load-test.js          # k6 load test (10 VUs, 2s)
    └── validation.ts         # Zod validation example
```

---

## Running Tests

### Concurrent Race Test (10 requests, same key)
```bash
cd tests
node test-script.js
# Expected: 1× 200, 9× 409
```

### k6 Load Test
```bash
# Install k6 first: https://k6.io/docs/getting-started/installation/
k6 run load-test.js
```

### Validation Test
```bash
npx tsx validation.ts
```

---

## Environment Variables

### Backend (`.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection (local or Upstash) |
| `GROQ_API_KEY` | Yes | Groq API key for AI compiler |
| `PORT` | No | Server port (default: 3000) |

### Frontend (`.env.local`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE` | No | Backend URL (default: http://localhost:3000) |
| `VITE_DEMO_MODE` | No | Enable demo mode (default: false) |
| `VITE_DEMO_DATA_PATH` | No | Demo data path (default: /data/demo.json) |

---

## License

ISC