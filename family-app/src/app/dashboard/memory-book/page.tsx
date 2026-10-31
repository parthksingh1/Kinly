import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Empty, Locked, PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { toggleChapter } from "../actions";
import { BookActions } from "./book-actions";

export const metadata: Metadata = { title: "Memory Book" };

export default async function MemoryBookPage() {
  const { elder, family } = await requireContext();
  if (!hasFeature(family.plan, "memory_book")) {
    return (<><PageHeader eyebrow="Memory Book" title="Their stories, kept" /><Locked feature="The Memory Book" plan="Family" /></>);
  }
  const chapters = await db.memoryBookChapter.findMany({ where: { elderId: elder.id }, orderBy: { createdAt: "asc" } });
  const visible = chapters.filter((c) => !c.hidden);
  return (
    <>
      <div className="no-print">
        <PageHeader eyebrow="Memory Book" title={`The life of ${elder.name}`}
          description={`Written from the stories ${elder.preferredName} chose to share with Kinly. Anything they asked to keep private is never included.`}
          actions={<BookActions />} />
      </div>
      {chapters.length === 0 ? (
        <Empty icon={<BookOpenText size={30} />} title="The first chapter is waiting" body={`As ${elder.preferredName} shares stories in conversation, Kinly turns them into chapters. Try “Write new chapters” after a few chats.`} />
      ) : (
        <article className="mx-auto max-w-[680px] rounded-[6px] bg-[#fffdf8] px-7 py-12 shadow-[var(--shadow-lift)] sm:px-14 sm:py-16 print:max-w-none print:shadow-none">
          <header className="mb-14 text-center">
            <p className="eyebrow">A Memory Book</p>
            <h2 className="display mt-4 text-5xl">{elder.name}</h2>
            <p className="mt-4 font-[family-name:var(--font-serif)] text-lg italic text-[var(--color-muted)]">as told to Kinly, for the family</p>
          </header>
          {visible.map((c, i) => (
            <section key={c.id} className="mb-14 break-inside-avoid">
              <p className="eyebrow text-center">Chapter {i + 1}{c.era && ` · ${c.era}`}</p>
              <h3 className="display mt-3 text-center text-3xl">{c.title}</h3>
              <div className="mx-auto my-6 h-px w-16 bg-[var(--color-clay)]" aria-hidden="true" />
              {c.body.split(/\n\s*\n/).map((p, j) => (
                <p key={j} className={`mb-5 font-[family-name:var(--font-serif)] text-[1.18rem] leading-[1.75] text-[var(--color-ink)] ${j === 0 ? "first-letter:float-left first-letter:mr-2 first-letter:font-[family-name:var(--font-serif)] first-letter:text-[3.4rem] first-letter:leading-[0.9] first-letter:text-[var(--color-evergreen)]" : ""}`}>{p}</p>
              ))}
              <form action={toggleChapter.bind(null, c.id, true)} className="no-print text-center"><button className="btn btn-ghost btn-sm text-[var(--color-muted)]">Hide this chapter</button></form>
            </section>
          ))}
          {chapters.some((c) => c.hidden) && (
            <div className="no-print border-t border-[var(--color-line)] pt-6">
              <p className="mb-2 text-sm font-semibold">Hidden chapters</p>
              <ul className="space-y-1">
                {chapters.filter((c) => c.hidden).map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm"><span>{c.title}</span><form action={toggleChapter.bind(null, c.id, false)}><button className="btn btn-ghost btn-sm">Show</button></form></li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </>
  );
}
