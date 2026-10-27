import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# Tests never call real providers or a real LLM.
for key in ("LLM_API_KEY", "DEEPGRAM_API_KEY", "SARVAM_API_KEY", "CARTESIA_API_KEY", "BOLNA_API_KEY",
            "WHATSAPP_TOKEN", "TWILIO_ACCOUNT_SID", "RESEND_API_KEY"):
    os.environ[key] = ""
os.environ["KINLY_SCHEDULER"] = "false"
os.environ["KINLY_API_TOKEN"] = "test-token"


@pytest.fixture()
def fresh_db(monkeypatch):
    from src.kinly import db
    from src.kinly.settings import settings

    tmp = Path(tempfile.mkdtemp()) / "kinly-test.db"
    monkeypatch.setattr(settings, "database_path", tmp)
    monkeypatch.setattr(settings, "api_token", "test-token")
    db.reset_connection()
    yield db
    db.reset_connection()


@pytest.fixture()
def family(fresh_db):
    """A family with one elder (consented), contacts and a medicine."""
    db = fresh_db
    user = db.insert("users", {"email": "arjun@example.com", "name": "Arjun", "passwordHash": "x", "isAdmin": False})
    fam = db.insert("families", {"name": "Sharma family", "plan": "family", "planStatus": "active", "currency": "USD"})
    db.insert("family_members", {"familyId": fam["id"], "userId": user["id"], "role": "owner", "relation": "son",
                                 "phone": "+919800000001", "notifyWhatsapp": True, "notifyEmail": True})
    elder = db.insert("elders", {
        "familyId": fam["id"], "name": "Kamala Sharma", "preferredName": "Kamala", "age": 74, "gender": "female",
        "languages": "en,hi", "phone": "+919811111111", "timezone": "Asia/Kolkata", "city": "Pune",
        "about": "Loves gardening and old Bollywood songs.", "screenToken": "screen-test",
        "consentStatus": "granted", "emergencyNumber": "112", "isDemo": False,
    })
    db.insert("contacts", {"elderId": elder["id"], "name": "Riya", "relation": "granddaughter", "phone": "+15550001", "email": "", "photoUrl": "", "isEmergency": False})
    db.insert("contacts", {"elderId": elder["id"], "name": "Arjun", "relation": "son", "phone": "+919800000001", "email": "", "photoUrl": "", "isEmergency": True})
    med = db.insert("medicines", {"elderId": elder["id"], "name": "Amlodipine", "dosage": "5 mg", "instructions": "", "times": "09:00,21:00", "active": True})
    return {"user": user, "family": fam, "elder": db.get("elders", elder["id"]), "medicine": med}
