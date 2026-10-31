"use client";

import { Check } from "@phosphor-icons/react";
import clsx from "clsx";
import { useState, useTransition } from "react";
import { startCheckout } from "./actions";

type Plan = { id: string; name: string; tagline: string; bullets: string[] };

export function PlanPicker({ plans, prices, current, defaultCurrency }: { plans: Plan[]; prices: Record<"USD" | "INR", Record<string, string>>; current: string; defaultCurrency: "USD" | "INR" }) {
  const [currency, setCurrency] = useState(defaultCurrency);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  return (
    <div>
      <div className="mb-6 flex gap-2" role="radiogroup" aria-label="Currency">
        {(["USD", "INR"] as const).map((c) => (
          <button key={c} role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)} className={clsx("btn btn-sm", currency === c ? "btn-primary" : "btn-secondary")}>{c === "USD" ? "US $" : "India ₹"}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={clsx("card flex flex-col p-6", current === p.id && "!border-[var(--color-evergreen)] ring-2 ring-[var(--color-evergreen-soft)]")}>
            <p className="text-lg font-semibold">{p.name}</p>
            <p className="text-sm text-[var(--color-muted)]">{p.tagline}</p>
            <p className="display tabular mt-4 text-3xl">{prices[currency][p.id]}<span className="font-[family-name:var(--font-sans)] text-sm text-[var(--color-muted)]"> / month</span></p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.bullets.map((b) => <li key={b} className="flex gap-2"><Check size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--color-evergreen)]" aria-hidden="true" />{b}</li>)}
            </ul>
            <button className={clsx("btn mt-6 w-full", current === p.id ? "btn-secondary" : "btn-primary")} disabled={current === p.id || pending}
              onClick={() => { setBusy(p.id); setError(""); start(async () => { const r = await startCheckout(p.id, currency); if (r?.error) setError(r.error); }); }}>
              {current === p.id ? "Current plan" : pending && busy === p.id ? "Opening checkout…" : `Switch to ${p.name}`}
            </button>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
      <p className="mt-6 text-xs text-[var(--color-muted)]">Payments are processed by Stripe (test mode during the pilot). Razorpay for India is supported behind the same billing interface.</p>
    </div>
  );
}
