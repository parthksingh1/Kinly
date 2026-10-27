"""Offline companion brain.

Used when no LLM key is configured, or when the LLM times out mid-demo. It is a small
rule-based conversationalist that still feels personal: it follows the check-in flow,
uses the elder's name, remembered facts and interests, in English, Hindi and Spanish.
"""

from __future__ import annotations

import random
import re

STAGE_LINES = {
    "greeting": {
        "en": ["[happy] Good {daypart}, {name}! How are you feeling today?"],
        "hi": ["[happy] {daypart_hi} {name}! आज आप कैसा महसूस कर रही हैं?"],
        "es": ["[happy] ¡Buen{daypart_es}, {name}! ¿Cómo se siente hoy?"],
    },
    "sleep": {
        "en": ["How did you sleep last night?", "Did you get a good night's rest?"],
        "hi": ["कल रात नींद कैसी आई?"],
        "es": ["¿Cómo durmió anoche?"],
    },
    "food": {
        "en": ["What did you have to eat today?", "Have you had something nice to eat today?"],
        "hi": ["आज आपने खाने में क्या खाया?"],
        "es": ["¿Qué ha comido hoy?"],
    },
    "medicines": {
        "en": ["Have you taken your {med} today?"],
        "hi": ["क्या आपने आज अपनी {med} ले ली?"],
        "es": ["¿Ya tomó su {med} hoy?"],
    },
    "plans": {
        "en": ["What are you planning to do today?", "Anything nice planned for today?"],
        "hi": ["आज का क्या प्लान है?"],
        "es": ["¿Qué planes tiene para hoy?"],
    },
    "story": {
        "en": ["I'd love to hear more about {interest}. What do you enjoy most about it?", "Tell me a story from when you were young. What was your home like?"],
        "hi": ["मुझे {interest} के बारे में और सुनना अच्छा लगेगा। आपको इसमें सबसे ज़्यादा क्या पसंद है?", "अपने बचपन की कोई कहानी सुनाइए।"],
        "es": ["Me encantaría saber más sobre {interest}. ¿Qué es lo que más le gusta?", "Cuénteme una historia de cuando era joven."],
    },
    "wrapup": {
        "en": ["[happy] It's been lovely talking with you, {name}. Your family is thinking of you. Shall we talk again tomorrow?"],
        "hi": ["[happy] आपसे बात करके बहुत अच्छा लगा, {name}। आपका परिवार आपको याद करता है। कल फिर बात करें?"],
        "es": ["[happy] Ha sido un placer hablar con usted, {name}. Su familia piensa en usted. ¿Hablamos mañana?"],
    },
}

ACKS = {
    "positive": {
        "en": ["[happy] That's lovely to hear.", "[happy] Oh, how nice!", "[happy] I'm so glad."],
        "hi": ["[happy] यह सुनकर बहुत अच्छा लगा।", "[happy] वाह, बहुत बढ़िया!"],
        "es": ["[happy] Qué bueno escuchar eso.", "[happy] ¡Qué bien!"],
    },
    "negative": {
        "en": ["[concerned] Oh, I'm sorry to hear that.", "[concerned] That sounds hard."],
        "hi": ["[concerned] ओह, यह सुनकर दुख हुआ।"],
        "es": ["[concerned] Lo siento mucho."],
    },
    "neutral": {
        "en": ["[listening] I see.", "[listening] Mm, tell me more.", "That makes sense."],
        "hi": ["[listening] अच्छा।", "[listening] हम्म, और बताइए।"],
        "es": ["[listening] Ya veo.", "[listening] Cuénteme más."],
    },
}

_POS = r"\b(good|great|fine|well|lovely|wonderful|happy|nice|better|accha|achha|badhiya|theek|thik|bien|bueno|feliz|mejor)\b|अच्छ|बढ़िया|ठीक"
_NEG = r"\b(bad|tired|sad|not good|not well|pain|hurt|lonely|worse|bura|thaki|thaka|dard|mal|cansad|triste|dolor)\b|बुरा|थक|दर्द|उदास"


def _daypart(hour: int) -> tuple[str, str, str]:
    if hour < 12:
        return "morning", "सुप्रभात", "os días"
    if hour < 17:
        return "afternoon", "नमस्ते", "as tardes"
    return "evening", "शुभ संध्या", "as noches"


def reply(
    stage: str,
    lang: str,
    name: str,
    user_text: str,
    hour: int,
    interests: list[str],
    followup: str = "",
    med_name: str = "",
    first_turn: bool = False,
) -> str:
    lang = lang if lang in ("en", "hi", "es") else "en"
    daypart, daypart_hi, daypart_es = _daypart(hour)
    parts: list[str] = []

    if user_text and not first_turn:
        low = user_text.lower()
        tone = "negative" if re.search(_NEG, low) else "positive" if re.search(_POS, low) else "neutral"
        parts.append(random.choice(ACKS[tone][lang]))

    if first_turn and followup:
        greet = random.choice(STAGE_LINES["greeting"][lang]).split("!")[0] + "!"
        follow = {
            "en": f"Last time you mentioned that {followup}. How is that today?",
            "hi": f"पिछली बार आपने बताया था कि {followup}। आज कैसा है?",
            "es": f"La última vez me contó que {followup}. ¿Cómo sigue hoy?",
        }[lang]
        parts.append(greet.format(name=name, daypart=daypart, daypart_hi=daypart_hi, daypart_es=daypart_es))
        parts.append(follow)
        return " ".join(parts)

    line = random.choice(STAGE_LINES.get(stage, STAGE_LINES["story"])[lang])
    interest = random.choice(interests) if interests else {"en": "your favourite things", "hi": "आपकी पसंदीदा चीज़ों", "es": "sus cosas favoritas"}[lang]
    parts.append(
        line.format(
            name=name, daypart=daypart, daypart_hi=daypart_hi, daypart_es=daypart_es,
            interest=interest, med=med_name or {"en": "medicines", "hi": "दवाइयाँ", "es": "medicinas"}[lang],
        )
    )
    return " ".join(parts)
