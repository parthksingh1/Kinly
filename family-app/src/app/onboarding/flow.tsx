"use client";

import { ArrowLeft, ArrowRight, Check, Plus, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { useState, useTransition } from "react";
import { completeOnboarding, type OnboardingPayload } from "./actions";

const LANGS: [string, string][] = [["en", "English"], ["hi", "Hindi"], ["es", "Spanish"], ["bn", "Bengali"], ["ta", "Tamil"], ["te", "Telugu"], ["mr", "Marathi"], ["gu", "Gujarati"], ["kn", "Kannada"], ["ml", "Malayalam"], ["pa", "Punjabi"]];
const ZONES = ["Asia/Kolkata", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Mexico_City", "Europe/London", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"];
const STEPS = ["About them", "Care", "Family", "Plan"];

type Plan = { id: string; name: string; tagline: string; bullets: string[] };

export function OnboardingFlow({ userName, plans, prices, initialPlan, initialCurrency, stripeConfigured }: {
  userName: string; plans: Plan[]; prices: Record<"USD" | "INR", Record<string, string>>;
  initialPlan: "trial" | "care" | "family" | "premium"; initialCurrency: "USD" | "INR"; stripeConfigured: boolean;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [elder, setElder] = useState({ name: "", preferredName: "", age: "", gender: "" as "" | "female" | "male", languages: ["en"], phone: "", timezone: "Asia/Kolkata", city: "", about: "", emergencyNumber: "112" });
  const [meds, setMeds] = useState([{ name: "", dosage: "", times: "09:00" }]);
  const [callTime, setCallTime] = useState("10:00");
  const [me, setMe] = useState({ relation: "", phone: "" });
  const [invites, setInvites] = useState("");
  const [plan, setPlan] = useState(initialPlan);
  const [currency, setCurrency] = useState(initialCurrency);

  const first = userName.split(" ")[0];
  const them = elder.preferredName || "them";
  const canNext = step === 0 ? elder.name.trim().length > 1 && elder.preferredName.trim() && elder.languages.length > 0 : true;

  function submit() {
    setError("");
    const payload: OnboardingPayload = {
      elder: { ...elder, age: elder.age as unknown as number },
      medicines: meds.filter((m) => m.name.trim()),
      callTime, me,
      invites: invites.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
      plan, currency,
    };
    start(async () => {
      const res = await completeOnboarding(payload);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div>
      <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className={clsx("h-1.5 rounded-full transition-colors", i <= step ? "bg-[var(--color-evergreen)]" : "bg-[var(--color-line)]")} />
            <p className={clsx("mt-2 text-xs font-medium", i === step ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]")}>{s}</p>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="animate-rise">
          <h1 className="display text-4xl">Hello {first}. Who will Kinly keep company?</h1>
          <p className="mt-2 text-[var(--color-muted)]">Kinly uses this to talk to them the way they like to be spoken to.</p>
          <div className="card mt-8 grid gap-5 p-6 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="name">Full name</label><input id="name" className="input" value={elder.name} onChange={(e) => setElder({ ...elder, name: e.target.value })} placeholder="Kamala Sharma" /></div>
            <div><label className="field-label" htmlFor="pref">What should Kinly call them?</label><input id="pref" className="input" value={elder.preferredName} onChange={(e) => setElder({ ...elder, preferredName: e.target.value })} placeholder="Kamala ji, Mom, Papa…" /></div>
            <div><label className="field-label" htmlFor="age">Age <span className="font-normal text-[var(--color-muted)]">(optional)</span></label><input id="age" inputMode="numeric" className="input" value={elder.age} onChange={(e) => setElder({ ...elder, age: e.target.value.replace(/\D/g, "") })} /></div>
            <div>
              <label className="field-label" htmlFor="gender">How should Kinly address them?</label>
              <select id="gender" className="input" value={elder.gender} onChange={(e) => setElder({ ...elder, gender: e.target.value as "" })}>
                <option value="">Prefer not to say</option><option value="female">As a woman</option><option value="male">As a man</option>
              </select>
              <p className="field-help">Some languages, like Hindi, change words for this.</p>
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="field-label">Languages they speak <span className="font-normal text-[var(--color-muted)]">(first one is their favourite)</span></legend>
              <div className="flex flex-wrap gap-2">
                {LANGS.map(([code, label]) => {
                  const on = elder.languages.includes(code);
                  return (
                    <button key={code} type="button" aria-pressed={on}
                      onClick={() => setElder({ ...elder, languages: on ? elder.languages.filter((l) => l !== code) : [...elder.languages, code] })}
                      className={clsx("min-h-10 rounded-full border px-4 text-sm font-medium transition-colors", on ? "border-[var(--color-evergreen)] bg-[var(--color-evergreen-tint)] text-[var(--color-evergreen-deep)]" : "border-[var(--color-line-strong)] bg-white hover:border-[var(--color-ink-soft)]")}>
                      {on && <Check size={14} weight="bold" className="-ml-1 mr-1 inline" aria-hidden="true" />}{label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div><label className="field-label" htmlFor="phone">Their phone number</label><input id="phone" type="tel" className="input" value={elder.phone} onChange={(e) => setElder({ ...elder, phone: e.target.value })} placeholder="+91 98xxx xxxxx" /><p className="field-help">Kinly calls this number. Include the country code.</p></div>
            <div>
              <label className="field-label" htmlFor="tz">Their time zone</label>
              <select id="tz" className="input" value={elder.timezone} onChange={(e) => setElder({ ...elder, timezone: e.target.value })}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select>
            </div>
            <div><label className="field-label" htmlFor="city">City</label><input id="city" className="input" value={elder.city} onChange={(e) => setElder({ ...elder, city: e.target.value })} /></div>
            <div><label className="field-label" htmlFor="emerg">Local emergency number</label><input id="emerg" className="input" value={elder.emergencyNumber} onChange={(e) => setElder({ ...elder, emergencyNumber: e.target.value })} /><p className="field-help">112 in India, 911 in the US.</p></div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="about">What do they love? Anything Kinly should know?</label>
              <textarea id="about" rows={3} className="input" value={elder.about} onChange={(e) => setElder({ ...elder, about: e.target.value })} placeholder="Loves her terrace garden and old Bollywood songs. Morning walk at 7. Knee pain on cold days." />
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="animate-rise">
          <h1 className="display text-4xl">Daily call and medicines</h1>
          <p className="mt-2 text-[var(--color-muted)]">Kinly calls {them} every day at this time, in their time zone, and gently checks on medicines.</p>
          <div className="card mt-8 space-y-6 p-6">
            <div className="max-w-xs"><label className="field-label" htmlFor="call">Daily check-in call</label><input id="call" type="time" className="input" value={callTime} onChange={(e) => setCallTime(e.target.value)} /></div>
            <div className="divider" />
            <fieldset>
              <legend className="field-label">Medicines</legend>
              <div className="space-y-3">
                {meds.map((m, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1fr_auto]">
                    <input aria-label="Medicine name" className="input" placeholder="Amlodipine" value={m.name} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <input aria-label="Dosage" className="input" placeholder="5 mg" value={m.dosage} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, dosage: e.target.value } : x))} />
                    <input aria-label="Times, comma separated" className="input" placeholder="09:00, 21:00" value={m.times} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, times: e.target.value.replace(/\s/g, "") } : x))} />
                    <button type="button" className="btn btn-ghost" aria-label="Remove medicine" onClick={() => setMeds(meds.filter((_, j) => j !== i))}><Trash size={18} /></button>
                  </div>
                ))}
              </div>
              <p className="field-help">Times in 24-hour format, separated by commas.</p>
              <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => setMeds([...meds, { name: "", dosage: "", times: "09:00" }])}><Plus size={16} /> Add a medicine</button>
            </fieldset>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="animate-rise">
          <h1 className="display text-4xl">Who should hear from Kinly?</h1>
          <p className="mt-2 text-[var(--color-muted)]">Summaries and alerts go to the family. Each person chooses WhatsApp, email or both.</p>
          <div className="card mt-8 grid gap-5 p-6 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="rel">You are their…</label><input id="rel" className="input" placeholder="Son, daughter, grandson…" value={me.relation} onChange={(e) => setMe({ ...me, relation: e.target.value })} /></div>
            <div><label className="field-label" htmlFor="myphone">Your WhatsApp number</label><input id="myphone" type="tel" className="input" placeholder="+91…" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="inv">Invite family members <span className="font-normal text-[var(--color-muted)]">(optional)</span></label>
              <input id="inv" className="input" placeholder="riya@example.com, priya@example.com" value={invites} onChange={(e) => setInvites(e.target.value)} />
              <p className="field-help">They get a link to join. You can do this later too.</p>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="animate-rise">
          <h1 className="display text-4xl">Choose a plan</h1>
          <p className="mt-2 text-[var(--color-muted)]">Start with the free trial, or pick a plan now. {stripeConfigured ? "Payments are processed securely by Stripe." : "Your plan starts right away."}</p>
          <div className="mt-6 flex gap-2">
            {(["USD", "INR"] as const).map((c) => (
              <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)} className={clsx("btn btn-sm", currency === c ? "btn-primary" : "btn-secondary")}>{c === "USD" ? "US $" : "India ₹"}</button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Plan" className="mt-6 grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} onClick={() => setPlan(p.id as typeof plan)}
                className={clsx("card p-5 text-left transition-[border-color,box-shadow]", plan === p.id ? "!border-[var(--color-evergreen)] ring-2 ring-[var(--color-evergreen-soft)]" : "hover:!border-[var(--color-line-strong)]")}>
                <div className="flex items-center justify-between"><p className="font-semibold">{p.name}</p><p className="tabular font-semibold">{p.id === "trial" ? "Free · 7 days" : `${prices[currency][p.id]}/mo`}</p></div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{p.tagline}</p>
                <p className="mt-3 text-xs text-[var(--color-ink-soft)]">{p.bullets.slice(0, 4).join(" · ")}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <p role="alert" className="mt-6 rounded-xl bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || pending}><ArrowLeft size={18} /> Back</button>
        {step < 3 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue <ArrowRight size={18} /></button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>{pending ? "Setting up…" : plan === "trial" ? "Start free trial" : "Continue to payment"}</button>
        )}
      </div>
    </div>
  );
}
