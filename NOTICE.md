# Notice

Kinly includes software from the following projects.

## Open-LLM-VTuber

Kinly is built on **Open-LLM-VTuber v1.2.1** — https://github.com/Open-LLM-VTuber/Open-LLM-VTuber —
licensed under the MIT License. The original copyright and license text are kept unchanged in
[`LICENSE`](LICENSE). Changes made for Kinly are documented in [`IMPROVEMENTS.md`](IMPROVEMENTS.md).

The Live2D sample models in `live2d-models/` are governed by [`LICENSE-Live2D.md`](LICENSE-Live2D.md)
and are not used by the Kinly elder screen, which draws its own original companion character.

The upstream web frontend (`frontend/`, a git submodule of Open-LLM-VTuber-Web) is distributed by its
authors under its own license. Kinly references it but does not modify or redistribute it.

## Other components

Third-party packages are used under their own licenses (see `pyproject.toml` and
`family-app/package.json`), including FastAPI, Next.js, React, Prisma, Tailwind CSS, Recharts,
Phosphor Icons, LiveKit client libraries, Stripe SDKs and @ricky0123/vad-web (Silero VAD).
