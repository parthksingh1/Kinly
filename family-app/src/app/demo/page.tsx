import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { db } from "@/lib/db";
import { DEMO_SCREEN_TOKEN } from "@/lib/demo-seed";
import { kinlyHealth } from "@/lib/kinly-api";
import { DemoPanel } from "./panel";

export const metadata: Metadata = { title: "Demo controls", robots: { index: false } };
export const dynamic = "force-dynamic";

const STEPS = ["checkin", "phone", "fall", "scam", "missed_medicine", "video"];

export default async function DemoPage() {
  if (process.env.DEMO_MODE !== "true") {
    return <main className="p-10"><p>Demo controls are disabled. Set <code>DEMO_MODE=true</code>.</p></main>;
  }
  const [health, elder] = await Promise.all([kinlyHealth(), db.elder.findFirst({ where: { isDemo: true } })]);
  const clipsDir = path.join(process.cwd(), "public", "demo-clips");
  const clips = Object.fromEntries(STEPS.map((s) => {
    const file = ["mp4", "webm", "mp3"].map((ext) => `${s}.${ext}`).find((f) => fs.existsSync(path.join(clipsDir, f)));
    return [s, file ? `/demo-clips/${file}` : null];
  }));
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <div className="flex gap-2">
          <Link href="/dashboard" className="btn btn-secondary btn-sm">Arjun&apos;s dashboard</Link>
          <a href={`/screen/${DEMO_SCREEN_TOKEN}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">Open Kamala&apos;s screen</a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20">
        <p className="eyebrow">Demo controls</p>
        <h1 className="display mt-2 text-4xl">Run the Kamala story</h1>
        <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
          Open Kamala&apos;s screen on a tablet (or a second window) and press Talk once so audio is allowed. Every button below runs the real product path: brain, alerts, notifications and dashboard.
        </p>
        <DemoPanel
          health={health}
          elder={elder ? { id: elder.id, phone: elder.phone, online: !!health?.onlineScreens.includes(elder.id) } : null}
          clips={clips}
          defaultPhone={process.env.DEMO_ELDER_PHONE ?? ""}
        />
      </main>
    </div>
  );
}
