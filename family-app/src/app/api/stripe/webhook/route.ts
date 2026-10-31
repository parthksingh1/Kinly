import { NextRequest, NextResponse } from "next/server";
import { activatePlan, stripeBilling } from "@/lib/billing";
import { db } from "@/lib/db";

// Stripe webhook: keeps the family's plan in sync. Configure the endpoint with
//   stripe listen --forward-to localhost:3000/api/stripe/webhook
export async function POST(req: NextRequest) {
  const stripe = stripeBilling();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  const body = await req.text();
  let event;
  try {
    event = stripe.verifyWebhook(body, req.headers.get("stripe-signature") ?? "");
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.metadata?.familyId && s.metadata.plan) {
        await activatePlan(s.metadata.familyId, s.metadata.plan, "stripe", String(s.customer ?? ""), String(s.subscription ?? ""));
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const familyId = sub.metadata?.familyId;
      if (familyId) {
        const canceled = event.type === "customer.subscription.deleted" || sub.status === "canceled";
        await db.family.update({
          where: { id: familyId },
          data: canceled ? { plan: "care", planStatus: "canceled" } : { planStatus: sub.status === "active" ? "active" : sub.status, plan: sub.metadata?.plan || undefined },
        });
        await db.auditLog.create({ data: { familyId, action: "subscription_" + (canceled ? "canceled" : "updated"), detail: JSON.stringify({ status: sub.status }) } });
      }
      break;
    }
  }
  return NextResponse.json({ received: true });
}
