import {
  ArrowRight, Bell, CalendarBlank, ChatCircleText, Lightbulb, Phone, Pill, ShieldCheck, VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AdherenceChart, MoodChart } from "@/components/charts";
import { Empty, PageHeader, SectionTitle, SeverityChip, Stat, StatusChip } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { MOOD_LABEL, dayIn, parseJson, relative, timeIn } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { latestSummary, todaysDoses, trends } from "@/lib/queries";
import { AlertActions, CallNowButton, RefreshSummaryButton } from "./client-bits";
import { startVideoCall } from "./actions";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { elder, family, user } = await requireContext();
  const { welcome } = await searchParams;
  const [summary, t, doses, alerts, convos, appointments, schedule] = await Promise.all([
    latestSummary(elder),
    trends(elder),
    todaysDoses(elder),
    db.alert.findMany({ where: { elderId: elder.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 4 }),
    db.conversation.findMany({ where: { elderId: elder.id, processed: true }, orderBy: { startedAt: "desc" }, take: 4 }),
    db.appointment.findMany({ where: { elderId: elder.id, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 3 }),
    db.callSchedule.findMany({ where: { elderId: elder.id, enabled: true }, orderBy: { timeLocal: "asc" } }),
  ]);
  const name = elder.preferredName;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: elder.timezone }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const openUrgent = alerts.filter((a) => a.status === "open" && a.severity === "urgent");

  return (
    <>
      {welcome && (
        <div className="card mb-6 flex flex-col gap-3 border-[var(--color-evergreen)]/30 bg-[var(--color-evergreen-tint)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">You&apos;re all set. Kinly will call {name} at {schedule[0]?.timeLocal ?? "the time you chose"}.</p>
            <p className="text-sm text-[var(--color-ink-soft)]">On the first call Kinly explains what it is and asks for {name}&apos;s consent. You&apos;ll see the summary here.</p>
          </div>
          <Link href="/dashboard/settings#screen" className="btn btn-secondary btn-sm">Set up the screen companion</Link>
        </div>
      )}

      {openUrgent.length > 0 && (
        <Link href="/dashboard/alerts" className="mb-6 flex items-center gap-4 rounded-[var(--radius-card)] border border-[#f3c5c0] bg-[var(--color-danger-soft)] p-5 text-[var(--color-danger)]" role="alert">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)] text-white"><Bell size={22} weight="fill" aria-hidden="true" /></span>
          <div className="flex-1">
            <p className="font-semibold">{openUrgent[0].title}</p>
            <p className="text-sm opacity-90">“{openUrgent[0].quote}” · {relative(openUrgent[0].createdAt)}. Please call {name}.</p>
          </div>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      )}

      <PageHeader
        eyebrow={dayIn(new Date(), elder.timezone) + " · " + timeIn(new Date(), elder.timezone) + " for " + name}
        title={`${greeting}, ${user.name.split(" ")[0]}.`}
        description={summary ? <>Here is how <b className="font-semibold text-[var(--color-ink)]">{name}</b> is doing.</> : `Kinly hasn't spoken with ${name} yet. The first conversation will appear here.`}
        actions={<>
          <CallNowButton name={name} />
          {hasFeature(family.plan, "video_calls") && (
            <form action={startVideoCall.bind(null, user.name.split(" ")[0])}><button className="btn btn-secondary"><VideoCamera size={18} aria-hidden="true" /> Video call</button></form>
          )}
        </>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Summary */}
        <section className="card p-6 lg:col-span-2" aria-labelledby="summary-h">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{summary?.isToday ? "Today" : summary ? `Latest · ${summary.date}` : "Daily summary"}</p>
              <h2 id="summary-h" className="display mt-1.5 text-2xl">{summary ? `${name}'s day` : "Waiting for the first chat"}</h2>
            </div>
            <RefreshSummaryButton />
          </div>
          {summary ? (
            <>
              <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--color-ink-soft)]">{summary.summary}</p>
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[var(--color-line)] pt-5">
                <Stat label="Mood" value={summary.mood ? MOOD_LABEL[summary.mood] : "—"} tone={summary.mood && summary.mood <= 2 ? "warn" : "good"} />
                <Stat label="Medicines" value={`${summary.medsTaken} taken`} sub={summary.medsMissed ? `${summary.medsMissed} missed` : "None missed"} tone={summary.medsMissed ? "warn" : undefined} />
                <Stat label="Talked about" value={<span className="text-base font-medium">{summary.topics.slice(0, 2).join(", ") || "—"}</span>} />
              </div>
              {summary.followUps.length > 0 && (
                <div className="mt-5 rounded-xl bg-[var(--color-sun-soft)] px-4 py-3 text-sm text-[#6b4705]">
                  <p className="font-semibold">To follow up</p>
                  <ul className="mt-1 list-disc pl-5">{summary.followUps.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
            </>
          ) : (
            <div className="mt-6"><Empty icon={<ChatCircleText size={30} />} title="No conversations yet" body={`Kinly will call ${name} at ${schedule[0]?.timeLocal ?? "the scheduled time"}, or you can call now.`} /></div>
          )}
        </section>

        {/* Talk about this */}
        <section className="card flex flex-col bg-[var(--color-clay-soft)]/60 p-6" aria-labelledby="talk-h">
          <div className="flex items-center gap-2 text-[var(--color-clay)]"><Lightbulb size={20} weight="fill" aria-hidden="true" /><p className="eyebrow !text-[var(--color-clay)]">Talk about this</p></div>
          <h2 id="talk-h" className="sr-only">Conversation ideas</h2>
          {summary?.talkAbout.length ? (
            <ul className="mt-4 space-y-4">
              {summary.talkAbout.slice(0, 3).map((t) => <li key={t} className="text-[0.97rem] leading-relaxed">{t}</li>)}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-muted)]">Ideas for your next call appear here as Kinly learns what {name} loves talking about.</p>
          )}
        </section>

        {/* Mood trend */}
        <section className="card p-6 lg:col-span-2" aria-labelledby="mood-h">
          <SectionTitle title="Mood, last 14 days" hint={t.avgMood ? `Mostly ${MOOD_LABEL[Math.round(t.avgMood)].toLowerCase()}` : undefined} />
          <h2 id="mood-h" className="sr-only">Mood trend</h2>
          <MoodChart data={t.series.map(({ day, mood }) => ({ day, mood }))} />
        </section>

        {/* Today: medicines & upcoming */}
        <section className="card p-6" aria-labelledby="today-h">
          <SectionTitle title="Today's medicines" action={<Link href="/dashboard/care" className="text-sm font-medium text-[var(--color-evergreen)] hover:underline">Care plan</Link>} />
          <h2 id="today-h" className="sr-only">Medicines today</h2>
          {doses.length ? (
            <ul className="space-y-2.5">
              {doses.map((d) => (
                <li key={d.medicine + d.time} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-evergreen-tint)] text-[var(--color-evergreen)]"><Pill size={17} aria-hidden="true" /></span>
                  <div className="flex-1"><p className="text-sm font-medium">{d.medicine} <span className="text-[var(--color-muted)]">{d.dosage}</span></p><p className="tabular text-xs text-[var(--color-muted)]">{d.time}</p></div>
                  <StatusChip status={d.status} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-[var(--color-muted)]">No medicines added.</p>}
          <div className="divider my-5" />
          <p className="mb-3 text-sm font-semibold">Coming up</p>
          <ul className="space-y-2.5 text-sm">
            {schedule.map((s) => (
              <li key={s.id} className="flex items-center gap-3"><Phone size={17} className="text-[var(--color-muted)]" aria-hidden="true" /><span className="flex-1">Check-in call</span><span className="tabular text-[var(--color-muted)]">{s.timeLocal} daily</span></li>
            ))}
            {appointments.map((a) => (
              <li key={a.id} className="flex items-center gap-3"><CalendarBlank size={17} className="text-[var(--color-muted)]" aria-hidden="true" /><span className="flex-1">{a.title}</span><span className="text-[var(--color-muted)]">{dayIn(a.startsAt, elder.timezone)}</span></li>
            ))}
          </ul>
        </section>

        {/* Adherence */}
        <section className="card p-6 lg:col-span-2" aria-labelledby="adh-h">
          <SectionTitle title="Medicine adherence" hint={t.adherence !== null ? `${t.adherence}% of doses confirmed in 14 days · ${t.missed} missed` : undefined} />
          <h2 id="adh-h" className="sr-only">Medicine adherence</h2>
          <AdherenceChart data={t.series.map(({ day, taken, missed }) => ({ day, taken, missed }))} />
          <div className="mt-3 flex gap-5 text-xs text-[var(--color-muted)]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-evergreen)]" aria-hidden="true" />Taken</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-clay)]" aria-hidden="true" />Missed</span>
          </div>
        </section>

        {/* Alerts */}
        <section className="card p-6" aria-labelledby="alerts-h">
          <SectionTitle title="Alerts" action={<Link href="/dashboard/alerts" className="text-sm font-medium text-[var(--color-evergreen)] hover:underline">All alerts</Link>} />
          <h2 id="alerts-h" className="sr-only">Recent alerts</h2>
          {alerts.length ? (
            <ul className="space-y-4">
              {alerts.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center gap-2"><SeverityChip severity={a.severity} /><StatusChip status={a.status} /><span className="ml-auto text-xs text-[var(--color-muted)]">{relative(a.createdAt)}</span></div>
                  <p className="mt-1.5 text-sm font-medium">{a.title}</p>
                  {a.status === "open" && <AlertActions id={a.id} />}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]"><ShieldCheck size={22} className="text-[var(--color-evergreen)]" aria-hidden="true" />No alerts. All calm.</div>
          )}
        </section>

        {/* Conversations */}
        <section className="card p-6 lg:col-span-3" aria-labelledby="conv-h">
          <SectionTitle title="Recent conversations" action={<Link href="/dashboard/conversations" className="text-sm font-medium text-[var(--color-evergreen)] hover:underline">See all</Link>} />
          <h2 id="conv-h" className="sr-only">Recent conversations</h2>
          {convos.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {convos.map((c) => (
                <li key={c.id}>
                  <Link href={`/dashboard/conversations/${c.id}`} className="block rounded-2xl border border-[var(--color-line)] p-4 transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-paper)]">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      {c.channel === "phone" ? <Phone size={14} aria-hidden="true" /> : <ChatCircleText size={14} aria-hidden="true" />}
                      <span className="capitalize">{c.channel === "phone" ? "Phone call" : "Screen chat"}</span>·<span>{dayIn(c.startedAt, elder.timezone)}, {timeIn(c.startedAt, elder.timezone)}</span>
                      {c.mood && <span className="ml-auto">{MOOD_LABEL[c.mood]}</span>}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed">{c.summary}</p>
                    <p className="mt-2 text-xs text-[var(--color-muted)]">{parseJson<string[]>(c.topics, []).join(" · ")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="No conversations yet" />}
        </section>
      </div>
    </>
  );
}
