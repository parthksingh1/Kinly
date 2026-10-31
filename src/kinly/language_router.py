"""LanguageRouter: chooses speech providers per turn from the elder's languages and the
language actually being spoken.

ASR: Indian-language elders -> Sarvam (auto-detects 11 Indian languages + Indian English),
     everyone else -> Deepgram Nova-3 with language detection. The other provider is the fallback.
TTS: reply language detected from the text. Indian languages -> Sarvam Bulbul,
     global languages -> Cartesia Sonic, Edge TTS as a keyless fallback for both.

Every provider call has a short timeout and one retry. If everything fails the turn degrades
gracefully (empty transcript -> "Sorry, could you say that again?").
"""

from __future__ import annotations

import asyncio
import os
from typing import Optional

import httpx
import numpy as np
from loguru import logger

from ..open_llm_vtuber.asr.asr_interface import ASRInterface
from ..open_llm_vtuber.tts.tts_interface import TTSInterface
from .brain.lang import INDIAN_LANGUAGES, detect_language
from .settings import settings
from .turn_context import turn_context

EDGE_VOICES = {
    "en": "en-US-AvaNeural", "en-IN": "en-IN-NeerjaNeural", "hi": "hi-IN-SwaraNeural", "es": "es-MX-DaliaNeural",
    "bn": "bn-IN-TanishaaNeural", "ta": "ta-IN-PallaviNeural", "te": "te-IN-ShrutiNeural", "mr": "mr-IN-AarohiNeural",
    "gu": "gu-IN-DhwaniNeural", "kn": "kn-IN-SapnaNeural", "ml": "ml-IN-SobhanaNeural", "pa": "pa-IN-OjasNeural",
    "fr": "fr-FR-DeniseNeural", "de": "de-DE-KatjaNeural", "pt": "pt-BR-FranciscaNeural", "it": "it-IT-ElsaNeural",
}
CARTESIA_LANGS = {"en", "es", "fr", "de", "pt", "it", "hi", "ja", "ko", "zh", "nl", "pl", "ru", "sv", "tr"}


def _session_context():
    """(elder languages, session) for the current turn, if known."""
    t = turn_context.current()
    if not t:
        return ["en"], None
    from .brain.session import sessions
    from .repo import elder_languages

    session = sessions.get(t.client_uid)
    if not session:
        return ["en"], None
    return elder_languages(session.elder), session


async def _with_retry(label: str, fn, retries: int = 1):
    last: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            return await asyncio.wait_for(fn(), timeout=settings.provider_timeout_s)
        except Exception as e:  # timeout, HTTP error, network
            last = e
            logger.warning(f"{label} attempt {attempt + 1} failed: {type(e).__name__}: {str(e)[:160]}")
    raise last or RuntimeError(f"{label} failed")


class RouterASR(ASRInterface):
    def __init__(self, deepgram_model: str = "nova-3", sarvam_model: str = "saaras:v4"):
        self.deepgram = self.sarvam = None
        if settings.deepgram_api_key:
            from ..open_llm_vtuber.asr.deepgram_asr import VoiceRecognition as Deepgram

            self.deepgram = Deepgram(settings.deepgram_api_key, model=deepgram_model, timeout=settings.provider_timeout_s)
        if settings.sarvam_api_key:
            from ..open_llm_vtuber.asr.sarvam_asr import VoiceRecognition as Sarvam

            self.sarvam = Sarvam(settings.sarvam_api_key, model=sarvam_model, timeout=settings.provider_timeout_s)
        logger.info(f"LanguageRouter ASR: deepgram={'on' if self.deepgram else 'off'}, sarvam={'on' if self.sarvam else 'off'}")

    @property
    def available(self) -> bool:
        return bool(self.deepgram or self.sarvam)

    async def async_transcribe_np(self, audio: np.ndarray) -> str:
        if audio is None or len(audio) < 1600:  # < 0.1 s
            return ""
        langs, session = _session_context()
        indian_first = bool(set(langs) & INDIAN_LANGUAGES)
        if session and session.language in INDIAN_LANGUAGES:
            indian_first = True
        elif session and session.language and session.language not in INDIAN_LANGUAGES and session.language != "en":
            indian_first = False
        order = [("sarvam", self.sarvam), ("deepgram", self.deepgram)]
        if not indian_first:
            order.reverse()
        dg_langs = [lang for lang in langs if lang not in ("od", "pa")] or None
        for name, engine in order:
            if not engine:
                continue
            try:
                kwargs = {"languages": dg_langs} if name == "deepgram" else {}
                text = await _with_retry(f"{name} ASR", lambda: engine.async_transcribe_np(audio, **kwargs))
                lang = engine.last_language or ""
                turn_context.set_asr(name, lang)
                if text:
                    return text
            except Exception:
                continue
        logger.error("All ASR providers failed or none configured")
        return ""

    def transcribe_np(self, audio: np.ndarray) -> str:
        return asyncio.run(self.async_transcribe_np(audio))


class RouterTTS(TTSInterface):
    def __init__(self, cartesia_voice_id: str = "", cartesia_model: str = "sonic-3", sarvam_speaker: str = "priya",
                 sarvam_model: str = "bulbul:v3", speech_rate: Optional[float] = None):
        self.rate = speech_rate or settings.speech_rate
        self.cartesia_voice_id = cartesia_voice_id or os.environ.get("CARTESIA_VOICE_ID", "6ccbfb76-1fc6-48f7-b71d-91ac6298247b")
        self.cartesia_model = cartesia_model
        self.sarvam = None
        if settings.sarvam_api_key:
            from ..open_llm_vtuber.tts.sarvam_tts import TTSEngine as SarvamTTS

            self.sarvam = SarvamTTS(settings.sarvam_api_key, model=sarvam_model, speaker=sarvam_speaker,
                                    pace=self.rate, timeout=settings.provider_timeout_s)
        logger.info(f"LanguageRouter TTS: cartesia={'on' if settings.cartesia_api_key else 'off'}, sarvam={'on' if self.sarvam else 'off'}, edge=fallback")

    async def _cartesia(self, text: str, lang: str, file_name: str, voice_id: Optional[str] = None) -> str:
        speed = max(0.6, min(1.5, self.rate))
        async with httpx.AsyncClient(timeout=settings.provider_timeout_s) as client:
            r = await client.post(
                "https://api.cartesia.ai/tts/bytes",
                headers={"Authorization": f"Bearer {settings.cartesia_api_key}", "Cartesia-Version": "2026-08-14"},
                json={
                    "model_id": self.cartesia_model,
                    "transcript": text,
                    "voice": {"mode": "id", "id": voice_id or self.cartesia_voice_id},
                    "language": lang if lang in CARTESIA_LANGS else "en",
                    "output_format": {"container": "wav", "encoding": "pcm_s16le", "sample_rate": 24000},
                    "generation_config": {"speed": speed},
                },
            )
        r.raise_for_status()
        path = self.generate_cache_file_name(file_name, "wav")
        with open(path, "wb") as f:
            f.write(r.content)
        return path

    async def _edge(self, text: str, lang: str, file_name: str, indian: bool) -> str:
        import edge_tts

        voice = EDGE_VOICES["en-IN"] if (lang == "en" and indian) else EDGE_VOICES.get(lang, EDGE_VOICES["en"])
        pct = int(round((self.rate - 1.0) * 100))
        path = self.generate_cache_file_name(file_name, "mp3")
        await edge_tts.Communicate(text, voice, rate=f"{pct:+d}%").save(path)
        return path

    async def async_generate_audio(self, text: str, file_name_no_ext=None) -> str:
        langs, session = _session_context()
        lang = detect_language(text, langs, session.language if session else None)
        indian = bool(set(langs) & INDIAN_LANGUAGES)
        avatar_voice = session.avatar.get("voiceId") if session and session.avatar else None
        chain = []
        if avatar_voice and settings.cartesia_api_key:
            chain.append(("cartesia-avatar", lambda: self._cartesia(text, lang, file_name_no_ext, avatar_voice)))
        if lang in INDIAN_LANGUAGES or (lang == "en" and indian):
            if self.sarvam:
                chain.append(("sarvam", lambda: self.sarvam.async_generate_audio(text, file_name_no_ext, language=lang)))
            if settings.cartesia_api_key and lang in CARTESIA_LANGS:
                chain.append(("cartesia", lambda: self._cartesia(text, lang, file_name_no_ext)))
        elif settings.cartesia_api_key:
            chain.append(("cartesia", lambda: self._cartesia(text, lang, file_name_no_ext)))
        chain.append(("edge", lambda: self._edge(text, lang, file_name_no_ext, indian)))
        for name, fn in chain:
            try:
                path = await _with_retry(f"{name} TTS", fn, retries=0 if name == "edge" else 1)
                turn_context.set_tts(name, lang)
                return path
            except Exception:
                continue
        raise RuntimeError("All TTS providers failed")

    def generate_audio(self, text: str, file_name_no_ext=None) -> str:
        return asyncio.run(self.async_generate_audio(text, file_name_no_ext))

    async def warm_up(self) -> None:
        """Open connections / load voices so the first live response is fast."""
        try:
            path = await self._edge("Hello.", "en", "warmup", False)
            self.remove_file(path, verbose=False)
        except Exception as e:
            logger.warning(f"TTS warm up skipped: {e}")
