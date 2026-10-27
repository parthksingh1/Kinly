"""Deepgram pre-recorded speech-to-text (Nova-3) with automatic language detection.

API: POST https://api.deepgram.com/v1/listen?model=nova-3&detect_language=true
Docs: https://developers.deepgram.com/docs/language-detection
"""

import io
import wave

import httpx
import numpy as np
from loguru import logger

from .asr_interface import ASRInterface


def np_to_wav_bytes(audio: np.ndarray, sample_rate: int = 16000) -> bytes:
    audio = np.clip(audio, -1, 1)
    pcm = (audio * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


class VoiceRecognition(ASRInterface):
    def __init__(
        self,
        api_key: str,
        model: str = "nova-3",
        detect_languages: list[str] | None = None,
        timeout: float = 8.0,
    ):
        if not api_key:
            raise ValueError("Deepgram ASR needs an api_key")
        self.api_key = api_key
        self.model = model
        self.detect_languages = detect_languages or []
        self.timeout = timeout
        self.last_language: str | None = None

    def _params(self, languages: list[str] | None = None) -> list[tuple[str, str]]:
        params = [("model", self.model), ("smart_format", "true"), ("punctuate", "true")]
        langs = languages or self.detect_languages
        if langs:
            params += [("detect_language", lang) for lang in langs]
        else:
            params.append(("detect_language", "true"))
        return params

    def _parse(self, data: dict) -> str:
        channel = data["results"]["channels"][0]
        self.last_language = (channel.get("detected_language") or "").split("-")[0] or None
        return channel["alternatives"][0].get("transcript", "").strip()

    async def async_transcribe_np(self, audio: np.ndarray, languages: list[str] | None = None) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(
                "https://api.deepgram.com/v1/listen",
                params=self._params(languages),
                headers={"Authorization": f"Token {self.api_key}", "Content-Type": "audio/wav"},
                content=np_to_wav_bytes(audio.astype(np.float32), self.SAMPLE_RATE),
            )
        r.raise_for_status()
        text = self._parse(r.json())
        logger.debug(f"Deepgram ({self.last_language}): {text}")
        return text

    def transcribe_np(self, audio: np.ndarray) -> str:
        r = httpx.post(
            "https://api.deepgram.com/v1/listen",
            params=self._params(),
            headers={"Authorization": f"Token {self.api_key}", "Content-Type": "audio/wav"},
            content=np_to_wav_bytes(audio.astype(np.float32), self.SAMPLE_RATE),
            timeout=self.timeout,
        )
        r.raise_for_status()
        return self._parse(r.json())
