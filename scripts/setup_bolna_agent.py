"""Create or update the Kinly phone agent on Bolna.

Usage:
    uv run scripts/setup_bolna_agent.py --language hi            # create (prints BOLNA_AGENT_ID)
    uv run scripts/setup_bolna_agent.py --language en --update    # update the agent in BOLNA_AGENT_ID
    uv run scripts/setup_bolna_agent.py --print                   # only print the JSON body

The agent uses Kinly's companion server as a custom LLM (PUBLIC_BASE_URL/v1/chat/completions),
so the phone and the screen share the same brain, memory and safety rules.
Docs: https://www.bolna.ai/docs/api-reference/agent/v2/create
      https://www.bolna.ai/docs/custom-llm-inference
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.kinly.phone.bolna import API, agent_config  # noqa: E402
from src.kinly.settings import settings  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--language", default="hi", help="Starting language for transcriber/voice (hi, en, es, ...)")
    p.add_argument("--update", action="store_true", help="PUT to the agent in BOLNA_AGENT_ID instead of creating one")
    p.add_argument("--print", action="store_true", help="Print the request body and exit")
    args = p.parse_args()

    body = agent_config(language=args.language)
    if args.print:
        print(json.dumps(body, indent=2, ensure_ascii=False))
        return 0
    if not settings.bolna_api_key:
        print("BOLNA_API_KEY is not set in .env", file=sys.stderr)
        return 1
    if settings.public_base_url.startswith("http://localhost"):
        print("PUBLIC_BASE_URL must be a public https URL (cloudflared/ngrok or your deployment). Bolna refuses private hosts.", file=sys.stderr)
        return 1

    headers = {"Authorization": f"Bearer {settings.bolna_api_key}", "Content-Type": "application/json"}
    with httpx.Client(timeout=30) as client:
        # 1. Register (or refresh) our endpoint as a custom model. Bolna verifies it.
        r = client.post(f"{API}/user/model/custom", headers=headers, json={
            "custom_model_name": "kinly-companion",
            "custom_model_url": f"{settings.public_base_url}/v1",
            "custom_model_key": settings.api_token,
            "custom_model_family": "openai",
        })
        if r.status_code >= 300 and "unique" not in r.text.lower() and "exists" not in r.text.lower():
            print(f"Registering the custom model returned {r.status_code}: {r.text[:300]}\n"
                  "You can also add it in the dashboard: Settings > Integrations > LLM > Custom LLM.")
        # 2. Create or update the agent.
        if args.update:
            if not settings.bolna_agent_id:
                print("BOLNA_AGENT_ID is not set", file=sys.stderr)
                return 1
            r = client.put(f"{API}/v2/agent/{settings.bolna_agent_id}", headers=headers, json=body)
        else:
            r = client.post(f"{API}/v2/agent", headers=headers, json=body)
    if r.status_code >= 300:
        print(f"Bolna returned {r.status_code}: {r.text}", file=sys.stderr)
        print("Tip: voice ids differ per account. List voices with GET /me/voices and pass a valid one.", file=sys.stderr)
        return 1
    data = r.json()
    agent_id = data.get("agent_id") or settings.bolna_agent_id
    print(json.dumps(data, indent=2))
    print(f"\nAdd to .env:\nBOLNA_AGENT_ID={agent_id}")
    print("Then link an inbound number to this agent in the Bolna dashboard (see docs/PHONE_MODE.md).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
