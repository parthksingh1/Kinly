"""Safety, wellbeing and scam signal detection.

Deterministic multilingual rules run on every utterance (fast, never offline), so the
urgent path does not depend on an LLM. An optional LLM pass after the conversation adds
nuance (see summary.py). Kinly never diagnoses: it notices, encourages help and informs family.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

URGENT = "urgent"
CONCERNING = "concerning"
SCAM = "scam"


@dataclass
class Signal:
    category: str
    severity: str  # urgent | concerning | scam
    title: str
    quote: str
    matched: str = ""

    @property
    def is_urgent(self) -> bool:
        return self.severity == URGENT


@dataclass
class _Rule:
    category: str
    severity: str
    title: str
    patterns: list[str] = field(default_factory=list)


# Patterns are regexes matched against lower-cased text. Each list mixes English,
# Hindi (Devanagari and romanized) and Spanish.
RULES: list[_Rule] = [
    _Rule("fall", URGENT, "Mentioned a fall", [
        r"\b(i|i've|i have|i just|i had)\s+(fell|fallen|slipped|tripped)\b", r"\b(i|she|he|we|mom|dad|amma|papa)\s+(just\s+|then\s+)?fell\b", r"\bfell (down|off) (the |my )?(stairs|steps|bed|chair)\b",
        r"\b(had|took) a (bad )?fall\b", r"\bslipped (in|on)\b", r"\bcan'?t get up\b", r"\bon the floor and\b",
        r"गिर (गई|गया|गयी|पड़ी|पड़ा)", r"फिसल (गई|गया|गयी)", r"\bgir (gayi|gai|gaya|gayee|padi|pada)\b",
        r"\bphisal (gayi|gai|gaya)\b", r"\bme (caí|cai)\b", r"\b(he|e) tenido una caída\b", r"\bresbalé\b",
        r"\bno me puedo levantar\b",
    ]),
    _Rule("chest_pain", URGENT, "Chest pain", [
        r"\bchest (pain|hurts|is hurting|tight|tightness|pressure)\b", r"\bpain in (my|the) chest\b",
        r"\bheart (pain|is hurting|attack)\b", r"सीने में दर्द", r"छाती में दर्द", r"\b(seene|seene mein|chhati|chhati mein) (me |mein )?dard\b",
        r"\bdolor (en el|de) pecho\b", r"\bme duele el pecho\b",
    ]),
    _Rule("breathing", URGENT, "Trouble breathing", [
        r"\b(can'?t|cannot|hard to|trouble|difficult(y)? (to )?)\s*breath(e|ing)?\b", r"\bshort(ness)? of breath\b",
        r"\bout of breath\b", r"सांस (नहीं|लेने में)", r"\bsaans (nahi|nahin|lene mein|phool)\b",
        r"\bno puedo respirar\b", r"\bme falta el aire\b",
    ]),
    _Rule("stroke_confusion", URGENT, "Possible severe confusion or stroke signs", [
        r"\b(face|arm) (is )?(numb|drooping|weak)\b", r"\bcan'?t (move|feel) my (arm|leg|face)\b",
        r"\bspeech (is )?slurr", r"\bdon'?t know where i am\b", r"\bwhere am i\b", r"\bwho are you\? where\b",
        r"\bmujhe nahi pata main kahan\b", r"मैं कहाँ हूँ", r"\bno sé dónde estoy\b",
    ]),
    _Rule("self_harm", URGENT, "Talk of self harm", [
        r"\b(kill|hurt|harm) myself\b", r"\bend (my|it) (life|all)\b", r"\bwant to die\b", r"\bdon'?t want to live\b",
        r"\bbetter off dead\b", r"\bno reason to live\b", r"मरना चाहत", r"जीना नहीं चाहत", r"\bmarna chaht",
        r"\bjeena nahi chaht", r"\bquiero morir(me)?\b", r"\bno quiero vivir\b",
    ]),
    _Rule("bleeding", URGENT, "Mentioned heavy bleeding or injury", [
        r"\bbleeding (a lot|badly|heavily|won'?t stop)\b", r"\bhit my head\b", r"\bsir (par|pe) chot\b",
        r"सिर पर चोट", r"\bme golpeé la cabeza\b",
    ]),
    _Rule("scam_money", SCAM, "Possible scam: money request", [
        r"\b(asked|asking|wants?|told) (me )?(to )?(send|transfer|pay|wire)\b.*\b(money|rupees|dollars|amount|fee)\b",
        r"\b(send|transfer|pay|wire) (him|her|them|someone)? ?(some )?(money|rupees|dollars)\b",
        r"\bgift ?cards?\b", r"\b(lottery|prize|lucky draw|jackpot)\b", r"\bdigital arrest\b",
        r"\b(kyc|account) (will be )?(blocked|suspended|expired|update)\b", r"\bcustoms (fee|parcel)\b",
        r"\bpaise (bhejo|bhejne|transfer|maang)", r"पैसे (भेज|मांग|ट्रांसफर)", r"\b(lottery|inaam) (laga|lagi)\b",
        r"\b(pedir|mandar|enviar|transferir) dinero\b", r"\btarjetas? de regalo\b", r"\bme pidi(ó|eron) dinero\b",
    ]),
    _Rule("scam_credentials", SCAM, "Possible scam: OTP, PIN or bank details", [
        r"\botp\b", r"\bone[- ]time (password|code)\b", r"\b(pin|password|cvv)\b.*\b(asked|asking|wants?|share|tell)\b",
        r"\b(asked|asking|wants?)\b.*\b(pin|password|cvv|bank details|account number|card number|aadhaar|social security)\b",
        r"\bverification code\b", r"ओटीपी", r"\bcódigo de verificación\b", r"\bnúmero de (cuenta|tarjeta)\b",
    ]),
    _Rule("scam_caller", SCAM, "Suspicious caller", [
        r"\b(stranger|unknown (number|caller|person)|someone) (called|rang)\b.*\b(bank|police|government|tax|courier|grandson|granddaughter|son|daughter)\b",
        r"\b(said|claimed) (he|she|they) (was|were|is|are) (from|with) (the )?(bank|police|government|irs|tax|cbi|customs)\b",
        r"\banjaan (number|aadmi|log) (ka|se) (call|phone)\b", r"अनजान (नंबर|आदमी)", r"\bllamó un desconocido\b",
    ]),
    _Rule("low_mood", CONCERNING, "Low mood", [
        r"\b(i'?m|i am|feeling|feel) (so |very |really )?(sad|down|depressed|hopeless|miserable|low)\b",
        r"\bnothing (to look forward|matters)\b", r"\bcried (all|a lot)\b", r"\bउदास\b", r"\b(udaas|udas|dukhi)\b",
        r"\bman nahi lagta\b", r"\bmuy triste\b", r"\bestoy (triste|deprimid[ao])\b",
    ]),
    _Rule("loneliness", CONCERNING, "Feeling lonely", [
        r"\b(lonely|alone all day|no one (visits|calls|to talk))\b", r"\bnobody (visits|calls|cares)\b",
        r"अकेल", r"\b(akela|akeli|akelapan)\b", r"\b(me siento )?sol[ao] (todo el día)?\b", r"\bsoledad\b",
    ]),
    _Rule("not_eating", CONCERNING, "Not eating well", [
        r"\b(haven'?t|didn'?t|did not|have not) (eaten|had (any )?(food|breakfast|lunch|dinner))\b",
        r"\bno appetite\b", r"\bnot (eating|hungry)\b", r"\bskipped (breakfast|lunch|dinner|meals?)\b",
        r"\bkhana nahi (khaya|khayi|khaaya)\b", r"खाना नहीं खाया", r"\bbhook nahi\b", r"\bno he comido\b", r"\bno tengo hambre\b",
    ]),
    _Rule("pain", CONCERNING, "Mentioned pain", [
        r"\b(my )?(knee|back|leg|hip|head|stomach|joint)s? (is |are )?(hurting|aching|painful|hurts)\b",
        r"\b(bad|terrible|lot of) (pain|headache)\b", r"\b(ghutne|kamar|pair|sir|pet) (mein|me) dard\b",
        r"(घुटने|कमर|पैर|सिर|पेट) में दर्द", r"\bme duele (la|el) (rodilla|espalda|cabeza|pierna)\b",
    ]),
    _Rule("sleep", CONCERNING, "Trouble sleeping", [
        r"\b(couldn'?t|could not|can'?t|didn'?t) sleep\b", r"\bno sleep\b", r"\bawake all night\b",
        r"\bneend nahi\b", r"नींद नहीं", r"\bno (pude|puedo) dormir\b",
    ]),
]

_NEGATIONS = re.compile(
    r"\b(didn'?t|did not|never|not|no|haven'?t|nahi|nahin|nunca)\b(\s+\w+){0,2}\s*$"
)
# "I didn't fall" -> negated. Only applied to urgent physical rules.
_NEGATABLE = {"fall", "chest_pain", "breathing", "bleeding"}


def classify(text: str) -> list[Signal]:
    lowered = (text or "").lower()
    if not lowered.strip():
        return []
    found: dict[str, Signal] = {}
    for rule in RULES:
        for pattern in rule.patterns:
            m = re.search(pattern, lowered)
            if not m:
                continue
            if rule.category in _NEGATABLE and _is_negated(lowered, m.start(), m.group(0)):
                continue
            found.setdefault(
                rule.category,
                Signal(rule.category, rule.severity, rule.title, text.strip()[:300], m.group(0)),
            )
            break
    order = {URGENT: 0, SCAM: 1, CONCERNING: 2}
    return sorted(found.values(), key=lambda s: order[s.severity])


def _is_negated(text: str, start: int, matched: str) -> bool:
    if re.match(r"^(i|i've|i have|i just|i had)\s", matched):
        # negation would sit inside the match: "i have not fallen" is not matched anyway
        return False
    window = text[max(0, start - 30) : start]
    return bool(_NEGATIONS.search(window)) or bool(re.search(r"\b(almost|nearly)\s*$", window))


def has_urgent(signals: list[Signal]) -> bool:
    return any(s.is_urgent for s in signals)
