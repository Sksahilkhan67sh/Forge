import json
from typing import Any
import httpx
import os

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")


async def _upstash(command: list) -> Any:
    """Call Upstash Redis REST API."""
    if not UPSTASH_URL:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            UPSTASH_URL,
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            json=command,
        )
        data = resp.json()
        return data.get("result")


class SessionMemory:
    """Per-session conversation memory backed by Upstash Redis."""

    def __init__(self, session_id: str, max_turns: int = 40):
        self.key = f"session:{session_id}:messages"
        self.max_turns = max_turns

    async def append(self, message: dict[str, Any]) -> None:
        await _upstash(["RPUSH", self.key, json.dumps(message)])
        await _upstash(["LTRIM", self.key, -self.max_turns * 2, -1])
        await _upstash(["EXPIRE", self.key, 604800])  # 7 days

    async def get_all(self) -> list[dict[str, Any]]:
        raw = await _upstash(["LRANGE", self.key, 0, -1])
        if not raw:
            return []
        return [json.loads(m) for m in raw]

    async def clear(self) -> None:
        await _upstash(["DEL", self.key])


class RateLimiter:
    """Simple rate limiter backed by Upstash Redis."""

    async def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        rkey = f"rl:{key}"
        count = await _upstash(["INCR", rkey])
        if count == 1:
            await _upstash(["EXPIRE", rkey, window_seconds])
        count = int(count or 0)
        remaining = max(0, limit - count)
        return count <= limit, remaining