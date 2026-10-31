"use client";

import { ArrowLeft, Check, Envelope, Microphone, PhoneCall, PhoneSlash, Pill, Play, Stop, VideoCamera } from "@phosphor-icons/react";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { CompanionFace } from "@/components/companion-face";
import { Recorder } from "@/components/recorder";
import { VideoCall } from "@/components/video-call";
import type { ScreenState } from "@/lib/screen-state";
import { useKinlyVoice, type VoiceStatus } from "@/lib/use-kinly-voice";

// ------------------------------------------------------------------ words in the elder's language
const WORDS = {
  en: { talk: "Talk to Kinly", done: "Done talking", call: "Call family", messages: "Messages", meds: "My medicines", back: "Back",
    listening: "I'm listening…", hearing: "Listening to you…", thinking: "Thinking…", speaking: "Kinly is speaking", ready: "Tap “Talk to Kinly” to start", connecting: "Connecting…", offline: "Reconnecting…",
    calling: "is calling you", answer: "Answer", notNow: "Not now", tookIt: "I took it", taken: "Taken", later: "Remind me later", timeFor: "Time for your", newMsg: "sent you a message!",
    reply: "Record a reply", stopRec: "Stop", send: "Send", discard: "Delete", noMsgs: "No messages yet.", ai: "Kinly is an AI companion", play: "Play", whoCall: "Who would you like to see?" },
  hi: { talk: "Kinly से बात करें", done: "बात खत्म", call: "परिवार को कॉल", messages: "संदेश", meds: "मेरी दवाइयाँ", back: "वापस",
    listening: "मैं सुन रही हूँ…", hearing: "आपको सुन रही हूँ…", thinking: "सोच रही हूँ…", speaking: "Kinly बोल रही है", ready: "शुरू करने के लिए “Kinly से बात करें” दबाइए", connecting: "जुड़ रहा है…", offline: "फिर से जुड़ रहा है…",
    calling: "आपको कॉल कर रहे हैं", answer: "उठाइए", notNow: "अभी नहीं", tookIt: "मैंने ले ली", taken: "ले ली", later: "बाद में याद दिलाना", timeFor: "दवाई का समय:", newMsg: "ने आपको संदेश भेजा है!",
    reply: "जवाब रिकॉर्ड करें", stopRec: "रोकें", send: "भेजें", discard: "हटाएँ", noMsgs: "अभी कोई संदेश नहीं।", ai: "Kinly एक AI साथी है", play: "सुनें", whoCall: "आप किसे देखना चाहेंगी?" },
  es: { talk: "Hablar con Kinly", done: "Terminar", call: "Llamar a la familia", messages: "Mensajes", meds: "Mis medicinas", back: "Volver",
    listening: "Le escucho…", hearing: "Escuchando…", thinking: "Pensando…", speaking: "Kinly está hablando", ready: "Toque “Hablar con Kinly” para empezar", connecting: "Conectando…", offline: "Reconectando…",
    calling: "le está llamando", answer: "Contestar", notNow: "Ahora no", tookIt: "Ya la tomé", taken: "Tomada", later: "Recordar más tarde", timeFor: "Hora de su", newMsg: "le envió un mensaje!",
    reply: "Grabar respuesta", stopRec: "Parar", send: "Enviar", discard: "Borrar", noMsgs: "No hay mensajes.", ai: "Kinly es una compañera de IA", play: "Escuchar", whoCall: "¿A quién quiere ver?" },
};
type Words = typeof WORDS.en;

function useClock(tz: string, lang: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  if (!now) return { time: "", date: "" };
  const locale = lang === "hi" ? "hi-IN" : lang === "es" ? "es-ES" : "en-GB";
  return {
    time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).format(now),
    date: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now),
  };
}

function ring() {
  const ac = new AudioContext();
  const beep = (t: number) => {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.frequency.value = 660; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.45); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.5);
  };
  beep(0); beep(0.6);
  setTimeout(() => ac.close(), 1500);
}

export function ScreenApp({ token, initial }: { token: string; initial: ScreenState }) {
  const [state, setState] = useState(initial);
  const lang = (state.elder.languages[0] in WORDS ? state.elder.languages[0] : "en") as keyof typeof WORDS;
  const w: Words = WORDS[lang];
  const [panel, setPanel] = useState<null | "call" | "messages" | "meds">(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [ringing, setRinging] = useState<{ callId: string; from: string } | null>(initial.ringing);
  const [reminder, setReminder] = useState<{ logId: string; medicine: string; dosage: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clock = useClock(state.elder.timezone, lang);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/screen/${token}`, { cache: "no-store" });
    if (r.ok) {
      const s: ScreenState = await r.json();
      setState(s);
      if (s.ringing) setRinging((cur) => cur ?? s.ringing);
    }
  }, [token]);

  const api = useCallback((body: object) => fetch(`/api/screen/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()), [token]);

  const startCall = useCallback(async (contactId: string) => {
    const res = await api({ action: "call", contactId });
    if (res.callId) { setPanel(null); setCallId(res.callId); }
    else setToast(res.error ?? "Could not start the call.");
  }, [api]);

  const playMessage = useCallback(async (id: string, url: string) => {
    audioRef.current?.pause();
    const a = new Audio(url);
    audioRef.current = a;
    setNowPlaying(id);
    a.onended = () => setNowPlaying(null);
    await a.play().catch(() => setNowPlaying(null));
    await api({ action: "played", messageId: id });
    refresh();
  }, [api, refresh]);

  const voice = useKinlyVoice(token, (msg) => {
    switch (msg.type) {
      case "kinly-action":
        if (msg.action === "start_call") startCall((msg.contact as { id: string }).id);
        if (msg.action === "play_messages") {
          setPanel("messages");
          const first = state.messages.find((m) => !m.played) ?? state.messages[0];
          if (first) setTimeout(() => playMessage(first.id, first.url), 3500);
        }
        break;
      case "kinly-incoming-call":
        setRinging({ callId: String(msg.callId), from: String(msg.from) });
        break;
      case "kinly-new-message":
        setToast(`${msg.from} ${w.newMsg}`);
        refresh();
        break;
      case "kinly-reminder":
        setReminder({ logId: String(msg.logId), medicine: String(msg.medicine), dosage: String(msg.dosage ?? "") });
        if (voice.active) voice.sayText(`__kinly_event__:med_reminder:${msg.logId}`, false);
        break;
      case "kinly-command":
        if (msg.command === "start_checkin") { if (!voice.active) voice.start("start_checkin"); }
        if (msg.command === "say") {
          if (!voice.active) voice.start("chat").then(() => setTimeout(() => voice.sayText(String(msg.text)), 2500));
          else voice.sayText(String(msg.text));
        }
        break;
    }
  });

  // Fallback polling (calls, messages, doses) in case a push was missed.
  useEffect(() => { const t = setInterval(refresh, 12000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { if (!ringing) return; ring(); const t = setInterval(ring, 2600); return () => clearInterval(t); }, [ringing]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const unread = state.messages.filter((m) => !m.played).length;
  const dueNow = state.doses.filter((d) => d.status === "pending");
  const has = (f: string) => (state.features as string[]).includes(f);

  async function confirmDose(medicineId: string, time: string) {
    await api({ action: "dose", medicineId, time });
    refresh();
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top_left,#fbf6ee_0%,#f1e9dc_60%,#ebe1d1_100%)] font-[family-name:var(--font-elder)] text-[var(--color-ink)]">
      {/* Top bar */}
      <header className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-10">
        <div>
          <p className="text-[2.6rem] font-bold leading-none tracking-tight sm:text-5xl">{clock.time}</p>
          <p className="mt-2 text-2xl text-[var(--color-ink-soft)]">{clock.date}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border-2 border-[var(--color-ink)]/15 bg-white/70 px-4 py-1.5 text-lg font-bold"><span className="mr-2 rounded bg-[var(--color-ink)] px-1.5 py-0.5 text-sm text-white">AI</span>{w.ai}</span>
          <StatusPill status={voice.status} w={w} />
        </div>
      </header>

      <div className="grid flex-1 gap-6 px-6 pb-8 pt-4 sm:px-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        {/* Companion */}
        <section className="flex flex-col items-center text-center" aria-live="polite">
          {state.avatar ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {state.avatar.photo ? <img src={state.avatar.photo} alt="" className="h-64 w-64 rounded-[40px] border-8 border-white object-cover shadow-[var(--shadow-lift)] sm:h-80 sm:w-80" style={{ transform: `scale(${1 + voice.mouth * 0.015})` }} />
                : <CompanionFace mouth={voice.mouth} expression={voice.expression} speaking={voice.status === "speaking"} size={320} />}
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-[var(--color-ink)] px-4 py-1.5 text-xl font-bold text-white">AI · {state.avatar.name}&apos;s voice</span>
            </div>
          ) : (
            <CompanionFace mouth={voice.mouth} expression={voice.expression} speaking={voice.status === "speaking"} size={340} />
          )}
          <div className="mt-6 min-h-[7.5rem] max-w-2xl">
            <p className="text-[1.9rem] font-bold leading-snug sm:text-[2.2rem]">{voice.kinlyText || (state.elder.consentStatus === "granted" ? greetingFor(lang, state.elder.preferredName) : "")}</p>
            {voice.elderText && <p className="mt-3 text-2xl text-[var(--color-ink-soft)]">“{voice.elderText}”</p>}
          </div>
          <button onClick={() => (voice.active ? voice.stop() : voice.start())} disabled={voice.status === "connecting" || voice.status === "offline"}
            className={clsx("mt-6 flex min-h-24 items-center gap-4 rounded-full px-12 text-[1.9rem] font-bold shadow-[var(--shadow-lift)] transition-transform active:scale-[0.98] disabled:opacity-50",
              voice.active ? "bg-white text-[var(--color-ink)] ring-4 ring-[var(--color-ink)]/10" : "bg-[var(--color-evergreen)] text-white")}>
            {voice.active ? <Stop size={40} weight="fill" aria-hidden="true" /> : <Microphone size={40} weight="fill" aria-hidden="true" />}
            {voice.active ? w.done : w.talk}
          </button>
        </section>

        {/* Big tiles */}
        <nav className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-1" aria-label="Kinly">
          {has("video_calls") && <Tile icon={<VideoCamera size={46} weight="fill" />} label={w.call} tone="evergreen" onClick={() => setPanel("call")} />}
          {has("voice_messages") && <Tile icon={<Envelope size={46} weight="fill" />} label={w.messages} tone="clay" badge={unread} onClick={() => setPanel("messages")} />}
          <Tile icon={<Pill size={46} weight="fill" />} label={w.meds} tone="sky" badge={dueNow.length && dueNow.some((d) => d.time <= clockHHMM(state.elder.timezone)) ? dueNow.filter((d) => d.time <= clockHHMM(state.elder.timezone)).length : 0} onClick={() => setPanel("meds")} />
        </nav>
      </div>

      {/* Panels */}
      {panel && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-[#f6f0e6] px-6 pb-10 pt-6 sm:px-10" role="dialog" aria-modal="true">
          <button onClick={() => setPanel(null)} className="flex min-h-20 items-center gap-3 rounded-full bg-white px-8 text-[1.7rem] font-bold shadow-[var(--shadow-card)]"><ArrowLeft size={34} weight="bold" aria-hidden="true" />{w.back}</button>

          {panel === "call" && (
            <section className="mt-8">
              <h2 className="text-4xl font-bold">{w.whoCall}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {state.contacts.filter((c) => c.relation.toLowerCase() !== "doctor").map((c) => (
                  <button key={c.id} onClick={() => startCall(c.id)} className="flex min-h-40 items-center gap-6 rounded-[32px] bg-white p-6 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]">
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[var(--color-evergreen)] text-4xl font-bold text-white">{c.name[0]}</span>
                    <span><span className="block text-[2.2rem] font-bold leading-tight">{c.name}</span><span className="text-2xl text-[var(--color-ink-soft)]">{c.relation}</span></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {panel === "messages" && (
            <section className="mt-8 max-w-3xl">
              <h2 className="text-4xl font-bold">{w.messages}</h2>
              {state.messages.length === 0 && <p className="mt-6 text-2xl">{w.noMsgs}</p>}
              <ul className="mt-6 space-y-5">
                {state.messages.map((m) => (
                  <li key={m.id} className={clsx("flex items-center gap-5 rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)]", !m.played && "ring-4 ring-[var(--color-clay)]/40")}>
                    <button onClick={() => playMessage(m.id, m.url)} className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[var(--color-clay)] text-white" aria-label={`${w.play}: ${m.from}`}>
                      {nowPlaying === m.id ? <span className="h-8 w-8 animate-pulse rounded-full bg-white" /> : <Play size={44} weight="fill" />}
                    </button>
                    <div><p className="text-[2rem] font-bold">{m.from}</p>{m.transcript && <p className="text-xl text-[var(--color-ink-soft)]">{m.transcript}</p>}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Recorder large labels={{ record: w.reply, stop: w.stopRec, send: w.send, discard: w.discard }} onSend={async (blob, seconds) => {
                  const f = new FormData();
                  f.append("audio", blob, "reply.webm"); f.append("elderId", state.elder.id); f.append("screenToken", token); f.append("duration", String(seconds));
                  const r = await fetch("/api/messages", { method: "POST", body: f });
                  if (!r.ok) throw new Error("Could not send");
                  setToast(w.send + " ✓");
                }} />
              </div>
            </section>
          )}

          {panel === "meds" && (
            <section className="mt-8 max-w-3xl">
              <h2 className="text-4xl font-bold">{w.meds}</h2>
              <ul className="mt-6 space-y-5">
                {state.doses.map((d) => (
                  <li key={d.medicineId + d.time} className="flex flex-wrap items-center gap-5 rounded-[28px] bg-white p-6 shadow-[var(--shadow-card)]">
                    <span className="text-[2.4rem] font-bold tabular-nums">{d.time}</span>
                    <div className="flex-1"><p className="text-[2rem] font-bold">{d.name}</p><p className="text-xl text-[var(--color-ink-soft)]">{[d.dosage, d.instructions].filter(Boolean).join(" · ")}</p></div>
                    {d.status === "taken" ? (
                      <span className="flex items-center gap-2 rounded-full bg-[var(--color-evergreen-soft)] px-6 py-3 text-2xl font-bold text-[var(--color-evergreen-deep)]"><Check size={30} weight="bold" aria-hidden="true" />{w.taken}</span>
                    ) : (
                      <button onClick={() => confirmDose(d.medicineId, d.time)} className="min-h-20 rounded-full bg-[var(--color-evergreen)] px-8 text-2xl font-bold text-white">{w.tookIt}</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Medicine reminder */}
      {reminder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-ink)]/40 p-6" role="alertdialog" aria-modal="true" aria-label={w.timeFor}>
          <div className="w-full max-w-2xl rounded-[36px] bg-white p-10 text-center shadow-[var(--shadow-lift)]">
            <Pill size={72} weight="duotone" className="mx-auto text-[var(--color-sky)]" aria-hidden="true" />
            <p className="mt-4 text-2xl text-[var(--color-ink-soft)]">{w.timeFor}</p>
            <p className="mt-1 text-5xl font-bold">{reminder.medicine}</p>
            {reminder.dosage && <p className="mt-2 text-2xl">{reminder.dosage}</p>}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <button className="min-h-24 rounded-full bg-[var(--color-evergreen)] px-10 text-[1.9rem] font-bold text-white" onClick={async () => {
                const dose = state.doses.find((d) => d.name === reminder.medicine && d.status === "pending");
                if (dose) await confirmDose(dose.medicineId, dose.time);
                if (voice.active) voice.sayText(w.tookIt);
                setReminder(null);
              }}>{w.tookIt}</button>
              <button className="min-h-24 rounded-full bg-[#efe8dc] px-10 text-[1.7rem] font-bold" onClick={() => setReminder(null)}>{w.later}</button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming call */}
      {ringing && !callId && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-evergreen-deep)] p-8 text-center text-white" role="alertdialog" aria-modal="true">
          <span className="relative flex h-44 w-44 items-center justify-center rounded-full bg-white/10">
            <span className="absolute inset-0 animate-ring rounded-full bg-white/25" />
            <span className="text-7xl font-bold">{ringing.from[0]}</span>
          </span>
          <p className="mt-8 text-6xl font-bold">{ringing.from}</p>
          <p className="mt-3 text-3xl text-white/80">{w.calling}</p>
          <div className="mt-12 flex flex-col gap-5 sm:flex-row">
            <button className="flex min-h-28 items-center justify-center gap-4 rounded-full bg-[#2f9e62] px-14 text-[2.2rem] font-bold" onClick={() => { voice.stop(); setCallId(ringing.callId); api({ action: "call-status", callId: ringing.callId, status: "active" }); setRinging(null); }}>
              <PhoneCall size={48} weight="fill" aria-hidden="true" />{w.answer}
            </button>
            <button className="flex min-h-28 items-center justify-center gap-4 rounded-full bg-white/15 px-12 text-[1.9rem] font-bold" onClick={() => { api({ action: "call-status", callId: ringing.callId, status: "declined" }); setRinging(null); }}>
              <PhoneSlash size={40} aria-hidden="true" />{w.notNow}
            </button>
          </div>
        </div>
      )}

      {callId && <VideoCall callId={callId} screenToken={token} large onEnd={() => { setCallId(null); refresh(); }} />}

      {toast && (
        <div className="fixed inset-x-0 bottom-8 z-40 flex justify-center px-6" role="status">
          <button onClick={() => { setPanel("messages"); setToast(null); }} className="flex items-center gap-4 rounded-full bg-[var(--color-ink)] px-8 py-5 text-2xl font-bold text-white shadow-[var(--shadow-lift)]">
            <Envelope size={34} weight="fill" aria-hidden="true" />{toast}
          </button>
        </div>
      )}
    </main>
  );
}

function clockHHMM(tz: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date());
}

function greetingFor(lang: string, name: string) {
  return lang === "hi" ? `नमस्ते ${name}!` : lang === "es" ? `¡Hola, ${name}!` : `Hello, ${name}!`;
}

function StatusPill({ status, w }: { status: VoiceStatus; w: Words }) {
  const label = { connecting: w.connecting, ready: w.ready, listening: w.listening, hearing: w.hearing, thinking: w.thinking, speaking: w.speaking, offline: w.offline }[status];
  const live = status === "listening" || status === "hearing";
  return (
    <span className={clsx("flex items-center gap-2.5 rounded-full px-4 py-2 text-xl font-bold", status === "offline" ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" : "bg-white/80")} aria-live="polite">
      <span className={clsx("h-3.5 w-3.5 rounded-full", live ? "animate-pulse bg-[#2f9e62]" : status === "speaking" ? "bg-[var(--color-evergreen)]" : status === "thinking" ? "animate-pulse bg-[var(--color-sun)]" : "bg-[var(--color-faint)]")} aria-hidden="true" />
      {label}
    </span>
  );
}

function Tile({ icon, label, tone, badge, onClick }: { icon: React.ReactNode; label: string; tone: "evergreen" | "clay" | "sky"; badge?: number; onClick: () => void }) {
  const colors = { evergreen: "bg-[var(--color-evergreen)] text-white", clay: "bg-[var(--color-clay)] text-white", sky: "bg-[var(--color-sky)] text-white" }[tone];
  return (
    <button onClick={onClick} className="relative flex min-h-32 items-center gap-6 rounded-[32px] bg-white px-7 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98] lg:min-h-36">
      <span className={clsx("flex h-24 w-24 shrink-0 items-center justify-center rounded-[26px]", colors)} aria-hidden="true">{icon}</span>
      <span className="text-[2.1rem] font-bold leading-tight">{label}</span>
      {!!badge && <span className="absolute right-6 top-6 flex h-12 min-w-12 items-center justify-center rounded-full bg-[var(--color-danger)] px-3 text-2xl font-bold text-white" aria-label={`${badge} new`}>{badge}</span>}
    </button>
  );
}
