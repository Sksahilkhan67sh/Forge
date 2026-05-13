#!/bin/bash
set -e

echo "⚡ Forge — Local Dev Setup"
echo "========================="

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 22+ required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3.11+ required"; exit 1; }

# Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env — fill in your API keys before continuing"
  echo "  Required: ANTHROPIC_API_KEY, OPENAI_API_KEY"
  echo "  Optional: E2B_API_KEY (for code execution), TAVILY_API_KEY (for search)"
fi

# Start infra
echo ""
echo "→ Starting Postgres + Redis..."
docker compose up -d postgres redis
sleep 3

# Backend setup
echo ""
echo "→ Setting up backend..."
cd backend
pip install uv -q
uv pip install --system -e ".[dev]" -q
alembic upgrade head
echo "✓ Backend ready"
cd ..

# Frontend setup
echo ""
echo "→ Installing frontend dependencies..."
cd frontend
npm install -q
echo "✓ Frontend ready"
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start dev servers:"
echo "  Terminal 1: cd backend && uvicorn app.main:app --reload"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "  API docs:  http://localhost:8000/docs"
echo "  App:       http://localhost:3000"
