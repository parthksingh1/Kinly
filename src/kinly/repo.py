"""Read/write helpers for Kinly domain objects on top of db.py."""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from . import db
from .db import from_db_dt, now_utc


# ---------------------------------------------------------------- elders


def get_elder(elder_id: str) -> Optional[dict]:
    return db.get("elders", elder_id) if elder_id else None


def elder_by_screen_token(token: str) -> Optional[dict]:
    return db.query_one("SELECT * FROM elders WHERE screenToken = ?", [token])


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"[^\d+]", "", phone or "")
    return digits.lstrip("+")[-10:]  # compare on the last 10 digits


def elder_by_phone(phone: str) -> Optional[dict]:
    key = normalize_phone(phone)
    if not key:
        return None
    for elder in db.query("SELECT * FROM elders WHERE phone != ''"):
        if normalize_phone(elder["phone"]) == key:
            return elder
    return None


def list_elders() -> list[dict]:
    return db.query("SELECT * FROM elders ORDER BY createdAt")


def elder_tz(elder: dict) -> ZoneInfo:
    try:
        return ZoneInfo(elder.get("timezone") or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def elder_now(elder: dict) -> datetime:
    return now_utc().astimezone(elder_tz(elder))


def elder_languages(elder: dict) -> list[str]:
    langs = [x.strip() for x in (elder.get("languages") or "en").split(",") if x.strip()]
    return langs or ["en"]


def touch_elder(elder_id: str) -> None:
    db.update("elders", elder_id, {"lastActiveAt": now_utc()})


def family_of(elder: dict) -> Optional[dict]:
    return db.get("families", elder["familyId"])


def family_recipients(family_id: str) -> list[dict]:
    return db.query(
        """SELECT u.name, u.email, m.phone, m.role, m.relation, m.notifyWhatsapp, m.notifyEmail
           FROM family_members m JOIN users u ON u.id = m.userId
           WHERE m.familyId = ? ORDER BY m.role DESC""",
        [family_id],
    )


# ---------------------------------------------------------------- plans

PLAN_FEATURES = {
    "trial": {"checkin_call", "reminders", "daily_summary", "safety_alerts", "screen", "voice_messages", "video_calls", "memory_book", "scam_shield", "inbound"},
    "care": {"checkin_call", "inbound", "reminders", "daily_summary", "safety_alerts"},
    "family": {"checkin_call", "inbound", "reminders", "daily_summary", "safety_alerts", "screen", "video_calls", "voice_messages", "memory_book", "scam_shield"},
    "premium": {"checkin_call", "inbound", "reminders", "daily_summary", "safety_alerts", "screen", "video_calls", "voice_messages", "memory_book", "scam_shield", "priority_alerts", "family_avatar", "multi_calls"},
}


def has_feature(elder: dict, feature: str) -> bool:
    family = family_of(elder)
    plan = (family or {}).get("plan", "trial")
    # Safety never depends on the plan: urgent alerts always fire.
    if feature == "safety_alerts":
        return True
    return feature in PLAN_FEATURES.get(plan, PLAN_FEATURES["trial"])


# ---------------------------------------------------------------- contacts & meds


def contacts(elder_id: str) -> list[dict]:
    return db.query("SELECT * FROM contacts WHERE elderId = ? ORDER BY isEmergency DESC, name", [elder_id])


def find_contact(elder_id: str, spoken: str) -> Optional[dict]:
    spoken_l = spoken.lower()
    best = None
    for c in contacts(elder_id):
        names = {c["name"].lower(), c["name"].split()[0].lower()}
        if c.get("relation"):
            names.add(c["relation"].lower())
        if any(n and re.search(rf"\b{re.escape(n)}\b", spoken_l) for n in names):
            best = c
            break
    return best


def medicines(elder_id: str) -> list[dict]:
    return db.query("SELECT * FROM medicines WHERE elderId = ? AND active = 1 ORDER BY name", [elder_id])


def _parse_times(times: str) -> list[tuple[int, int]]:
    out = []
    for t in (times or "").split(","):
        m = re.match(r"\s*(\d{1,2}):(\d{2})", t)
        if m:
            out.append((int(m.group(1)), int(m.group(2))))
    return out


def ensure_medicine_logs(elder: dict, day: Optional[date] = None) -> None:
    """Create pending log rows for each scheduled dose of the elder's local day."""
    tz = elder_tz(elder)
    day = day or elder_now(elder).date()
    for med in medicines(elder["id"]):
        for hh, mm in _parse_times(med["times"]):
            local = datetime(day.year, day.month, day.day, hh, mm, tzinfo=tz)
            db.execute(
                """INSERT OR IGNORE INTO medicine_logs (id, elderId, medicineId, scheduledFor, status, remindedCount, createdAt)
                   VALUES (?, ?, ?, ?, 'pending', 0, ?)""",
                [db.new_id(), elder["id"], med["id"], local, now_utc()],
            )


def todays_medicine_logs(elder: dict) -> list[dict]:
    ensure_medicine_logs(elder)
    tz = elder_tz(elder)
    today = elder_now(elder).date()
    start = datetime(today.year, today.month, today.day, tzinfo=tz)
    rows = db.query(
        """SELECT l.*, m.name AS medicineName, m.dosage, m.instructions
           FROM medicine_logs l JOIN medicines m ON m.id = l.medicineId
           WHERE l.elderId = ? AND l.scheduledFor >= ? AND l.scheduledFor < ?
           ORDER BY l.scheduledFor""",
        [elder["id"], start, start + timedelta(days=1)],
    )
    for r in rows:
        r["scheduledLocal"] = from_db_dt(r["scheduledFor"]).astimezone(tz)
    return rows


def due_medicine_logs(elder: dict, window_minutes: int = 90) -> list[dict]:
    """Pending doses whose time has come (up to window_minutes ago)."""
    now = elder_now(elder)
    return [
        r
        for r in todays_medicine_logs(elder)
        if r["status"] == "pending"
        and r["scheduledLocal"] <= now + timedelta(minutes=10)
        and r["scheduledLocal"] >= now - timedelta(minutes=window_minutes)
    ]


def set_medicine_status(log_id: str, status: str, source: str) -> None:
    db.update(
        "medicine_logs",
        log_id,
        {"status": status, "source": source, "confirmedAt": now_utc() if status == "taken" else None},
    )


# ---------------------------------------------------------------- alerts


def create_alert(
    elder_id: str,
    severity: str,
    category: str,
    title: str,
    detail: str = "",
    quote: str = "",
    conversation_id: Optional[str] = None,
) -> dict:
    return db.insert(
        "alerts",
        {
            "elderId": elder_id,
            "severity": severity,
            "category": category,
            "title": title,
            "detail": detail,
            "quote": quote[:500],
            "status": "open",
            "conversationId": conversation_id,
        },
    )


def recent_alert_exists(elder_id: str, category: str, minutes: int = 30) -> bool:
    since = now_utc() - timedelta(minutes=minutes)
    row = db.query_one(
        "SELECT id FROM alerts WHERE elderId = ? AND category = ? AND createdAt >= ?",
        [elder_id, category, since],
    )
    return row is not None


def audit(family_id: str, action: str, detail: dict, elder_id: Optional[str] = None, actor: Optional[str] = None) -> None:
    db.insert(
        "audit_logs",
        {"familyId": family_id, "elderId": elder_id, "actorUserId": actor, "action": action, "detail": detail},
    )


def record_turn_metric(elder_id: Optional[str], channel: str, first_audio_ms: int, asr: str = "", tts: str = "", language: str = "") -> None:
    db.insert(
        "turn_metrics",
        {"elderId": elder_id, "channel": channel, "firstAudioMs": int(first_audio_ms), "asrProvider": asr, "ttsProvider": tts, "language": language},
    )
