import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PLANS, defaultCurrency, formatPrice, price } from "@/lib/plans";
import { OnboardingFlow } from "./flow";

export const metadata: Metadata = { title: "Set up Kinly" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; currency?: string }> }) {
  const user = await requireUser();
  const { plan, currency } = await searchParams;
  const prices = Object.fromEntries((["USD", "INR"] as const).map((c) => [c, Object.fromEntries((["care", "family", "premium"] as const).map((p) => [p, formatPrice(price(p, c), c)]))]));
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link href="/" aria-label="Kinly home"><Logo /></Link>
        <span className="text-sm text-[var(--color-muted)]">Signed in as {user.email}</span>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20">
        <OnboardingFlow
          userName={user.name}
          plans={PLANS}
          prices={prices as Record<"USD" | "INR", Record<string, string>>}
          initialPlan={(plan as "trial") ?? "trial"}
          initialCurrency={(currency === "INR" ? "INR" : currency === "USD" ? "USD" : defaultCurrency())}
          stripeConfigured={!!process.env.STRIPE_SECRET_KEY}
        />
      </main>
    </div>
  );
}
