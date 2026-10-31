import { ArrowLeft, LockSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { LANGUAGE_NAMES, MOOD_LABEL, dayIn, duration, parseJson, timeIn } from "@/lib/format";

type Turn = { role: "user" | "assistant"; text: string; private?: boolean };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { elder } = await requireContext();
  const c = await db.conversation.findFirst({ where: { id, elderId: elder.id } });
  if (!c) notFound();
  const turns = parseJson<Turn[]>(c.transcript, []);
  let hiddenRun = 0;
  const rows: (Turn | { hidden: number })[] = [];
  for (const t of turns) {
    if (t.private) { hiddenRun++; continue; }
    if (hiddenRun) { rows.push({ hidden: hiddenRun }); hiddenRun = 0; }
    rows.push(t);
  }
  if (hiddenRun) rows.push({ hidden: hiddenRun });

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/conversations" className="btn btn-ghost btn-sm -ml-3 mb-4"><ArrowLeft size={16} aria-hidden="true" />All conversations</Link>
      <p className="eyebrow">{c.channel === "phone" ? "Phone call" : "Screen chat"} · {dayIn(c.startedAt, elder.timezone)}, {timeIn(c.startedAt, elder.timezone)}</p>
      <h1 className="display mt-2 text-3xl">{c.summary ? c.summary.split(". ")[0] + "." : "Conversation"}</h1>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {c.mood && <span className="chip chip-ok">Mood: {MOOD_LABEL[c.mood]}</span>}
        <span className="chip chip-neutral">{duration(c.durationSec)}</span>
        <span className="chip chip-neutral">{(c.languagesUsed || c.language).split(",").map((l) => LANGUAGE_NAMES[l] ?? l).join(", ")}</span>
        {parseJson<string[]>(c.topics, []).map((t) => <span key={t} className="chip chip-info">{t}</span>)}
      </div>
      {c.summary && <p className="mt-6 text-[1.02rem] leading-relaxed text-[var(--color-ink-soft)]">{c.summary}</p>}
      <div className="card mt-8 space-y-3 p-5 sm:p-6">
        {rows.map((r, i) =>
          "hidden" in r ? (
            <p key={i} className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--color-muted)]"><LockSimple size={14} aria-hidden="true" />{elder.preferredName} asked to keep {r.hidden > 1 ? "a few lines" : "this"} between them and Kinly</p>
          ) : (
            <div key={i} className={r.role === "user" ? "flex justify-end" : "flex"}>
              <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed ${r.role === "user" ? "rounded-tr-sm bg-[var(--color-linen)]" : "rounded-tl-sm bg-[var(--color-evergreen-tint)]"}`}>
                <span className="sr-only">{r.role === "user" ? elder.preferredName : "Kinly"}: </span>{r.text}
              </p>
            </div>
          ),
        )}
        {rows.length === 0 && <p className="text-sm text-[var(--color-muted)]">No transcript.</p>}
      </div>
    </div>
  );
}
