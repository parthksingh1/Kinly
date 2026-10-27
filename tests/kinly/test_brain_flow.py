import asyncio
import json

from src.kinly.brain.brain import EVENT_PREFIX, brain
from src.kinly.brain.session import sessions


def run(coro):
    return asyncio.run(coro)


async def collect(session, text):
    out = []
    async for chunk in brain.respond(session, text):
        out.append(chunk)
    return out


def text_of(chunks):
    return " ".join(c for c in chunks if isinstance(c, str))


def test_checkin_memory_and_safety(family, fresh_db):
    db = fresh_db
    elder = family["elder"]

    async def first_conversation():
        s = sessions.start("t1", elder, "screen")
        greet = text_of(await collect(s, f"{EVENT_PREFIX}start_checkin"))
        assert "Kamala" in greet
        await collect(s, "My knee is hurting since yesterday")
        await collect(s, "My granddaughter Riya studies in Boston. I love gardening")
        priv = text_of(await collect(s, "Keep this between us"))
        assert "between us" in priv.lower()
        call = await collect(s, "Call Riya")
        assert any(isinstance(c, dict) and c.get("action") == "start_call" for c in call)
        urgent = text_of(await collect(s, "I fell in the bathroom this morning"))
        assert "112" in urgent
        await asyncio.sleep(0.05)
        return await brain.finalize(s)

    result = run(first_conversation())
    assert result and result["summary"]
    alerts = db.query("SELECT * FROM alerts WHERE elderId = ?", [elder["id"]])
    assert any(a["category"] == "fall" and a["severity"] == "urgent" for a in alerts)
    memories = [m["content"] for m in db.query("SELECT content FROM memories WHERE elderId = ?", [elder["id"]])]
    assert any("Riya" in m for m in memories)
    assert any("knee" in m for m in memories)
    convo = db.query_one("SELECT * FROM conversations WHERE elderId = ?", [elder["id"]])
    transcript = json.loads(convo["transcript"])
    assert convo["processed"] == 1 and len(transcript) >= 10
    assert db.query_one("SELECT * FROM daily_summaries WHERE elderId = ?", [elder["id"]])
    outbox = db.query("SELECT * FROM notifications WHERE elderId = ?", [elder["id"]])
    assert any("URGENT" in n["subject"] for n in outbox)

    # Next session: the companion follows up on the knee it remembered.
    async def second_conversation():
        s = sessions.start("t2", elder, "screen")
        return text_of(await collect(s, f"{EVENT_PREFIX}start_checkin"))

    greet2 = run(second_conversation())
    assert "knee" in greet2.lower()


def test_forget(family, fresh_db):
    elder = family["elder"]

    async def go():
        s = sessions.start("f1", elder, "screen")
        from src.kinly.brain import memory

        memory.save(elder["id"], "like", "Kamala enjoys spicy pickles", "pickles", conversation_id=s.conversation_id)
        reply = text_of(await collect(s, "Please forget that"))
        return reply

    assert "forgot" in run(go()).lower()
    row = fresh_db.query_one("SELECT forgotten FROM memories WHERE content LIKE '%pickles%'")
    assert row["forgotten"] == 1


def test_consent_flow(family, fresh_db):
    db = fresh_db
    db.update("elders", family["elder"]["id"], {"consentStatus": "pending"})
    elder = db.get("elders", family["elder"]["id"])

    async def go():
        s = sessions.start("c1", elder, "phone")
        intro = text_of(await collect(s, "Hello?"))
        assert "AI" in intro
        ok = text_of(await collect(s, "Yes, that's fine"))
        return ok

    assert "Thank you" in run(go())
    updated = db.get("elders", elder["id"])
    assert updated["consentStatus"] == "granted" and "Yes" in updated["consentTranscript"]


def test_scam_shield(family, fresh_db):
    elder = family["elder"]

    async def go():
        s = sessions.start("s1", elder, "screen")
        return text_of(await collect(s, "Someone from the bank called asking for my OTP"))

    reply = run(go())
    assert "never ask" in reply
    alert = fresh_db.query_one("SELECT * FROM alerts WHERE category = 'scam'")
    assert alert and alert["severity"] == "urgent"
