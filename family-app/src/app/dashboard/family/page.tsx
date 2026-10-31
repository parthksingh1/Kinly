import { Crown, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { Monogram, PageHeader, SectionTitle } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { relative } from "@/lib/format";
import { MEMBER_LIMIT, type PlanId } from "@/lib/plans";
import { inviteMember, removeMember, updateMyNotifications } from "../actions";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage() {
  const { family, membership, isOwner, user } = await requireContext();
  const [members, invites] = await Promise.all([
    db.familyMember.findMany({ where: { familyId: family.id }, include: { user: true }, orderBy: [{ role: "desc" }, { createdAt: "asc" }] }),
    db.invite.findMany({ where: { familyId: family.id, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const limit = MEMBER_LIMIT[family.plan as PlanId] ?? 2;
  return (
    <>
      <PageHeader eyebrow="Family" title={family.name}
        description={`Everyone here gets summaries and alerts. ${members.length + invites.length} of ${limit} places used on your plan.`} />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-6" aria-labelledby="members-h">
          <SectionTitle title="Members" />
          <h2 id="members-h" className="sr-only">Members</h2>
          <ul className="divide-y divide-[var(--color-line)]">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Monogram name={m.user.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">{m.user.name}{m.user.id === user.id && <span className="text-xs font-normal text-[var(--color-muted)]">(you)</span>}</p>
                  <p className="truncate text-sm text-[var(--color-muted)]">{m.relation || "Family"} · {m.user.email}</p>
                </div>
                {m.role === "owner" ? <span className="chip chip-ok"><Crown size={13} weight="fill" aria-hidden="true" />Owner</span> : <span className="chip chip-neutral">Member</span>}
                {isOwner && m.role !== "owner" && <ConfirmButton action={removeMember.bind(null, m.id)} confirm={`Remove ${m.user.name} from the family?`} label="Remove" />}
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[var(--color-line-strong)] text-[var(--color-muted)]"><EnvelopeSimple size={18} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.email}</p>
                  <p className="text-sm text-[var(--color-muted)]">Invited {relative(i.createdAt)} · link: <code className="font-mono text-xs">/invite/{i.token}</code></p>
                </div>
                <span className="chip chip-info">Pending</span>
              </li>
            ))}
          </ul>
          {isOwner && (
            <ActionForm action={inviteMember} submit="Send invite" submitClass="btn btn-secondary btn-sm" className="mt-5 grid gap-3 rounded-2xl bg-[var(--color-paper)] p-4 sm:grid-cols-2">
              <div><label className="field-label" htmlFor="inv-email">Email</label><input id="inv-email" name="email" type="email" className="input" required /></div>
              <div><label className="field-label" htmlFor="inv-rel">Relation</label><input id="inv-rel" name="relation" className="input" placeholder="Daughter" /></div>
            </ActionForm>
          )}
        </section>
        <section className="card p-6" aria-labelledby="me-h">
          <SectionTitle title="How you hear from Kinly" />
          <h2 id="me-h" className="sr-only">Your notifications</h2>
          <ActionForm action={updateMyNotifications} submit="Save" resetOnSuccess={false} className="space-y-4">
            <div><label className="field-label" htmlFor="my-rel">Your relation</label><input id="my-rel" name="relation" defaultValue={membership.relation} className="input" /></div>
            <div><label className="field-label" htmlFor="my-phone">WhatsApp number</label><input id="my-phone" name="phone" type="tel" defaultValue={membership.phone} className="input" placeholder="+91…" /></div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="notifyWhatsapp" defaultChecked={membership.notifyWhatsapp} className="h-4 w-4 accent-[var(--color-evergreen)]" />WhatsApp for alerts and summaries</label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="notifyEmail" defaultChecked={membership.notifyEmail} className="h-4 w-4 accent-[var(--color-evergreen)]" />Email for alerts and summaries</label>
            <p className="field-help">Urgent alerts always go out on every channel you enable.</p>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
