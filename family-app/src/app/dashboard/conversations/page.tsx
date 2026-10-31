import { ChatCircleText, Phone } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader, StatusChip } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { LANGUAGE_NAMES, MOOD_LABEL, dayIn, duration, parseJson, timeIn } from "@/lib/format";

export const metadata: Metadata = { title: "Conversations" };

export default async function ConversationsPage() {
  const { elder } = await requireContext();
  const [convos, calls] = await Promise.all([
    db.conversation.findMany({ where: { elderId: elder.id }, orderBy: { startedAt: "desc" }, take: 60 }),
    db.phoneCall.findMany({ where: { elderId: elder.id, status: { in: ["no-answer", "busy", "failed"] } }, orderBy: { scheduledFor: "desc" }, take: 10 }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Conversations" title={`Talks with ${elder.preferredName}`}
        description="Summaries of every phone call and screen chat. Anything they asked to keep private is not shown, and safety is always shared." />
      {convos.length === 0 && calls.length === 0 ? <Empty title="No conversations yet" body="They will appear here after the first call." /> : (
        <div className="card divide-y divide-[var(--color-line)]">
          {convos.map((c) => (
            <Link key={c.id} href={`/dashboard/conversations/${c.id}`} className="flex flex-col gap-2 p-5 transition-colors hover:bg-[var(--color-paper)] sm:flex-row sm:items-start sm:gap-5">
              <div className="flex w-40 shrink-0 items-center gap-2 text-sm text-[var(--color-muted)]">
                {c.channel === "phone" ? <Phone size={16} aria-hidden="true" /> : <ChatCircleText size={16} aria-hidden="true" />}
                <span>{dayIn(c.startedAt, elder.timezone)}<br /><span className="text-xs">{timeIn(c.startedAt, elder.timezone)} · {duration(c.durationSec)}</span></span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] leading-relaxed">{c.summary || (c.processed ? "No summary." : "In progress…")}</p>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  {[c.mood ? `Mood: ${MOOD_LABEL[c.mood]}` : null, LANGUAGE_NAMES[c.language] ?? c.language, ...parseJson<string[]>(c.topics, [])].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
          {calls.map((c) => (
            <div key={c.id} className="flex items-center gap-5 p-5 text-sm">
              <div className="flex w-40 items-center gap-2 text-[var(--color-muted)]"><Phone size={16} aria-hidden="true" />{dayIn(c.scheduledFor, elder.timezone)}</div>
              <p className="flex-1 text-[var(--color-ink-soft)]">Scheduled check-in call, {c.attempt} attempt{c.attempt > 1 ? "s" : ""}</p>
              <StatusChip status={c.status} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
