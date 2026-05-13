# Forge — AI Coding Platform

Production-grade AI coding assistant with streaming, RAG, multi-step agents, and sandboxed code execution.

## Stack
- **Backend**: FastAPI + LangGraph + pgvector + Redis
- **Frontend**: Next.js 15 + Monaco Editor + Tailwind
- **Models**: Anthropic Claude + OpenAI (abstracted router)
- **Sandbox**: E2B (code execution)
- **DB**: PostgreSQL 16 + pgvector
- **Cache/Queue**: Redis 7 + BullMQ

## Quick Start

```bash
cp .env.example .env
# Fill in API keys

docker compose up -d          # Start Postgres + Redis
cd backend && uv run alembic upgrade head   # Run migrations
cd backend && uv run uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

## Project Structure

```
forge/
├── backend/           FastAPI app
│   ├── app/
│   │   ├── api/       HTTP routes
│   │   ├── agents/    LangGraph graphs
│   │   ├── tools/     Agent tools
│   │   ├── services/  Business logic
│   │   ├── db/        DB + vector clients
│   │   ├── schemas/   Pydantic models
│   │   └── core/      Config, auth, middleware
│   ├── migrations/    Alembic
│   └── tests/
├── frontend/          Next.js 15 app
│   └── src/
│       ├── app/       App Router pages
│       ├── components/
│       ├── hooks/
│       └── lib/
├── infra/             Docker, K8s
└── evals/             Eval harness
```
cd C:\Users\sahil\Desktop\forge\backend
python -m uvicorn app.main:app --reload --port 8000

cd C:\Users\sahil\Desktop\forge\frontend
npm run dev

