"""Kinly HTTP API mounted on the companion server.

Public (token protected):
- POST /v1/chat/completions   OpenAI compatible, streaming; Bolna uses it as a custom LLM
- GET  /v1/models
- POST /webhooks/bolna        post-call execution data
Internal (Bearer KINLY_API_TOKEN, called by the family app server):
- /api/kinly/*                calls, demo simulations, screen push, summaries, Memory Book, avatar
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from loguru import logger

from . import avatar as avatar_service
from . import db, memory_book, repo
from .brain import summary
from .brain.brain import EVENT_PREFIX, brain, strip_tags
from .brain.session import sessions
from .hub import hub
from .llm import llm
from .phone.bolna import bolna
from .phone.handler import handle_webhook, phone_reply
from .phone.scheduler import scheduler
from .settings import settings

DEMO_LINES = {
    "fall": {"en": "I fell in the bathroom this morning and my hip hurts.", "hi": "आज सुबह मैं बाथरूम में गिर गई और मेरे कूल्हे में दर्द है।"},
    "scam": {"en": "A man called saying he is from the bank. He wants the OTP that came on my phone to keep my account open.",
             "hi": "एक आदमी का फ़ोन आया, बोला बैंक से है। वो मेरे फ़ोन पर आया OTP माँग रहा है वरना खाता बंद हो जाएगा।"},
    "checkin": {"en": f"{EVENT_PREFIX}start_checkin", "hi": f"{EVENT_PREFIX}start_checkin"},
}


def require_token(authorization: Optional[str] = Header(default=None), token: Optional[str] = Query(default=None)) -> None:
    supplied = (authorization or "").removeprefix("Bearer ").strip() or (token or "")
    if supplied != settings.api_token:
        raise HTTPException(status_code=401, detail="Invalid Kinly API token")


def _chunk(cid: str, created: int, content: Optional[str] = None, finish: Optional[str] = None, role: bool = False) -> str:
    delta: dict = {}
    if role:
        delta["role"] = "assistant"
    if content is not None:
        delta["content"] = content
    body = {"id": cid, "object": "chat.completion.chunk", "created": created, "model": "kinly-companion",
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
    return f"data: {json.dumps(body, ensure_ascii=False)}\n\n"


def init_kinly_routes() -> APIRouter:
    router = APIRouter()

    # ------------------------------------------------------------- OpenAI compatible

    @router.get("/v1/models", dependencies=[Depends(require_token)])
    async def models():
        return {"object": "list", "data": [{"id": "kinly-companion", "object": "model", "owned_by": "kinly"}]}

    @router.post("/v1/chat/completions", dependencies=[Depends(require_token)])
    async def chat_completions(request: Request):
        body = await request.json()
        messages = body.get("messages") or []
        metadata = body.get("metadata") or body.get("user_data") or {}
        if body.get("user") and not metadata.get("session_id"):
            metadata["session_id"] = body["user"]
        headers = {k.lower(): v for k, v in request.headers.items()}
        cid = f"chatcmpl-{uuid.uuid4().hex[:20]}"
        created = int(time.time())

        if body.get("stream"):
            async def gen():
                yield _chunk(cid, created, role=True, content="")
                try:
                    async for text in phone_reply(messages, headers, metadata):
                        yield _chunk(cid, created, content=text if text.endswith(" ") else text + " ")
                except Exception as e:
                    logger.exception(f"phone turn failed: {e}")
                    yield _chunk(cid, created, content="Sorry, could you say that again?")
                yield _chunk(cid, created, finish="stop")
                yield "data: [DONE]\n\n"

            return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

        parts = [t async for t in phone_reply(messages, headers, metadata)]
        text = " ".join(p.strip() for p in parts)
        return {
            "id": cid, "object": "chat.completion", "created": created, "model": "kinly-companion",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    @router.post("/webhooks/bolna", dependencies=[Depends(require_token)])
    async def bolna_webhook(request: Request):
        payload = await request.json()
        logger.info(f"Bolna webhook: {payload.get('id')} status={payload.get('status')}")
        result = await handle_webhook(payload)
        return result

    # ------------------------------------------------------------- health

    @router.get("/api/kinly/health")
    async def health():
        return {
            "ok": True,
            "demoMode": settings.demo_mode,
            "providers": {
                "llm": llm.available, "deepgram": bool(settings.deepgram_api_key), "sarvam": bool(settings.sarvam_api_key),
                "cartesia": bool(settings.cartesia_api_key), "edgeTtsFallback": True, "bolna": settings.bolna_enabled,
                "whatsapp": bool(settings.whatsapp_token or settings.twilio_account_sid), "email": bool(settings.resend_api_key),
            },
            "onlineScreens": sorted(hub.online_elders()),
            "activeSessions": len(sessions.all()),
        }

    # ------------------------------------------------------------- internal

    internal = APIRouter(prefix="/api/kinly", dependencies=[Depends(require_token)])

    def _elder(elder_id: str) -> dict:
        elder = repo.get_elder(elder_id)
        if not elder:
            raise HTTPException(404, "Elder not found")
        return elder

    @internal.post("/calls/outbound")
    async def outbound_call(request: Request):
        body = await request.json()
        elder = _elder(body.get("elderId", ""))
        row = await bolna.place_call(elder, body.get("reason", "demo"), phone_override=body.get("phone") or None)
        return {"ok": row.get("status") != "failed", "call": row}

    @internal.post("/screen/push")
    async def screen_push(request: Request):
        body = await request.json()
        delivered = await hub.push(body["elderId"], body["message"])
        return {"delivered": delivered}

    @internal.get("/screen/online")
    async def screen_online(elderId: str):
        return {"online": hub.is_online(elderId)}

    async def _headless(elder: dict, text: str) -> dict:
        key = f"demo:{uuid.uuid4().hex[:8]}"
        session = sessions.start(key, elder, "demo")
        replies = []
        async for chunk in brain.respond(session, text):
            if isinstance(chunk, str):
                replies.append(strip_tags(chunk).strip())
        await asyncio.sleep(0.2)  # let alert notifications start
        asyncio.create_task(brain.finalize(session))
        return {"via": "headless", "reply": " ".join(replies)}

    @internal.post("/demo/simulate")
    async def simulate(request: Request):
        body = await request.json()
        elder = _elder(body.get("elderId", ""))
        kind = body.get("kind", "say")
        lang = body.get("language") or repo.elder_languages(elder)[0]
        if kind == "missed_medicine":
            return await _simulate_missed_medicine(elder)
        if kind == "missed_call":
            call = db.insert("phone_calls", {
                "elderId": elder["id"], "direction": "outbound", "reason": "checkin", "status": "no-answer",
                "scheduledFor": repo.elder_now(elder).replace(minute=0, second=0, microsecond=0), "attempt": settings.call_retry_count + 1,
                "error": "handled: simulated",
            })
            alert = await scheduler.missed_call_alert(elder, call)
            return {"via": "headless", "alert": alert}
        text = body.get("text") or DEMO_LINES.get(kind, {}).get(lang) or DEMO_LINES.get(kind, {}).get("en", "")
        if not text:
            raise HTTPException(400, "Nothing to say")
        if hub.is_online(elder["id"]) and not body.get("headless"):
            command = {"type": "kinly-command", "command": "start_checkin"} if text.startswith(EVENT_PREFIX) else \
                      {"type": "kinly-command", "command": "say", "text": text}
            delivered = await hub.push(elder["id"], command)
            if delivered:
                return {"via": "screen", "text": text}
        return await _headless(elder, text)

    async def _simulate_missed_medicine(elder: dict) -> dict:
        meds = repo.medicines(elder["id"])
        if not meds:
            raise HTTPException(400, "No medicines configured")
        med = meds[0]
        tz = repo.elder_tz(elder)
        now = repo.elder_now(elder)
        hh, mm = (int(x) for x in med["times"].split(",")[0].split(":"))
        alert = None
        for days_ago in (1, 0):
            day = (now - timedelta(days=days_ago)).date()
            slot = now.replace(year=day.year, month=day.month, day=day.day, hour=hh, minute=mm, second=0, microsecond=0)
            if days_ago == 0 and slot > now:
                slot = now - timedelta(minutes=65)
            slot = slot.astimezone(tz)
            existing = db.query_one("SELECT id FROM medicine_logs WHERE medicineId = ? AND scheduledFor = ?", [med["id"], slot])
            log_id = existing["id"] if existing else db.insert("medicine_logs", {
                "elderId": elder["id"], "medicineId": med["id"], "scheduledFor": slot, "status": "pending", "remindedCount": 1,
            })["id"]
            log = {"id": log_id, "medicineId": med["id"], "medicineName": med["name"], "scheduledLocal": slot}
            if days_ago == 1:
                repo.set_medicine_status(log_id, "missed", "auto")
            else:
                if elder.get("isDemo"):
                    # let the demo button fire repeatedly without the 6h de-duplication
                    db.execute("DELETE FROM alerts WHERE elderId = ? AND category = 'missed_medicine'", [elder["id"]])
                alert = await scheduler.mark_missed(elder, log)
                if hub.is_online(elder["id"]):
                    await scheduler.push_reminder(elder, {**log, "dosage": med["dosage"], "scheduledLocal": now})
        await summary.update_daily_summary(elder)
        return {"via": "headless", "alert": alert, "medicine": med["name"]}

    @internal.post("/elders/{elder_id}/summary")
    async def daily_summary(elder_id: str, send: bool = False):
        elder = _elder(elder_id)
        daily = await summary.update_daily_summary(elder)
        if send:
            await scheduler.send_daily(elder, daily)
        return daily

    @internal.post("/elders/{elder_id}/memory-book")
    async def generate_book(elder_id: str):
        chapters = await memory_book.generate(_elder(elder_id))
        return {"created": len(chapters), "chapters": chapters}

    @internal.post("/avatar/{avatar_id}/clone")
    async def avatar_clone(avatar_id: str):
        try:
            return await avatar_service.clone_voice(avatar_id)
        except PermissionError as e:
            raise HTTPException(403, str(e))
        except Exception as e:
            raise HTTPException(400, str(e))

    @internal.post("/avatar/{avatar_id}/revoke")
    async def avatar_revoke(avatar_id: str, request: Request):
        body = await request.json()
        await avatar_service.revoke(avatar_id, body.get("actorUserId", ""))
        return {"ok": True}

    @internal.post("/avatar/{avatar_id}/preview")
    async def avatar_preview(avatar_id: str, request: Request):
        body = await request.json()
        try:
            audio = await avatar_service.preview(avatar_id, body.get("text", ""))
        except Exception as e:
            raise HTTPException(400, str(e))
        return Response(content=audio, media_type="audio/wav")

    @internal.post("/scheduler/tick")
    async def tick():
        await scheduler.tick()
        return {"ok": True}

    @internal.post("/sessions/end-all")
    async def end_all():
        for s in sessions.all():
            await brain.finalize(s)
        return {"ok": True}

    router.include_router(internal)
    return router


async def on_startup(tts_engine=None) -> None:
    """Warm up providers so the first live response is fast, then start the scheduler."""
    started = time.perf_counter()
    try:
        db.conn()
    except Exception as e:
        logger.error(f"Kinly database unavailable: {e}")
    if tts_engine is not None and hasattr(tts_engine, "warm_up"):
        await tts_engine.warm_up()
    if llm.available:
        try:
            await asyncio.wait_for(llm.complete([{"role": "user", "content": "Say OK."}], max_tokens=3), timeout=8)
        except Exception as e:
            logger.warning(f"LLM warm up failed: {e}")
    scheduler.start()
    logger.info(f"Kinly ready (warm up {int((time.perf_counter() - started) * 1000)} ms)")
