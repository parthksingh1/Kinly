# How one voice turn flows (Open-LLM-VTuber, as used by Kinly)

```mermaid
sequenceDiagram
  participant Mic as Browser mic + VAD
  participant WS as websocket_handler.py
  participant CH as conversation_handler.py
  participant SC as single_conversation.py
  participant ASR as ASR engine (LanguageRouter)
  participant AG as Agent (KinlyAgent → brain)
  participant TTS as TTSTaskManager + TTS engine
  participant UI as Screen (lip sync)

  Mic->>WS: mic-audio-data (float32, 16 kHz) … mic-audio-end
  WS->>CH: handle_conversation_trigger (+ client_uid, elder_id)
  CH->>SC: asyncio task process_single_conversation
  SC->>ASR: async_transcribe_np(audio)
  ASR-->>SC: text (+ detected language)
  SC->>UI: user-input-transcription
  SC->>AG: chat(BatchInput)
  loop each sentence (sentence_divider, faster first response)
    AG-->>SC: SentenceOutput(display, tts_text, actions/expressions)
    SC->>TTS: speak() — parallel synthesis, ordered delivery
    TTS->>UI: audio {wav base64, volumes[20 ms], display_text, actions}
  end
  SC->>UI: backend-synth-complete
  UI->>WS: frontend-playback-complete
  SC->>UI: conversation-chain-end
```

**Key points in the base code**

- `ServiceContext` holds the engines (ASR, TTS, VAD, agent, Live2D). Each connection gets a copy that shares the default engines.
- `TTSTaskManager` synthesises sentences in parallel but sends them strictly in order (sequence numbers). This keeps time-to-first-audio low.
- `prepare_audio_payload` computes the RMS volume per 20 ms slice. The frontend maps it to mouth openness (lip sync).
- Interruption: the client sends `interrupt-signal` with the text heard so far. The conversation task is cancelled, and the agent is told what was actually heard.
- Expressions: the agent's sentence pipeline (`actions_extractor`) turns `[emotion]` keywords into Live2D expression indices.

**Where Kinly hooks in:** `kinly-hello` pairs a screen with an elder (`hub.py`). `KinlyAgent` replaces the chat agent while reusing the base sentence divider. `kinly_router_asr`/`kinly_router_tts` are ordinary factory engines. `turn_context` stamps time-to-first-audio when `TTSTaskManager` sends the first audio payload.
