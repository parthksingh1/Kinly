"""Small, deterministic intent detectors that must work in every language we support."""

from __future__ import annotations

import re
from typing import Optional

_PRIVATE = [
    r"\b(keep (this|it|that) (between us|to yourself|private|a secret)|between (you and me|us))\b",
    r"\bdon'?t tell (my|anyone|anybody|the family|them)\b", r"\bdon'?t share (this|it|that)\b",
    r"\b(kisi ko|kisiko) (mat|na) (batana|bolna)\b", r"\bhamare beech\b", r"किसी को मत बताना", r"हमारे बीच",
    r"\bentre (tú y yo|nosotros)\b", r"\bno se lo (digas|cuentes)\b",
]

_FORGET = [
    r"\bforget (that|this|it|what i said|about)\b", r"\bplease forget\b", r"\bdon'?t remember (that|this)\b",
    r"\b(yeh|ye|woh|wo) bhool (jao|jaana|ja)\b", r"भूल जाओ", r"\bolvida (eso|lo que dije)\b",
]

_CALL = [
    r"\b(?P<name>[a-z][a-z]+)\s+(ko|se)\s+(call|phone|video call|baat)\s*(karo|kar do|karwa|karna|karao|kara do)",
    r"(?P<name>[ऀ-ॿ]+)\s+(को|से)\s+(कॉल|फोन|फ़ोन|बात)",
    r"\b(llama|llamar|llámale|llámala|marca)\s+(a\s+)?(mi\s+)?(?P<name>[a-záéíóúñ]+)",
    r"\b(call|ring|phone|video ?call|dial)\s+(my\s+)?(?P<name>[a-z][a-z]+)",
]
_CALL_STOPWORDS = {"me", "you", "them", "it", "back", "later", "now", "the", "a", "someone", "him", "her", "kinly", "please", "family", "karo", "kar", "karna", "now", "mom", "dad"}

_MESSAGES = [
    r"\b(any|new|my) (messages?|voice notes?)\b", r"\bplay (the |my )?messages?\b", r"\b(koi )?message (aaya|hai)\b",
    r"\bsandesh\b", r"\bmensajes?\b",
]

_YES = r"\b(yes|yeah|yep|sure|okay|ok|of course|i agree|agreed|fine|alright|haan|han|ji|ji haan|theek hai|thik hai|bilkul|sí|si|claro|de acuerdo|vale|हाँ|हां|जी|ठीक है|बिल्कुल)\b"
_NO = r"\b(no|nope|not now|don'?t|do not|nahi|nahin|mat|नहीं|ना|todavía no|aún no)\b"

_TOOK_MED = [
    r"\b(took|taken|had|have had|swallowed) (it|them|my|the|both)\b", r"\b(i )?(already )?took (it|them|my)\b",
    r"\b(le li|le liya|kha li|kha liya|le chuki|le chuka|kha chuki|kha chuka)\b", r"(ले ली|ले लिया|खा ली|खा लिया)",
    r"\b(la|las|lo|los) tomé\b", r"\bya (la|las|lo|los) tomé\b", r"\bsí,? (ya )?(la|las) tomé\b",
]
_NOT_TOOK_MED = [
    r"\b(forgot|haven'?t|have not|didn'?t|did not|not yet)\b.*\b(take|taken|took|it|them|medicine|tablet|pill)\b",
    r"\b(nahi li|nahin li|bhool gayi|bhool gaya|abhi nahi)\b", r"(नहीं ली|भूल गई|भूल गया|अभी नहीं)",
    r"\b(no la tomé|se me olvidó|todavía no|aún no)\b",
]


def _any(patterns: list[str], text: str) -> bool:
    t = (text or "").lower()
    return any(re.search(p, t) for p in patterns)


def wants_privacy(text: str) -> bool:
    return _any(_PRIVATE, text)


def wants_forget(text: str) -> bool:
    return _any(_FORGET, text)


def wants_messages(text: str) -> bool:
    return _any(_MESSAGES, text)


def call_target(text: str) -> Optional[str]:
    t = (text or "").lower()
    for p in _CALL:
        m = re.search(p, t)
        if m:
            name = m.group("name").strip()
            if name not in _CALL_STOPWORDS and len(name) > 1:
                return name
    return None


def is_yes(text: str) -> bool:
    t = (text or "").lower()
    return bool(re.search(_YES, t)) and not re.search(r"\b(no|nahi|nahin|not)\b", t.split(",")[0])


def is_no(text: str) -> bool:
    t = (text or "").lower()
    return bool(re.search(_NO, t)) and not is_yes(text)


def took_medicine(text: str) -> Optional[bool]:
    """True = taken, False = not taken, None = unclear."""
    if _any(_NOT_TOOK_MED, text):
        return False
    if _any(_TOOK_MED, text):
        return True
    return None
