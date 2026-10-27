"""Sarvam AI speech-to-text for Indian languages (and Indian English), with auto language detection.

API: POST https://api.sarvam.ai/speech-to-text (multipart: file, model, language_code)
Header: api-subscription-key. Docs: https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
"""

import httpx
import numpy as np
from loguru import logger

from .asr_interface import ASRInterface
from .deepgram_asr import np_to_wav_bytes


class VoiceRecognition(ASRInterface):
    def __init__(
        self,
        api_key: str,
        model: str = "saaras:v4",
        language_code: str = "unknown",
        timeout: float = 8.0,
    ):
        if not api_key:
            raise ValueError("Sarvam ASR needs an api_key")
        self.api_key = api_key
        self.model = model
        self.language_code = language_code
        self.timeout = timeout
        self.last_language: str | None = None

    def _request_args(self, audio: np.ndarray) -> dict:
        return dict(
            url="https://api.sarvam.ai/speech-to-text",
            headers={"api-subscription-key": self.api_key},
            files={"file": ("speech.wav", np_to_wav_bytes(audio.astype(np.float32), self.SAMPLE_RATE), "audio/wav")},
            data={"model": self.model, "language_code": self.language_code},
        )

    def _parse(self, data: dict) -> str:
        self.last_language = (data.get("language_code") or "").split("-")[0] or None
        return (data.get("transcript") or "").strip()

    async def async_transcribe_np(self, audio: np.ndarray, languages: list[str] | None = None) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(**self._request_args(audio))
        r.raise_for_status()
        text = self._parse(r.json())
        logger.debug(f"Sarvam ({self.last_language}): {text}")
        return text

    def transcribe_np(self, audio: np.ndarray) -> str:
        r = httpx.post(**self._request_args(audio), timeout=self.timeout)
        r.raise_for_status()
        return self._parse(r.json())
