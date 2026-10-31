"use client";

import { Check } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";

type Plan = { id: string; name: string; tagline: string; bullets: string[] };
type Prices = Record<"USD" | "INR", Record<string, string>>;

export function Pricing({ plans, prices, defaultCurrency, ctaHref = "/signup", action }: {
  plans: Plan[];
  prices: Prices;
  defaultCurrency: "USD" | "INR";
  ctaHref?: string;
  action?: (plan: string, currency: "USD" | "INR") => React.ReactNode;
}) {
  const [currency, setCurrency] = useState<"USD" | "INR">(defaultCurrency);
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div role="radiogroup" aria-label="Currency" className="inline-flex rounded-full border border-[var(--color-line-strong)] bg-white p-1 text-sm">
          {(["USD", "INR"] as const).map((c) => (
            <button key={c} role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)}
              className={clsx("min-h-9 rounded-full px-4 font-medium transition-colors", currency === c ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")}>
              {c === "USD" ? "US $" : "India ₹"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const featured = p.id === "family";
          return (
            <div key={p.id} className={clsx("relative flex flex-col rounded-[22px] border p-6",
              featured ? "border-[var(--color-evergreen)] bg-[var(--color-evergreen-deep)] text-white shadow-[var(--shadow-lift)]" : "border-[var(--color-line)] bg-white")}>
              {featured && <span className="absolute -top-3 left-6 rounded-full bg-[#e8b48f] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">Most families choose this</span>}
              <p className="text-lg font-semibold">{p.name}</p>
              <p className={clsx("mt-1 text-sm", featured ? "text-white/70" : "text-[var(--color-muted)]")}>{p.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="display tabular text-4xl">{p.id === "trial" ? "Free" : prices[currency][p.id]}</span>
                <span className={clsx("text-sm", featured ? "text-white/60" : "text-[var(--color-muted)]")}>{p.id === "trial" ? "for 7 days" : "/ month"}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-[0.92rem]">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <Check size={18} weight="bold" className={clsx("mt-0.5 shrink-0", featured ? "text-[#e8b48f]" : "text-[var(--color-evergreen)]")} aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                {action ? action(p.id, currency) : (
                  <Link href={`${ctaHref}?plan=${p.id}&currency=${currency}`}
                    className={clsx("btn w-full", featured ? "bg-white text-[var(--color-ink)] hover:bg-[var(--color-linen)]" : "btn-secondary")}>
                    {p.id === "trial" ? "Start free trial" : `Choose ${p.name}`}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
