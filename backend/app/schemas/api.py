from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Auth ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    email: str


# ── Users ───────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Projects ────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    repo_url: str | None = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    repo_url: str | None
    language: str | None
    indexed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class IndexProjectRequest(BaseModel):
    directory: str  # local path to index
    force_reindex: bool = False


class IndexProjectResponse(BaseModel):
    files: int
    chunks: int
    project_id: UUID


# ── Chat ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=32_000)
    session_id: UUID | None = None
    project_id: UUID | None = None
    model_tier: str | None = None   # fast | smart | expert
    use_agent: bool = True           # use full agent loop vs direct completion
    max_iterations: int = Field(default=6, ge=1, le=15)


class SessionCreate(BaseModel):
    project_id: UUID | None = None
    title: str | None = None


class SessionResponse(BaseModel):
    id: UUID
    project_id: UUID | None
    title: str | None
    model: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: dict
    model_used: str | None
    tokens_in: int | None
    tokens_out: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Code Execution ───────────────────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    code: str = Field(min_length=1)
    language: str = "python"
    timeout: int = Field(default=30, ge=1, le=120)
    files: dict[str, str] | None = None


class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    error: str | None
    duration_ms: int
    success: bool


# ── Search ───────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=512)
    project_id: UUID | None = None
    k: int = Field(default=8, ge=1, le=20)


class SearchResult(BaseModel):
    file_path: str
    language: str | None
    symbol_name: str | None
    content: str
    start_line: int | None
    end_line: int | None
    score: float
