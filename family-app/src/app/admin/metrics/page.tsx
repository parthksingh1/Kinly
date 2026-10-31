import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, Stat } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LANGUAGE_NAMES, duration } from "@/lib/format";

export const metadata: Metadata = { title: "Metrics" };
export const dynamic = "force-dynamic";

function pct(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ demo?: string; days?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin/metrics");
  if (!user.isAdmin && process.env.DEMO_MODE !== "true") redirect("/dashboard");
  const { demo, days: daysParam } = await searchParams;
  const includeDemo = demo === "1";
  const days = Number(daysParam ?? 30);
  const since = new Date(Date.now() - days * 86400000);
  const elders = await db.elder.findMany({ where: includeDemo ? {} : { isDemo: false }, select: { id: true } });
  const ids = elders.map((e) => e.id);
  const inElders = { elderId: { in: ids } };

  const [calls, convos, alerts, logs, turns, families] = await Promise.all([
    db.phoneCall.findMany({ where: { ...inElders, createdAt: { gte: since }, direction: "outbound" } }),
    db.conversation.findMany({ where: { ...inElders, startedAt: { gte: since } }, select: { channel: true, durationSec: true, languagesUsed: true, language: true, turnCount: true } }),
    db.alert.findMany({ where: { ...inElders, createdAt: { gte: since } }, select: { severity: true, category: true } }),
    db.medicineLog.findMany({ where: { ...inElders, scheduledFor: { gte: since, lte: new Date() } }, select: { status: true } }),
    db.turnMetric.findMany({ where: { ...inElders, createdAt: { gte: since } }, select: { channel: true, firstAudioMs: true } }),
    db.family.count({ where: includeDemo ? {} : { elders: { some: { isDemo: false } } } }),
  ]);

  const answered = calls.filter((c) => c.status === "completed").length;
  const phoneConvos = convos.filter((c) => c.channel === "phone" && c.turnCount > 0);
  const avgCall = phoneConvos.length ? Math.round(phoneConvos.reduce((a, c) => a + c.durationSec, 0) / phoneConvos.length) : 0;
  const langCount: Record<string, number> = {};
  for (const c of convos) for (const l of (c.languagesUsed || c.language).split(",").filter(Boolean)) langCount[l] = (langCount[l] ?? 0) + 1;
  const taken = logs.filter((l) => l.status === "taken").length;
  const missed = logs.filter((l) => l.status === "missed").length;
  const screenTurns = turns.filter((t) => t.channel === "screen").map((t) => t.firstAudioMs);
  const phoneTurns = turns.filter((t) => t.channel === "phone").map((t) => t.firstAudioMs);
  const avg = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
  const bySeverity = (s: string) => alerts.filter((a) => a.severity === s).length;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20">
      <header className="flex items-center justify-between py-6">
        <Link href="/dashboard"><Logo /></Link>
        <div className="flex gap-2 text-sm">
          {[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}${includeDemo ? "&demo=1" : ""}`} className={`btn btn-sm ${d === days ? "btn-primary" : "btn-secondary"}`}>{d} days</Link>)}
          <Link href={`?days=${days}${includeDemo ? "" : "&demo=1"}`} className="btn btn-ghost btn-sm">{includeDemo ? "Hide demo data" : "Include demo data"}</Link>
        </div>
      </header>
      <p className="eyebrow">Metrics · last {days} days</p>
      <h1 className="display mt-2 text-4xl">How Kinly is doing</h1>
      <p className="mt-2 text-[var(--color-muted)]">{includeDemo ? "Including the seeded demo family." : "Real usage only (demo family excluded)."} {elders.length} older adult{elders.length === 1 ? "" : "s"} across {families} famil{families === 1 ? "y" : "ies"}.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5"><Stat label="Calls placed" value={calls.length} sub={calls.length ? `${Math.round((answered / calls.length) * 100)}% answered` : "—"} /></div>
        <div className="card p-5"><Stat label="Conversations" value={convos.length} sub={`${phoneConvos.length} phone · ${convos.length - phoneConvos.length} screen`} /></div>
        <div className="card p-5"><Stat label="Average call length" value={avgCall ? duration(avgCall) : "—"} /></div>
        <div className="card p-5"><Stat label="Medicine adherence" value={taken + missed ? `${Math.round((taken / (taken + missed)) * 100)}%` : "—"} sub={`${taken} taken · ${missed} missed`} /></div>
        <div className="card p-5"><Stat label="Alerts fired" value={alerts.length} sub={`${bySeverity("urgent")} urgent · ${bySeverity("concerning")} check-in`} /></div>
        <div className="card p-5"><Stat label="Time to first audio (screen)" value={avg(screenTurns) ? `${avg(screenTurns)} ms` : "—"} sub={screenTurns.length ? `p90 ${pct(screenTurns, 90)} ms · ${screenTurns.length} turns` : "No turns yet"} /></div>
        <div className="card p-5"><Stat label="Time to first token (phone)" value={avg(phoneTurns) ? `${avg(phoneTurns)} ms` : "—"} sub={phoneTurns.length ? `p90 ${pct(phoneTurns, 90)} ms · ${phoneTurns.length} turns` : "No turns yet"} /></div>
        <div className="card p-5">
          <p className="text-[0.8rem] font-medium text-[var(--color-muted)]">Languages used</p>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(langCount).sort((a, b) => b[1] - a[1]).map(([l, n]) => <li key={l} className="flex justify-between"><span>{LANGUAGE_NAMES[l] ?? l}</span><span className="tabular text-[var(--color-muted)]">{n}</span></li>)}
            {Object.keys(langCount).length === 0 && <li className="text-[var(--color-muted)]">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
