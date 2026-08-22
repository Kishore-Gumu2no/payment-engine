# Stateful AI-Driven Payment Engine

A concurrent, stateful payment gateway built on Node.js and TypeScript with Redis-backed idempotency and an AI-simulated failure injection system for QA testing.

---

## The Problem

Payment gateways break under concurrency: race conditions cause double-charges, traditional tests can't simulate real outages/timeouts, stateful flows (pay→refund→pay) require ordered execution, and idempotency keys fail under "thundering herd" attacks.

---

## The Solution

Atomic Redis `SET NX` locks reject duplicates before DB. AI compiler (Groq) turns plain English into executable JSON rulebooks. Stateful engine tracks sequence across async requests. Configurable mock responses (200/408/409/500) per step enable chaos engineering. Feature-flagged architecture toggles production ↔ QA mode via Redis key presence.

---


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
