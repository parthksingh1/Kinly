"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, selectElder } from "@/lib/auth";
import { billing } from "@/lib/billing";
import { db } from "@/lib/db";
import type { Currency } from "@/lib/plans";

const schema = z.object({
  elder: z.object({
    name: z.string().trim().min(2),
    preferredName: z.string().trim().min(1),
    age: z.coerce.number().int().min(40).max(120).optional().or(z.literal("").transform(() => undefined)),
    gender: z.enum(["female", "male", ""]).default(""),
    languages: z.array(z.string()).min(1),
    phone: z.string().trim().default(""),
    timezone: z.string().min(1),
    city: z.string().trim().default(""),
    about: z.string().trim().default(""),
    emergencyNumber: z.string().trim().default("112"),
  }),
  medicines: z.array(z.object({ name: z.string().trim(), dosage: z.string().trim().default(""), times: z.string().trim() })).default([]),
  callTime: z.string().regex(/^\d{2}:\d{2}$/),
  me: z.object({ relation: z.string().trim().default(""), phone: z.string().trim().default("") }),
  invites: z.array(z.string().trim().toLowerCase().email()).default([]),
  plan: z.enum(["trial", "care", "family", "premium"]),
  currency: z.enum(["USD", "INR"]),
});

export type OnboardingPayload = z.input<typeof schema>;

export async function completeOnboarding(payload: OnboardingPayload): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { error: "Some details are missing: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const data = parsed.data;

  const existing = await db.familyMember.findFirst({ where: { userId: user.id, role: "owner" } });
  const family = existing
    ? await db.family.findUniqueOrThrow({ where: { id: existing.familyId } })
    : await db.family.create({
        data: {
          name: `${data.elder.name.split(" ").slice(-1)[0]} family`,
          plan: "trial", planStatus: "trialing", currency: data.currency,
          trialEndsAt: new Date(Date.now() + 7 * 86400000),
          members: { create: { userId: user.id, role: "owner", relation: data.me.relation, phone: data.me.phone } },
        },
      });
  if (existing) await db.familyMember.update({ where: { id: existing.id }, data: { relation: data.me.relation, phone: data.me.phone } });

  const elder = await db.elder.create({
    data: {
      familyId: family.id, name: data.elder.name, preferredName: data.elder.preferredName, age: data.elder.age ?? null,
      gender: data.elder.gender, languages: data.elder.languages.join(","), phone: data.elder.phone, timezone: data.elder.timezone,
      city: data.elder.city, about: data.elder.about, emergencyNumber: data.elder.emergencyNumber || "112",
      screenToken: crypto.randomBytes(12).toString("base64url"),
      callSchedules: { create: { timeLocal: data.callTime } },
      medicines: { create: data.medicines.filter((m) => m.name && m.times).map((m) => ({ name: m.name, dosage: m.dosage, times: m.times })) },
      contacts: { create: { name: user.name.split(" ")[0], relation: data.me.relation, phone: data.me.phone, email: user.email, userId: user.id, isEmergency: true } },
    },
  });
  for (const email of data.invites.filter((e) => e !== user.email)) {
    await db.invite.create({ data: { familyId: family.id, email, token: crypto.randomBytes(16).toString("base64url") } });
  }
  await db.auditLog.create({ data: { familyId: family.id, elderId: elder.id, actorUserId: user.id, action: "elder_added", detail: JSON.stringify({ languages: data.elder.languages }) } });
  await selectElder(elder.id);

  if (data.plan === "trial") redirect("/dashboard?welcome=1");
  const h = await headers();
  const appUrl = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { url } = await billing().createCheckout({ familyId: family.id, plan: data.plan, currency: data.currency as Currency, email: user.email, appUrl });
  redirect(url);
}
