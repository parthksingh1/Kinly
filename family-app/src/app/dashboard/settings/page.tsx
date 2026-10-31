import { DeviceTablet, LockSimple, SealCheck, Warning } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { PageHeader, SectionTitle } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { LANGUAGE_NAMES, dayIn, timeIn } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { resetConsent, rotateScreenLink, updateElder } from "../actions";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Settings" };

const ZONES = ["Asia/Kolkata", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Mexico_City", "Europe/London", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"];

export default async function SettingsPage() {
  const { elder, family, isOwner } = await requireContext();
  const h = await headers();
  const origin = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const screenUrl = `${origin}/screen/${elder.screenToken}`;
  const langs = elder.languages.split(",");
  return (
    <>
      <PageHeader eyebrow="Settings" title={`About ${elder.preferredName}`} />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-6" aria-labelledby="profile-h">
          <SectionTitle title="Profile" hint="Kinly uses this to speak with them the way they like." />
          <h2 id="profile-h" className="sr-only">Profile</h2>
          <ActionForm action={updateElder} submit="Save changes" resetOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="s-name">Full name</label><input id="s-name" name="name" defaultValue={elder.name} className="input" required /></div>
            <div><label className="field-label" htmlFor="s-pref">Kinly calls them</label><input id="s-pref" name="preferredName" defaultValue={elder.preferredName} className="input" required /></div>
            <div><label className="field-label" htmlFor="s-age">Age</label><input id="s-age" name="age" inputMode="numeric" defaultValue={elder.age ?? ""} className="input" /></div>
            <div><label className="field-label" htmlFor="s-gender">Address them</label>
              <select id="s-gender" name="gender" defaultValue={elder.gender} className="input"><option value="">Neutral</option><option value="female">As a woman</option><option value="male">As a man</option></select></div>
            <div><label className="field-label" htmlFor="s-phone">Phone</label><input id="s-phone" name="phone" type="tel" defaultValue={elder.phone} className="input" /></div>
            <div><label className="field-label" htmlFor="s-tz">Time zone</label><select id="s-tz" name="timezone" defaultValue={elder.timezone} className="input">{[...new Set([elder.timezone, ...ZONES])].map((z) => <option key={z}>{z}</option>)}</select></div>
            <div><label className="field-label" htmlFor="s-city">City</label><input id="s-city" name="city" defaultValue={elder.city} className="input" /></div>
            <div><label className="field-label" htmlFor="s-em">Emergency number</label><input id="s-em" name="emergencyNumber" defaultValue={elder.emergencyNumber} className="input" /></div>
            <fieldset className="sm:col-span-2">
              <legend className="field-label">Languages</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {Object.entries(LANGUAGE_NAMES).slice(0, 11).map(([code, label]) => (
                  <label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" name="languages" value={code} defaultChecked={langs.includes(code)} className="h-4 w-4 accent-[var(--color-evergreen)]" />{label}</label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2"><label className="field-label" htmlFor="s-about">Things Kinly should know</label><textarea id="s-about" name="about" rows={4} defaultValue={elder.about} className="input" /></div>
          </ActionForm>
        </section>

        <div className="space-y-5">
          <section id="screen" className="card p-6" aria-labelledby="screen-h">
            <SectionTitle title="Screen companion" />
            <h2 id="screen-h" className="sr-only">Screen companion</h2>
            {hasFeature(family.plan, "screen") ? (
              <>
                <div className="flex items-start gap-3 text-sm text-[var(--color-ink-soft)]">
                  <DeviceTablet size={22} className="mt-0.5 shrink-0 text-[var(--color-evergreen)]" aria-hidden="true" />
                  <p>Open this link once on {elder.preferredName}&apos;s tablet or TV browser and add it to the home screen. It stays signed in, with big buttons to talk, call family, hear messages and check medicines.</p>
                </div>
                <CopyLink url={screenUrl} />
                {isOwner && <ConfirmButton action={rotateScreenLink} confirm="Create a new link? The old one stops working." label="Create a new link" className="btn btn-ghost btn-sm mt-2" />}
              </>
            ) : <p className="text-sm text-[var(--color-muted)]">The screen companion is part of the Family plan.</p>}
          </section>

          <section className="card p-6" aria-labelledby="consent-h">
            <SectionTitle title={`${elder.preferredName}'s consent`} />
            <h2 id="consent-h" className="sr-only">Consent</h2>
            {elder.consentStatus === "granted" ? (
              <div className="text-sm">
                <p className="flex items-center gap-2 font-medium text-[var(--color-evergreen)]"><SealCheck size={20} weight="fill" aria-hidden="true" />Agreed on {elder.consentAt ? `${dayIn(elder.consentAt, elder.timezone)}, ${timeIn(elder.consentAt, elder.timezone)}` : "—"} by {elder.consentChannel}</p>
                {elder.consentTranscript && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[var(--color-paper)] p-3 font-sans text-xs leading-relaxed text-[var(--color-ink-soft)]">{elder.consentTranscript}</pre>}
              </div>
            ) : elder.consentStatus === "declined" ? (
              <p className="flex items-start gap-2 text-sm text-[var(--color-danger)]"><Warning size={20} className="shrink-0" aria-hidden="true" />{elder.preferredName} said no. Kinly will not call. You can ask again after talking with them.</p>
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">Waiting for the first conversation. Kinly will explain what it is, that it is an AI, and what is shared with family, then ask for {elder.preferredName}&apos;s agreement. Regular check-ins start only after a yes.</p>
            )}
            {isOwner && elder.consentStatus !== "pending" && <ConfirmButton action={resetConsent} confirm="Ask for consent again on the next conversation?" label="Ask again next time" className="btn btn-ghost btn-sm mt-3" />}
          </section>

          <section className="card p-6" aria-labelledby="priv-h">
            <SectionTitle title="What the family sees" />
            <h2 id="priv-h" className="sr-only">Privacy</h2>
            <ul className="space-y-3 text-sm text-[var(--color-ink-soft)]">
              <li className="flex gap-2"><LockSimple size={18} className="mt-0.5 shrink-0" aria-hidden="true" />If {elder.preferredName} says “keep this between us”, those words are left out of summaries, transcripts and the Memory Book.</li>
              <li className="flex gap-2"><Warning size={18} className="mt-0.5 shrink-0" aria-hidden="true" />Safety is the exception: falls, chest pain, breathing trouble, confusion, self-harm and scams are always shared. {elder.preferredName} is told this when they agree to use Kinly.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
