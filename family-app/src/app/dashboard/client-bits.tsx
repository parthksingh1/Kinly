"use client";

import { ArrowsClockwise, Check, Phone } from "@phosphor-icons/react";
import { useActionState, useState, useTransition } from "react";
import { callNow, refreshSummary, setAlertStatus, type ActionResult } from "./actions";

export function CallNowButton({ name }: { name: string }) {
  const [state, action, pending] = useActionState(callNow, {} as ActionResult);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button className="btn btn-primary" disabled={pending}><Phone size={18} weight="fill" aria-hidden="true" />{pending ? "Placing call…" : `Call ${name} now`}</button>
      <p aria-live="polite" className={`max-w-xs text-right text-xs ${state.error ? "text-[var(--color-danger)]" : "text-[var(--color-evergreen)]"}`}>{state.error || state.message}</p>
    </form>
  );
}

export function RefreshSummaryButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-2">
      <span aria-live="polite" className="hidden text-xs text-[var(--color-muted)] sm:inline">{msg}</span>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await refreshSummary(false); setMsg(r.error || r.message || ""); })} aria-label="Refresh summary">
        <ArrowsClockwise size={16} className={pending ? "animate-spin" : ""} aria-hidden="true" />Refresh
      </button>
    </div>
  );
}

export function AlertActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 flex gap-2">
      <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(() => setAlertStatus(id, "acknowledged"))}>I&apos;m on it</button>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => setAlertStatus(id, "resolved"))}><Check size={15} aria-hidden="true" />Resolved</button>
    </div>
  );
}
