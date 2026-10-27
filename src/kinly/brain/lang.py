"""Language detection tuned for short, spoken utterances from older adults."""

from __future__ import annotations

import re
from typing import Optional

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "es": "Spanish",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "od": "Odia",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "it": "Italian",
}

INDIAN_LANGUAGES = {"hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "od"}

# Unicode script ranges -> language (Marathi shares Devanagari with Hindi; profile decides)
_SCRIPTS = [
    (r"[ऀ-ॿ]", "hi"),
    (r"[ঀ-৿]", "bn"),
    (r"[਀-੿]", "pa"),
    (r"[઀-૿]", "gu"),
    (r"[଀-୿]", "od"),
    (r"[஀-௿]", "ta"),
    (r"[ఀ-౿]", "te"),
    (r"[ಀ-೿]", "kn"),
    (r"[ഀ-ൿ]", "ml"),
]

# Common romanized Hindi (Hinglish) words; enough of them means "hi" even in Latin script.
_HINGLISH = set(
    "hai hain haan han nahi nahin kya kyun kaise kaisi theek thik accha acha achha mera meri mujhe "
    "aap aapka tum tumhara bahut bohot aaj kal raat subah dawai dawa khana khaya kha liya gaya gayi "
    "ghar beta beti bachche pota poti nani dadi nana dada ji bhi aur lekin abhi mein main hoon hu "
    "gir giri gira dard pareshan akela akeli neend soya soyi baat karo karna chahiye wala wali "
    "yaad paisa paise bhejo phone".split()
)

_SPANISH_HINTS = set(
    "hola gracias buenos buenas dias tardes noches estoy estás como cómo que qué muy bien mal "
    "mi mis hijo hija nieta nieto medicina pastilla dolor caí caído ayuda llamar llama por favor "
    "sí no tengo dormí comí hoy ayer mañana señora señor".split()
)


def detect_language(text: str, allowed: Optional[list[str]] = None, previous: Optional[str] = None) -> str:
    """Best effort language of `text`. `allowed` are the elder's languages (first = primary)."""
    allowed = allowed or ["en"]
    text = (text or "").strip()
    if not text:
        return previous or allowed[0]

    for pattern, lang in _SCRIPTS:
        if re.search(pattern, text):
            if lang == "hi" and "mr" in allowed and "hi" not in allowed:
                return "mr"
            return lang

    words = re.findall(r"[a-záéíóúñü]+", text.lower())
    if not words:
        return previous or allowed[0]

    hinglish = sum(1 for w in words if w in _HINGLISH)
    spanish = sum(1 for w in words if w in _SPANISH_HINTS)
    if hinglish >= 2 or (hinglish >= 1 and len(words) <= 3 and "hi" in allowed):
        return "hi"
    if spanish >= 2 or (spanish >= 1 and len(words) <= 3 and "es" in allowed) or re.search(r"[ñ¿¡]", text):
        return "es"

    if len(words) >= 4:
        try:
            from langdetect import DetectorFactory, detect

            DetectorFactory.seed = 0
            guess = detect(text)
            if guess in LANGUAGE_NAMES and (guess in allowed or guess in ("en", "es", "fr", "de", "pt", "it")):
                return guess
        except Exception:
            pass
    return "en" if "en" in allowed or not previous else previous


def is_romanized(text: str) -> bool:
    return not any(re.search(p, text or "") for p, _ in _SCRIPTS)


def language_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, code)
