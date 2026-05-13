"""
Backend integration tests.
Run: pytest tests/ -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.db.database import Base, get_db

# ── Test DB setup ─────────────────────────────────────────────────────────────

TEST_DATABASE_URL = "postgresql+asyncpg://forge:forge@localhost:5432/forge_test"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    """Create a user and return auth headers."""
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test@forge.dev",
        "password": "testpassword123",
        "full_name": "Test User",
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Auth tests ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "new@forge.dev",
        "password": "password123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["email"] == "new@forge.dev"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test@forge.dev",
        "password": "password123",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@forge.dev",
        "password": "testpassword123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@forge.dev",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "test@forge.dev"


# ── Project tests ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v1/projects/", json={
        "name": "My API",
        "description": "A test project",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My API"
    assert data["indexed"] is False
    return data["id"]


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v1/projects/", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Chat tests ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_session(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v1/chat/sessions", json={}, headers=auth_headers)
    assert resp.status_code == 201
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v1/chat/sessions", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_health():
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── Model router unit tests ───────────────────────────────────────────────────

def test_route_tier_fast():
    from app.services.model_router import route_tier, ModelTier
    assert route_tier("autocomplete") == ModelTier.FAST


def test_route_tier_expert_long_context():
    from app.services.model_router import route_tier, ModelTier
    assert route_tier("generate", context_tokens=60_000) == ModelTier.EXPERT


def test_route_tier_smart_default():
    from app.services.model_router import route_tier, ModelTier
    assert route_tier("generate") == ModelTier.SMART
