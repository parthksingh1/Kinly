# Improvements over Open-LLM-VTuber

Kinly is built on [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) **v1.2.1**
(MIT license, see `LICENSE` and `NOTICE.md`). This file records what the base project already did,
what we changed, what we added, and why. The git history follows the same order: the first commit
is the unmodified upstream import, and each later commit is one focused change.

## Base project: what Open-LLM-VTuber already did

| Area | What existed |
|---|---|
| Server | FastAPI + WebSocket server (`server.py`, `routes.py`, `websocket_handler.py`); per-connection `ServiceContext` dependency container |
| Voice loop | Hands-free voice chat with voice interruption: mic audio → (optional VAD) → ASR → agent → sentence-by-sentence TTS → ordered audio payloads with a per-20 ms volume envelope for lip sync |
| Engines | Factory pattern for ASR (Whisper variants, Sherpa-ONNX, FunASR, Azure, Groq), TTS (Edge, Azure, Cartesia, ElevenLabs, MeloTTS, CosyVoice, GPT-SoVITS…), VAD (Silero), LLMs (OpenAI-compatible, Claude, Ollama, llama.cpp) |
| Agent | `BasicMemoryAgent` with streaming, sentence segmentation, expression keywords, MCP tool calling |
| Avatar | Live2D models with expressions mapped from `[emotion]` keywords, lip sync from the volume envelope |
| Config | Typed pydantic config (`config_manager/`), YAML templates, upgrade system |
| Frontend | Prebuilt web/desktop client (separate repository, its own license) aimed at streamers and anime fans |

## What we kept, and why

- **The voice pipeline and its protocol.** Sentence-level TTS streaming with ordered delivery and the
  volume-envelope lip sync are exactly what a fast, natural companion needs. Kinly's new screen speaks
  the same WebSocket protocol.
- **The engine factories.** New speech providers were added the way the project already adds them
  (provider file + factory branch + typed config class), so they are swappable from `conf.yaml`.
- **The upstream frontend**, untouched, as a git submodule pinned to the v1.2.1 build (it has its own license).

## What we changed in the base (small, targeted hooks)

| File | Change | Why |
|---|---|---|
| `asr/asr_factory.py`, `config_manager/asr.py` | `deepgram_asr`, `sarvam_asr`, `kinly_router_asr` | Global + Indian language speech-to-text |
| `tts/tts_factory.py`, `config_manager/tts.py` | `sarvam_tts`, `kinly_router_tts` | Indian language voices; per-turn voice choice |
| `agent/agent_factory.py`, `config_manager/agent.py` | `kinly_agent` | Plug the Kinly brain into the existing agent pipeline |
| `conversations/conversation_handler.py` | Attach `client_uid` and `elder_id` to each turn's metadata | The agent needs to know which elder it is talking to |
| `conversations/single_conversation.py` | Forward `kinly-*` action dicts to the screen; start the latency timer | "Call Riya" and "play my messages" become UI actions |
| `conversations/tts_manager.py` | Stamp time-to-first-audio when the first audio payload is sent | Measure and keep latency low |
| `websocket_handler.py` | `kinly-hello` (pair screen ↔ elder) and `kinly-end-session`; finalize on disconnect | Sessions belong to a real person, and every conversation is summarised |
| `server.py` | Mount Kinly routes; warm up providers and start the scheduler on startup | Phone mode, family app API, fast first response |

Everything else lives in new code: `src/kinly/` (Python) and `family-app/` (Next.js).

## What we added

### Voice in many languages (Phase 1)
- `deepgram_asr.py`: Deepgram Nova-3 pre-recorded API with language detection (restricted to the elder's languages).
- `sarvam_asr.py` / `sarvam_tts.py`: Sarvam Saaras v4 (auto-detects 11 Indian languages) and Bulbul v3.
- `src/kinly/language_router.py`: **LanguageRouter**. ASR: Sarvam first for elders who speak Indian languages, Deepgram first otherwise, each the other's fallback. TTS: detects the reply language per sentence; Sarvam for Indian languages, Cartesia Sonic for global languages, a consented cloned voice when a Family Avatar is on, and Edge TTS as a keyless fallback. Short timeouts, one retry, and a spoken "Sorry, could you say that again?" if everything fails.
- Slower default speaking rate (0.9) and a longer, configurable end-of-speech pause (1.3 s) for older adults.
- Time to first audio is logged per turn and stored (`turn_metrics`).

### The companion brain (Phase 2): `src/kinly/brain/`
- One brain for every transport (screen, phone, demo): `brain.respond(session, text)`.
- **Persona** built per elder: profile, family, retrieved memories, today's medicines, check-in stage, language.
- **Long-term memory**: structured facts (family, life stories, routines, likes, health) extracted after each conversation (LLM JSON, with a pattern-based fallback); retrieved by relevance every turn; "forget that" removes a fact.
- **Daily check-in flow**: greeting → feeling → sleep → food → medicines → plans → a favourite story → warm wrap-up, guided but never form-like.
- **Safety classifier**: deterministic, multilingual (English, Hindi in Devanagari and romanised, Spanish) rules for urgent (fall, chest pain, breathing, confusion/stroke signs, self-harm, injury), concerning (low mood, loneliness, not eating, pain, sleep) and scam signals, with negation handling. Urgent and scam replies are fixed, reviewed templates, never LLM text. Alerts fire immediately. Low mood across several days raises a trend alert.
- **Scam Shield**: warnings on OTP/money/gift-card/"digital arrest" patterns plus a periodic gentle reminder.
- **Privacy**: "keep this between us" hides those turns from summaries, transcripts and the Memory Book; safety is always shared.
- **Consent**: the first conversation explains Kinly in plain language and asks; the answer and transcript are recorded; no regular check-ins before a yes.
- **Hard output filter**: no sentence asking for money, OTPs, passwords, PINs, bank details or documents is ever spoken.
- **Offline brain**: if no LLM key is set, or the LLM times out mid-demo, a rule-based companion still greets by name, follows up on remembered facts and runs the check-in in English, Hindi and Spanish.
- **Expressions**: `[happy] [concerned] [listening] [laughing] [surprised]` map to the new avatar and to the base Live2D emotion map.

### Phone mode (Phase 4): `src/kinly/phone/`, `src/kinly/api.py`
- `POST /v1/chat/completions`: OpenAI-compatible streaming endpoint (Bearer `KINLY_API_TOKEN`) that Bolna uses as a custom LLM. Bolna only sends a Bearer header, so the agent prompt carries a `KINLY_CONTEXT` line with Bolna variables (`{elder_id}`, `{from_number}`, `{execution_id}`…) from which the elder is identified (caller-number lookup for inbound calls).
- `POST /webhooks/bolna`: stores the transcript, runs memory, safety, summaries; idempotent.
- Scheduler: check-in calls in each elder's time zone, retries, then "Mom didn't pick up her 10am call"; medicine reminders and escalation; evening daily summary.
- `scripts/setup_bolna_agent.py`: registers the custom model and creates/updates the agent (v2 API).

### Family app (Phase 3, 5, 6, 8, 9): `family-app/` (Next.js 15, TypeScript, Tailwind 4, Prisma)
- Sign up / log in, onboarding (elder, medicines, call time, family, plan), dashboard (summary, mood and adherence charts, alerts timeline, "Talk about this", upcoming), conversations with privacy-aware transcripts, care plan, family members and invites with roles, settings and consent record.
- Plans with feature flags, USD/INR pricing, Stripe Checkout (test mode) + webhook, a billing interface ready for Razorpay, and a clearly-labelled demo billing mode without keys.
- Voice messages (record in browser → played on the elder screen → reply), Memory Book (chapters, hide, print to PDF), Family Avatar with the full consent gate and audit log.
- Video calls: LiveKit when configured; keyless 1:1 WebRTC fallback with signalling through the app.
- Elder screen (`/screen/<token>`): a new, original, non-anime companion character, huge buttons (Talk, Call family, Messages, My medicines), UI in the elder's language, ringing calls with a giant Answer button, medicine reminder cards, a permanent "AI" disclosure, hands-free voice with barge-in, browser speech recognition fallback.
- Demo mode: seeded 14-day history for Kamala, `/demo` control panel, provider health, backup clips.
- Metrics page that excludes demo data by default.

### Shared data
- One database schema owned by Prisma (`family-app/prisma/schema.prisma`, SQLite now, Postgres-ready). `src/kinly/schema.sql` is generated from it so the Python side can bootstrap a database without drift. Verified: Prisma stores `DateTime` as integer milliseconds in SQLite, and Python writes the same.

### Tests
- `tests/kinly/`: safety (multilingual, negation), intents, output filter, language detection, a full brain flow on a temporary database (memory follow-up across sessions, urgent alert, privacy, call action), consent, Scam Shield, the OpenAI-compatible endpoint (streaming, auth, caller lookup) and the Bolna webhook (idempotent).
