"""Sarvam AI text-to-speech (Bulbul) for Indian languages.

API: POST https://api.sarvam.ai/text-to-speech -> {"audios": [base64 wav]}
Header: api-subscription-key. Docs: https://docs.sarvam.ai/api-reference/text-to-speech/convert
"""

import base64

import httpx
from loguru import logger

from .tts_interface import TTSInterface

SARVAM_LANGS = {"hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "od", "en"}


class TTSEngine(TTSInterface):
    def __init__(
        self,
        api_key: str,
        model: str = "bulbul:v3",
        speaker: str = "priya",
        language_code: str = "hi-IN",
        pace: float = 0.9,
        sample_rate: int = 24000,
        timeout: float = 8.0,
    ):
        if not api_key:
            raise ValueError("Sarvam TTS needs an api_key")
        self.api_key = api_key
        self.model = model
        self.speaker = speaker
        self.language_code = language_code
        self.pace = pace
        self.sample_rate = sample_rate
        self.timeout = timeout

    def _payload(self, text: str, language: str | None) -> dict:
        lang = f"{language}-IN" if language in SARVAM_LANGS else self.language_code
        return {
            "text": text[:2400],
            "language_code": lang,
            "speaker": self.speaker,
            "model": self.model,
            "pace": self.pace,
            "speech_sample_rate": self.sample_rate,
        }

    def _write(self, data: dict, file_name_no_ext: str | None) -> str:
        audio = base64.b64decode(data["audios"][0])
        path = self.generate_cache_file_name(file_name_no_ext, "wav")
        with open(path, "wb") as f:
            f.write(audio)
        return path

    async def async_generate_audio(self, text: str, file_name_no_ext=None, language: str | None = None) -> str:
        payload = self._payload(text, language)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"api-subscription-key": self.api_key},
                json=payload,
            )
        if r.status_code >= 300:
            logger.error(f"Sarvam TTS {r.status_code}: {r.text[:200]}")
        r.raise_for_status()
        return self._write(r.json(), file_name_no_ext)

    def generate_audio(self, text: str, file_name_no_ext=None) -> str:
        payload = self._payload(text, None)
        r = httpx.post(
            "https://api.sarvam.ai/text-to-speech",
            headers={"api-subscription-key": self.api_key},
            json=payload,
            timeout=self.timeout,
        )
        r.raise_for_status()
        return self._write(r.json(), file_name_no_ext)
