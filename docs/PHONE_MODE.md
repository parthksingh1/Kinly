# Phone mode with Bolna

Kinly runs phone calls on [Bolna](https://www.bolna.ai). Bolna handles telephony, streaming speech to text and the voice. Kinly is plugged in as the agent's **custom LLM**, so the phone uses the same brain, memory and safety rules as the screen.

## 1. Expose the companion server
```bash
uv run run_server.py
cloudflared tunnel --url http://localhost:12393      # copy the https URL
```
Set `PUBLIC_BASE_URL=https://<your-tunnel>` in `.env` and restart the server. Test it:
```bash
curl -N "$PUBLIC_BASE_URL/v1/chat/completions" -H "Authorization: Bearer $KINLY_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"model":"kinly-companion","stream":true,"messages":[{"role":"user","content":"Hello"}]}'
```

## 2. Create the agent
```bash
uv run scripts/setup_bolna_agent.py --language hi     # or en, es …
```
This registers `PUBLIC_BASE_URL/v1` as a custom model (key = `KINLY_API_TOKEN`) and creates the v2 agent with:
Sarvam Saaras (Indian languages) or Deepgram Nova-3, a Sarvam/Cartesia voice at 0.9 speed, a longer endpointing pause, `hangup_after_silence: 20`, and the webhook `PUBLIC_BASE_URL/webhooks/bolna?token=…`.
Copy the printed `BOLNA_AGENT_ID` into `.env`.

If the script reports that a voice id is not available on your account:
`uv run scripts/setup_bolna_agent.py --print > agent.json`, pick a voice in the dashboard, and paste it there.

## 3. Dashboard steps (click by click)
1. **Settings → Integrations → LLM → Custom LLM → Add model** (only needed if step 2 could not register it): Provider *Other (OpenAI-compatible)*, Model name `kinly-companion`, Endpoint URL `https://<tunnel>/v1`, API key = `KINLY_API_TOKEN`, Family `openai`.
2. Open the **Kinly companion** agent → **Agent tab**: check that the prompt contains the `KINLY_CONTEXT …` line (do not remove it).
3. **Intelligence tab**: the provider is `custom`, the model is `kinly-companion`.
4. **Extractions tab**: confirm the Webhook URL. Leave *Trigger on statuses* empty.
5. **Phone numbers → Buy / connect a number → Link to agent**. This enables **inbound calls**: an elder calling this number is recognised by their phone number.
6. **Call tab**: optional calling hours. Kinly's scheduler already respects each elder's time zone.

## 4. Calls
- Scheduled: each elder's call times are in the family app's Care plan. The scheduler places the call through `POST https://api.bolna.ai/call` with `user_data.elder_id`. If there is no answer, it retries twice, 10 minutes apart, and then alerts the family.
- On demand: the dashboard button **Call Kamala now**, or `/demo` → **Phone check-in call**.
- After the call, Bolna posts the execution. Kinly stores the transcript, extracts memories, runs the safety pass, writes the summary and daily summary, and notifies the family. The dashboard updates when the `completed`/`call-disconnected` webhook arrives (usually under a minute).
