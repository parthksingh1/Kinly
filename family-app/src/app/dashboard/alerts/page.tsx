import { Bell, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Empty, PageHeader, SeverityChip, StatusChip } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayIn, relative, timeIn } from "@/lib/format";
import { AlertActions } from "../client-bits";

export const metadata: Metadata = { title: "Alerts" };

const CATEGORY: Record<string, string> = {
  fall: "Fall", chest_pain: "Chest pain", breathing: "Breathing", stroke_confusion: "Confusion", self_harm: "Emotional safety",
  bleeding: "Injury", scam: "Scam Shield", low_mood: "Mood", low_mood_trend: "Mood trend", loneliness: "Loneliness",
  not_eating: "Eating", missed_medicine: "Medicines", missed_call: "Missed call", pain: "Pain", sleep: "Sleep",
};

export default async function AlertsPage() {
  const { elder } = await requireContext();
  const alerts = await db.alert.findMany({ where: { elderId: elder.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const open = alerts.filter((a) => a.status !== "resolved");
  const closed = alerts.filter((a) => a.status === "resolved");

  return (
    <>
      <PageHeader eyebrow="Alerts" title="What needed attention"
        description={<>Urgent alerts reach every family member on WhatsApp and email the moment Kinly hears them. Kinly never diagnoses: it notices, encourages {elder.preferredName} to get help, and tells you.</>} />
      {alerts.length === 0 && <Empty icon={<ShieldCheck size={32} />} title="No alerts yet" body="When something needs your attention it will appear here, newest first." />}
      {open.length > 0 && (
        <section aria-labelledby="open-h" className="mb-10">
          <h2 id="open-h" className="mb-3 text-sm font-semibold text-[var(--color-muted)]">Needs attention</h2>
          <ol className="space-y-3">{open.map((a) => <AlertRow key={a.id} a={a} tz={elder.timezone} />)}</ol>
        </section>
      )}
      {closed.length > 0 && (
        <section aria-labelledby="closed-h">
          <h2 id="closed-h" className="mb-3 text-sm font-semibold text-[var(--color-muted)]">Resolved</h2>
          <ol className="relative space-y-3 border-l border-[var(--color-line-strong)] pl-6">
            {closed.map((a) => <AlertRow key={a.id} a={a} tz={elder.timezone} timeline />)}
          </ol>
        </section>
      )}
    </>
  );
}

function AlertRow({ a, tz, timeline }: { a: Awaited<ReturnType<typeof db.alert.findMany>>[number]; tz: string; timeline?: boolean }) {
  return (
    <li className={`card relative p-5 ${a.severity === "urgent" && a.status === "open" ? "border-[#f3c5c0]" : ""}`}>
      {timeline && <span className="absolute -left-[31px] top-6 h-2.5 w-2.5 rounded-full bg-[var(--color-line-strong)] ring-4 ring-[var(--color-linen)]" aria-hidden="true" />}
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip severity={a.severity} />
        <span className="chip chip-neutral">{CATEGORY[a.category] ?? a.category}</span>
        <StatusChip status={a.status} />
        <span className="ml-auto text-xs text-[var(--color-muted)]">{dayIn(a.createdAt, tz)}, {timeIn(a.createdAt, tz)} · {relative(a.createdAt)}</span>
      </div>
      <p className="mt-3 flex items-center gap-2 font-semibold"><Bell size={17} aria-hidden="true" className="text-[var(--color-muted)]" />{a.title}</p>
      {a.detail && <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{a.detail}</p>}
      {a.quote && <blockquote className="mt-3 border-l-2 border-[var(--color-clay)] pl-3 text-sm italic text-[var(--color-ink-soft)]">“{a.quote}”</blockquote>}
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        {a.notifiedAt ? `Family notified ${relative(a.notifiedAt)}` : "Shown in the dashboard"}
        {a.acknowledgedBy && ` · ${a.acknowledgedBy} took it`}
        {a.resolvedAt && ` · resolved ${relative(a.resolvedAt)}`}
      </p>
      {a.status === "open" && <AlertActions id={a.id} />}
    </li>
  );
}
