"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { billing } from "@/lib/billing";
import type { Currency } from "@/lib/plans";

export async function startCheckout(plan: string, currency: Currency): Promise<{ error?: string } | void> {
  const { family, user, isOwner } = await requireContext();
  if (!isOwner) return { error: "Only the plan owner can change the plan." };
  if (!["care", "family", "premium"].includes(plan)) return { error: "Unknown plan." };
  const h = await headers();
  const appUrl = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  let url: string;
  try {
    ({ url } = await billing().createCheckout({ familyId: family.id, plan: plan as "care", currency, email: user.email, appUrl }));
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(url);
}
