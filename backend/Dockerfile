FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev git curl && \
    rm -rf /var/lib/apt/lists/*

RUN pip install uv

COPY pyproject.toml .
RUN uv pip install --system fastapi uvicorn[standard] pydantic pydantic-settings \
    sqlalchemy[asyncio] asyncpg alembic psycopg2-binary pgvector redis \
    anthropic openai langgraph langchain-core langchain-anthropic langchain-openai \
    e2b-code-interpreter tavily-python tiktoken python-jose[cryptography] \
    passlib[bcrypt] python-multipart httpx structlog \
    opentelemetry-sdk opentelemetry-instrumentation-fastapi \
    opentelemetry-exporter-otlp gitpython aiofiles email-validator

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]