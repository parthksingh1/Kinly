"""Hard output filter: the companion (and any Family Avatar voice) can never ask the elder
for money, OTPs, passwords, PINs, bank details or documents. Applied to every sentence
before it is spoken, regardless of what the LLM produced."""

from __future__ import annotations

import re

_REQUEST = r"(send|transfer|pay|wire|give|share|tell|read out|read me|give me|provide|confirm|bhej|bata|de do|dijiye|batao|envíe|envía|mande|manda|comparta|dígame|dime|dé|deme)"
_SENSITIVE = (
    r"(money|cash|rupees|dollars|payment|gift ?cards?|otp|one[- ]time|password|passcode|pin\b|cvv|bank (details|account)|"
    r"account number|card number|card details|aadhaar|pan card|social security|documents?|upi|paise|पैसे|ओटीपी|पासवर्ड|"
    r"dinero|contraseña|código|tarjeta|cuenta bancaria|documentos?)"
)

_BLOCK = [
    re.compile(rf"\b{_REQUEST}\b[^.?!।]{{0,60}}\b{_SENSITIVE}", re.I),
    re.compile(rf"\b(what('?s| is)|tell me) (your|the) {_SENSITIVE}", re.I),
    re.compile(rf"\b{_SENSITIVE}\b[^.?!।]{{0,40}}\b(please|now|jaldi|ahora)\b[^.?!।]{{0,20}}\b{_REQUEST}\b", re.I),
]

# Phrases that *warn* about scams are fine ("never share your OTP").
_ALLOW = re.compile(
    r"\b(never|don'?t|do not|won'?t|will not|nobody|no one|kabhi nahi|mat|nunca|no (comparta|envíe|de))\b", re.I
)

SAFE_REPLACEMENT = {
    "en": "Remember, I will never ask you for money, codes or passwords.",
    "hi": "याद रखिए, मैं आपसे कभी पैसे, कोड या पासवर्ड नहीं माँगूँगी।",
    "es": "Recuerde, nunca le pediré dinero, códigos ni contraseñas.",
}


def is_blocked(sentence: str) -> bool:
    if not sentence or _ALLOW.search(sentence):
        return False
    return any(p.search(sentence) for p in _BLOCK)


def filter_sentence(sentence: str, lang: str = "en") -> str:
    if is_blocked(sentence):
        return SAFE_REPLACEMENT.get(lang, SAFE_REPLACEMENT["en"])
    return sentence
