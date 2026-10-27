"""Per-turn latency tracking: time from end of the elder's speech to the first audio sent.

A ContextVar holds a mutable TurnTimer. It is set at the start of a conversation turn task;
TTS tasks created inside that task inherit it, so the first payload sent can stamp it.
"""

from __future__ import annotations

import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Optional

from loguru import logger


@dataclass
class TurnTimer:
    client_uid: str
    started: float = field(default_factory=time.perf_counter)
    llm_started: Optional[float] = None
    first_audio_ms: Optional[int] = None
    asr_provider: str = ""
    tts_provider: str = ""
    language: str = ""


_current: ContextVar[Optional[TurnTimer]] = ContextVar("kinly_turn", default=None)


class _TurnContext:
    def begin(self, client_uid: str) -> TurnTimer:
        timer = TurnTimer(client_uid)
        _current.set(timer)
        return timer

    def current(self) -> Optional[TurnTimer]:
        return _current.get()

    def mark_llm_start(self) -> None:
        t = _current.get()
        if t and t.llm_started is None:
            t.llm_started = time.perf_counter()

    def set_asr(self, provider: str, language: str = "") -> None:
        t = _current.get()
        if t:
            t.asr_provider = provider
            t.language = language or t.language

    def set_tts(self, provider: str, language: str = "") -> None:
        t = _current.get()
        if t and not t.tts_provider:
            t.tts_provider = provider
            t.language = t.language or language

    def mark_first_audio(self) -> None:
        t = _current.get()
        if not t or t.first_audio_ms is not None:
            return
        t.first_audio_ms = int((time.perf_counter() - t.started) * 1000)
        logger.info(
            f"⏱ time to first audio: {t.first_audio_ms} ms (asr={t.asr_provider or '-'}, tts={t.tts_provider or '-'}, lang={t.language or '-'})"
        )
        try:
            from . import repo
            from .brain.session import sessions

            session = sessions.get(t.client_uid)
            if session:
                session.first_audio_ms.append(t.first_audio_ms)
            repo.record_turn_metric(session.elder_id if session else None, "screen", t.first_audio_ms,
                                    t.asr_provider, t.tts_provider, t.language)
        except Exception as e:  # metrics must never break a conversation
            logger.debug(f"turn metric not recorded: {e}")

    def reset(self) -> None:
        _current.set(None)


turn_context = _TurnContext()
