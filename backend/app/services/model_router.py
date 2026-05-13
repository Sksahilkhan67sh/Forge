"""
Model router — Groq primary, with fallback chain.
Groq is free and fast: llama3, mixtral, gemma models.
"""
from enum import StrEnum
from typing import AsyncIterator

import openai

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
log = get_logger(__name__)

# Groq uses OpenAI-compatible API
_groq = openai.AsyncOpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1",
)


class ModelTier(StrEnum):
    FAST   = "fast"
    SMART  = "smart"
    EXPERT = "expert"
    LOCAL  = "local"


TIER_MODELS: dict[ModelTier, list[tuple[str, str]]] = {
    ModelTier.FAST:   [("groq", "llama-3.1-8b-instant")],
    ModelTier.SMART:  [("groq", "llama-3.3-70b-versatile")],
    ModelTier.EXPERT: [("groq", "llama-3.3-70b-versatile")],
    ModelTier.LOCAL:  [("groq", "llama-3.3-70b-versatile")],
}

TIER_MAX_TOKENS: dict[ModelTier, int] = {
    ModelTier.FAST:   2048,
    ModelTier.SMART:  8192,
    ModelTier.EXPERT: 8192,
    ModelTier.LOCAL:  4096,
}


def route_tier(
    task_type: str,
    context_tokens: int = 0,
    force_tier: ModelTier | None = None,
) -> ModelTier:
    if force_tier:
        return force_tier
    if task_type == "autocomplete":
        return ModelTier.FAST
    if task_type in ("generate", "debug", "explain", "agent"):
        return ModelTier.SMART
    return ModelTier.SMART


async def complete(
    messages: list[dict],
    system: str = "",
    task_type: str = "generate",
    context_tokens: int = 0,
    force_tier: ModelTier | None = None,
    temperature: float = 0.2,
) -> tuple[str, dict]:
    tier = route_tier(task_type, context_tokens, force_tier)
    _, model_id = TIER_MODELS[tier][0]

    all_messages = []
    if system:
        all_messages.append({"role": "system", "content": system})
    all_messages.extend(messages)

    resp = await _groq.chat.completions.create(
        model=model_id,
        messages=all_messages,
        max_tokens=TIER_MAX_TOKENS[tier],
        temperature=temperature,
    )
    text = resp.choices[0].message.content or ""
    usage = {
        "tokens_in": resp.usage.prompt_tokens,
        "tokens_out": resp.usage.completion_tokens,
    }
    return text, usage


async def stream(
    messages: list[dict],
    system: str = "",
    task_type: str = "generate",
    context_tokens: int = 0,
    force_tier: ModelTier | None = None,
    temperature: float = 0.2,
) -> AsyncIterator[str]:
    tier = route_tier(task_type, context_tokens, force_tier)
    _, model_id = TIER_MODELS[tier][0]

    log.info("stream_start", provider="groq", model=model_id, tier=tier)

    all_messages = []
    if system:
        all_messages.append({"role": "system", "content": system})
    all_messages.extend(messages)

    stream_resp = await _groq.chat.completions.create(
        model=model_id,
        messages=all_messages,
        max_tokens=TIER_MAX_TOKENS[tier],
        temperature=temperature,
        stream=True,
    )
    async for chunk in stream_resp:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta