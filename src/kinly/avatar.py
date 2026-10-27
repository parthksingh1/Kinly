"""Family Avatar voice (Premium, consent gated).

Product rules enforced here and in the family app:
- only the represented adult can create it, from their own account, with a recorded spoken consent;
- the plan owner confirms suitability and the elder is told; off by default;
- it always discloses it is an AI voice; money/credential requests are hard blocked (output_filter);
- one click revoke deletes the cloned voice at the provider and all local audio/photo files;
- every step is written to the audit log.
"""

from __future__ import annotations

from pathlib import Path

import httpx
from loguru import logger

from . import db, repo
from .db import now_utc
from .settings import settings

CARTESIA = "https://api.cartesia.ai"
HEADERS = lambda: {"Authorization": f"Bearer {settings.cartesia_api_key}", "Cartesia-Version": "2026-08-14"}  # noqa: E731


def _abs(path: str) -> Path:
    p = Path(path)
    return p if p.is_absolute() else settings.uploads_dir / p


async def clone_voice(avatar_id: str) -> dict:
    avatar = db.get("family_avatars", avatar_id)
    if not avatar:
        raise ValueError("Avatar not found")
    if not (avatar["consentAt"] and avatar["adultConfirmed"] and avatar["consentAudioPath"]):
        raise PermissionError("The represented adult has not recorded consent yet")
    elder = repo.get_elder(avatar["elderId"])
    if not repo.has_feature(elder, "family_avatar"):
        raise PermissionError("Family Avatar is a Premium feature")
    if not settings.cartesia_api_key:
        raise RuntimeError("Voice cloning needs CARTESIA_API_KEY")
    clip = _abs(avatar["consentAudioPath"])
    language = repo.elder_languages(elder)[0]
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{CARTESIA}/voices/clone",
            headers=HEADERS(),
            files={"clip": (clip.name, clip.read_bytes(), "audio/webm" if clip.suffix == ".webm" else "audio/wav")},
            data={"name": f"Kinly - {avatar['displayName']} (consented)", "language": language if language in ("en", "hi", "es") else "en",
                  "description": f"Consented voice of {avatar['displayName']} for Kinly Family Avatar"},
        )
    if r.status_code >= 300:
        raise RuntimeError(f"Cartesia clone failed: {r.status_code} {r.text[:300]}")
    voice_id = r.json().get("id")
    db.update("family_avatars", avatar_id, {"voiceProvider": "cartesia", "voiceId": voice_id, "status": "consented"})
    repo.audit(elder["familyId"], "avatar_voice_cloned", {"avatarId": avatar_id, "provider": "cartesia"}, elder["id"], avatar["userId"])
    logger.info(f"Family Avatar voice cloned for {avatar['displayName']}")
    return {"voiceId": voice_id}


async def revoke(avatar_id: str, actor_user_id: str) -> None:
    avatar = db.get("family_avatars", avatar_id)
    if not avatar:
        return
    elder = repo.get_elder(avatar["elderId"])
    if avatar["voiceProvider"] == "cartesia" and avatar["voiceId"] and settings.cartesia_api_key:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                await client.delete(f"{CARTESIA}/voices/{avatar['voiceId']}", headers=HEADERS())
        except Exception as e:
            logger.error(f"Could not delete voice at provider: {e}")
    for key in ("consentAudioPath", "photoPath"):
        if avatar.get(key):
            try:
                _abs(avatar[key]).unlink(missing_ok=True)
            except Exception as e:
                logger.error(f"Could not delete {key}: {e}")
    db.update("family_avatars", avatar_id, {
        "status": "revoked", "enabled": False, "voiceId": "", "consentAudioPath": "", "photoPath": "", "revokedAt": now_utc(),
    })
    repo.audit(elder["familyId"], "avatar_revoked_and_deleted", {"avatarId": avatar_id}, elder["id"], actor_user_id)


def active_avatar(elder_id: str) -> dict | None:
    return db.query_one(
        "SELECT * FROM family_avatars WHERE elderId = ? AND enabled = 1 AND status = 'active' AND voiceId != '' ORDER BY createdAt DESC",
        [elder_id],
    )


async def preview(avatar_id: str, text: str) -> bytes:
    avatar = db.get("family_avatars", avatar_id)
    if not avatar or not avatar.get("voiceId"):
        raise ValueError("No cloned voice")
    from .brain.output_filter import filter_sentence

    safe = filter_sentence(text)
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{CARTESIA}/tts/bytes", headers=HEADERS(), json={
            "model_id": "sonic-3", "transcript": safe, "voice": {"mode": "id", "id": avatar["voiceId"]},
            "output_format": {"container": "wav", "encoding": "pcm_s16le", "sample_rate": 24000},
        })
    r.raise_for_status()
    repo.audit(repo.get_elder(avatar["elderId"])["familyId"], "avatar_voice_used", {"avatarId": avatar_id, "use": "preview"}, avatar["elderId"])
    return r.content
