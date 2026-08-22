# Local Setup (60 seconds)

**Prereqs:** Node 22+, Docker Desktop, Git. Get free Groq key at console.groq.com.

```bash
# 1. Clone & configure
git clone <repo-url> && cd Stateful-AI-Payment-Engine
cp backend/.env.example backend/.env
# Edit backend/.env → add GROQ_API_KEY

# 2. Start infra & backend
docker-compose up -d postgres redis
cd backend && npm install && npm run prisma:generate && npm run prisma:migrate && npm run dev

# 3. Start frontend (new terminal)
cd frontend && npm install && npm run dev
```

**Open:** http://localhost:5173 (frontend) • http://localhost:3000 (API)

**Demo mode (no backend):** `echo "VITE_DEMO_MODE=true" > frontend/.env.local && cd frontend && npm run dev`