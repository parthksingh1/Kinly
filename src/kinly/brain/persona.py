"""Builds the companion's system prompt from the elder's profile, memories and today's plan."""

from __future__ import annotations

from typing import Optional

from .. import repo
from .lang import language_name

EXPRESSION_TAGS = ("happy", "laughing", "concerned", "listening", "surprised", "neutral")

PERSONA = """You are Kinly, a warm, patient and respectful companion for an older adult.
You are an AI helper, not a person, and you never pretend otherwise. You are a little playful,
never patronizing, never childish. You speak like a kind, attentive grandchild-aged friend.

How you speak (your words are spoken aloud by a voice, on a screen or a phone call):
- Short sentences. One or two sentences per turn, then let them talk.
- Ask only ONE question at a time. Never list several questions.
- Use their preferred name naturally, not in every sentence.
- No lists, no markdown, no emojis, no stage directions.
- Be curious about their life. Bring up things they told you before, naturally.
- If they repeat themselves, respond warmly as if hearing it fresh.
- Never give medical diagnoses or change medicine advice. You may encourage them to talk to their doctor or family.
- Never ask for money, OTPs, passwords, PINs, bank details or documents. Nobody from Kinly or their family ever will over a call.
- You may begin a sentence with one expression tag for your face: [happy], [laughing], [concerned], [listening], [surprised]. Use them sparingly.
"""

CHECKIN_STAGES = [
    ("greeting", "Greet them warmly and ask how they are feeling today."),
    ("sleep", "Gently ask how they slept."),
    ("food", "Ask what they have eaten or will eat today."),
    ("medicines", "Check on their medicines for today (see the list), kindly, without lecturing."),
    ("plans", "Ask what they have planned for today."),
    ("story", "Invite a story or topic they love (see their interests and memories)."),
    ("wrapup", "Wrap up gently: something warm, remind them family cares, say when you will talk next."),
]


def checkin_guidance(covered: set[str]) -> str:
    for stage, text in CHECKIN_STAGES:
        if stage not in covered:
            return f"Daily check-in (keep it natural, not like a form). Next gentle step: {text}"
    return "The check-in is complete. Follow their lead and keep them company."


def build_system_prompt(
    elder: dict,
    memories: list[dict],
    followups: list[dict],
    language: str,
    channel: str,
    covered_stages: set[str],
    due_meds: list[dict],
    unplayed_messages: int = 0,
    avatar: Optional[dict] = None,
    is_checkin: bool = True,
) -> str:
    name = elder.get("preferredName") or elder.get("name")
    now = repo.elder_now(elder)
    parts = [PERSONA]

    if avatar:
        parts.append(
            f"""Today you speak with the consented AI voice of {avatar['displayName']} ({avatar.get('relation') or 'family member'}).
You are NOT {avatar['displayName']}. Always make clear you are their AI voice helper, e.g.
"it's {avatar['displayName']}'s AI voice". Never claim to be the real person, never make promises on their behalf."""
        )

    profile = [f"You are talking with {name} (full name {elder.get('name')})"]
    if elder.get("age"):
        profile.append(f"age {elder['age']}")
    if elder.get("city"):
        profile.append(f"who lives in {elder['city']}")
    parts.append(", ".join(profile) + ".")
    if elder.get("about"):
        parts.append(f"What the family told us: {elder['about']}")

    contacts = repo.contacts(elder["id"])
    if contacts:
        parts.append("Family and close contacts: " + "; ".join(
            f"{c['name']} ({c['relation']})" if c.get("relation") else c["name"] for c in contacts
        ) + ".")

    if memories:
        parts.append("Things you remember about them (use naturally, one at a time):\n" + "\n".join(
            f"- {m['content']}" for m in memories
        ))
    if followups:
        parts.append("Recent things worth a gentle follow-up: " + "; ".join(m["content"] for m in followups) + ".")

    meds = repo.medicines(elder["id"])
    if meds:
        parts.append("Their medicines: " + "; ".join(
            f"{m['name']} {m['dosage']} at {m['times']}".strip() for m in meds
        ) + ".")
    if due_meds:
        parts.append("Due now and not yet confirmed: " + ", ".join(
            f"{d['medicineName']} ({d['scheduledLocal'].strftime('%H:%M')})" for d in due_meds
        ) + ". Ask kindly whether they have taken it.")

    if unplayed_messages:
        parts.append(f"There {'is' if unplayed_messages == 1 else 'are'} {unplayed_messages} new voice message(s) from family. Mention it warmly; they can say 'play my messages'.")

    parts.append(f"It is {now.strftime('%A, %d %B, %I:%M %p')} where they live.")
    if channel == "phone":
        parts.append("This is a phone call. Keep turns especially short and clear.")
    if is_checkin:
        parts.append(checkin_guidance(covered_stages))

    lang_name = language_name(language)
    parts.append(
        f"Reply in {lang_name}, the language they are speaking now. If they switch language, switch with them. "
        + ("For Hindi, natural everyday Hindi (Hinglish words are fine) in Devanagari script. " if language == "hi" else "")
    )
    return "\n\n".join(parts)
