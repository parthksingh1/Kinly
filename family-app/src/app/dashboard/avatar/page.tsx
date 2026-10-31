import { Info, ShieldCheck, Sparkle, Warning } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Locked, PageHeader, SectionTitle } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayIn, relative, timeIn } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { AvatarCard, CreateAvatar } from "./avatar-client";

export const metadata: Metadata = { title: "Family Avatar" };

export default async function AvatarPage() {
  const { elder, family, user, isOwner } = await requireContext();
  if (!hasFeature(family.plan, "family_avatar")) {
    return (<><PageHeader eyebrow="Family Avatar" title="Your voice, with your consent" /><Locked feature="Family Avatar" plan="Premium" /></>);
  }
  const [avatars, logs] = await Promise.all([
    db.familyAvatar.findMany({ where: { elderId: elder.id, status: { not: "revoked" } }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { elderId: elder.id, action: { startsWith: "avatar_" } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: [...new Set([...avatars.map((a) => a.userId), ...logs.map((l) => l.actorUserId ?? "")])] } } });
  const nameOf = (id?: string | null) => users.find((u) => u.id === id)?.name ?? "Kinly";
  const mine = avatars.find((a) => a.userId === user.id);

  return (
    <>
      <PageHeader eyebrow="Family Avatar · Premium" title={`Let ${elder.preferredName} hear a familiar voice`}
        description={`On some days, Kinly can speak with the consented AI voice of a family member, shown with their chosen photo in a frame marked “AI”. It always says it is an AI voice, and can never ask for money, codes or passwords.`} />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {[
          [ShieldCheck, "Only you can create yours", "The adult whose voice is used records a spoken consent from their own account. Nobody can make an avatar of someone else."],
          [Warning, "Not for everyone", `It may confuse people living with memory problems. The plan owner confirms it suits ${elder.preferredName}, and it is off by default.`],
          [Info, "Delete any time", "One click deletes the voice at the provider and every recording and photo. Every step is logged below."],
        ].map(([Icon, t, b]) => {
          const I = Icon as typeof ShieldCheck;
          return (
            <div key={t as string} className="card p-5">
              <I size={22} weight="duotone" className="text-[var(--color-evergreen)]" aria-hidden="true" />
              <p className="mt-3 font-semibold">{t as string}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{b as string}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          {avatars.map((a) => (
            <AvatarCard key={a.id} elderName={elder.preferredName} isOwner={isOwner} isSelf={a.userId === user.id}
              avatar={{
                id: a.id, displayName: a.displayName, relation: a.relation, photoUrl: a.photoPath ? `/api/media/${a.photoPath}` : null,
                consentAt: a.consentAt?.toISOString() ?? null, voiceReady: !!a.voiceId, ownerApproved: !!a.ownerApprovedAt,
                elderInformed: !!a.elderInformedAt, enabled: a.enabled, status: a.status, createdBy: nameOf(a.userId),
              }} />
          ))}
          {!mine && <CreateAvatar userName={user.name} elderName={elder.preferredName} />}
        </div>
        <section className="card h-fit p-6" aria-labelledby="audit-h">
          <SectionTitle title="Audit log" hint="Creation, consent, use and deletion." />
          <h2 id="audit-h" className="sr-only">Audit log</h2>
          {logs.length === 0 ? <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]"><Sparkle size={18} aria-hidden="true" />Nothing yet.</p> : (
            <ol className="space-y-3 text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-line-strong)]" aria-hidden="true" />
                  <div><p>{l.action.replace(/^avatar_/, "").replace(/_/g, " ")} <span className="text-[var(--color-muted)]">by {nameOf(l.actorUserId)}</span></p>
                    <p className="text-xs text-[var(--color-muted)]">{dayIn(l.createdAt, elder.timezone)}, {timeIn(l.createdAt, elder.timezone)} · {relative(l.createdAt)}</p></div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
