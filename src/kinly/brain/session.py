"""Conversation sessions shared by every transport (screen, phone, demo)."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Optional

from .. import db, repo
from ..db import now_utc
from .safety import Signal


@dataclass
class Session:
    key: str
    elder: dict
    channel: str  # screen | phone | demo
    conversation_id: str
    language: str
    external_id: Optional[str] = None
    transcript: list[dict] = field(default_factory=list)
    covered: set[str] = field(default_factory=set)
    signals: list[Signal] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    mode: str = "chat"  # chat | consent | consent_declined
    consent_attempts: int = 0
    consent_intro_given: bool = False
    pending_med_log: Optional[dict] = None
    first_audio_ms: list[int] = field(default_factory=list)
    languages_used: set[str] = field(default_factory=set)
    is_checkin: bool = True
    scam_reminded: bool = False
    avatar: Optional[dict] = None
    ended: bool = False

    @property
    def elder_id(self) -> str:
        return self.elder["id"]

    @property
    def name(self) -> str:
        return self.elder.get("preferredName") or self.elder.get("name") or "friend"

    @property
    def gender(self) -> str:
        return self.elder.get("gender") or "female"

    def add(self, role: str, text: str, private: bool = False) -> dict:
        turn = {"role": role, "text": text.strip(), "at": int(time.time() * 1000), "private": private, "lang": self.language}
        self.transcript.append(turn)
        if role == "user":
            self.languages_used.add(self.language)
        return turn

    def user_turns(self) -> list[dict]:
        return [t for t in self.transcript if t["role"] == "user"]

    def mark_last_user_private(self, count: int = 2) -> None:
        marked = 0
        for turn in reversed(self.transcript):
            if turn["role"] == "user":
                turn["private"] = True
                marked += 1
                if marked >= count:
                    break

    def chat_messages(self, limit: int = 14) -> list[dict]:
        out = []
        for t in self.transcript[-limit:]:
            if t["text"]:
                out.append({"role": "assistant" if t["role"] == "assistant" else "user", "content": t["text"]})
        return out

    def update_coverage(self) -> None:
        text = " ".join(t["text"].lower() for t in self.transcript)
        if any(t["role"] == "assistant" for t in self.transcript):
            self.covered.add("greeting")
        checks = {
            "sleep": r"sleep|slept|rest|neend|नींद|soy[ai]|dorm",
            "food": r"\beat|\bate\b|breakfast|lunch|dinner|food|khana|खाना|nashta|comi|comida|desayun",
            "medicines": r"medicine|tablet|pill|dawai|dawa|दवा|medicina|pastilla",
            "plans": r"plan|today|later|aaj|आज|planes|hoy",
        }
        for stage, pattern in checks.items():
            if re.search(pattern, text):
                self.covered.add(stage)
        if len(self.user_turns()) >= 6:
            self.covered.add("story")


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def get(self, key: str) -> Optional[Session]:
        return self._sessions.get(key)

    def active_for_elder(self, elder_id: str) -> list[Session]:
        return [s for s in self._sessions.values() if s.elder_id == elder_id and not s.ended]

    def start(self, key: str, elder: dict, channel: str, external_id: Optional[str] = None,
              language: Optional[str] = None) -> Session:
        existing = self._sessions.get(key)
        if existing and not existing.ended:
            return existing
        conversation = db.insert(
            "conversations",
            {
                "elderId": elder["id"], "channel": channel, "externalId": external_id,
                "startedAt": now_utc(), "language": language or repo.elder_languages(elder)[0],
                "transcript": "[]", "processed": False,
            },
        )
        session = Session(
            key=key, elder=elder, channel=channel, conversation_id=conversation["id"],
            language=language or repo.elder_languages(elder)[0], external_id=external_id,
        )
        if elder.get("consentStatus") != "granted" and not elder.get("isDemo"):
            session.mode = "consent"
        if channel == "screen" and repo.has_feature(elder, "family_avatar"):
            from ..avatar import active_avatar

            session.avatar = active_avatar(elder["id"])
        self._sessions[key] = session
        repo.touch_elder(elder["id"])
        return session

    def pop(self, key: str) -> Optional[Session]:
        return self._sessions.pop(key, None)

    def all(self) -> list[Session]:
        return list(self._sessions.values())


sessions = SessionManager()
