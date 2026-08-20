# Local Setup Guide

Complete fresh-machine setup for the Stateful AI-Driven Payment Engine.

---

## Prerequisites

| Tool | Version | Install Command |
|------|---------|-----------------|
| **Node.js** | 22+ | `winget install OpenJS.NodeJS` (Windows) / `brew install node` (macOS) / `sudo apt install nodejs` (Linux) |
| **Docker** | 24+ | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Docker Compose** | v2+ | Included with Docker Desktop |
| **Git** | 2.40+ | `winget install Git.Git` / `brew install git` / `sudo apt install git` |
| **k6** (optional) | 0.50+ | `winget install k6` / `brew install k6` / [download](https://k6.io/docs/getting-started/installation/) |

### Verify Prerequisites
```bash
node --version      # v22.x.x
npm --version       # 10.x.x
docker --version    # 24.x.x
docker compose version  # v2.x.x
k6 version          # optional
```

---

## Environment Variables

### Backend (Required)
```bash
cd Stateful-AI-Payment-Engine/backend
cp .env.example .env
```

Edit `.env` with your values:
```env
# PostgreSQL (Docker Compose provides this)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payment_engine?schema=public"

# Redis (Docker Compose provides this)
REDIS_URL="redis://localhost:6379"

# Groq API Key (REQUIRED for AI compiler)
# Get free key at: https://console.groq.com/keys
GROQ_API_KEY="gsk_YOUR_ACTUAL_KEY_HERE"

# Backend Port
PORT=3000
```

### Frontend (Optional - for live mode)
```bash
cd ../frontend
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Backend API URL
VITE_API_BASE=http://localhost:3000

# Demo mode (false = use real backend)
VITE_DEMO_MODE=false

# Demo data path
VITE_DEMO_DATA_PATH=/data/demo.json
```

---

## Quick Start (Docker Compose - Recommended)

### 1. Start Infrastructure Only
```bash
cd Stateful-AI-Payment-Engine
docker-compose up -d postgres redis
```

### 2. Wait for Health Checks
```bash
docker-compose ps
# Both postgres and redis should show "healthy"
```

### 3. Backend Setup
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start All Services
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm install && npm run dev
```

### 5. Verify
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Prisma Studio | `cd backend && npm run prisma:studio` → http://localhost:5555 |

---

## Alternative: Full Docker Compose Stack

Run everything in containers (including hot-reload dev servers):

```bash
cd Stateful-AI-Payment-Engine

# Set Groq API key for backend container
export GROQ_API_KEY="gsk_YOUR_KEY"

# Build and start all services
docker-compose up --build
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

> **Note**: Volume mounts enable hot-reload. Container logs show both frontend and backend output.

---

## Demo Mode (No Backend Required)

Run frontend standalone with pre-generated scenarios:

```bash
cd frontend
echo "VITE_DEMO_MODE=true" > .env.local
npm install
npm run dev
```

This loads `demo-datasets/demo.json` (served via Vite at `/data/demo.json`) with 6 scenarios:
1. **Basic Payment Success** — 100 sequential payments
2. **Concurrent Attack** — 50 concurrent on same key
3. **Mixed Payment/Refund** — 50 pay → 30 refund (concurrent) → 20 pay
4. **Failure Injection** — 20 × 500 errors
5. **Timeout Simulation** — 15 × 408 timeouts
6. **Idempotency Stress** — 1000 sequential + 4× 100 concurrent attacks

---

## Demo Datasets

Located in `demo-datasets/`:

| File | Description |
|------|-------------|
| `demo.json` | 6 scenarios + 9 executions + 3 rulebooks + 3 failure patterns |
| `rulebook.json` | Standalone rulebook example |

### Using Demo Data with Backend
```bash
# Compile a scenario from demo rulebook
curl -X POST http://localhost:3000/qa/compile \
  -H "Content-Type: application/json" \
  -d '{"prompt": "100 sequential payments of 5000 cents"}'

# Or use the frontend Scenario Builder page
```

---

## Running Tests

### 1. Validation Test (Zod)
```bash
cd tests
npx tsx validation.ts
# Should show SafeParseError for "hundered"
```

### 2. Single Request Test
```bash
# Requires backend running
npx tsx client.ts
# Or with node directly (ESM)
node --experimental-specifier-resolution=node client.ts
```

### 3. Race Condition Test (10 concurrent, same key)
```bash
cd tests
node test-script.js
# Expected: 1× 200 OK, 9× 409 Conflict
```

### 4. k6 Load Test
```bash
# Requires k6 installed and backend running
k6 run load-test.js
# 10 VUs for 2 seconds, same idempotency key
# Expected: Mix of 200 and 409
```

---

## Sample Scenarios to Try

### Via Frontend (Scenario Builder)
1. Open http://localhost:5173/builder
2. Try presets or custom:
   - **Preset: Concurrent Attack** → Execute → Watch 409s
   - **Preset: Failure Injection** → Execute → Watch 500s
   - **Custom**: "5 payments then 3 refunds on same key"

### Via API (curl)
```bash
# 1. Compile scenario
curl -X POST http://localhost:3000/qa/compile \
  -H "Content-Type: application/json" \
  -d '{"prompt": "3 concurrent payments on same key, then 2 refunds"}'

# 2. Make payment (unique key = success)
curl -X POST http://localhost:3000/payment \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "idempotencyKey": "unique-key-1"}'

# 3. Make payment (same key = 409 conflict)
curl -X POST http://localhost:3000/payment \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "idempotencyKey": "unique-key-1"}'

# 4. Refund
curl -X POST http://localhost:3000/refund \
  -H "Content-Type: application/json" \
  -d '{"originalTransactionId": "txn_123", "idempotencyKey": "refund-key-1"}'
```

---

## Stopping & Cleaning

### Stop Dev Servers
```bash
# Ctrl+C in each terminal
```

### Stop Docker Containers
```bash
cd Stateful-AI-Payment-Engine
docker-compose down
```

### Full Cleanup (Removes Volumes/Data)
```bash
docker-compose down -v
# WARNING: Deletes PostgreSQL data and Redis data
```

### Clean Node Modules
```bash
# Backend
cd backend && rm -rf node_modules dist package-lock.json && npm install

# Frontend
cd frontend && rm -rf node_modules dist package-lock.json && npm install
```

---

## Troubleshooting

### Backend Won't Start

| Error | Solution |
|-------|----------|
| `DATABASE_URL not set` | Check `backend/.env` exists and has valid URL |
| `connect ECONNREFUSED 127.0.0.1:5432` | `docker-compose up -d postgres` and wait for healthy |
| `Prisma Client validation error` | Run `npm run prisma:generate` |
| `Migration failed` | `npm run prisma:migrate reset` (dev only) |
| `GROQ_API_KEY invalid` | Get new key from console.groq.com |
| `Redis connection failed` | `docker-compose up -d redis` or check Upstash URL |

### Frontend Issues

| Error | Solution |
|-------|----------|
| `Vite proxy 502` | Backend not running on port 3000 |
| `Demo data not loading` | Check `frontend/public/data/demo.json` exists |
| `CORS error` | Backend CORS allows `http://localhost:5173` |
| `Module not found` | `cd frontend && rm -rf node_modules && npm install` |

### Database Issues

```bash
# Reset database (dev only)
cd backend
npm run prisma:migrate reset --force
npm run prisma:generate

# View database
npm run prisma:studio
```

### Port Conflicts
```bash
# Check what's using ports
netstat -ano | findstr :3000   # Windows
lsof -i :3000                  # macOS/Linux

# Kill process
taskkill /PID <pid> /F         # Windows
kill -9 <pid>                  # macOS/Linux
```

### Docker Issues
```bash
# Full Docker reset
docker-compose down -v
docker system prune -f
docker-compose up --build
```

---

## Project Structure Reference

```
Stateful-AI-Payment-Engine/
├── README.md
├── ARCHITECTURE.md
├── LOCAL_SETUP.md
├── docker-compose.yml
├── demo-datasets/
│   ├── demo.json
│   └── rulebook.json
├── sample-reports/
│   └── *.json
├── screenshots/
├── backend/
│   ├── src/server.ts
│   ├── src/ai-compiler.ts
│   ├── prisma/schema.prisma
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── public/data/demo.json
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── Dockerfile
└── tests/
    ├── client.ts
    ├── test-script.js
    ├── load-test.js
    └── validation.ts
```

---

## Support

- **Groq API**: https://console.groq.com/docs
- **Prisma**: https://www.prisma.io/docs
- **Redis/Upstash**: https://upstash.com/docs
- **k6**: https://k6.io/docs