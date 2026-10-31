"""Kinly runtime settings, read from environment variables (and a local .env file)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so we don't add a dependency. Existing env vars win."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value[:1] in ('"', "'"):
            value = value[1:].split(value[0], 1)[0]
        else:
            value = value.split(" #", 1)[0].split("\t#", 1)[0].strip()
            if value.startswith("#"):
                value = ""
        os.environ.setdefault(key, value)


_load_dotenv(ROOT_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


@dataclass
class Settings:
    # LLM (any OpenAI compatible endpoint)
    llm_api_key: str = field(default_factory=lambda: os.environ.get("LLM_API_KEY", ""))
    llm_base_url: str = field(
        default_factory=lambda: os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
    )
    llm_model: str = field(default_factory=lambda: os.environ.get("LLM_MODEL", "gpt-4o-mini"))
    llm_timeout_s: float = field(default_factory=lambda: _float("LLM_TIMEOUT_S", 20.0))

    # Speech providers
    deepgram_api_key: str = field(default_factory=lambda: os.environ.get("DEEPGRAM_API_KEY", ""))
    cartesia_api_key: str = field(default_factory=lambda: os.environ.get("CARTESIA_API_KEY", ""))
    sarvam_api_key: str = field(default_factory=lambda: os.environ.get("SARVAM_API_KEY", ""))

    # Phone
    bolna_api_key: str = field(default_factory=lambda: os.environ.get("BOLNA_API_KEY", ""))
    bolna_agent_id: str = field(default_factory=lambda: os.environ.get("BOLNA_AGENT_ID", ""))
    bolna_from_number: str = field(
        default_factory=lambda: os.environ.get("BOLNA_FROM_NUMBER", "")
    )

    # Notifications
    whatsapp_provider: str = field(
        default_factory=lambda: os.environ.get("WHATSAPP_PROVIDER", "").lower()
    )
    whatsapp_token: str = field(default_factory=lambda: os.environ.get("WHATSAPP_TOKEN", ""))
    whatsapp_phone_id: str = field(default_factory=lambda: os.environ.get("WHATSAPP_PHONE_ID", ""))
    twilio_account_sid: str = field(
        default_factory=lambda: os.environ.get("TWILIO_ACCOUNT_SID", "")
    )
    twilio_auth_token: str = field(default_factory=lambda: os.environ.get("TWILIO_AUTH_TOKEN", ""))
    twilio_whatsapp_from: str = field(
        default_factory=lambda: os.environ.get("TWILIO_WHATSAPP_FROM", "")
    )
    resend_api_key: str = field(default_factory=lambda: os.environ.get("RESEND_API_KEY", ""))
    email_from: str = field(
        default_factory=lambda: os.environ.get("EMAIL_FROM", "Kinly <onboarding@resend.dev>")
    )

    # Platform
    public_base_url: str = field(
        default_factory=lambda: os.environ.get("PUBLIC_BASE_URL", "http://localhost:12393").rstrip("/")
    )
    family_app_url: str = field(
        default_factory=lambda: os.environ.get("FAMILY_APP_URL", "http://localhost:3000").rstrip("/")
    )
    api_token: str = field(default_factory=lambda: os.environ.get("KINLY_API_TOKEN", "dev-kinly-token"))
    demo_mode: bool = field(default_factory=lambda: _bool("DEMO_MODE", False))
    database_path: Path = field(
        default_factory=lambda: Path(
            os.environ.get("KINLY_DB_PATH", str(ROOT_DIR / "data" / "kinly.db"))
        )
    )
    uploads_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("KINLY_UPLOADS_DIR", str(ROOT_DIR / "data" / "uploads")))
    )

    # Elder friendly behaviour
    speech_rate: float = field(default_factory=lambda: _float("KINLY_SPEECH_RATE", 0.9))
    missed_med_escalate_after: int = field(
        default_factory=lambda: _int("KINLY_MISSED_MED_ESCALATE_AFTER", 2)
    )
    call_retry_count: int = field(default_factory=lambda: _int("KINLY_CALL_RETRIES", 2))
    call_retry_minutes: int = field(default_factory=lambda: _int("KINLY_CALL_RETRY_MINUTES", 10))
    scheduler_enabled: bool = field(default_factory=lambda: _bool("KINLY_SCHEDULER", True))
    provider_timeout_s: float = field(default_factory=lambda: _float("KINLY_PROVIDER_TIMEOUT_S", 8.0))

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def bolna_enabled(self) -> bool:
        return bool(self.bolna_api_key and self.bolna_agent_id)


settings = Settings()
