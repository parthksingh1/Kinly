"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Expression } from "@/components/companion-face";

/**
 * Voice client for the Kinly companion server (Open-LLM-VTuber websocket protocol + Kinly messages).
 * - mic: hands-free voice activity detection (Silero in the browser), patient pause before replying
 * - server sends sentence-sized audio with a volume envelope -> sequential playback + lip sync
 * - speaking over Kinly interrupts it (barge-in)
 * - when the server has no speech-to-text keys, the browser's own speech recognition is used
 */
export type VoiceStatus = "connecting" | "ready" | "listening" | "hearing" | "thinking" | "speaking" | "offline";

type AudioMsg = { audio: string | null; volumes: number[]; slice_length: number; display_text?: { text: string } | null; actions?: { expressions?: (string | number)[] } | null };

const PAUSE_MS = Number(process.env.NEXT_PUBLIC_KINLY_PAUSE_MS || 1300);
const SPEECH_LANG: Record<string, string> = { hi: "hi-IN", en: "en-IN", es: "es-ES", bn: "bn-IN", ta: "ta-IN", te: "te-IN", mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN" };

function wsUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_KINLY_WS_URL;
  if (fromEnv) return fromEnv;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.hostname}:12393/client-ws`;
}

export function useKinlyVoice(screenToken: string, onMessage: (msg: Record<string, unknown>) => void) {
  const [status, setStatus] = useState<VoiceStatus>("connecting");
  const [active, setActive] = useState(false);
  const [kinlyText, setKinlyText] = useState("");
  const [elderText, setElderText] = useState("");
  const [expression, setExpression] = useState<Expression>("neutral");
  const [mouth, setMouth] = useState(0);
  const [serverAsr, setServerAsr] = useState(true);
  const [ready, setReady] = useState<Record<string, unknown> | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const queue = useRef<AudioMsg[]>([]);
  const playing = useRef<AudioBufferSourceNode | null>(null);
  const synthDone = useRef(false);
  const heard = useRef("");
  const newMessage = useRef(true);
  const vad = useRef<{ start: () => void; pause: () => void; destroy: () => void } | null>(null);
  const recog = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);
  const statusRef = useRef<VoiceStatus>("connecting");
  const activeRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const langRef = useRef("en");

  const set = (s: VoiceStatus) => { statusRef.current = s; setStatus(s); };
  const send = useCallback((m: object) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m)); }, []);

  // ---------------------------------------------------------- playback

  const stopPlayback = useCallback(() => {
    queue.current = [];
    try { playing.current?.stop(); } catch {}
    playing.current = null;
    setMouth(0);
  }, []);

  const finishIfDone = useCallback(() => {
    if (!playing.current && queue.current.length === 0 && synthDone.current) {
      synthDone.current = false;
      send({ type: "frontend-playback-complete" });
      if (activeRef.current) set("listening"); else set("ready");
      setExpression((e) => (e === "concerned" ? e : "listening"));
    }
  }, [send]);

  const playNext = useCallback(async () => {
    if (playing.current || queue.current.length === 0) return finishIfDone();
    const msg = queue.current.shift()!;
    if (msg.display_text?.text) {
      if (newMessage.current) { setKinlyText(msg.display_text.text); newMessage.current = false; }
      else setKinlyText((t) => (t ? t + " " : "") + msg.display_text!.text);
      heard.current += " " + msg.display_text.text;
    }
    const exp = msg.actions?.expressions?.find((e) => typeof e === "string") as Expression | undefined;
    if (exp) setExpression(exp);
    if (!msg.audio) return playNext();
    const ac = ctx.current ?? (ctx.current = new AudioContext());
    let buffer: AudioBuffer;
    try {
      const bytes = Uint8Array.from(atob(msg.audio), (c) => c.charCodeAt(0));
      buffer = await ac.decodeAudioData(bytes.buffer);
    } catch {
      return playNext();
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    const startAt = ac.currentTime;
    playing.current = src;
    set("speaking");
    let raf = 0;
    const tick = () => {
      const idx = Math.floor(((ac.currentTime - startAt) * 1000) / (msg.slice_length || 20));
      setMouth(msg.volumes[idx] ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    src.onended = () => {
      cancelAnimationFrame(raf);
      setMouth(0);
      if (playing.current === src) playing.current = null;
      playNext();
    };
    src.start();
  }, [finishIfDone]);

  // ---------------------------------------------------------- listening

  const interrupt = useCallback(() => {
    if (statusRef.current === "speaking" || statusRef.current === "thinking") {
      stopPlayback();
      synthDone.current = false;
      send({ type: "interrupt-signal", text: heard.current.trim() });
      heard.current = "";
    }
  }, [send, stopPlayback]);

  const sayText = useCallback((text: string, show = true) => {
    if (!text.trim()) return;
    interrupt();
    if (show && !text.startsWith("__kinly_event__")) setElderText(text);
    newMessage.current = true;
    heard.current = "";
    set("thinking");
    send({ type: "text-input", text });
  }, [interrupt, send]);

  const startBrowserRecognition = useCallback(() => {
    type SR = { lang: string; interimResults: boolean; continuous: boolean; onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean }; length: number } }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void; abort: () => void };
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
    if (!Ctor) return false;
    const r = new Ctor();
    r.lang = SPEECH_LANG[langRef.current] ?? "en-IN";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      const text = res[0].transcript;
      if (!res.isFinal) { set("hearing"); setElderText(text); return; }
      sayText(text);
    };
    r.onend = () => {
      // keep listening hands-free while the conversation is open and Kinly isn't talking
      if (activeRef.current && statusRef.current === "listening") setTimeout(() => { try { r.start(); } catch {} }, 250);
    };
    r.onerror = () => {};
    recog.current = r;
    try { r.start(); } catch {}
    return true;
  }, [sayText]);

  const startMic = useCallback(async () => {
    if (!serverAsr) return startBrowserRecognition();
    try {
      const { MicVAD } = await import("@ricky0123/vad-web");
      const frameMs = 96; // legacy Silero model frames of 1536 samples at 16 kHz
      const v = await MicVAD.new({
        model: "legacy",
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
        positiveSpeechThreshold: 0.6,
        negativeSpeechThreshold: 0.4,
        minSpeechFrames: 4,
        redemptionFrames: Math.max(6, Math.round(PAUSE_MS / frameMs)),
        preSpeechPadFrames: 3,
        additionalAudioConstraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as MediaTrackConstraints,
        onSpeechStart: () => { interrupt(); if (statusRef.current !== "speaking") set("hearing"); },
        onVADMisfire: () => { if (statusRef.current === "hearing") set("listening"); },
        onSpeechEnd: (audio: Float32Array) => {
          newMessage.current = true;
          heard.current = "";
          setElderText("…");
          set("thinking");
          send({ type: "mic-audio-data", audio: Array.from(audio, (x) => Math.round(x * 10000) / 10000) });
          send({ type: "mic-audio-end" });
        },
      } as Parameters<typeof MicVAD.new>[0]);
      v.start();
      vad.current = v;
      return true;
    } catch (e) {
      console.warn("VAD unavailable, falling back to browser recognition", e);
      return startBrowserRecognition();
    }
  }, [interrupt, send, serverAsr, startBrowserRecognition]);

  const stopMic = useCallback(() => {
    vad.current?.destroy();
    vad.current = null;
    try { recog.current?.abort(); } catch {}
    recog.current = null;
  }, []);

  // ---------------------------------------------------------- session

  const start = useCallback(async (event = "start_checkin") => {
    ctx.current ??= new AudioContext();
    await ctx.current.resume();
    activeRef.current = true;
    setActive(true);
    await startMic();
    sayText(`__kinly_event__:${event}`, false);
  }, [sayText, startMic]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    stopMic();
    stopPlayback();
    send({ type: "kinly-end-session" });
    set("ready");
    setExpression("neutral");
  }, [send, stopMic, stopPlayback]);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    function connect() {
      set("connecting");
      const sock = new WebSocket(wsUrl());
      ws.current = sock;
      sock.onopen = () => { retry = 0; sock.send(JSON.stringify({ type: "kinly-hello", screen_token: screenToken })); };
      sock.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        switch (msg.type) {
          case "kinly-ready":
            setReady(msg);
            setServerAsr(!!msg.serverAsr);
            langRef.current = msg.elder?.languages?.[0] ?? "en";
            set(activeRef.current ? "listening" : "ready");
            break;
          case "audio":
            queue.current.push(msg);
            if (!playing.current) playNext();
            break;
          case "backend-synth-complete":
            synthDone.current = true;
            finishIfDone();
            break;
          case "user-input-transcription":
            setElderText(msg.text || "");
            if (!msg.text) set(activeRef.current ? "listening" : "ready");
            break;
          case "control":
            if (msg.text === "conversation-chain-start") { set("thinking"); newMessage.current = true; }
            if (msg.text === "conversation-chain-end" && !playing.current && queue.current.length === 0) set(activeRef.current ? "listening" : "ready");
            break;
          case "force-new-message":
            newMessage.current = true;
            break;
          case "error":
            console.warn("Kinly:", msg.message);
            break;
        }
        if (String(msg.type).startsWith("kinly-")) onMessageRef.current(msg);
      };
      sock.onclose = () => {
        if (closed) return;
        set("offline");
        setTimeout(connect, Math.min(10000, 1000 * 2 ** retry++));
      };
    }
    connect();
    return () => { closed = true; ws.current?.close(); stopMic(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToken]);

  return { status, active, kinlyText, elderText, expression, mouth, serverAsr, ready, start, stop, sayText, interrupt, send, stopPlayback };
}
