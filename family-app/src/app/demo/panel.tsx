"use client";

import {
  ArrowCounterClockwise, Bell, Check, ChatCircleText, FilmStrip, Phone, PhoneX, Pill, ShieldWarning, VideoCamera, Warning, X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type DemoResult, phoneCall, reset, riyaCalls, sendRiyaMessage, simulate } from "./actions";

type Health = { ok: boolean; demoMode: boolean; providers: Record<string, boolean>; onlineScreens: string[] } | null;

const PROVIDER_LABEL: Record<string, string> = {
  llm: "LLM", deepgram: "Deepgram ASR", sarvam: "Sarvam ASR/TTS", cartesia: "Cartesia TTS", edgeTtsFallback: "Edge TTS fallback",
  bolna: "Bolna phone", whatsapp: "WhatsApp", email: "Email",
};

export function DemoPanel({ health, elder, clips, defaultPhone }: {
  health: Health; elder: { id: string; phone: string; online: boolean } | null; clips: Record<string, string | null>; defaultPhone: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<(DemoResult & { at: string })[]>([]);
  const [phone, setPhone] = useState(defaultPhone || elder?.phone || "");
  const [lang, setLang] = useState("en");
  const [clip, setClip] = useState<string | null>(null);

  const run = (key: string, fn: () => Promise<DemoResult>) => {
    setBusy(key);
    start(async () => {
      const r = await fn();
      setLog((l) => [{ ...r, at: new Date().toLocaleTimeString() }, ...l].slice(0, 8));
      if (r.link) window.open(r.link, "_blank");
      router.refresh();
    });
  };

  const Btn = ({ id, icon, title, body, onClick, tone = "default", clipKey }: {
    id: string; icon: React.ReactNode; title: string; body: string; onClick: () => void; tone?: "default" | "urgent" | "warn"; clipKey?: string;
  }) => (
    <div className="card flex flex-col p-5">
      <span className={clsx("flex h-11 w-11 items-center justify-center rounded-xl",
        tone === "urgent" ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" : tone === "warn" ? "bg-[var(--color-sun-soft)] text-[#8a5a07]" : "bg-[var(--color-evergreen-tint)] text-[var(--color-evergreen)]")}>{icon}</span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 flex-1 text-sm text-[var(--color-muted)]">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={onClick}>{pending && busy === id ? "Running…" : "Run"}</button>
        {clipKey && clips[clipKey] && <button className="btn btn-ghost btn-sm" onClick={() => setClip(clips[clipKey])}><FilmStrip size={16} aria-hidden="true" />Backup clip</button>}
      </div>
    </div>
  );

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className={clsx("chip", elder?.online ? "chip-ok" : "chip-concerning")}>{elder?.online ? "Kamala's screen is online" : "Kamala's screen is not open"}</span>
          <label className="flex items-center gap-2">Kamala speaks
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="input !min-h-9 !w-auto !py-1">
              <option value="en">English</option><option value="hi">Hindi</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Btn id="checkin" icon={<ChatCircleText size={22} />} title="Start screen check-in" body="Kinly greets Kamala on her screen and follows up on her knee." clipKey="checkin" onClick={() => run("checkin", () => simulate("checkin", lang))} />
          <div className="card flex flex-col p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-evergreen-tint)] text-[var(--color-evergreen)]"><Phone size={22} /></span>
            <p className="mt-3 font-semibold">Phone check-in call</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">A real Bolna call to this number.</p>
            <label htmlFor="demo-phone" className="sr-only">Phone number</label>
            <input id="demo-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" className="input mt-3" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" disabled={pending || !phone} onClick={() => run("phone", () => phoneCall(phone))}>{pending && busy === "phone" ? "Calling…" : "Call"}</button>
              {clips.phone && <button className="btn btn-ghost btn-sm" onClick={() => setClip(clips.phone)}><FilmStrip size={16} aria-hidden="true" />Backup clip</button>}
            </div>
          </div>
          <Btn id="fall" tone="urgent" icon={<Bell size={22} weight="fill" />} title="Simulate fall mention" body="“I fell in the bathroom.” Kinly responds safely; the family gets an urgent alert." clipKey="fall" onClick={() => run("fall", () => simulate("fall", lang))} />
          <Btn id="scam" tone="urgent" icon={<ShieldWarning size={22} weight="fill" />} title="Simulate scam call mention" body="Someone asked for an OTP. Scam Shield warns Kamala and tells the family." clipKey="scam" onClick={() => run("scam", () => simulate("scam", lang))} />
          <Btn id="med" tone="warn" icon={<Pill size={22} />} title="Simulate missed medicine" body="Two missed doses in a row: reminder on screen and escalation to family." clipKey="missed_medicine" onClick={() => run("med", () => simulate("missed_medicine"))} />
          <Btn id="video" icon={<VideoCamera size={22} />} title="Riya starts a video call" body="Kamala's screen rings with a big Answer button. Opens Riya's side in a new tab." clipKey="video" onClick={() => run("video", riyaCalls)} />
          <Btn id="msg" icon={<ChatCircleText size={22} />} title="Riya's voice message" body="Mark Riya's message as new so Kinly offers to play it." onClick={() => run("msg", sendRiyaMessage)} />
          <Btn id="missedcall" tone="warn" icon={<PhoneX size={22} />} title="Simulate missed call" body="“Kamala didn't pick up the 10 am call”, after retries." onClick={() => run("missedcall", () => simulate("missed_call"))} />
          <Btn id="reset" icon={<ArrowCounterClockwise size={22} />} title="Reset demo" body="Restore Kamala's 14 days of history and clear today's alerts." onClick={() => { if (confirm("Reset the demo family?")) run("reset", reset); }} />
        </div>
      </div>

      <aside className="space-y-5">
        <section className="card p-5" aria-labelledby="health-h">
          <h2 id="health-h" className="font-semibold">Providers</h2>
          {!health ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-[var(--color-danger)]"><Warning size={18} className="shrink-0" aria-hidden="true" />The companion server is not reachable. Start it with <code>uv run run_server.py</code>.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {Object.entries(health.providers).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between">
                  <span>{PROVIDER_LABEL[k] ?? k}</span>
                  {v ? <span className="flex items-center gap-1 text-[var(--color-evergreen)]"><Check size={15} weight="bold" aria-hidden="true" />live</span> : <span className="text-[var(--color-muted)]">{k === "llm" ? "offline brain" : "not set"}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5" aria-labelledby="log-h">
          <h2 id="log-h" className="font-semibold">What just happened</h2>
          {log.length === 0 && <p className="mt-2 text-sm text-[var(--color-muted)]">Run a step to see results here.</p>}
          <ul className="mt-3 space-y-3" aria-live="polite">
            {log.map((l, i) => (
              <li key={i} className="text-sm">
                <p className={clsx("font-semibold", !l.ok && "text-[var(--color-danger)]")}>{l.title} <span className="font-normal text-[var(--color-muted)]">· {l.at}</span></p>
                {l.detail && <p className="text-[var(--color-ink-soft)]">{l.detail}</p>}
                {l.link && <a className="text-[var(--color-evergreen)] underline" href={l.link} target="_blank" rel="noreferrer">Open</a>}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {clip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" role="dialog" aria-modal="true" aria-label="Backup clip">
          <button className="btn absolute right-5 top-5 bg-white" onClick={() => setClip(null)} aria-label="Close"><X size={20} /></button>
          {clip.endsWith(".mp3") ? <audio src={clip} controls autoPlay /> : <video src={clip} controls autoPlay className="max-h-full max-w-full rounded-2xl" />}
        </div>
      )}
    </div>
  );
}
