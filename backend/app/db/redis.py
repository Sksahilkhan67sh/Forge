import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import get_settings

settings = get_settings()

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


class SessionMemory:
    """Per-session conversation memory backed by Redis."""

    def __init__(self, session_id: str, max_turns: int = 40):
        self.key = f"session:{session_id}:messages"
        self.max_turns = max_turns

    async def append(self, message: dict[str, Any]) -> None:
        r = await get_redis()
        await r.rpush(self.key, json.dumps(message))
        await r.ltrim(self.key, -self.max_turns * 2, -1)  # keep last N turns
        await r.expire(self.key, 60 * 60 * 24 * 7)        # 7-day TTL

    async def get_all(self) -> list[dict[str, Any]]:
        r = await get_redis()
        raw = await r.lrange(self.key, 0, -1)
        return [json.loads(m) for m in raw]

    async def clear(self) -> None:
        r = await get_redis()
        await r.delete(self.key)


class RateLimiter:
    """Token-bucket rate limiter backed by Redis."""

    async def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Returns (allowed, remaining)."""
        r = await get_redis()
        pipe = r.pipeline()
        rkey = f"rl:{key}"
        await pipe.incr(rkey)
        await pipe.expire(rkey, window_seconds)
        results = await pipe.execute()
        count = results[0]
        remaining = max(0, limit - count)
        return count <= limit, remaining
