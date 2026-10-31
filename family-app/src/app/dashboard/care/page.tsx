import { CalendarBlank, Phone, Pill, Star, Trash, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { Monogram, PageHeader, SectionTitle } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayIn, timeIn } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { addAppointment, addContact, addMedicine, removeAppointment, removeContact, removeMedicine, saveSchedule } from "../actions";

export const metadata: Metadata = { title: "Care plan" };

export default async function CarePage() {
  const { elder, family } = await requireContext();
  const [meds, schedule, appts, contacts] = await Promise.all([
    db.medicine.findMany({ where: { elderId: elder.id, active: true }, orderBy: { createdAt: "asc" } }),
    db.callSchedule.findMany({ where: { elderId: elder.id }, orderBy: { timeLocal: "asc" } }),
    db.appointment.findMany({ where: { elderId: elder.id, startsAt: { gte: new Date(Date.now() - 86400000) } }, orderBy: { startsAt: "asc" } }),
    db.contact.findMany({ where: { elderId: elder.id }, orderBy: [{ isEmergency: "desc" }, { name: "asc" }] }),
  ]);
  const multi = hasFeature(family.plan, "multi_calls");
  const times = [...schedule.map((s) => s.timeLocal), ...Array(Math.max(0, (multi ? 3 : 1) - schedule.length)).fill("")].slice(0, multi ? 3 : 1);

  return (
    <>
      <PageHeader eyebrow="Care plan" title={`${elder.preferredName}'s routine`}
        description={`Times are in ${elder.preferredName}'s time zone (${elder.timezone}). Kinly reminds, asks for a simple confirmation, and tells you if doses are missed twice in a row.`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="meds-h">
          <SectionTitle title="Medicines" />
          <h2 id="meds-h" className="sr-only">Medicines</h2>
          <ul className="mb-5 divide-y divide-[var(--color-line)]">
            {meds.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-evergreen-tint)] text-[var(--color-evergreen)]"><Pill size={19} aria-hidden="true" /></span>
                <div className="flex-1">
                  <p className="font-medium">{m.name} <span className="font-normal text-[var(--color-muted)]">{m.dosage}</span></p>
                  <p className="tabular text-sm text-[var(--color-muted)]">{m.times.split(",").join(" · ")}{m.instructions && ` · ${m.instructions}`}</p>
                </div>
                <ConfirmButton action={removeMedicine.bind(null, m.id)} confirm={`Remove ${m.name}?`} label={<Trash size={17} aria-label={`Remove ${m.name}`} />} />
              </li>
            ))}
            {meds.length === 0 && <li className="py-3 text-sm text-[var(--color-muted)]">No medicines yet.</li>}
          </ul>
          <ActionForm action={addMedicine} submit="Add medicine" submitClass="btn btn-secondary btn-sm" className="rounded-2xl bg-[var(--color-paper)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="field-label" htmlFor="m-name">Name</label><input id="m-name" name="name" className="input" required /></div>
              <div><label className="field-label" htmlFor="m-dose">Dosage</label><input id="m-dose" name="dosage" className="input" placeholder="5 mg" /></div>
              <div><label className="field-label" htmlFor="m-times">Times</label><input id="m-times" name="times" className="input" placeholder="09:00,21:00" required /></div>
              <div><label className="field-label" htmlFor="m-ins">Instructions</label><input id="m-ins" name="instructions" className="input" placeholder="After food" /></div>
            </div>
          </ActionForm>
        </section>

        <div className="space-y-5">
          <section className="card p-6" aria-labelledby="calls-h">
            <SectionTitle title="Daily check-in calls" hint={multi ? "Premium: up to 3 calls a day." : "Your plan includes one call a day."} />
            <h2 id="calls-h" className="sr-only">Call times</h2>
            <ActionForm action={saveSchedule} submit="Save call times" submitClass="btn btn-secondary btn-sm" resetOnSuccess={false}>
              <div className="flex flex-wrap gap-3">
                {times.map((t, i) => (
                  <div key={i}>
                    <label className="field-label" htmlFor={`t${i}`}><Phone size={14} className="mr-1 inline" aria-hidden="true" />Call {i + 1}</label>
                    <input id={`t${i}`} type="time" name="time" defaultValue={t} className="input w-36" />
                  </div>
                ))}
              </div>
              <input type="hidden" name="days" value="daily" />
              <p className="field-help">If {elder.preferredName} doesn&apos;t answer, Kinly tries again twice, then lets you know.</p>
            </ActionForm>
          </section>

          <section className="card p-6" aria-labelledby="appt-h">
            <SectionTitle title="Appointments" />
            <h2 id="appt-h" className="sr-only">Appointments</h2>
            <ul className="mb-4 space-y-2.5">
              {appts.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <CalendarBlank size={19} className="text-[var(--color-muted)]" aria-hidden="true" />
                  <div className="flex-1"><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-[var(--color-muted)]">{dayIn(a.startsAt, elder.timezone)}, {timeIn(a.startsAt, elder.timezone)}{a.location && ` · ${a.location}`}</p></div>
                  <ConfirmButton action={removeAppointment.bind(null, a.id)} confirm="Remove this appointment?" label={<Trash size={17} aria-label="Remove appointment" />} />
                </li>
              ))}
              {appts.length === 0 && <li className="text-sm text-[var(--color-muted)]">No upcoming appointments.</li>}
            </ul>
            <ActionForm action={addAppointment} submit="Add appointment" submitClass="btn btn-secondary btn-sm" className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="field-label" htmlFor="a-title">What</label><input id="a-title" name="title" className="input" placeholder="Eye check-up with Dr. Rao" required /></div>
              <div><label className="field-label" htmlFor="a-when">When</label><input id="a-when" name="startsAt" type="datetime-local" className="input" required /></div>
              <div><label className="field-label" htmlFor="a-where">Where</label><input id="a-where" name="location" className="input" /></div>
            </ActionForm>
          </section>
        </div>

        <section className="card p-6 lg:col-span-2" aria-labelledby="contacts-h">
          <SectionTitle title="People they can call" hint={`Shown as big buttons on ${elder.preferredName}'s screen. They can also say “Call Riya”.`} />
          <h2 id="contacts-h" className="sr-only">Contacts</h2>
          <ul className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] p-3">
                <Monogram name={c.name} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">{c.name}{c.isEmergency && <Star size={14} weight="fill" className="text-[var(--color-clay)]" aria-label="Emergency contact" />}</p>
                  <p className="truncate text-xs text-[var(--color-muted)]">{c.relation || "Contact"}{c.userId && " · on Kinly"}</p>
                </div>
                <ConfirmButton action={removeContact.bind(null, c.id)} confirm={`Remove ${c.name}?`} label={<Trash size={17} aria-label={`Remove ${c.name}`} />} />
              </li>
            ))}
            {contacts.length === 0 && <li className="flex items-center gap-2 text-sm text-[var(--color-muted)]"><UserCircle size={20} aria-hidden="true" />No contacts yet.</li>}
          </ul>
          <ActionForm action={addContact} submit="Add person" submitClass="btn btn-secondary btn-sm" className="grid gap-3 rounded-2xl bg-[var(--color-paper)] p-4 sm:grid-cols-4">
            <div><label className="field-label" htmlFor="c-name">Name</label><input id="c-name" name="name" className="input" required /></div>
            <div><label className="field-label" htmlFor="c-rel">Relation</label><input id="c-rel" name="relation" className="input" placeholder="Daughter" /></div>
            <div><label className="field-label" htmlFor="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" className="input" /></div>
            <div><label className="field-label" htmlFor="c-email">Email (for call links)</label><input id="c-email" name="email" type="email" className="input" /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" name="isEmergency" className="h-4 w-4 accent-[var(--color-evergreen)]" /> Emergency contact (named in urgent moments)</label>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
