"""Elder screen handshake: pairs a WebSocket connection with an elder profile."""

from __future__ import annotations

from typing import Awaitable, Callable

from . import repo
from .hub import hub
from .llm import llm
from .settings import settings


def hello(client_uid: str, screen_token: str, send_text: Callable[[str], Awaitable[None]]) -> dict:
    elder = repo.elder_by_screen_token(screen_token) if screen_token else None
    if elder is None and settings.demo_mode:
        demo = [e for e in repo.list_elders() if e.get("isDemo")]
        elder = demo[0] if demo else None
    if elder is None:
        return {"type": "kinly-error", "message": "This screen is not paired. Open the link from the family app."}
    hub.register(client_uid, elder["id"], send_text)
    repo.touch_elder(elder["id"])
    features = sorted(f for f in repo.PLAN_FEATURES["premium"] if repo.has_feature(elder, f))
    return {
        "type": "kinly-ready",
        "elder": {
            "id": elder["id"],
            "name": elder["name"],
            "preferredName": elder["preferredName"],
            "languages": repo.elder_languages(elder),
            "timezone": elder["timezone"],
            "consentStatus": elder["consentStatus"],
            "isDemo": bool(elder.get("isDemo")),
        },
        "features": features,
        "serverAsr": bool(settings.deepgram_api_key or settings.sarvam_api_key),
        "llm": llm.available,
    }
