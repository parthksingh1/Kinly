import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export function Logo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill={mono ? "currentColor" : "var(--color-evergreen)"} opacity={mono ? 0.12 : 1} />
        <path d="M10.5 21.5c0-4.4 2.5-7.6 6.2-8.9" stroke={mono ? "currentColor" : "#f6f2ea"} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M21.5 21.5c0-4.4-2.5-7.6-6.2-8.9" stroke={mono ? "currentColor" : "#e8b48f"} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="9.6" r="2.4" fill={mono ? "currentColor" : "#f6f2ea"} />
      </svg>
      <span className="display text-[1.45rem] leading-none tracking-tight">Kinly</span>
    </span>
  );
}

const TONES = ["#1d5547", "#b2603a", "#2f6690", "#7a5c99", "#8a6a12", "#3c4744"];

export function Monogram({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const tone = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: tone, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: string }) {
  if (severity === "urgent") return <span className="chip chip-urgent"><Dot className="bg-[var(--color-danger)]" />Urgent</span>;
  if (severity === "concerning") return <span className="chip chip-concerning"><Dot className="bg-[var(--color-sun)]" />Check in</span>;
  return <span className="chip chip-info">Info</span>;
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    open: ["chip-urgent", "Open"], acknowledged: ["chip-info", "Acknowledged"], resolved: ["chip-ok", "Resolved"],
    taken: ["chip-ok", "Taken"], missed: ["chip-urgent", "Missed"], pending: ["chip-neutral", "Due"], skipped: ["chip-neutral", "Skipped"],
    completed: ["chip-ok", "Completed"], "no-answer": ["chip-concerning", "No answer"], busy: ["chip-concerning", "Busy"],
    failed: ["chip-urgent", "Failed"], queued: ["chip-info", "Queued"], "in-progress": ["chip-info", "In progress"],
  };
  const [cls, label] = map[status] ?? ["chip-neutral", status];
  return <span className={clsx("chip", cls)}>{label}</span>;
}

export function Dot({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-1.5 w-1.5 rounded-full", className)} aria-hidden="true" />;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-3xl sm:text-[2.35rem]">{title}</h1>
        {description && <p className="mt-2 text-[0.98rem] leading-relaxed text-[var(--color-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, hint }: { title: string; action?: ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-[1.02rem] font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-sm text-[var(--color-muted)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-line-strong)] px-6 py-10 text-center">
      {icon && <div className="mb-3 text-[var(--color-faint)]">{icon}</div>}
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Locked({ feature, plan }: { feature: string; plan: string }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{feature} is part of the {plan} plan</p>
        <p className="text-sm text-[var(--color-muted)]">Upgrade any time. Safety alerts are included on every plan.</p>
      </div>
      <Link href="/dashboard/billing" className="btn btn-primary btn-sm">See plans</Link>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div>
      <p className="text-[0.8rem] font-medium text-[var(--color-muted)]">{label}</p>
      <p className={clsx("tabular mt-1 text-[1.65rem] font-semibold tracking-tight",
        tone === "good" && "text-[var(--color-evergreen)]", tone === "warn" && "text-[#8a5a07]", tone === "bad" && "text-[var(--color-danger)]")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{sub}</p>}
    </div>
  );
}
