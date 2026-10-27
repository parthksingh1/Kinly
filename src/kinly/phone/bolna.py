"""Bolna phone integration.

- Outbound calls: POST https://api.bolna.ai/call with user_data variables.
- Agent setup: builds the v2 agent JSON (custom LLM = our /v1/chat/completions endpoint).
- Webhook parsing: execution payloads (same shape as GET /executions/{id}).

Bolna only sends `Authorization: Bearer <key>` to a custom LLM, so the agent prompt carries a
KINLY_CONTEXT line with Bolna variables; our endpoint reads the elder and call ids from it.
Docs: https://www.bolna.ai/docs/custom-llm-inference , /docs/api-reference/calls/make
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

import httpx
from loguru import logger

from .. import db, repo
from ..db import now_utc
from ..settings import settings

API = "https://api.bolna.ai"

CONTEXT_LINE = (
    "KINLY_CONTEXT elder_id={elder_id} caller={from_number} callee={to_number} "
    "execution={execution_id} call_sid={call_sid}"
)

BOLNA_PROMPT = (
    "You are Kinly, a warm, patient AI companion for older adults calling for a short daily check-in.\n"
    "Keep every reply short and kind. Never ask for money, OTPs, passwords or bank details.\n"
    + CONTEXT_LINE
)

_CTX = re.compile(
    r"KINLY_CONTEXT\s+elder_id=(?P<elder>\S*)\s+caller=(?P<caller>\S*)\s+callee=(?P<callee>\S*)\s+"
    r"execution=(?P<execution>\S*)\s+call_sid=(?P<sid>\S*)"
)


def _clean(value: Optional[str]) -> str:
    value = (value or "").strip()
    return "" if (not value or value.startswith("{") or value.lower() in ("none", "null")) else value


def parse_context(messages: list[dict]) -> dict:
    """Pull Kinly/Bolna call variables out of the (substituted) system prompt."""
    for m in messages:
        content = m.get("content")
        if isinstance(content, list):
            content = " ".join(part.get("text", "") for part in content if isinstance(part, dict))
        if m.get("role") == "system" and isinstance(content, str):
            match = _CTX.search(content)
            if match:
                return {
                    "elder_id": _clean(match.group("elder")),
                    "caller": _clean(match.group("caller")),
                    "callee": _clean(match.group("callee")),
                    "execution_id": _clean(match.group("execution")),
                    "call_sid": _clean(match.group("sid")),
                }
    return {}


def parse_transcript(text: str) -> list[dict]:
    """Bolna transcript: 'assistant: ...\\nuser: ...' -> Kinly transcript turns."""
    turns: list[dict] = []
    for line in (text or "").splitlines():
        m = re.match(r"^\s*(assistant|user|agent|bot|human|customer)\s*:\s*(.*)$", line, re.I)
        if m:
            role = "user" if m.group(1).lower() in ("user", "human", "customer") else "assistant"
            turns.append({"role": role, "text": m.group(2).strip(), "private": False})
        elif turns and line.strip():
            turns[-1]["text"] += " " + line.strip()
    return [t for t in turns if t["text"]]


def agent_config(language: str = "hi", voice: Optional[dict] = None) -> dict:
    """Bolna v2 agent body for Kinly (POST /v2/agent, PUT /v2/agent/{id})."""
    base = settings.public_base_url
    indian = language in ("hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "od")
    transcriber = (
        {"provider": "sarvam", "model": "saaras:v4", "language": language, "stream": True, "endpointing": 700}
        if indian else
        {"provider": "deepgram", "model": "nova-3", "language": language, "stream": True, "encoding": "linear16",
         "sampling_rate": 16000, "endpointing": 700}
    )
    synthesizer = voice or (
        {"provider": "sarvam", "provider_config": {"voice": "Priya", "voice_id": "priya", "model": "bulbul:v3",
                                                   "language": language, "speed": 0.9},
         "stream": True, "buffer_size": 150}
        if indian else
        {"provider": "cartesia", "provider_config": {"voice": "Kinly", "voice_id": "6ccbfb76-1fc6-48f7-b71d-91ac6298247b",
                                                     "model": "sonic-3", "language": language},
         "stream": True, "buffer_size": 150}
    )
    welcome = {
        "hi": "नमस्ते {preferred_name} जी, मैं Kinly बोल रही हूँ।",
        "es": "Hola {preferred_name}, le habla Kinly.",
    }.get(language, "Hello {preferred_name}, it's Kinly calling.")
    return {
        "agent_config": {
            "agent_name": "Kinly companion",
            "agent_welcome_message": welcome,
            "webhook_url": f"{base}/webhooks/bolna?token={settings.api_token}",
            "tasks": [{
                "task_type": "conversation",
                "toolchain": {"execution": "sequential", "pipelines": [["transcriber", "llm", "synthesizer"]]},
                "tools_config": {
                    "llm_agent": {
                        "agent_type": "simple_llm_agent",
                        "agent_flow_type": "streaming",
                        "llm_config": {
                            "provider": "custom", "model": "kinly-companion", "base_url": f"{base}/v1",
                            "family": "openai", "max_tokens": 200, "temperature": 0.6,
                        },
                    },
                    "synthesizer": synthesizer,
                    "transcriber": transcriber,
                    "input": {"provider": "plivo", "format": "wav"},
                    "output": {"provider": "plivo", "format": "wav"},
                },
                "task_config": {
                    "hangup_after_silence": 20,          # older adults pause longer
                    "call_terminate": 600,
                    "number_of_words_for_interruption": 3,
                    "incremental_delay": 900,           # wait a little longer before replying
                    "backchanneling": False,
                    "ambient_noise": False,
                },
            }],
        },
        "agent_prompts": {"task_1": {"system_prompt": BOLNA_PROMPT}},
    }


class BolnaClient:
    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {settings.bolna_api_key}", "Content-Type": "application/json"}

    async def place_call(self, elder: dict, reason: str = "checkin", scheduled_for: Optional[datetime] = None,
                         attempt: int = 1, phone_override: Optional[str] = None) -> dict:
        """Places an outbound call and records it. Returns the phone_calls row."""
        phone = phone_override or elder.get("phone")
        row = db.insert("phone_calls", {
            "elderId": elder["id"], "direction": "outbound", "reason": reason, "status": "queued",
            "scheduledFor": scheduled_for or now_utc(), "attempt": attempt, "error": "",
        })
        if not settings.bolna_enabled:
            db.update("phone_calls", row["id"], {"status": "failed", "error": "Bolna is not configured (BOLNA_API_KEY, BOLNA_AGENT_ID)"})
            logger.warning("Bolna call skipped: not configured")
            return {**row, "status": "failed", "error": "Bolna is not configured"}
        if not phone:
            db.update("phone_calls", row["id"], {"status": "failed", "error": "No phone number"})
            return {**row, "status": "failed", "error": "No phone number"}
        langs = repo.elder_languages(elder)
        body = {
            "agent_id": settings.bolna_agent_id,
            "recipient_phone_number": phone if phone.startswith("+") else f"+{phone}",
            "user_data": {
                "elder_id": elder["id"], "preferred_name": elder.get("preferredName") or elder["name"],
                "elder_name": elder["name"], "kinly_reason": reason, "language": langs[0],
            },
        }
        if settings.bolna_from_number:
            body["from_phone_number"] = settings.bolna_from_number
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(f"{API}/call", headers=self._headers(), json=body)
            data = r.json() if r.content else {}
            if r.status_code >= 300:
                raise RuntimeError(f"{r.status_code}: {str(data)[:300]}")
            execution_id = data.get("execution_id") or data.get("call_id")
            db.update("phone_calls", row["id"], {"status": data.get("status", "queued"), "executionId": execution_id})
            logger.info(f"Bolna call queued for {elder['name']}: {execution_id}")
            return {**row, "executionId": execution_id, "status": data.get("status", "queued")}
        except Exception as e:
            db.update("phone_calls", row["id"], {"status": "failed", "error": str(e)[:500]})
            logger.error(f"Bolna call failed: {e}")
            return {**row, "status": "failed", "error": str(e)}

    async def get_execution(self, execution_id: str) -> Optional[dict]:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{API}/executions/{execution_id}", headers=self._headers())
        return r.json() if r.status_code < 300 else None


bolna = BolnaClient()
