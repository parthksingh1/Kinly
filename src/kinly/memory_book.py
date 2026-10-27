"""Memory Book: turns life stories the elder shared (never private ones) into short chapters."""

from __future__ import annotations

import json
from collections import defaultdict

from loguru import logger

from . import db
from .llm import llm

_SYSTEM = """You are a gentle biographer writing a family Memory Book from stories an older adult told
their companion. Write in warm, simple, third-person prose. Use ONLY the facts given; never invent
names, places or events. Group related stories into chapters.
Return JSON: {"chapters": [{"title": evocative short title, "era": e.g. "Childhood" or "1970s",
"body": 2-4 short paragraphs separated by blank lines, "sources": [indexes of facts used]}]}"""

ERA_ORDER = ["Childhood", "Growing up", "Family life", "Work", "Traditions", "Today"]


def _era_for(content: str) -> str:
    low = content.lower()
    if any(w in low for w in ("child", "young", "little", "school", "bachpan", "village")):
        return "Childhood"
    if any(w in low for w in ("married", "wedding", "husband", "wife", "born", "son", "daughter")):
        return "Family life"
    if any(w in low for w in ("work", "job", "teacher", "office", "shop", "career")):
        return "Work"
    if any(w in low for w in ("festival", "diwali", "recipe", "cook", "song", "temple", "christmas")):
        return "Traditions"
    return "Today"


async def generate(elder: dict) -> list[dict]:
    name = elder.get("preferredName") or elder["name"]
    facts = db.query(
        """SELECT id, kind, subject, content FROM memories
           WHERE elderId = ? AND forgotten = 0 AND private = 0 AND kind IN ('life_story','family','like','routine','event')
           ORDER BY createdAt""",
        [elder["id"]],
    )
    stories = [f for f in facts if f["kind"] == "life_story"] or facts
    if not stories:
        return []
    used = {
        json_id
        for row in db.query("SELECT sources FROM memory_book_chapters WHERE elderId = ?", [elder["id"]])
        for json_id in db.loads(row["sources"], [])
    }
    fresh = [f for f in stories if f["id"] not in used]
    if not fresh:
        return []

    chapters: list[dict] = []
    if llm.available:
        listing = "\n".join(f"[{i}] {f['content']}" for i, f in enumerate(fresh))
        data = await llm.complete_json(_SYSTEM, f"The book is about {name} ({elder['name']}).\nFacts:\n{listing}", max_tokens=1600)
        if isinstance(data, dict):
            for ch in data.get("chapters", []):
                idx = [i for i in ch.get("sources", []) if isinstance(i, int) and 0 <= i < len(fresh)]
                if ch.get("title") and ch.get("body"):
                    chapters.append({"title": ch["title"][:120], "era": str(ch.get("era", ""))[:40], "body": ch["body"],
                                     "sources": [fresh[i]["id"] for i in idx] or [f["id"] for f in fresh]})
    if not chapters:
        groups: dict[str, list[dict]] = defaultdict(list)
        for f in fresh:
            groups[_era_for(f["content"])].append(f)
        for era in sorted(groups, key=lambda e: ERA_ORDER.index(e) if e in ERA_ORDER else 99):
            items = groups[era]
            body = "\n\n".join(
                f["content"].rstrip(".") + "." for f in items
            )
            chapters.append({"title": {"Childhood": f"When {name} was young", "Family life": "A family is built",
                                       "Work": "Years of work", "Traditions": "Things worth keeping",
                                       "Today": f"{name}, today"}.get(era, era),
                             "era": era, "body": body, "sources": [f["id"] for f in items]})
    saved = []
    for ch in chapters:
        saved.append(db.insert("memory_book_chapters", {
            "elderId": elder["id"], "title": ch["title"], "era": ch["era"], "body": ch["body"],
            "sources": json.dumps(ch["sources"]), "hidden": False,
        }))
    logger.info(f"Memory Book: {len(saved)} new chapter(s) for {name}")
    return saved
