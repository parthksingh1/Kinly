"""Conversation and daily summaries for the family, mood, topics and "Talk about this" ideas.

Private turns ("keep this between us") are removed before anything is summarized.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from loguru import logger

from .. import db, repo
from ..db import from_db_dt, now_utc
from ..llm import llm
from .safety import Signal

MOOD_LABELS = {1: "Very low", 2: "Low", 3: "Okay", 4: "Good", 5: "Very good"}

TOPIC_WORDS = {
    "Gardening": r"garden|plant|flower|rose|tulsi|seed|बगीच|पौध|jardín|planta",
    "Family": r"son|daughter|grand|beta|beti|family|परिवार|nieta|nieto|hijo|hija",
    "Health": r"knee|pain|doctor|blood pressure|bp|sugar|dard|दर्द|médico|dolor",
    "Music": r"song|music|sing|gaana|gana|गाना|bollywood|kishore|lata|rafi|música|canción",
    "Food & cooking": r"cook|recipe|food|khana|खाना|cocina|comida|eat",
    "Sleep": r"sleep|slept|neend|नींद|dorm",
    "Walks & exercise": r"walk|park|exercise|yoga|टहल|paseo|caminar",
    "Faith & festivals": r"temple|prayer|puja|pooja|diwali|holi|church|mass|festival|मंदिर|iglesia",
    "Friends & neighbours": r"friend|neighbo|dost|दोस्त|amig|vecin",
    "Memories": r"when i was|used to|years ago|bachpan|बचपन|cuando era",
    "Medicines": r"medicine|tablet|dawai|दवा|pill|medicina",
    "Weather": r"rain|hot|cold|weather|baarish|बारिश|lluvia|calor|frío",
}

_POS = r"\b(good|great|happy|lovely|wonderful|fine|better|enjoy|laugh|accha|achha|badhiya|khush|bien|feliz|alegr)\w*|अच्छ|खुश|बढ़िया"
_NEG = r"\b(sad|lonely|tired|pain|hurt|bad|worse|alone|miss|cry|dukhi|udaas|akeli|akela|thak|dard|triste|sola|dolor|mal)\w*|उदास|अकेल|दर्द|थक"


def public_turns(transcript: list[dict]) -> list[dict]:
    return [t for t in transcript if not t.get("private") and t.get("text")]


def heuristic_mood(texts: list[str]) -> int:
    joined = " ".join(texts).lower()
    pos, neg = len(re.findall(_POS, joined)), len(re.findall(_NEG, joined))
    score = 3 + min(2, pos * 0.5) - min(2, neg * 0.7)
    return max(1, min(5, round(score)))


def heuristic_topics(texts: list[str]) -> list[str]:
    joined = " ".join(texts).lower()
    return [topic for topic, pattern in TOPIC_WORDS.items() if re.search(pattern, joined)][:5]


_SUMMARY_SYSTEM = """You write short, warm, factual updates for the family of an older adult, based on a
conversation between the elder and Kinly (an AI companion). Never diagnose. Never invent facts.
Return JSON: {"summary": 2-3 sentences in English for the family, "mood": 1-5 (1 very low, 5 very good),
"mood_label": short label, "topics": up to 5 short topic names, "follow_ups": up to 3 short things the family
might follow up on (empty if none)}"""


async def summarize_conversation(elder: dict, transcript: list[dict], conversation_id: str,
                                 signals: Optional[list[Signal]] = None) -> dict:
    name = elder.get("preferredName") or elder.get("name")
    turns = public_turns(transcript)
    elder_texts = [t["text"] for t in turns if t["role"] == "user"]
    result: dict = {}
    if llm.available and elder_texts:
        convo = "\n".join(f"{'ELDER' if t['role'] == 'user' else 'KINLY'}: {t['text']}" for t in turns)
        data = await llm.complete_json(_SUMMARY_SYSTEM, f"Elder: {name}\n\n{convo[-7000:]}")
        if isinstance(data, dict) and data.get("summary"):
            result = {
                "summary": str(data["summary"])[:800],
                "mood": int(data.get("mood") or 3),
                "moodLabel": str(data.get("mood_label") or ""),
                "topics": [str(t) for t in (data.get("topics") or [])][:5],
                "followUps": [str(f) for f in (data.get("follow_ups") or [])][:3],
            }
    if not result:
        mood = heuristic_mood(elder_texts)
        topics = heuristic_topics(elder_texts)
        topic_text = ", ".join(t.lower() for t in topics[:3]) or "how the day was going"
        result = {
            "summary": f"{name} had a {MOOD_LABELS[mood].lower()} conversation with Kinly and talked about {topic_text}." if elder_texts else f"{name} did not say much in this conversation.",
            "mood": mood,
            "moodLabel": MOOD_LABELS[mood],
            "topics": topics,
            "followUps": [],
        }
    for s in signals or []:
        note = f"{s.title}: \"{s.quote[:120]}\""
        if note not in result["followUps"]:
            result["followUps"].append(note)
    result["mood"] = max(1, min(5, int(result["mood"])))
    result["moodLabel"] = result["moodLabel"] or MOOD_LABELS[result["mood"]]
    db.update("conversations", conversation_id, {
        "summary": result["summary"], "mood": result["mood"], "moodLabel": result["moodLabel"],
        "topics": json.dumps(result["topics"]), "processed": True,
    })
    return result


async def check_wellbeing_trends(elder: dict, days: int = 3) -> None:
    """Low mood across several days -> concerning alert (once per 2 days)."""
    since = now_utc() - timedelta(days=days)
    rows = db.query(
        "SELECT mood, startedAt FROM conversations WHERE elderId = ? AND startedAt >= ? AND mood IS NOT NULL",
        [elder["id"], since],
    )
    tz = repo.elder_tz(elder)
    by_day: dict[str, list[int]] = {}
    for r in rows:
        day = from_db_dt(r["startedAt"]).astimezone(tz).date().isoformat()
        by_day.setdefault(day, []).append(r["mood"])
    low_days = [d for d, moods in by_day.items() if sum(moods) / len(moods) <= 2.4]
    name = elder.get("preferredName") or elder["name"]
    if len(low_days) >= 2 and not repo.recent_alert_exists(elder["id"], "low_mood_trend", 48 * 60):
        alert = repo.create_alert(
            elder["id"], "concerning", "low_mood_trend", "Low mood for several days",
            f"{name} has sounded low on {len(low_days)} of the last {days} days. A call or visit from family could help.",
        )
        from ..notify import notifier

        await notifier.alert(elder, alert)


def _week_mentions(elder: dict) -> Counter:
    """Count people and things the elder brought up in the last 7 days (public turns only)."""
    since = now_utc() - timedelta(days=7)
    rows = db.query("SELECT transcript FROM conversations WHERE elderId = ? AND startedAt >= ?", [elder["id"], since])
    texts = []
    for r in rows:
        texts.extend(t["text"] for t in public_turns(db.loads(r["transcript"], [])) if t["role"] == "user")
    joined = " ".join(texts)
    counts: Counter = Counter()
    known_contacts = {c["name"].split()[0] for c in repo.contacts(elder["id"])}
    subjects = {m["subject"] for m in db.query(
        "SELECT DISTINCT subject FROM memories WHERE elderId = ? AND forgotten = 0 AND private = 0 AND subject != ''", [elder["id"]]
    )}
    for word in re.findall(r"\b[A-Z][a-z]{2,}\b", joined):
        if word in known_contacts or word in {"Kinly", "The", "And", "But", "Yes", "Today", "Good", "Hello", "Hi", "Okay", "I'm", "What", "How"}:
            continue
        counts[word] += 1
    low = joined.lower()
    for s in subjects:
        if s and s[0].isupper() and s not in known_contacts:
            counts[s] = max(counts[s], len(re.findall(rf"\b{re.escape(s.lower())}\b", low)))
    return counts


def talk_about_suggestions(elder: dict) -> list[str]:
    name = elder.get("preferredName") or elder["name"]
    pronoun = "him" if elder.get("gender") == "male" else "her" if elder.get("gender") == "female" else "them"
    suggestions = []
    for subject, n in _week_mentions(elder).most_common(3):
        if n < 2:
            continue
        mem = db.query_one(
            "SELECT content FROM memories WHERE elderId = ? AND subject = ? AND forgotten = 0 AND private = 0 ORDER BY importance DESC",
            [elder["id"], subject],
        )
        context = f" ({mem['content']})" if mem else ""
        times = {2: "twice", 3: "three times"}.get(n, f"{n} times")
        suggestions.append(f"{name} mentioned {subject} {times} this week{context}. Ask {pronoun} about {subject} when you call.")
    if len(suggestions) < 2:
        likes = db.query(
            "SELECT content FROM memories WHERE elderId = ? AND kind IN ('like','life_story') AND forgotten = 0 AND private = 0 ORDER BY lastUsedAt DESC, createdAt DESC LIMIT 2",
            [elder["id"]],
        )
        for m in likes:
            suggestions.append(f"Conversation idea: {m['content']}. Ask {pronoun} to tell you more.")
    return suggestions[:3]


async def update_daily_summary(elder: dict, day: Optional[datetime] = None) -> dict:
    tz = repo.elder_tz(elder)
    local_day = (day or repo.elder_now(elder)).date()
    start = datetime(local_day.year, local_day.month, local_day.day, tzinfo=tz)
    end = start + timedelta(days=1)
    convos = db.query(
        "SELECT * FROM conversations WHERE elderId = ? AND startedAt >= ? AND startedAt < ? AND processed = 1 ORDER BY startedAt",
        [elder["id"], start, end],
    )
    logs = db.query("SELECT status FROM medicine_logs WHERE elderId = ? AND scheduledFor >= ? AND scheduledFor < ?", [elder["id"], start, end])
    taken = sum(1 for l in logs if l["status"] == "taken")
    missed = sum(1 for l in logs if l["status"] == "missed")
    moods = [c["mood"] for c in convos if c["mood"]]
    mood = round(sum(moods) / len(moods)) if moods else None
    topics: list[str] = []
    for c in convos:
        for t in db.loads(c["topics"], []):
            if t not in topics:
                topics.append(t)
    summaries = [c["summary"] for c in convos if c["summary"] and c["turnCount"]]
    name = elder.get("preferredName") or elder["name"]
    if not summaries:
        text = f"No conversations with {name} yet today."
    elif llm.available and len(summaries) > 1:
        try:
            text = await llm.complete(
                [{"role": "system", "content": "Merge these short updates about an older adult into one warm 2-3 sentence daily update for their family. No diagnosis, no invention."},
                 {"role": "user", "content": "\n".join(summaries)}], max_tokens=200,
            )
        except Exception as e:
            logger.warning(f"Daily summary merge failed: {e}")
            text = " ".join(summaries[-2:])
    else:
        text = " ".join(summaries[-2:])
    open_alerts = db.query(
        "SELECT title FROM alerts WHERE elderId = ? AND status = 'open' AND createdAt >= ? ORDER BY createdAt DESC LIMIT 3",
        [elder["id"], start],
    )
    follow_ups = [a["title"] for a in open_alerts]
    if missed:
        follow_ups.append(f"{missed} medicine dose{'s' if missed > 1 else ''} missed today")
    data = {
        "summary": text, "mood": mood, "moodLabel": MOOD_LABELS.get(mood, "") if mood else "",
        "topics": json.dumps(topics[:6]), "medsTaken": taken, "medsMissed": missed,
        "followUps": json.dumps(follow_ups), "talkAbout": json.dumps(talk_about_suggestions(elder)),
    }
    existing = db.query_one("SELECT * FROM daily_summaries WHERE elderId = ? AND date = ?", [elder["id"], local_day.isoformat()])
    if existing:
        db.update("daily_summaries", existing["id"], data)
        data["id"] = existing["id"]
    else:
        data = db.insert("daily_summaries", {"elderId": elder["id"], "date": local_day.isoformat(), **data})
    logger.info(f"Daily summary updated for {name} ({local_day})")
    data["date"] = local_day.isoformat()
    return data
