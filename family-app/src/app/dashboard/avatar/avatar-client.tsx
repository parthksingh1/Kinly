"use client";

import { CheckCircle, Circle, Microphone, Play, Stop, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Monogram } from "@/components/ui";
import { cloneVoice, createAvatar, ownerApprove, revokeAvatar, setEnabled } from "./actions";

type AvatarView = {
  id: string; displayName: string; relation: string; photoUrl: string | null; consentAt: string | null;
  voiceReady: boolean; ownerApproved: boolean; elderInformed: boolean; enabled: boolean; status: string; createdBy: string;
};

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {done ? <CheckCircle size={20} weight="fill" className="shrink-0 text-[var(--color-evergreen)]" aria-label="Done" /> : <Circle size={20} className="shrink-0 text-[var(--color-faint)]" aria-label="Not done" />}
      <span className={done ? "" : "text-[var(--color-muted)]"}>{children}</span>
    </li>
  );
}

export function AvatarCard({ avatar, elderName, isOwner, isSelf }: { avatar: AvatarView; elderName: string; isOwner: boolean; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [playing, setPlaying] = useState(false);
  const run = (fn: () => Promise<{ error?: string; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.error || r.message || ""); });
  const allReady = avatar.voiceReady && avatar.ownerApproved && avatar.elderInformed && !!avatar.consentAt;

  async function preview() {
    setPlaying(true);
    try {
      const res = await fetch(`/api/avatar/${avatar.id}/preview`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audio.onended = () => setPlaying(false);
      await audio.play();
    } catch (e) {
      setMsg((e as Error).message || "Preview unavailable");
      setPlaying(false);
    }
  }

  return (
    <section className="card p-6" aria-label={`Avatar of ${avatar.displayName}`}>
      <div className="flex items-center gap-4">
        <div className="relative">
          {avatar.photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatar.photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            : <Monogram name={avatar.displayName} size={64} className="!rounded-2xl" />}
          <span className="absolute -bottom-1.5 -right-1.5 rounded-md bg-[var(--color-ink)] px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-white">AI</span>
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold">{avatar.displayName}&apos;s AI voice</p>
          <p className="text-sm text-[var(--color-muted)]">{avatar.relation || "Family"} · created by {avatar.createdBy}</p>
        </div>
        <span className={`chip ${avatar.enabled ? "chip-ok" : "chip-neutral"}`}>{avatar.enabled ? "On" : "Off"}</span>
      </div>

      <ol className="mt-5 space-y-2.5">
        <Step done={!!avatar.consentAt}>{avatar.displayName} recorded their spoken consent (adult, own account)</Step>
        <Step done={avatar.voiceReady}>Voice created from the consent recording</Step>
        <Step done={avatar.ownerApproved}>Plan owner confirmed it suits {elderName}</Step>
        <Step done={avatar.elderInformed}>{elderName} was told, in plain words, that this is an AI voice</Step>
      </ol>

      <div className="mt-5 flex flex-wrap gap-2">
        {isSelf && !avatar.voiceReady && <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => cloneVoice(avatar.id))}>{pending ? "Creating voice…" : "Create my voice"}</button>}
        {avatar.voiceReady && <button className="btn btn-secondary btn-sm" disabled={playing} onClick={preview}><Play size={15} weight="fill" aria-hidden="true" />{playing ? "Playing…" : "Hear a sample"}</button>}
        {(isOwner || isSelf) && allReady && (
          <button className={`btn btn-sm ${avatar.enabled ? "btn-secondary" : "btn-primary"}`} disabled={pending} onClick={() => run(() => setEnabled(avatar.id, !avatar.enabled))}>{avatar.enabled ? "Turn off" : "Turn on"}</button>
        )}
        {(isSelf || isOwner) && (
          <button className="btn btn-ghost btn-sm text-[var(--color-danger)]" disabled={pending}
            onClick={() => { if (confirm("Delete this avatar? The voice, recordings and photo are deleted permanently.")) run(() => revokeAvatar(avatar.id)); }}>
            <Trash size={15} aria-hidden="true" />Delete everything
          </button>
        )}
      </div>

      {isOwner && !avatar.ownerApproved && (
        <form className="mt-5 space-y-2.5 rounded-2xl bg-[var(--color-sun-soft)] p-4 text-sm" action={(f) => run(() => ownerApprove(avatar.id, f))}>
          <p className="font-semibold text-[#6b4705]">Owner confirmation</p>
          <label className="flex gap-2.5"><input type="checkbox" name="suitable" className="mt-0.5 h-4 w-4 accent-[var(--color-evergreen)]" />I believe this is suitable for {elderName}. They do not live with memory problems that could make an AI voice confusing.</label>
          <label className="flex gap-2.5"><input type="checkbox" name="informed" className="mt-0.5 h-4 w-4 accent-[var(--color-evergreen)]" />{elderName} has been told that this is an AI voice of {avatar.displayName}, not the real person.</label>
          <button className="btn btn-primary btn-sm" disabled={pending}>Confirm</button>
        </form>
      )}
      {msg && <p aria-live="polite" className="mt-3 text-sm text-[var(--color-ink-soft)]">{msg}</p>}
    </section>
  );
}

export function CreateAvatar({ userName, elderName }: { userName: string; elderName: string }) {
  const router = useRouter();
  const first = userName.split(" ")[0];
  const statement = `I am ${userName}. I am an adult, and I agree that Kinly may create an AI version of my voice from this recording, to talk with ${elderName}. It will always say it is an AI. I can delete it at any time.`;
  const [rec, setRec] = useState<"idle" | "recording" | "done">("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const mr = useRef<MediaRecorder | null>(null);

  async function record() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setBlob(new Blob(chunks, { type: r.mimeType.split(";")[0] })); setRec("done"); };
      r.start();
      mr.current = r;
      setRec("recording");
    } catch { setError("Microphone permission is needed."); }
  }

  return (
    <section className="card p-6" aria-labelledby="create-h">
      <h2 id="create-h" className="text-lg font-semibold">Create your own AI voice for {elderName}</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Only for you, {first}. It takes about a minute.</p>
      <form className="mt-5 space-y-4" action={(form) => {
        if (!blob) { setError("Please record the consent statement."); return; }
        form.append("consent", blob, "consent.webm");
        form.append("statement", statement);
        start(async () => { const r = await createAvatar(form); if (r.error) setError(r.error); else router.refresh(); });
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="av-name">Name {elderName} knows you by</label><input id="av-name" name="displayName" defaultValue={first} className="input" required /></div>
          <div><label className="field-label" htmlFor="av-rel">Relation</label><input id="av-rel" name="relation" className="input" placeholder="Granddaughter" /></div>
        </div>
        <div><label className="field-label" htmlFor="av-photo">Your photo (shown in a frame marked “AI”)</label><input id="av-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input !py-2" /></div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className="field-label">Read this aloud and record it</p>
          <p className="font-[family-name:var(--font-serif)] text-lg leading-relaxed">“{statement}”</p>
          <div className="mt-3 flex items-center gap-3">
            {rec === "recording"
              ? <button type="button" className="btn btn-danger btn-sm" onClick={() => mr.current?.stop()}><Stop size={15} weight="fill" aria-hidden="true" />Stop</button>
              : <button type="button" className="btn btn-secondary btn-sm" onClick={record}><Microphone size={15} weight="fill" aria-hidden="true" />{rec === "done" ? "Record again" : "Record"}</button>}
            {rec === "done" && blob && <audio controls src={URL.createObjectURL(blob)} className="h-9" />}
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name="adult" className="mt-0.5 h-4 w-4 accent-[var(--color-evergreen)]" required />I am 18 or older.</label>
        <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name="self" className="mt-0.5 h-4 w-4 accent-[var(--color-evergreen)]" required />This is my own voice and my own photo.</label>
        {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save my consent"}</button>
      </form>
    </section>
  );
}
