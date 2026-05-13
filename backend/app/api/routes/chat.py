import json
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.forge_agent import run_agent
from app.core.auth import get_current_user_id
from app.core.logging import get_logger
from app.db.database import get_db
from app.db.models import ChatSession, Message
from app.db.redis import SessionMemory
from app.schemas.api import ChatRequest, MessageResponse, SessionCreate, SessionResponse
from app.services import model_router
from app.services.rag import format_context, retrieve

router = APIRouter(prefix="/chat", tags=["chat"])
log = get_logger(__name__)


# ── Sessions ─────────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(user_id=user_id, project_id=body.project_id, title=body.title)
    db.add(session)
    await db.flush()
    return session


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()

@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user_id, db)
    await db.delete(session)

@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user_id, db)
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session.id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


# ── Streaming Chat ────────────────────────────────────────────────────────────

@router.post("/")
async def chat(
    body: ChatRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Main chat endpoint — streams SSE events."""
    # Get or create session
    if body.session_id:
        session = await _get_session(body.session_id, user_id, db)
    else:
        session = ChatSession(user_id=user_id, project_id=body.project_id)
        db.add(session)
        await db.flush()

    # Load conversation history from Redis
    memory = SessionMemory(str(session.id))
    history = await memory.get_all()

    # Build RAG context if project is set
    context_str = ""
    if session.project_id:
        chunks = await retrieve(db, session.project_id, body.message, k=6)
        context_str = format_context(chunks)

    # Save user message
    user_msg = Message(
        session_id=session.id,
        role="user",
        content={"text": body.message},
    )
    db.add(user_msg)
    await memory.append({"role": "user", "content": body.message})

    return StreamingResponse(
        _stream_response(
            body=body,
            session=session,
            history=history,
            context=context_str,
            db=db,
            memory=memory,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


async def _stream_response(
    body: ChatRequest,
    session: ChatSession,
    history: list[dict],
    context: str,
    db: AsyncSession,
    memory: SessionMemory,
):
    """Generator that yields SSE-formatted events."""
    full_response = []
    tokens_out = 0
    start = time.monotonic()

    try:
        yield _sse("session_id", str(session.id))

        if body.use_agent:
            stream = run_agent(
                user_message=body.message,
                history=history,
                context=context,
                max_iterations=body.max_iterations,
            )
        else:
            # Direct streaming — no agent loop
            msgs = [{"role": m["role"], "content": m["content"]} for m in history]
            msgs.append({"role": "user", "content": body.message})
            if context:
                msgs.insert(0, {"role": "user", "content": f"Context:\n{context}"})
            stream = model_router.stream(msgs, task_type="generate")

        async for chunk in stream:
            full_response.append(chunk)
            tokens_out += len(chunk) // 4  # rough estimate
            yield _sse("chunk", chunk)

        final_text = "".join(full_response)
        latency_ms = int((time.monotonic() - start) * 1000)

        # Persist assistant message
        assistant_msg = Message(
            session_id=session.id,
            role="assistant",
            content={"text": final_text},
            model_used=session.model,
            tokens_out=tokens_out,
            latency_ms=latency_ms,
        )
        db.add(assistant_msg)
        await memory.append({"role": "assistant", "content": final_text})
        await db.commit()

        # Auto-title session on first response
        if not session.title and len(history) == 0:
            title = body.message[:80]
            session.title = title
            await db.commit()

        yield _sse("done", json.dumps({"session_id": str(session.id), "latency_ms": latency_ms}))

    except Exception as e:
        log.error("stream_error", error=str(e))
        yield _sse("error", str(e))


def _sse(event: str, data: str) -> str:
    return f"event: {event}\ndata: {data}\n\n"


async def _get_session(session_id: UUID, user_id: UUID, db: AsyncSession) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
