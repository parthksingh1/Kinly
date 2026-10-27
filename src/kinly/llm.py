"""Thin async client for any OpenAI compatible chat endpoint (key, base URL and model from env).

When no key is configured, `available` is False and callers fall back to the
deterministic offline brain in `brain/offline.py`, so the product still works.
"""

from __future__ import annotations

import json
import re
from typing import AsyncIterator, Optional

from loguru import logger

from .settings import settings


class LLMUnavailable(RuntimeError):
    pass


class LLMClient:
    def __init__(self) -> None:
        self._client = None
        if settings.llm_enabled:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url,
                timeout=settings.llm_timeout_s,
                max_retries=1,
            )
            logger.info(f"Kinly LLM: {settings.llm_model} @ {settings.llm_base_url}")
        else:
            logger.warning("Kinly LLM: no LLM_API_KEY set, using the offline companion brain")

    @property
    def available(self) -> bool:
        return self._client is not None

    async def stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 220,
    ) -> AsyncIterator[str]:
        if not self._client:
            raise LLMUnavailable("No LLM configured")
        stream = await self._client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def complete(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: int = 600,
    ) -> str:
        if not self._client:
            raise LLMUnavailable("No LLM configured")
        resp = await self._client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()

    async def complete_json(
        self, system: str, user: str, max_tokens: int = 800
    ) -> Optional[dict | list]:
        """Ask for JSON and parse it leniently. Returns None on any failure."""
        try:
            text = await self.complete(
                [
                    {"role": "system", "content": system + "\nReply with valid JSON only."},
                    {"role": "user", "content": user},
                ],
                temperature=0.1,
                max_tokens=max_tokens,
            )
        except Exception as e:  # network, quota, LLMUnavailable
            logger.warning(f"LLM JSON call failed: {e}")
            return None
        return parse_json_loose(text)


def parse_json_loose(text: str) -> Optional[dict | list]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    for candidate in (text, _outermost(text, "{", "}"), _outermost(text, "[", "]")):
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def _outermost(text: str, open_ch: str, close_ch: str) -> Optional[str]:
    start, end = text.find(open_ch), text.rfind(close_ch)
    if start == -1 or end <= start:
        return None
    return text[start : end + 1]


llm = LLMClient()
