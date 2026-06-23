# Stateful AI-Driven Payment Engine
This project is a concurrent, stateful payment gateway built on Node.js and TypeScript. It includes a Redis-backed idempotency system to defend against race conditions and a feature-flagged AI simulated Engine that simulates failures for end-to-end testing dynamically.

## Key Features
- **Atomic Idempotency & Concurrency:** Implements strict `SET ... NX` Redis locks to instantly reject duplicate payloads, preventing database race conditions and double-charging during high-traffic spikes.
- **AI-Powered Engineering:** A custom CLI compiler translates plain-English scenarios (via LLM) into a JSON rulebook, allowing the server to dynamically simulate real-world API outages (400/500 errors) and strict chronological sequence mismatches.
- **Feature-Flagged Architecture:** Uses environment variables to seamlessly toggle the gateway between a high-performance, raw production mode and the AI-driven testing environment without modifying source code.
- **Statefulness:** Tracking the chronological sequence of requests across multiple asynchronous events. (such as redis REMEMBERING the past to block dups and server REMEMBERING the timeline of AI driven scneario across seperate requests)

## Tech Stack
TypeScript + Node.js + Express (Backend), Redis (Concurrency and Caching), PostgreSQL + Prisma ORM (Data Persistence), Zod (Payload Validation), Groq API (AI Compiler). Built using a Guard Clause routing architecture.
