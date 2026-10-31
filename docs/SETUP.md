# Setup

Tested on Windows 11 with Python 3.10 (uv), Node 24 and Chrome. These steps also work on macOS and Linux.

## 1. Prerequisites
- [uv](https://docs.astral.sh/uv/) (Python package manager), Node.js 20+, git, ffmpeg (used by the base project for audio conversion).

## 2. Get the code
```bash
git clone <repo> kinly && cd kinly
git submodule update --init      # upstream Open-LLM-VTuber web UI (optional, served at :12393/)
```

## 3. Configure
```bash
cp .env.example .env             # fill in keys you have; everything is optional locally
cp config_templates/conf.kinly.yaml conf.yaml
```
Without keys, Kinly still runs end to end. It uses the offline companion brain (no LLM), Edge TTS voices, the browser's speech recognition on the elder screen, plan activation without checkout, peer-to-peer video, and notifications written to the dashboard outbox.

## 4. Companion server (Python)
```bash
uv sync
uv run run_server.py             # http://localhost:12393  (health: /api/kinly/health)
```
The upstream default config (`conf.default.yaml`) downloads a ~1 GB SenseVoice model and expects a local Ollama. Kinly's `conf.kinly.yaml` avoids both.

## 5. Family app (Next.js)
```bash
cd family-app
npm install
npm run setup                    # creates data/kinly.db from the Prisma schema and seeds Kamala's family
npm run dev                      # http://localhost:3000
```
`family-app/.env` only needs `DATABASE_URL="file:../../data/kinly.db"` (created by setup). Everything else is read from the root `.env`.

## 6. Try it
- Family dashboard: http://localhost:3000/login, then **Explore the family (Kamala)**
- Elder screen: http://localhost:3000/screen/kamala-demo-screen (press **Talk to Kinly** once, so the browser allows audio)
- Demo controls: http://localhost:3000/demo

## 7. Tests
```bash
uv run pytest tests/kinly        # brain, safety, consent, phone endpoint, webhook
cd family-app && npm run typecheck
```

## 8. Public URL for phone calls
Bolna must reach the companion server over the internet:
```bash
cloudflared tunnel --url http://localhost:12393     # or: ngrok http 12393
```
Put the https URL in `PUBLIC_BASE_URL`, then follow [PHONE_MODE.md](PHONE_MODE.md).

## 9. Deploy
- Companion server: the base `dockerfile` works. Run `uv run run_server.py` on Railway, Render, Fly or a small VM, and mount `data/` as a volume.
- Family app: `npm run build && npm start` (or Vercel/Render). Point `KINLY_API_URL` at the companion server and share the same database (use Postgres in production: change `provider` in `schema.prisma`).
