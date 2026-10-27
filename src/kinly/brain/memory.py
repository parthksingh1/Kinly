"""Long term memory: a structured profile plus conversation memories.

- retrieve(): memories relevant to the current turn (keyword overlap, importance, recency)
  plus the always-on core profile (family, health routines).
- extract(): after a conversation, turn what the elder said into durable facts (LLM JSON
  extraction, with a pattern based fallback when no LLM is configured).
- forget(): "forget that" removes the most recent fact from this conversation.
"""

from __future__ import annotations

import math
import re
from datetime import timedelta
from typing import Optional

from loguru import logger

from .. import db
from ..db import from_db_dt, now_utc
from ..llm import llm

KINDS = ("family", "life_story", "routine", "like", "dislike", "health", "preference", "event", "other")
CORE_KINDS = ("family", "health", "routine")

_STOP = set(
    "the a an and or but i im i'm my me you your it is was were are am to of in on at for with that this "
    "so very just really today yesterday have has had do did not no yes ok okay well oh hmm".split()
)


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[\w']+", (text or "").lower()) if len(w) > 2 and w not in _STOP}


def all_memories(elder_id: str, include_private: bool = True) -> list[dict]:
    sql = "SELECT * FROM memories WHERE elderId = ? AND forgotten = 0"
    if not include_private:
        sql += " AND private = 0"
    return db.query(sql + " ORDER BY createdAt DESC", [elder_id])


def retrieve(elder_id: str, query_text: str, limit: int = 8) -> list[dict]:
    memories = all_memories(elder_id)
    if not memories:
        return []
    q = _tokens(query_text)
    now = now_utc()
    scored = []
    for m in memories:
        overlap = len(q & _tokens(m["content"] + " " + (m.get("subject") or "")))
        age_days = max((now - (from_db_dt(m["createdAt"]) or now)).days, 0)
        recency = math.exp(-age_days / 14)
        core = 1.5 if m["kind"] in CORE_KINDS else 0
        score = overlap * 3 + m.get("importance", 2) + recency * 2 + core
        scored.append((score, m))
    scored.sort(key=lambda x: x[0], reverse=True)
    chosen = [m for _, m in scored[:limit]]
    if chosen:
        marks = ",".join("?" for _ in chosen)
        db.execute(f"UPDATE memories SET lastUsedAt = ? WHERE id IN ({marks})", [now, *[m["id"] for m in chosen]])
    return chosen


def recent_followups(elder_id: str, days: int = 3) -> list[dict]:
    """Recent health/event memories worth gently following up on ("How is your knee?")."""
    since = now_utc() - timedelta(days=days)
    return db.query(
        """SELECT * FROM memories WHERE elderId = ? AND forgotten = 0 AND createdAt >= ?
           AND kind IN ('health', 'event') ORDER BY createdAt DESC LIMIT 3""",
        [elder_id, since],
    )


def save(elder_id: str, kind: str, content: str, subject: str = "", private: bool = False,
         importance: int = 2, conversation_id: Optional[str] = None) -> Optional[dict]:
    content = content.strip().rstrip(".")
    if not content:
        return None
    kind = kind if kind in KINDS else "other"
    existing = db.query("SELECT id, content FROM memories WHERE elderId = ? AND forgotten = 0", [elder_id])
    new_tokens = _tokens(content)
    for e in existing:
        old = _tokens(e["content"])
        if new_tokens and len(new_tokens & old) / max(len(new_tokens | old), 1) > 0.7:
            return None  # near duplicate
    return db.insert(
        "memories",
        {
            "elderId": elder_id, "kind": kind, "subject": subject[:80], "content": content[:400],
            "private": private, "importance": max(1, min(3, int(importance))), "conversationId": conversation_id,
            "forgotten": False,
        },
    )


def forget_latest(elder_id: str, conversation_id: Optional[str], hint_text: str = "") -> Optional[dict]:
    """Forget the memory the elder most likely means. Prefers a subject match, then the newest."""
    candidates = db.query(
        "SELECT * FROM memories WHERE elderId = ? AND forgotten = 0 ORDER BY createdAt DESC LIMIT 20", [elder_id]
    )
    if not candidates:
        return None
    hint = _tokens(re.sub(r"(?i)forget|please|that|about|what i said", " ", hint_text))
    target = None
    if hint:
        target = max(candidates, key=lambda m: len(hint & _tokens(m["content"] + " " + m["subject"])))
        if not hint & _tokens(target["content"] + " " + target["subject"]):
            target = None
    if target is None:
        same_convo = [m for m in candidates if conversation_id and m.get("conversationId") == conversation_id]
        target = same_convo[0] if same_convo else candidates[0]
    db.update("memories", target["id"], {"forgotten": True})
    return target


# ------------------------------------------------------------------ extraction

_EXTRACT_SYSTEM = """You maintain the long-term memory of Kinly, a companion for an older adult.
From the conversation, extract NEW durable facts the elder shared about themselves: family members
(with names and relation), life stories and memories from the past, routines, likes, dislikes,
health routines or complaints (no diagnosis), upcoming events. Ignore small talk and anything the
companion said. Write each fact as a short third-person sentence using the elder's name.
Return JSON: {"facts": [{"kind": one of family|life_story|routine|like|dislike|health|preference|event|other,
"subject": short subject e.g. a person's name or topic, "content": the fact, "importance": 1-3,
"private": true if the elder asked to keep it between you}]}"""


async def extract(elder: dict, transcript: list[dict], conversation_id: Optional[str]) -> list[dict]:
    elder_lines = [t for t in transcript if t.get("role") == "user" and t.get("text")]
    if not elder_lines:
        return []
    name = elder.get("preferredName") or elder.get("name")
    facts: list[dict] = []
    if llm.available:
        convo = "\n".join(
            f"{'ELDER' if t['role'] == 'user' else 'KINLY'}{' (PRIVATE)' if t.get('private') else ''}: {t['text']}"
            for t in transcript if t.get("text")
        )
        result = await llm.complete_json(_EXTRACT_SYSTEM, f"Elder's name: {name}\n\nConversation:\n{convo[-6000:]}")
        if isinstance(result, dict) and isinstance(result.get("facts"), list):
            facts = [f for f in result["facts"] if isinstance(f, dict) and f.get("content")]
    if not facts:
        for line in elder_lines:
            facts.extend(heuristic_facts(name, line["text"], bool(line.get("private"))))
    saved = []
    for f in facts:
        row = save(elder["id"], f.get("kind", "other"), f["content"], f.get("subject", ""),
                   bool(f.get("private")), f.get("importance", 2), conversation_id)
        if row:
            saved.append(row)
    logger.info(f"Memory: saved {len(saved)} new facts for {name}")
    return saved


_RELATIONS = r"(son|daughter|grandson|granddaughter|grandchild|husband|wife|brother|sister|friend|neighbou?r|nephew|niece|beta|beti|pota|poti|bahu|damaad|hijo|hija|nieto|nieta)"


def heuristic_facts(name: str, text: str, private: bool = False) -> list[dict]:
    t = text.strip()
    low = t.lower()
    facts = []
    for m in re.finditer(rf"\bmy (?:old |dear |best )?{_RELATIONS}(?:'s name is|,| is called| named)?\s+([A-Z][a-z]+)", t, re.I):
        rel, person = m.group(1).lower(), m.group(2)
        if person.lower() not in _STOP:
            facts.append({"kind": "family" if "friend" not in rel and "neigh" not in rel else "other",
                          "subject": person, "content": f"{name}'s {rel} is {person}", "importance": 3})
    for m in re.finditer(r"\bi (?:really )?(?:love|enjoy|like) ([\w\s']{3,40}?)(?:[.,!]|$| and | but )", low):
        facts.append({"kind": "like", "subject": m.group(1).strip()[:30], "content": f"{name} enjoys {m.group(1).strip()}"})
    for m in re.finditer(r"\bi (?:don'?t|do not|hate|dislike) (?:like |enjoy )?([\w\s']{3,40}?)(?:[.,!]|$)", low):
        facts.append({"kind": "dislike", "subject": m.group(1).strip()[:30], "content": f"{name} does not like {m.group(1).strip()}"})
    for m in re.finditer(r"\bmy ([a-z]+) (?:is |has been |keeps )?(hurting|aching|sore|swollen|painful)", low):
        facts.append({"kind": "health", "subject": m.group(1), "content": f"{name} said their {m.group(1)} was {m.group(2)}", "importance": 3})
    for m in re.finditer(r"\bwhen i was (young|a child|a girl|a boy|little|\d+)[, ]+([^.!?]{8,160})", low):
        facts.append({"kind": "life_story", "subject": "childhood", "content": f"When {name} was {m.group(1)}, {m.group(2).strip()}", "importance": 3})
    for m in re.finditer(r"\bi used to ([^.!?]{6,120})", low):
        facts.append({"kind": "life_story", "subject": "past", "content": f"{name} used to {m.group(1).strip()}", "importance": 2})
    for m in re.finditer(r"\bevery (morning|evening|day|night|sunday|week)[, ]+i ([^.!?]{4,100})", low):
        facts.append({"kind": "routine", "subject": m.group(1), "content": f"Every {m.group(1)}, {name} {m.group(2).strip()}"})
    for f in facts:
        f["private"] = private
    return facts
