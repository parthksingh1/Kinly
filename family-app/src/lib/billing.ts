import "server-only";
import Stripe from "stripe";
import { db } from "./db";
import { type Currency, type PlanId, price } from "./plans";

/**
 * Billing behind one interface so Razorpay can be added for India without touching the UI.
 * - "stripe": Stripe Checkout in test mode (subscription, price created inline)
 * - "demo":   no keys configured; activates the plan instantly and says so clearly
 */
export interface BillingProvider {
  id: "stripe" | "razorpay" | "demo";
  createCheckout(args: { familyId: string; plan: Exclude<PlanId, "trial">; currency: Currency; email: string; appUrl: string }): Promise<{ url: string }>;
}

class StripeBilling implements BillingProvider {
  id = "stripe" as const;
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  async createCheckout({ familyId, plan, currency, email, appUrl }: Parameters<BillingProvider["createCheckout"]>[0]) {
    const amount = price(plan, currency);
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: familyId,
      metadata: { familyId, plan },
      subscription_data: { metadata: { familyId, plan } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(amount * 100),
          recurring: { interval: "month" },
          product_data: { name: `Kinly ${plan[0].toUpperCase()}${plan.slice(1)}` },
        },
      }],
      success_url: `${appUrl}/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?status=canceled`,
    });
    return { url: session.url! };
  }

  verifyWebhook(payload: string, signature: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  }

  async retrieveSession(id: string) {
    return this.stripe.checkout.sessions.retrieve(id);
  }
}

class DemoBilling implements BillingProvider {
  id = "demo" as const;
  async createCheckout({ familyId, plan, appUrl }: Parameters<BillingProvider["createCheckout"]>[0]) {
    await activatePlan(familyId, plan, "demo", null, null);
    return { url: `${appUrl}/dashboard/billing?status=success&demo=1` };
  }
}

export function billing(): BillingProvider {
  if (process.env.STRIPE_SECRET_KEY) return new StripeBilling();
  return new DemoBilling();
}

export function stripeBilling(): StripeBilling | null {
  return process.env.STRIPE_SECRET_KEY ? new StripeBilling() : null;
}

export async function activatePlan(familyId: string, plan: string, provider: string, customerId: string | null, subscriptionId: string | null) {
  const family = await db.family.update({
    where: { id: familyId },
    data: {
      plan,
      planStatus: "active",
      billingProvider: provider,
      billingCustomerId: customerId,
      billingSubscriptionId: subscriptionId,
    },
  });
  await db.auditLog.create({ data: { familyId, action: "plan_activated", detail: JSON.stringify({ plan, provider }) } });
  return family;
}
