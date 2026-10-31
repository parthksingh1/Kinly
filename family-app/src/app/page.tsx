import {
  Bell, BookOpenText, ChatsCircle, HandHeart, Microphone, Phone, Pill, ShieldCheck, ShieldWarning, Translate, VideoCamera, Waveform,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Pricing } from "@/components/pricing";
import { Logo } from "@/components/ui";
import { PLANS, defaultCurrency, formatPrice, price } from "@/lib/plans";

const prices = {
  USD: Object.fromEntries((["care", "family", "premium"] as const).map((p) => [p, formatPrice(price(p, "USD"), "USD")])),
  INR: Object.fromEntries((["care", "family", "premium"] as const).map((p) => [p, formatPrice(price(p, "INR"), "INR")])),
};

const FEATURES = [
  { icon: Phone, title: "A real phone call, every morning", body: "Kinly calls the phone they already have, at the time you choose. No app, no setup for them. They can call Kinly back anytime." },
  { icon: Translate, title: "In their own language", body: "English, Hindi, Spanish, Tamil, Bengali and more. If they switch languages mid-sentence, Kinly switches too." },
  { icon: ChatsCircle, title: "It remembers what matters", body: "Grandchildren's names, the knee that hurt yesterday, the friend from school. Brought up gently, the way a friend would." },
  { icon: Pill, title: "Medicines, kindly", body: "Reminders at the right time, a simple “have you taken it?”, and a note to you if doses are missed." },
  { icon: Bell, title: "Alerts the moment it matters", body: "A fall, chest pain, confusion: Kinly tells them to call for help right away and alerts the family instantly on WhatsApp." },
  { icon: ShieldWarning, title: "Scam Shield", body: "If someone asks for an OTP, money or gift cards, Kinly warns them on the spot and lets you know." },
  { icon: VideoCamera, title: "“Call Riya”", body: "One big button, or just ask. Kinly starts a real video call with the family member they want to see." },
  { icon: BookOpenText, title: "A Memory Book", body: "With their permission, the stories they tell become a beautifully written book your family can keep." },
];

const PRINCIPLES = [
  ["Always honest", "Kinly says it is an AI. It never pretends to be a person, and never asks for money, OTPs or passwords."],
  ["Their consent first", "On the first call Kinly explains what it is and what is shared, and waits for their yes before regular check-ins."],
  ["Their privacy, too", "They can say “keep this between us”. It stays out of your summary. Safety is the only exception, and they are told that."],
  ["Notices, never diagnoses", "Kinly listens for signs that need attention and encourages help. Medical decisions stay with doctors and family."],
];

export default function Landing() {
  return (
    <div className="bg-[var(--color-linen)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)]/70 bg-[var(--color-linen)]/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Main">
          <Link href="/" aria-label="Kinly home"><Logo /></Link>
          <div className="hidden items-center gap-7 text-sm text-[var(--color-ink-soft)] md:flex">
            <a href="#how" className="hover:text-[var(--color-ink)]">How it works</a>
            <a href="#safety" className="hover:text-[var(--color-ink)]">Safety</a>
            <a href="#pricing" className="hover:text-[var(--color-ink)]">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
            <Link href="/signup" className="btn btn-primary btn-sm">Start free trial</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-20">
          <div className="animate-rise">
            <a href="https://www.ycombinator.com/rfs" target="_blank" rel="noreferrer"
               className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-line-strong)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink-soft)]">
              <HandHeart size={15} weight="fill" className="text-[var(--color-clay)]" aria-hidden="true" />
              Built for YC&apos;s Request for Startups: AI for the Aging Population
            </a>
            <h1 className="display text-[2.7rem] leading-[1.04] sm:text-6xl">
              Someone to talk to every morning.
              <span className="block italic text-[var(--color-evergreen)]">Peace of mind for all of you.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-ink-soft)]">
              Kinly is a warm voice companion for your parents and grandparents. It calls them every day in their own
              language, remembers their stories, reminds them about medicines, and tells you the moment something needs you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary h-12 px-6 text-base">Start your 7-day free trial</Link>
              <Link href="/login?demo=1" className="btn btn-secondary h-12 px-6 text-base">See the live demo</Link>
            </div>
            <p className="mt-5 text-sm text-[var(--color-muted)]">Launching in India and the US. No app needed on their side, just their phone.</p>
          </div>

          {/* Product collage */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
            <div className="card relative z-10 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-evergreen)] text-white">
                    <span className="absolute inset-0 animate-ring rounded-full bg-[var(--color-evergreen)]" />
                    <Phone size={20} weight="fill" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Morning check-in · Kamala</p>
                    <p className="text-xs text-[var(--color-muted)]">10:00 · Hindi · 6 min</p>
                  </div>
                </div>
                <Waveform size={26} className="text-[var(--color-evergreen)]" />
              </div>
              <div className="mt-4 space-y-2 text-[0.92rem]">
                <p className="rounded-2xl rounded-tl-sm bg-[var(--color-evergreen-tint)] px-3.5 py-2.5">नमस्ते कमला जी! कल घुटने में दर्द था, आज कैसा है?</p>
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--color-linen)] px-3.5 py-2.5">बेहतर है बेटा। आज गुलाब में नई कलियाँ आईं!</p>
              </div>
            </div>
            <div className="card relative z-20 -mt-4 ml-8 mr-[-8px] p-4 sm:ml-16">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-danger-soft)] text-[var(--color-danger)]"><Bell size={18} weight="fill" /></span>
                <div className="text-sm">
                  <p className="font-semibold">Urgent: Mentioned a fall (Kamala)</p>
                  <p className="text-[var(--color-muted)]">“I fell in the bathroom this morning.” Kinly asked her to call 112 and is alerting you now.</p>
                </div>
              </div>
            </div>
            <div className="card relative z-10 -mt-3 mr-10 p-4">
              <p className="eyebrow">Talk about this</p>
              <p className="mt-1.5 text-sm leading-relaxed">Kamala mentioned her school friend <b>Shanta</b> three times this week. Ask her about Shanta when you call.</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-[var(--color-line)] bg-[var(--color-paper)]">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="eyebrow">How it works</p>
            <h2 className="display mt-3 max-w-2xl text-4xl">Five minutes for you. A friend for them, every day.</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                ["Tell us about them", "Their name, language, medicines and the best time to call. Invite brothers, sisters and grandchildren."],
                ["Kinly calls and chats", "A real conversation on their phone, or on a tablet with big buttons. First, it asks for their consent."],
                ["You stay close", "A short summary after each chat, gentle trends, and instant alerts when something needs you."],
              ].map(([t, b], i) => (
                <li key={t} className="card p-6">
                  <span className="display text-3xl text-[var(--color-clay)]">0{i + 1}</span>
                  <p className="mt-4 text-lg font-semibold">{t}</p>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--color-muted)]">{b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="eyebrow">What Kinly does</p>
              <h2 className="display mt-3 text-4xl">Company, care and a safety net, in one voice.</h2>
              <p className="mt-4 leading-relaxed text-[var(--color-muted)]">
                Older adults living alone deserve someone who listens. Families living far away deserve to know they are okay.
                Kinly does both, without asking anyone to learn a new app.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm text-[var(--color-ink-soft)]">
                <Microphone size={18} aria-hidden="true" /> Patient listening: Kinly waits longer before it replies.
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="card p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-evergreen-tint)] text-[var(--color-evergreen)]">
                    <Icon size={21} weight="duotone" aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-semibold">{title}</p>
                  <p className="mt-1.5 text-[0.93rem] leading-relaxed text-[var(--color-muted)]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="bg-[var(--color-evergreen-deep)] text-white">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="flex items-center gap-3"><ShieldCheck size={26} weight="duotone" className="text-[#e8b48f]" aria-hidden="true" /><p className="eyebrow !text-white/60">Safety and consent</p></div>
            <h2 className="display mt-3 max-w-3xl text-4xl">Built with the dignity of the person on the other end of the call.</h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-[22px] bg-white/10 sm:grid-cols-2">
              {PRINCIPLES.map(([t, b]) => (
                <div key={t} className="bg-[var(--color-evergreen-deep)] p-7">
                  <p className="text-lg font-semibold">{t}</p>
                  <p className="mt-2 leading-relaxed text-white/70">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h2 className="display mt-3 text-4xl">Less than a weekly coffee, for a daily call.</h2>
            <p className="mt-3 text-[var(--color-muted)]">Start free for 7 days. Cancel any time. Safety alerts are included on every plan.</p>
          </div>
          <Pricing plans={PLANS} prices={prices} defaultCurrency={defaultCurrency()} />
        </section>

        {/* Closing */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="card flex flex-col items-start justify-between gap-6 p-8 sm:p-10 md:flex-row md:items-center">
            <div>
              <h2 className="display text-3xl">Call them today. Let Kinly call them tomorrow.</h2>
              <p className="mt-2 text-[var(--color-muted)]">Set up in five minutes. The first call explains everything to them, kindly.</p>
            </div>
            <Link href="/signup" className="btn btn-primary h-12 px-6 text-base">Get started</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
          <Logo className="text-[var(--color-ink)]" />
          <p>Built on the open source Open-LLM-VTuber project, rebuilt for the people who need companionship most.</p>
        </div>
      </footer>
    </div>
  );
}
