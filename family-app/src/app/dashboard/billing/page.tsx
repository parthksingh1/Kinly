import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { activatePlan, stripeBilling } from "@/lib/billing";
import { PLANS, formatPrice, price } from "@/lib/plans";
import { PlanPicker } from "./plan-picker";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string; session_id?: string; demo?: string }> }) {
  const { family, isOwner } = await requireContext();
  const { status, session_id, demo } = await searchParams;

  // Returning from Stripe Checkout: confirm the session server-side (the webhook also does this).
  let current: { plan: string; planStatus: string; currency: string; trialEndsAt: Date | null; billingProvider: string | null } = family;
  if (status === "success" && session_id) {
    const stripe = stripeBilling();
    if (stripe) {
      const s = await stripe.retrieveSession(session_id);
      if (s.status === "complete" && s.metadata?.familyId === family.id && family.plan !== s.metadata.plan) {
        current = await activatePlan(family.id, s.metadata.plan!, "stripe", String(s.customer ?? ""), String(s.subscription ?? ""));
      }
    }
  }
  const prices = Object.fromEntries((["USD", "INR"] as const).map((c) => [c, Object.fromEntries((["care", "family", "premium"] as const).map((p) => [p, formatPrice(price(p, c), c)]))]));
  const plan = PLANS.find((p) => p.id === current.plan) ?? PLANS[0];
  const trialDays = current.trialEndsAt ? Math.max(0, Math.ceil((current.trialEndsAt.getTime() - Date.now()) / 86400000)) : null;

  return (
    <>
      <PageHeader eyebrow="Plan & billing" title="Your plan" description="Change or cancel any time. Safety alerts are included on every plan." />
      {status === "success" && (
        <p className="card mb-6 flex items-center gap-3 border-[var(--color-evergreen)]/30 bg-[var(--color-evergreen-tint)] p-4 text-sm" role="status">
          <CheckCircle size={20} weight="fill" className="text-[var(--color-evergreen)]" aria-hidden="true" />
          {demo ? "Your plan is active. Thank you." : "Payment received. Thank you, your plan is active."}
        </p>
      )}
      {status === "canceled" && <p className="card mb-6 p-4 text-sm" role="status">Checkout was canceled. Nothing was charged.</p>}
      <div className="card mb-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Current plan</p>
          <p className="display mt-1 text-3xl">{plan.name}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {current.plan === "trial" ? `Free trial · ${trialDays ?? 7} day${trialDays === 1 ? "" : "s"} left` : `${current.planStatus === "active" ? "Active" : current.planStatus} · billed monthly in ${current.currency}${current.billingProvider ? ` · via ${current.billingProvider}` : ""}`}
          </p>
        </div>
        
      </div>
      {isOwner ? (
        <PlanPicker plans={PLANS.filter((p) => p.id !== "trial")} prices={prices as Record<"USD" | "INR", Record<string, string>>} current={current.plan} defaultCurrency={current.currency === "INR" ? "INR" : "USD"} />
      ) : (
        <p className="text-sm text-[var(--color-muted)]">Only the plan owner can change the plan.</p>
      )}
    </>
  );
}
