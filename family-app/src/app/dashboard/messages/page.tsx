import { Microphone } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Empty, Locked, Monogram, PageHeader, SectionTitle } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayIn, relative, timeIn } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { MessageComposer } from "./composer";

export const metadata: Metadata = { title: "Voice messages" };

export default async function MessagesPage() {
  const { elder, family } = await requireContext();
  if (!hasFeature(family.plan, "voice_messages")) {
    return (<><PageHeader eyebrow="Voice messages" title="Send your voice" /><Locked feature="Voice messages" plan="Family" /></>);
  }
  const messages = await db.voiceMessage.findMany({ where: { elderId: elder.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <PageHeader eyebrow="Voice messages" title={`Say something to ${elder.preferredName}`}
        description={`Kinly plays it at the start of ${elder.preferredName}'s next chat: “Riya sent you a message!” They can record a reply with one big button.`} />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card p-6" aria-labelledby="rec-h">
          <SectionTitle title="Record a message" hint="Up to a minute. Speak slowly and warmly." />
          <h2 id="rec-h" className="sr-only">Record</h2>
          <MessageComposer elderId={elder.id} />
        </section>
        <section className="card p-6" aria-labelledby="list-h">
          <SectionTitle title="Messages" />
          <h2 id="list-h" className="sr-only">All messages</h2>
          {messages.length === 0 ? <Empty icon={<Microphone size={28} />} title="No messages yet" /> : (
            <ul className="space-y-4">
              {messages.map((m) => (
                <li key={m.id} className="flex gap-3">
                  <Monogram name={m.fromName} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><b className="font-semibold">{m.fromName}</b>
                      <span className="text-[var(--color-muted)]"> {m.direction === "from_elder" ? "replied" : `to ${elder.preferredName}`} · {dayIn(m.createdAt, elder.timezone)}, {timeIn(m.createdAt, elder.timezone)}</span></p>
                    <audio controls preload="none" src={`/api/media/${m.audioPath}`} className="mt-2 w-full" />
                    {m.transcript && <p className="mt-1.5 text-sm italic text-[var(--color-ink-soft)]">“{m.transcript}”</p>}
                    {m.direction === "to_elder" && (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">{m.playedAt ? `Heard by ${elder.preferredName} ${relative(m.playedAt)}` : "Not played yet"}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
