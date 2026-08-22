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

