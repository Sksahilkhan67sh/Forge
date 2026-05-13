from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.db.database import get_db
from app.db.redis import RateLimiter
from app.schemas.api import ExecuteRequest, ExecuteResponse, SearchRequest, SearchResult
from app.services.rag import retrieve
from app.tools.sandbox import execute_code

router = APIRouter(tags=["tools"])
rate_limiter = RateLimiter()


@router.post("/execute", response_model=ExecuteResponse)
async def execute(
    body: ExecuteRequest,
    user_id: UUID = Depends(get_current_user_id),
):
    """Execute code in an isolated sandbox."""
    allowed, remaining = await rate_limiter.check(
        key=f"exec:{user_id}", limit=20, window_seconds=60
    )
    if not allowed:
        from fastapi import HTTPException
        raise HTTPException(status_code=429, detail="Rate limit: 20 executions/minute")

    result = await execute_code(
        code=body.code,
        language=body.language,  # type: ignore
        timeout=body.timeout,
        files=body.files,
    )
    return ExecuteResponse(**result.to_dict())


@router.post("/search/code", response_model=list[SearchResult])
async def search_code(
    body: SearchRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Semantic + keyword search over an indexed project."""
    if not body.project_id:
        return []
    chunks = await retrieve(db, body.project_id, body.query, k=body.k)
    return [SearchResult(**c) for c in chunks]
