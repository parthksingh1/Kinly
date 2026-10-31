"use client";

import { FilePdf, PenNib } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { generateChapters } from "../actions";

export function BookActions() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button className="btn btn-secondary" onClick={() => window.print()}><FilePdf size={18} aria-hidden="true" />Save as PDF</button>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await generateChapters(); setMsg(r.error || r.message || ""); })}>
          <PenNib size={18} aria-hidden="true" />{pending ? "Writing…" : "Write new chapters"}
        </button>
      </div>
      <p aria-live="polite" className="text-xs text-[var(--color-muted)]">{msg}</p>
    </div>
  );
}
