# Kinly

**A voice companion that calls your parents every morning in their own language, remembers their stories, reminds them about medicines, and tells the family the moment something needs them.**

Built for the Bolna Symphony Buildathon, answering Y Combinator's Request for Startups:
[**AI for the Aging Population**](https://www.ycombinator.com/rfs). That request asks for voice interfaces that hold real conversations, monitoring that keeps older adults safe and independent, and software that helps family caregivers coordinate. Kinly does all three. It launches first in India and the US.

> *A 14k-star AI companion built for gaming and streaming fans, rebuilt for the people who need companionship most.*

---

## The problem

Millions of older adults live alone while their children live in other cities or countries. The days are long and quiet. Medicines get missed, and falls go unreported. Phone scams target exactly these people. Families worry, and their calls are rushed and irregular. Existing tools ask older adults to learn apps. Kinly asks nothing of them. **It just calls, in their language.**

## How it works

```mermaid
flowchart LR
  subgraph Elder
    P[Their own phone]:::new
    S[Tablet / TV screen]:::new
  end
  subgraph Kinly companion server  (Open-LLM-VTuber, extended)
    WS[WebSocket voice loop<br/>VAD · ASR · TTS · lip sync]
    LR[LanguageRouter<br/>Deepgram · Sarvam · Cartesia]:::new
    B[Kinly brain<br/>persona · memory · safety · consent]:::new
    API[/v1/chat/completions<br/>+ Bolna webhook/]:::new
    SCH[Scheduler<br/>calls · reminders · summaries]:::new
  end
  BOL[Bolna phone agent]:::new
  DB[(Shared DB<br/>Prisma schema)]:::new
  FA[Family app<br/>Next.js]:::new
  N[WhatsApp · Email]:::new

  P <--> BOL -->|custom LLM| API --> B
  BOL -->|post-call webhook| API
  S <--> WS --> LR
  WS --> B
  B --> DB
  SCH --> BOL
  B -->|alerts, summaries| N
  FA <--> DB
  FA -->|calls, demo, push| API
  classDef new fill:#e2eee8,stroke:#1d5547,color:#133d33;
```

Green boxes are new. The voice loop (mic → VAD → ASR → agent → sentence-by-sentence TTS → lip sync) is Open-LLM-VTuber's, and it's still at the core.

## Built on Open-LLM-VTuber: what existed vs what we added

| Open-LLM-VTuber v1.2.1 (MIT) | Kinly |
|---|---|
| Hands-free voice chat, interruption, sentence-streamed TTS, Live2D lip sync | Kept, and extended to real phone calls through **Bolna** with the same brain |
| ASR/TTS factories (Whisper, Edge, Cartesia…) | **Deepgram, Sarvam ASR/TTS** + a per-turn **LanguageRouter** with retries and fallbacks |
| A generic chat agent with short-term memory | **Kinly brain**: elder persona, long-term memory, daily check-in flow, reminders, consent, privacy |
| — | **Safety classifier** (falls, chest pain, breathing, confusion, self-harm), **Scam Shield**, instant family alerts |
| Anime avatar and streaming UI | An original, calm companion and an **elder screen** with huge buttons, in their language |
| — | **Family app**: summaries, trends, "Talk about this", alerts, care plan, voice messages, Memory Book, video calls, plans and billing |
| — | **Family Avatar** with a strict consent gate (Premium) |

Every change is listed in [IMPROVEMENTS.md](IMPROVEMENTS.md), and the git history follows the same order.

## Features

- **Daily check-in calls** to their own phone at the time you choose, in their time zone. Retries if they don't answer, then tells you ("Mom didn't pick up her 10am call"). They can call Kinly anytime.
- **Their language, every turn.** English, Hindi, Spanish, Tamil, Telugu, Bengali, Marathi and more. Kinly switches when they switch.
- **Long-term memory.** Family names, life stories, routines, likes, health notes, brought up naturally: *"How is your knee today? You said it was hurting yesterday."* They can say "forget that".
- **Medicine and appointment reminders** with a simple confirmation, plus escalation after repeated misses.
- **Safety alerts.** Urgent signals get an immediate, fixed safe response ("please call 112 now") and an alert to every family member. Concerning trends, like several low days, are flagged gently. Kinly never diagnoses.
- **Scam Shield.** It warns on the spot about OTPs, money requests, gift cards and "digital arrest" calls, and alerts the family.
- **Video calls.** One big "Call family" button, or just say "Call Riya". Family can ring the screen too.
- **Voice messages.** Family records, Kinly plays it ("Riya sent you a message!"), and the elder can reply.
- **Memory Book.** Their stories, written as chapters the family can keep and print.
- **Family dashboard.** Daily summary, mood and medicine trends, alerts timeline, "Talk about this" suggestions, care plan, roles, billing.

## Safety, consent and dignity

1. **Always honest.** Kinly says it is an AI, and a visible "AI" badge is always on screen.
2. **Consent first.** The first conversation explains Kinly and asks. Their answer is recorded, and nothing regular happens before a yes.
3. **Their privacy.** "Keep this between us" removes those words from every family view. Safety is always shared, and they are told so.
4. **No money talk, ever.** A hard output filter blocks any request for money, OTPs, passwords or bank details. This applies to every voice, including the Family Avatar.
5. **Family Avatar** (Premium) is created only by the adult being represented, with a recorded spoken consent. The plan owner confirms it suits the elder, and the elder is told. It is off by default, always introduces itself as an AI voice, can be deleted in one click, and every step is audit-logged.

## Plans

| | Free trial | Care | Family | Premium |
|---|---|---|---|---|
| Price | 7 days | $19 / ₹999 | $39 / ₹1,999 | $69 / ₹3,499 |
| Daily check-in call, reminders, daily summary | ✓ | ✓ | ✓ | ✓ |
| Inbound calls, safety alerts | ✓ | ✓ | ✓ | ✓ |
| Screen companion, video calls, voice messages, Memory Book, Scam Shield | ✓ | | ✓ | ✓ |
| Family members | 2 | 2 | 6 | 6 |
| Up to 3 calls a day, priority alerts, Family Avatar | | | | ✓ |

Prices and currency are configurable (`PRICE_*`, `PLAN_CURRENCY`). Payments run through Stripe Checkout behind a billing interface that is ready for Razorpay.

## Tech stack

- **Phone:** [Bolna](https://www.bolna.ai) agent with Kinly as a custom LLM (`/v1/chat/completions`) and a post-call webhook
- **Speech:** [Deepgram](https://deepgram.com) Nova-3 and [Sarvam AI](https://www.sarvam.ai) Saaras (speech to text); [Cartesia](https://cartesia.ai) Sonic and Sarvam Bulbul (text to speech); Edge TTS as fallback
- **LLM:** any OpenAI-compatible endpoint (`LLM_BASE_URL`, `LLM_MODEL`)
- **Companion server:** Python, FastAPI, Open-LLM-VTuber
- **Family app and elder screen:** Next.js 15, TypeScript, Tailwind CSS 4, Prisma (SQLite, Postgres-ready), Recharts, Phosphor icons
- **Video:** LiveKit, with a peer-to-peer WebRTC fallback
- **Payments:** Stripe. **Notifications:** WhatsApp (Meta Cloud API or Twilio), email (Resend)

## Setup (under 10 steps)

Requires Python 3.10+ with [uv](https://docs.astral.sh/uv/), Node 20+, and git.

```bash
git clone <this repo> kinly && cd kinly && git submodule update --init   # 1. code
cp .env.example .env                                                     # 2. config (keys optional for a local run)
uv sync                                                                  # 3. Python deps
cp config_templates/conf.kinly.yaml conf.yaml                            # 4. companion config
cd family-app && npm install && npm run setup && cd ..                   # 5. app deps, database, seeded family
uv run run_server.py                                                     # 6. companion server  → :12393
cd family-app && npm run dev                                             # 7. family app        → :3000
```

8. Open http://localhost:3000, choose **Log in**, then **Explore the family (Kamala)** (arjun@kinly.demo / kinly-demo).
9. Open Kamala's screen at http://localhost:3000/screen/kamala-demo-screen and the controls at http://localhost:3000/demo.

For phone calls, follow [docs/PHONE_MODE.md](docs/PHONE_MODE.md). More detail: [docs/SETUP.md](docs/SETUP.md). The demo script is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Results so far

The metrics page (`/admin/metrics`) reports calls placed, answer rate, conversations, average call length, languages used, alerts fired, medicine adherence, and time to first audio for the screen and phone.

## Roadmap

- Full animated Family Avatar likeness (v1 is a consented voice clone plus a photo in an AI frame)
- Razorpay and UPI autopay for India; Postgres and multi-region hosting
- Wearable fall detection and pharmacy refill integrations
- Clinician-reviewed wellbeing models and care-team sharing (with consent)

## Repository map

```
src/open_llm_vtuber/   upstream server (small, documented hooks)
src/kinly/             Kinly brain, LanguageRouter, phone mode, API, scheduler
family-app/            Next.js family app + elder screen + Prisma schema
scripts/               setup_bolna_agent.py
docs/                  setup, architecture, phone mode, avatar, demo script
tests/kinly/           backend tests (uv run pytest tests/kinly)
```

---

### Credit

Kinly is built on **[Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)** (v1.2.1, MIT License). Many thanks to its authors and community. The original license is in [LICENSE](LICENSE), third-party notices are in [NOTICE.md](NOTICE.md), and the original README is in [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md).
