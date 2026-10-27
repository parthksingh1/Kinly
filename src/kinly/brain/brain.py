"""KinlyBrain: the transport independent companion.

`respond(session, text)` yields text chunks (sentence sized) and action dicts. The screen
agent (agent.py) and the phone endpoint (api.py, used by Bolna as a custom LLM) share it.
`finalize(session)` runs after a conversation: memory, summary, wellbeing trends, family update.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from typing import AsyncIterator, Optional, Union

from loguru import logger

from .. import db, repo
from ..db import now_utc
from ..llm import LLMUnavailable, llm
from ..notify import notifier
from . import intents, memory, offline, persona, safety
from .lang import detect_language
from .output_filter import filter_sentence
from .responses import say
from .session import Session, sessions

EVENT_PREFIX = "__kinly_event__:"
Chunk = Union[str, dict]

_SENTENCE_END = re.compile(r"([.!?।]+[\"')\]]?\s+|\n+)")
_TAG = re.compile(r"\[(happy|laughing|concerned|listening|surprised|neutral)\]\s*", re.I)


def strip_tags(text: str) -> str:
    return _TAG.sub("", text)


class KinlyBrain:
    first_token_timeout_s = 7.0

    async def respond(self, session: Session, user_text: str) -> AsyncIterator[Chunk]:
        user_text = (user_text or "").strip()
        event = user_text[len(EVENT_PREFIX):] if user_text.startswith(EVENT_PREFIX) else None

        if event:
            async for chunk in self._handle_event(session, event):
                yield chunk
            return

        if not user_text:
            yield say("repeat", session.language, session.gender)
            return

        session.language = detect_language(user_text, repo.elder_languages(session.elder), session.language)
        turn = session.add("user", user_text)

        # 1. Consent comes first: no regular check-ins until the elder agrees.
        if session.mode == "consent":
            async for chunk in self._consent(session, user_text):
                yield chunk
            return
        if session.mode == "consent_declined":
            yield self._say(session, "consent_no")
            return

        # 2. Safety is deterministic and always runs, even on private turns.
        signals = safety.classify(user_text)
        private = intents.wants_privacy(user_text)
        if private:
            turn["private"] = True
            session.mark_last_user_private(2)

        urgent = next((s for s in signals if s.is_urgent), None)
        if urgent:
            await self._raise(session, urgent)
            key = "self_harm" if urgent.category == "self_harm" else "urgent"
            yield self._say(session, key, emergency=session.elder.get("emergencyNumber") or "112",
                            family=self._first_contact_name(session))
            return
        scam = next((s for s in signals if s.severity == safety.SCAM), None)
        if scam:
            # Scam warnings and alerts are never paywalled; only the proactive reminders are.
            await self._raise(session, scam)
            session.scam_reminded = True
            yield self._say(session, "scam", family=self._first_contact_name(session))
            return
        for s in signals:
            if s.severity == safety.CONCERNING and not private:
                session.signals.append(s)
                if s.category in ("low_mood", "loneliness", "not_eating"):
                    await self._raise(session, s, dedupe_minutes=12 * 60)

        # 3. Commands
        if intents.wants_forget(user_text):
            forgotten = memory.forget_latest(session.elder_id, session.conversation_id, user_text)
            for t in session.transcript[:-1][-4:]:
                if t["role"] == "user":
                    t["private"] = True  # don't re-extract it at the end
            logger.info(f"Forgot memory: {forgotten['content'] if forgotten else 'nothing yet'}")
            yield self._say(session, "forget_ack")
            return
        if private and len(user_text.split()) <= 9:
            yield self._say(session, "privacy_ack")
            return

        target = intents.call_target(user_text)
        if target:
            async for chunk in self._call_request(session, target):
                yield chunk
            return
        if intents.wants_messages(user_text):
            async for chunk in self._messages(session):
                yield chunk
            return

        # 4. Medicine confirmations
        med_reply = self._medicine_confirmation(session, user_text)
        if med_reply:
            yield med_reply
            return

        # 5. Conversation
        async for chunk in self._converse(session, user_text, private=private):
            yield chunk

    # ------------------------------------------------------------------ helpers

    def _say(self, session: Session, key: str, **kwargs) -> str:
        text = say(key, session.language, session.gender, name=session.name, **kwargs)
        session.add("assistant", strip_tags(text))
        return text

    def _first_contact_name(self, session: Session) -> str:
        contacts = repo.contacts(session.elder_id)
        emergency = [c for c in contacts if c.get("isEmergency")] or contacts
        if emergency:
            return emergency[0]["name"]
        return {"hi": "अपने परिवार", "es": "su familia"}.get(session.language, "your family")

    async def _raise(self, session: Session, signal: safety.Signal, dedupe_minutes: int = 10) -> None:
        session.signals.append(signal)
        if repo.recent_alert_exists(session.elder_id, signal.category, dedupe_minutes):
            return
        if signal.severity == safety.URGENT or signal.category in ("scam_money", "scam_credentials"):
            severity = "urgent"
        else:
            severity = "concerning"
        category = "scam" if signal.severity == safety.SCAM else signal.category
        detail = {
            safety.URGENT: f"{session.name} said something that may need help right away. Kinly asked them to call emergency services or family.",
            safety.SCAM: f"{session.name} mentioned something that sounds like a scam. Kinly warned them not to share money, OTPs or passwords.",
            safety.CONCERNING: f"{session.name} mentioned this during a {session.channel} conversation.",
        }[signal.severity]
        alert = repo.create_alert(session.elder_id, severity, category, signal.title, detail, signal.quote, session.conversation_id)
        logger.warning(f"ALERT [{severity}] {signal.title} for {session.name}: {signal.quote!r}")
        task = asyncio.create_task(notifier.alert(session.elder, alert))
        task.add_done_callback(lambda t: t.exception() and logger.error(f"Alert notify failed: {t.exception()}"))

    async def _consent(self, session: Session, user_text: str) -> AsyncIterator[Chunk]:
        if not session.consent_intro_given:
            # e.g. the phone greeting was spoken by Bolna; always explain Kinly before asking.
            session.consent_intro_given = True
            yield self._say(session, "consent_intro")
            return
        session.consent_attempts += 1
        if intents.is_yes(user_text):
            intro = next((t["text"] for t in session.transcript if t["role"] == "assistant"), "")
            db.update("elders", session.elder_id, {
                "consentStatus": "granted", "consentAt": now_utc(), "consentChannel": session.channel,
                "consentTranscript": f"Kinly: {intro}\n{session.name}: {user_text}"[:2000],
            })
            session.elder["consentStatus"] = "granted"
            repo.audit(session.elder["familyId"], "elder_consent_granted", {"channel": session.channel, "reply": user_text}, session.elder_id)
            session.mode = "chat"
            session.covered.add("greeting")
            yield self._say(session, "consent_yes")
        elif intents.is_no(user_text) or session.consent_attempts >= 3:
            db.update("elders", session.elder_id, {
                "consentStatus": "declined", "consentAt": now_utc(), "consentChannel": session.channel,
                "consentTranscript": f"{session.name}: {user_text}"[:2000],
            })
            repo.audit(session.elder["familyId"], "elder_consent_declined", {"channel": session.channel, "reply": user_text}, session.elder_id)
            session.mode = "consent_declined"
            yield self._say(session, "consent_no")
        else:
            yield self._say(session, "consent_unclear")

    async def _call_request(self, session: Session, spoken_name: str) -> AsyncIterator[Chunk]:
        contact = repo.find_contact(session.elder_id, spoken_name) or repo.find_contact(session.elder_id, session.transcript[-1]["text"])
        if not contact:
            yield self._say(session, "call_unknown")
            return
        if session.channel == "phone":
            text = {
                "en": f"I'll ask {contact['name']} to call you back as soon as they can.",
                "hi": f"मैं {contact['name']} से कहूँगी कि जल्दी से जल्दी आपको फ़ोन करें।",
                "es": f"Le pediré a {contact['name']} que le devuelva la llamada en cuanto pueda.",
            }.get(session.language)
            session.add("assistant", text)
            await notifier.family_message(session.elder, f"{session.name} would like {contact['name']} to call back.",
                                          f"{session.name} asked Kinly to call {contact['name']}. Please call them back.")
            yield text
            return
        yield {"type": "kinly-action", "action": "start_call", "contact": {"id": contact["id"], "name": contact["name"]}}
        yield self._say(session, "call_start", contact=contact["name"])

    async def _messages(self, session: Session) -> AsyncIterator[Chunk]:
        rows = db.query(
            "SELECT id, fromName FROM voice_messages WHERE elderId = ? AND direction = 'to_elder' AND playedAt IS NULL ORDER BY createdAt",
            [session.elder_id],
        )
        if not rows:
            yield self._say(session, "no_messages")
            return
        count = len(rows)
        yield self._say(session, "messages", count=count, plural="" if count == 1 else "s")
        yield {"type": "kinly-action", "action": "play_messages", "messageIds": [r["id"] for r in rows]}

    def _medicine_confirmation(self, session: Session, user_text: str) -> Optional[str]:
        answer = intents.took_medicine(user_text)
        if answer is None:
            return None
        due = repo.due_medicine_logs(session.elder, window_minutes=240)
        target = session.pending_med_log or (due[0] if due else None)
        if not target:
            return None
        if answer:
            for log in due or [target]:
                repo.set_medicine_status(log["id"], "taken", session.channel)
            session.pending_med_log = None
            session.covered.add("medicines")
            return self._say(session, "med_taken", medicine=target["medicineName"])
        db.execute("UPDATE medicine_logs SET remindedCount = remindedCount + 1 WHERE id = ?", [target["id"]])
        session.covered.add("medicines")
        return self._say(session, "med_not_taken", medicine=target["medicineName"])

    async def _handle_event(self, session: Session, event: str) -> AsyncIterator[Chunk]:
        name, _, arg = event.partition(":")
        if session.mode == "consent" and not session.consent_intro_given:
            session.consent_intro_given = True
            yield self._say(session, "consent_intro")
            return
        if name == "med_reminder":
            log = db.query_one(
                "SELECT l.*, m.name AS medicineName FROM medicine_logs l JOIN medicines m ON m.id = l.medicineId WHERE l.id = ?",
                [arg],
            )
            if log:
                session.pending_med_log = log
                db.execute("UPDATE medicine_logs SET remindedCount = remindedCount + 1 WHERE id = ?", [arg])
                yield self._say(session, "med_reminder", medicine=log["medicineName"])
            return
        if name == "goodbye":
            yield self._say(session, "goodbye")
            return
        if name == "say":  # demo / scripted elder utterance
            async for chunk in self.respond(session, arg):
                yield chunk
            return
        # start_checkin / greet
        session.is_checkin = name != "chat"
        if session.avatar:
            # Family Avatar must always introduce itself as an AI voice, never as the person.
            who = session.avatar["displayName"]
            intro = {
                "hi": f"[happy] नमस्ते {session.name}, यह {who} की AI आवाज़ है। असली {who} बाद में आपसे बात करेंगी।",
                "es": f"[happy] Hola {session.name}, soy la voz de inteligencia artificial de {who}. La verdadera {who} hablará con usted más tarde.",
            }.get(session.language, f"[happy] Hi {session.name}, it's {who}'s AI voice. The real {who} will talk to you later.")
            session.add("assistant", strip_tags(intro))
            yield intro
        async for chunk in self._converse(session, "", first_turn=True):
            yield chunk

    async def _converse(self, session: Session, user_text: str, private: bool = False, first_turn: bool = False) -> AsyncIterator[Chunk]:
        elder = session.elder
        query_text = " ".join(t["text"] for t in session.user_turns()[-3:]) or (elder.get("about") or "")
        memories = memory.retrieve(session.elder_id, query_text)
        followups = memory.recent_followups(session.elder_id) if first_turn or len(session.transcript) < 4 else []
        due = repo.due_medicine_logs(elder) if "medicines" not in session.covered else []
        unplayed = db.query_one(
            "SELECT COUNT(*) AS n FROM voice_messages WHERE elderId = ? AND direction = 'to_elder' AND playedAt IS NULL",
            [session.elder_id],
        )["n"] if first_turn else 0

        system = persona.build_system_prompt(
            elder, memories, followups, session.language, session.channel, session.covered, due,
            unplayed_messages=unplayed, avatar=session.avatar, is_checkin=session.is_checkin,
        )
        extra = []
        if first_turn:
            extra.append("Start the conversation now with a warm greeting (they have not spoken yet).")
        if private:
            extra.append("They asked to keep what they just said between you. Briefly reassure them it stays private (safety matters excepted), then respond kindly.")
        concerning = [s for s in session.signals if s.severity == safety.CONCERNING]
        if concerning:
            extra.append(f"They mentioned: {', '.join(sorted({s.title.lower() for s in concerning}))}. Respond with empathy and gentle care, without diagnosing.")
        if not session.scam_reminded and len(session.user_turns()) == 4 and repo.has_feature(elder, "scam_shield"):
            extra.append("Somewhere natural in this reply, add a one sentence friendly reminder that Kinly and their family will never ask for money, OTPs or passwords over a call.")
            session.scam_reminded = True
        if extra:
            system += "\n\n" + "\n".join(extra)

        messages = [{"role": "system", "content": system}, *session.chat_messages()]
        if first_turn:
            messages.append({"role": "user", "content": "(The companion starts the conversation.)"})

        full = ""
        try:
            async for sentence in self._llm_sentences(messages, session.language):
                full += sentence
                yield sentence
        except (LLMUnavailable, asyncio.TimeoutError, Exception) as e:
            if not isinstance(e, LLMUnavailable):
                logger.warning(f"LLM failed ({type(e).__name__}: {e}); using offline brain")
            if full:  # partial answer already spoken; end gracefully
                pass
            else:
                full = self._offline(session, user_text, memories, followups, due, first_turn)
                yield full

        clean = strip_tags(full).strip()
        if clean:
            session.add("assistant", clean)
        if due and re.search(r"medicine|tablet|pill|दवा|dawa|medicina|pastilla|" + "|".join(re.escape(d["medicineName"].lower()) for d in due), clean.lower()):
            session.pending_med_log = due[0]
        session.update_coverage()

    async def _llm_sentences(self, messages: list[dict], lang: str) -> AsyncIterator[str]:
        stream = llm.stream(messages, temperature=0.7, max_tokens=180)
        buffer = ""
        first = True
        iterator = stream.__aiter__()
        while True:
            try:
                if first:
                    token = await asyncio.wait_for(iterator.__anext__(), timeout=self.first_token_timeout_s)
                    first = False
                else:
                    token = await asyncio.wait_for(iterator.__anext__(), timeout=15)
            except StopAsyncIteration:
                break
            buffer += token
            while True:
                m = _SENTENCE_END.search(buffer)
                if not m:
                    break
                sentence, buffer = buffer[: m.end()], buffer[m.end():]
                if sentence.strip():
                    yield filter_sentence(sentence, lang)
        if buffer.strip():
            yield filter_sentence(buffer, lang)

    def _offline(self, session: Session, user_text: str, memories: list[dict], followups: list[dict], due: list[dict], first_turn: bool) -> str:
        interests = [m["subject"] or m["content"] for m in memories if m["kind"] in ("like", "life_story")][:4]
        stage = next((s for s, _ in persona.CHECKIN_STAGES if s not in session.covered), "story")
        if stage == "medicines" and not due:
            session.covered.add("medicines")
            stage = next((s for s, _ in persona.CHECKIN_STAGES if s not in session.covered), "story")
        followup = ""
        if followups:
            f = followups[0]["content"]
            followup = re.sub(rf"^{re.escape(session.name)}\s+(said\s+)?", "", f, flags=re.I)
            followup = followup.replace("their ", "your ").replace(" was ", " was ")
        med = due[0]["medicineName"] if due else (repo.medicines(session.elder_id)[0]["name"] if repo.medicines(session.elder_id) else "")
        return offline.reply(
            stage, session.language, session.name, user_text, repo.elder_now(session.elder).hour,
            interests, followup=followup if first_turn else "", med_name=med, first_turn=first_turn,
        )

    # ------------------------------------------------------------------ end of conversation

    async def finalize(self, session: Session, transcript_override: Optional[list[dict]] = None,
                       duration_sec: Optional[int] = None) -> Optional[dict]:
        if session.ended:
            return None
        session.ended = True
        sessions.pop(session.key)
        transcript = transcript_override or session.transcript
        user_turns = [t for t in transcript if t["role"] == "user" and t.get("text")]
        duration = duration_sec if duration_sec is not None else int(time.time() - session.started_at)
        avg_fa = int(sum(session.first_audio_ms) / len(session.first_audio_ms)) if session.first_audio_ms else None
        db.update("conversations", session.conversation_id, {
            "endedAt": now_utc(), "durationSec": duration, "transcript": json.dumps(transcript, ensure_ascii=False),
            "turnCount": len(user_turns), "language": session.language,
            "languagesUsed": ",".join(sorted(session.languages_used or {session.language})), "avgFirstAudioMs": avg_fa,
        })
        if not user_turns:
            db.update("conversations", session.conversation_id, {"processed": True, "summary": "No conversation (no reply from the elder)."})
            return None
        # Safety pass over the authoritative transcript (phone transcripts arrive here first time).
        if transcript_override:
            for t in user_turns:
                for s in safety.classify(t["text"]):
                    if s.severity != safety.CONCERNING or s.category in ("low_mood", "loneliness", "not_eating"):
                        await self._raise(session, s, dedupe_minutes=60)
        from . import summary  # local import: summary imports memory/notify

        try:
            await memory.extract(session.elder, transcript, session.conversation_id)
        except Exception as e:
            logger.error(f"Memory extraction failed: {e}")
        result = await summary.summarize_conversation(session.elder, transcript, session.conversation_id, session.signals)
        await summary.check_wellbeing_trends(session.elder)
        daily = await summary.update_daily_summary(session.elder)
        if session.channel in ("phone", "screen") and repo.has_feature(session.elder, "daily_summary"):
            await notifier.conversation_summary(session.elder, result, daily, session.channel)
        return result


brain = KinlyBrain()
