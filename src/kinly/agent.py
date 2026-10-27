"""KinlyAgent: plugs the shared Kinly brain into Open-LLM-VTuber's agent pipeline.

It implements the base project's AgentInterface and reuses its sentence divider, so TTS
still streams sentence by sentence with ordered delivery and lip sync. Expression tags
like [happy] become Live2D/avatar expressions through the base `Actions` object.
"""

from __future__ import annotations

import re
import time
from typing import Any, AsyncIterator, Dict, Union

from loguru import logger

from ..open_llm_vtuber.agent.agents.agent_interface import AgentInterface
from ..open_llm_vtuber.agent.input_types import BatchInput
from ..open_llm_vtuber.agent.output_types import Actions, DisplayText, SentenceOutput
from ..open_llm_vtuber.agent.transformers import sentence_divider
from ..open_llm_vtuber.utils.sentence_divider import SentenceWithTags
from ..open_llm_vtuber.utils.tts_preprocessor import tts_filter as filter_text
from . import repo
from .brain.brain import EVENT_PREFIX, brain
from .brain.session import sessions
from .turn_context import turn_context

_TAG = re.compile(r"\[(happy|laughing|concerned|listening|surprised|neutral)\]\s*", re.I)

# Kinly expression name -> emotion keyword understood by the base Live2D emotion map
LIVE2D_EMOTION = {"happy": "joy", "laughing": "joy", "concerned": "sadness", "surprised": "surprise", "listening": "neutral", "neutral": "neutral"}


class KinlyAgent(AgentInterface):
    def __init__(self, live2d_model=None, faster_first_response: bool = True, segment_method: str = "regex"):
        self._live2d_model = live2d_model
        self._faster_first_response = faster_first_response
        self._segment_method = segment_method
        logger.info("KinlyAgent ready (shared Kinly brain)")

    def _session_for(self, input_data: BatchInput):
        meta = input_data.metadata or {}
        client_uid = meta.get("client_uid") or "screen"
        elder_id = meta.get("elder_id")
        session = sessions.get(client_uid)
        if session and not session.ended:
            return session
        elder = repo.get_elder(elder_id) if elder_id else None
        if elder is None:
            elders = repo.list_elders()
            demo = [e for e in elders if e.get("isDemo")]
            elder = (demo or elders or [None])[0]
        if elder is None:
            raise RuntimeError("No elder profile exists yet. Create one in the family app first.")
        return sessions.start(client_uid, elder, "screen")

    def _expression(self, name: str) -> list:
        """Return the expression for this sentence in the form the active renderer expects."""
        expressions: list = [name]
        if self._live2d_model is not None:
            idx = self._live2d_model.emo_map.get(LIVE2D_EMOTION.get(name, "neutral"))
            if idx is not None:
                expressions.append(idx)
        return expressions

    async def chat(self, input_data: BatchInput) -> AsyncIterator[Union[SentenceOutput, Dict[str, Any]]]:
        session = self._session_for(input_data)
        text = " ".join(t.content for t in input_data.texts) if input_data.texts else ""
        turn_context.mark_llm_start()

        @sentence_divider(
            faster_first_response=self._faster_first_response,
            segment_method=self._segment_method,
            valid_tags=[],
        )
        async def token_stream(_: BatchInput) -> AsyncIterator[Union[str, Dict[str, Any]]]:
            async for chunk in brain.respond(session, text):
                yield chunk

        current_expr = "listening" if not text.startswith(EVENT_PREFIX) else "happy"
        async for item in token_stream(input_data):
            if isinstance(item, dict):
                yield item
                continue
            if not isinstance(item, SentenceWithTags):
                continue
            sentence = item.text
            m = _TAG.search(sentence)
            if m:
                current_expr = m.group(1).lower()
                sentence = _TAG.sub("", sentence)
            if not sentence.strip():
                continue
            tts = filter_text(text=sentence, remove_special_char=True, ignore_brackets=True,
                              ignore_parentheses=True, ignore_asterisks=True, ignore_angle_brackets=True)
            yield SentenceOutput(
                display_text=DisplayText(text=sentence),
                tts_text=tts,
                actions=Actions(expressions=self._expression(current_expr)),
            )

    def handle_interrupt(self, heard_response: str) -> None:
        logger.info(f"Kinly interrupted after: {heard_response[:60]!r}")
        turn_context.reset()

    def set_memory_from_history(self, conf_uid: str, history_uid: str) -> None:
        # Kinly keeps memory in its own database; the base chat history is not used.
        pass


async def end_screen_session(client_uid: str) -> None:
    session = sessions.get(client_uid)
    if session and not session.ended:
        started = time.time()
        await brain.finalize(session)
        logger.info(f"Screen conversation finalized in {time.time() - started:.1f}s")
