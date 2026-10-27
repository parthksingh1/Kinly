"""Phone conversations: Bolna calls our OpenAI compatible endpoint every turn, and posts the
execution to our webhook when the call ends."""

from __future__ import annotations

import hashlib
import time
from typing import AsyncIterator, Optional

from loguru import logger

from .. import db, repo
from ..brain.brain import brain, strip_tags
from ..brain.session import Session, sessions
from ..settings import settings
from .bolna import parse_context, parse_transcript

TERMINAL_FAILED = {"no-answer", "busy", "failed", "canceled", "error", "stopped", "balance-low"}
TERMINAL_DONE = {"completed", "call-disconnected"}


def _content(message: dict) -> str:
    content = message.get("content") or ""
    if isinstance(content, list):
        content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
    return str(content)


def resolve_elder(ctx: dict, headers: dict) -> Optional[dict]:
    elder_id = ctx.get("elder_id") or headers.get("x-kinly-elder-id") or ""
    elder = repo.get_elder(elder_id) if elder_id else None
    if not elder:
        for number in (ctx.get("caller"), ctx.get("callee"), headers.get("x-kinly-caller")):
            if number:
                elder = repo.elder_by_phone(number)
                if elder:
                    break
    if not elder and settings.demo_mode:
        demo = [e for e in repo.list_elders() if e.get("isDemo")]
        elder = demo[0] if demo else None
    return elder


def session_key(ctx: dict, messages: list[dict], metadata: dict) -> str:
    call_id = ctx.get("execution_id") or ctx.get("call_sid") or metadata.get("call_id") or metadata.get("session_id")
    if call_id:
        return f"phone:{call_id}"
    first_user = next((_content(m) for m in messages if m.get("role") == "user"), "")
    seed = f"{ctx.get('caller')}|{first_user}|{time.strftime('%Y%m%d%H')}"
    return "phone:anon:" + hashlib.sha1(seed.encode()).hexdigest()[:12]


def get_or_start(messages: list[dict], headers: dict, metadata: dict) -> Optional[Session]:
    ctx = parse_context(messages)
    key = session_key(ctx, messages, metadata)
    session = sessions.get(key)
    if session and not session.ended:
        return session
    elder = resolve_elder(ctx, headers)
    if not elder:
        return None
    execution_id = ctx.get("execution_id") or None
    if execution_id and db.query_one("SELECT id FROM conversations WHERE externalId = ?", [execution_id]):
        execution_id = None  # already stored (server restart mid-call); keep a fresh row
    session = sessions.start(key, elder, "phone", external_id=execution_id)
    # Bolna speaks its welcome line itself; record it so the transcript reads naturally.
    first_assistant = next((_content(m) for m in messages if m.get("role") == "assistant"), "")
    if first_assistant:
        session.add("assistant", first_assistant)
    if execution_id:
        call = db.query_one("SELECT id FROM phone_calls WHERE executionId = ?", [execution_id])
        if call:
            db.update("phone_calls", call["id"], {"conversationId": session.conversation_id, "status": "in-progress"})
        else:
            db.insert("phone_calls", {
                "elderId": elder["id"], "direction": "inbound", "reason": "inbound", "status": "in-progress",
                "scheduledFor": db.now_utc(), "attempt": 1, "executionId": execution_id,
                "conversationId": session.conversation_id, "error": "",
            })
    logger.info(f"Phone session started for {elder['name']} ({key})")
    return session


async def phone_reply(messages: list[dict], headers: dict, metadata: dict) -> AsyncIterator[str]:
    """Yields speakable text chunks for one phone turn."""
    started = time.perf_counter()
    session = get_or_start(messages, headers, metadata)
    if session is None:
        yield "Hello, this is Kinly. I'm sorry, I couldn't find your profile. Please ask your family to set up Kinly for this number."
        return
    last_user = next((_content(m) for m in reversed(messages) if m.get("role") == "user"), "")
    first = True
    async for chunk in brain.respond(session, last_user):
        if isinstance(chunk, dict):
            continue  # screen-only actions
        text = strip_tags(chunk)
        if not text.strip():
            continue
        if first:
            ms = int((time.perf_counter() - started) * 1000)
            session.first_audio_ms.append(ms)
            repo.record_turn_metric(session.elder_id, "phone", ms, "bolna", "bolna", session.language)
            first = False
        yield text


async def handle_webhook(payload: dict) -> dict:
    execution_id = payload.get("id") or payload.get("execution_id")
    status = (payload.get("status") or "").lower()
    if not execution_id:
        return {"ok": False, "reason": "no execution id"}
    call = db.query_one("SELECT * FROM phone_calls WHERE executionId = ?", [execution_id])
    if call:
        db.update("phone_calls", call["id"], {"status": status or call["status"], "error": payload.get("error_message") or call["error"]})

    transcript_text = payload.get("transcript") or ""
    if status not in TERMINAL_DONE or not transcript_text.strip():
        return {"ok": True, "status": status, "processed": False}

    already = db.query_one("SELECT id, processed FROM conversations WHERE externalId = ?", [execution_id])
    if already and already["processed"]:
        return {"ok": True, "status": status, "processed": False, "reason": "already processed"}

    session = sessions.get(f"phone:{execution_id}")
    if session is None:
        context = payload.get("context_details") or {}
        user_data = context.get("recipient_data") or context.get("user_data") or context or {}
        ctx = {"elder_id": user_data.get("elder_id") if isinstance(user_data, dict) else "",
               "caller": payload.get("user_number") or "", "callee": payload.get("agent_number") or ""}
        elder = resolve_elder(ctx, {})
        if not elder:
            return {"ok": False, "reason": "unknown elder"}
        session = sessions.start(f"phone:{execution_id}", elder, "phone", external_id=None if already else execution_id)
        if already:
            session.conversation_id = already["id"]
    transcript = parse_transcript(transcript_text)
    # Keep privacy flags decided live during the call.
    live_private = {t["text"] for t in session.transcript if t.get("private")}
    for t in transcript:
        if t["text"] in live_private:
            t["private"] = True
    duration = int(payload.get("conversation_duration") or (payload.get("telephony_data") or {}).get("duration") or 0)
    result = await brain.finalize(session, transcript_override=transcript, duration_sec=duration)
    if call:
        db.update("phone_calls", call["id"], {"conversationId": session.conversation_id, "status": "completed"})
    return {"ok": True, "status": status, "processed": True, "summary": (result or {}).get("summary")}
