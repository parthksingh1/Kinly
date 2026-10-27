import pytest

from src.kinly.brain import intents, safety
from src.kinly.brain.lang import detect_language
from src.kinly.brain.output_filter import is_blocked


@pytest.mark.parametrize("text,category", [
    ("I fell in the bathroom this morning", "fall"),
    ("I slipped on the stairs and can't get up", "fall"),
    ("आज सुबह मैं बाथरूम में गिर गई", "fall"),
    ("main bathroom mein gir gayi", "fall"),
    ("Me caí en la cocina", "fall"),
    ("I have chest pain since morning", "chest_pain"),
    ("I can't breathe properly", "breathing"),
    ("I just want to die", "self_harm"),
])
def test_urgent_detected(text, category):
    signals = safety.classify(text)
    assert signals and signals[0].category == category and signals[0].is_urgent


@pytest.mark.parametrize("text", ["I didn't fall, don't worry", "I almost fell but I'm fine", "The leaves fell in my garden"])
def test_not_urgent(text):
    assert not safety.has_urgent(safety.classify(text))


@pytest.mark.parametrize("text", [
    "A man called from the bank asking for the OTP",
    "Someone wants me to buy gift cards",
    "They said my KYC will be blocked",
    "एक आदमी ओटीपी माँग रहा था",
    "Me pidieron dinero por teléfono",
])
def test_scam_detected(text):
    assert any(s.severity == safety.SCAM for s in safety.classify(text))


def test_concerning():
    cats = {s.category for s in safety.classify("I feel so lonely and I haven't eaten today")}
    assert {"loneliness", "not_eating"} <= cats


@pytest.mark.parametrize("text,name", [
    ("Call Riya", "riya"), ("Please video call my Arjun", "arjun"), ("Riya ko call karo", "riya"), ("Llama a Riya por favor", "riya"),
])
def test_call_intent(text, name):
    assert intents.call_target(text) == name


def test_call_intent_ignores_noise():
    assert intents.call_target("call me later") is None


def test_privacy_and_forget():
    assert intents.wants_privacy("Please keep this between us")
    assert intents.wants_privacy("yeh baat kisi ko mat batana")
    assert intents.wants_forget("forget that")
    assert intents.took_medicine("Yes I took it after breakfast") is True
    assert intents.took_medicine("haan le li") is True
    assert intents.took_medicine("I forgot to take it") is False


def test_language_detection():
    assert detect_language("मैं ठीक हूँ", ["en", "hi"]) == "hi"
    assert detect_language("main theek hoon, aaj khana kha liya", ["en", "hi"]) == "hi"
    assert detect_language("Estoy muy bien, gracias", ["en", "es"]) == "es"
    assert detect_language("I am doing well today thank you", ["en", "hi"]) == "en"


def test_output_filter():
    assert is_blocked("Please share the OTP you received so I can help.")
    assert is_blocked("Can you send me some money today?")
    assert not is_blocked("Remember, never share your OTP with anyone.")
    assert not is_blocked("How is your garden today?")
