from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.kinly.api import init_kinly_routes
from src.kinly.phone.bolna import parse_context, parse_transcript

AUTH = {"Authorization": "Bearer test-token"}


def make_client():
    app = FastAPI()
    app.include_router(init_kinly_routes())
    return TestClient(app)


def system_prompt(elder_id, execution="exec-1"):
    return ("You are Kinly...\nKINLY_CONTEXT elder_id=%s caller=+918000000000 callee=+919811111111 "
            "execution=%s call_sid=CA123" % (elder_id, execution))


def test_parse_helpers():
    ctx = parse_context([{"role": "system", "content": "x KINLY_CONTEXT elder_id={elder_id} caller=+91981 callee=+1 execution=e1 call_sid=s"}])
    assert ctx["elder_id"] == "" and ctx["caller"] == "+91981" and ctx["execution_id"] == "e1"
    turns = parse_transcript("assistant: Hello Kamala\nuser: I am fine\nand happy\nassistant: Great")
    assert [t["role"] for t in turns] == ["assistant", "user", "assistant"] and turns[1]["text"] == "I am fine and happy"


def test_requires_token(family):
    client = make_client()
    r = client.post("/v1/chat/completions", json={"messages": []})
    assert r.status_code == 401


def test_streaming_turn_and_webhook(family, fresh_db):
    client = make_client()
    elder = family["elder"]
    messages = [
        {"role": "system", "content": system_prompt(elder["id"])},
        {"role": "assistant", "content": "Hello Kamala, it's Kinly calling."},
        {"role": "user", "content": "Hello, I'm good. My knee hurts a little."},
    ]
    r = client.post("/v1/chat/completions", headers=AUTH, json={"model": "kinly-companion", "stream": True, "messages": messages})
    assert r.status_code == 200
    body = r.text
    assert "data: [DONE]" in body and '"content"' in body

    # elder identified by caller number when elder_id is missing (inbound call)
    inbound = [{"role": "system", "content": "KINLY_CONTEXT elder_id= caller=+91 98111 11111 callee=+1 execution=exec-2 call_sid=x".replace("+91 98111 11111", "+919811111111")},
               {"role": "user", "content": "Hi Kinly"}]
    r2 = client.post("/v1/chat/completions", headers=AUTH, json={"stream": False, "messages": inbound})
    assert r2.status_code == 200 and r2.json()["choices"][0]["message"]["content"]

    hook = {
        "id": "exec-1", "status": "completed", "conversation_duration": 95,
        "transcript": "assistant: Hello Kamala, it's Kinly calling.\nuser: Hello, I'm good. My knee hurts a little.\nassistant: I'm sorry.\nuser: A man called asking for my OTP",
        "user_number": "+919811111111", "telephony_data": {"call_type": "outbound"},
    }
    r3 = client.post("/webhooks/bolna?token=test-token", json=hook)
    assert r3.status_code == 200 and r3.json()["processed"] is True
    convo = fresh_db.query_one("SELECT * FROM conversations WHERE externalId = 'exec-1'")
    assert convo["processed"] == 1 and convo["durationSec"] == 95
    assert fresh_db.query_one("SELECT * FROM alerts WHERE category = 'scam'")
    # idempotent
    assert client.post("/webhooks/bolna?token=test-token", json=hook).json()["processed"] is False


def test_demo_simulate_headless(family, fresh_db):
    client = make_client()
    r = client.post("/api/kinly/demo/simulate", headers=AUTH, json={"elderId": family["elder"]["id"], "kind": "fall"})
    assert r.status_code == 200 and r.json()["via"] == "headless" and "112" in r.json()["reply"]
    r = client.post("/api/kinly/demo/simulate", headers=AUTH, json={"elderId": family["elder"]["id"], "kind": "missed_medicine"})
    assert r.status_code == 200 and r.json()["alert"]["category"] == "missed_medicine"
