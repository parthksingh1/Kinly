"use client";

import { Microphone, PaperPlaneTilt, Stop, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

/** Records a short voice note with MediaRecorder. Calls onSend(blob, seconds). */
export function Recorder({ onSend, maxSeconds = 60, large = false, labels }: {
  onSend: (blob: Blob, seconds: number) => Promise<void>;
  maxSeconds?: number;
  large?: boolean;
  labels?: { record?: string; stop?: string; send?: string; discard?: string };
}) {
  const [state, setState] = useState<"idle" | "recording" | "review" | "sending" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/mp4";
      const r = new MediaRecorder(stream, { mimeType: type });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        blob.current = new Blob(chunks.current, { type: type.split(";")[0] });
        setUrl(URL.createObjectURL(blob.current));
        setState("review");
      };
      r.start(250);
      rec.current = r;
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => setSeconds((s) => {
        if (s + 1 >= maxSeconds) stop();
        return s + 1;
      }), 1000);
    } catch {
      setError("Microphone permission is needed to record.");
      setState("error");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }

  async function send() {
    if (!blob.current) return;
    setState("sending");
    try {
      await onSend(blob.current, seconds);
      discard();
    } catch (e) {
      setError((e as Error).message || "Could not send.");
      setState("review");
    }
  }

  function discard() {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    blob.current = null;
    setSeconds(0);
    setState("idle");
  }

  const big = large ? "min-h-20 text-2xl px-8" : "";
  return (
    <div className="flex flex-col gap-3">
      {state === "recording" ? (
        <div className="flex items-center gap-4">
          <button onClick={stop} className={clsx("btn btn-danger", big)}><Stop size={large ? 30 : 18} weight="fill" aria-hidden="true" />{labels?.stop ?? "Stop"}</button>
          <span className="tabular flex items-center gap-2 font-semibold text-[var(--color-danger)]" aria-live="polite">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-danger)]" aria-hidden="true" />
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        </div>
      ) : state === "review" || state === "sending" ? (
        <div className="flex flex-col gap-3">
          {url && <audio controls src={url} className="w-full max-w-md" />}
          <div className="flex gap-2">
            <button onClick={send} disabled={state === "sending"} className={clsx("btn btn-primary", big)}><PaperPlaneTilt size={large ? 28 : 18} weight="fill" aria-hidden="true" />{state === "sending" ? "Sending…" : labels?.send ?? "Send"}</button>
            <button onClick={discard} disabled={state === "sending"} className={clsx("btn btn-secondary", big)}><Trash size={large ? 26 : 18} aria-hidden="true" />{labels?.discard ?? "Discard"}</button>
          </div>
        </div>
      ) : (
        <button onClick={start} className={clsx("btn btn-primary w-fit", big)}><Microphone size={large ? 30 : 18} weight="fill" aria-hidden="true" />{labels?.record ?? "Record a message"}</button>
      )}
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
