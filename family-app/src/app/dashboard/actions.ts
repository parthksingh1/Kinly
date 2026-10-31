"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { kinly, pushToScreen } from "@/lib/kinly-api";
import { MEMBER_LIMIT, type PlanId, hasFeature } from "@/lib/plans";
import { videoProvider } from "@/lib/video";

export type ActionResult = { ok?: boolean; error?: string; message?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------------------------------------------------------------- alerts

export async function setAlertStatus(alertId: string, status: "acknowledged" | "resolved") {
  const { elder, user } = await requireContext();
  await db.alert.updateMany({
    where: { id: alertId, elderId: elder.id },
    data: status === "acknowledged"
      ? { status, acknowledgedAt: new Date(), acknowledgedBy: user.name }
      : { status, resolvedAt: new Date(), acknowledgedAt: new Date(), acknowledgedBy: user.name },
  });
  revalidatePath("/dashboard", "layout");
}

// ---------------------------------------------------------------- calls & summaries

export async function callNow(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { elder } = await requireContext();
  try {
    const res = await kinly<{ ok: boolean; call: { status: string; error?: string } }>("/api/kinly/calls/outbound", {
      elderId: elder.id, reason: "family", phone: str(form, "phone") || undefined,
    });
    if (!res.ok) return { error: res.call.error || "The call could not be placed." };
    return { ok: true, message: `Calling ${elder.preferredName} now.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function refreshSummary(send: boolean): Promise<ActionResult> {
  const { elder } = await requireContext();
  try {
    await kinly(`/api/kinly/elders/${elder.id}/summary?send=${send}`, {});
    revalidatePath("/dashboard");
    return { ok: true, message: send ? "Summary sent to the family." : "Summary updated." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function startVideoCall(contactName: string) {
  const { elder, family, user } = await requireContext();
  if (!hasFeature(family.plan, "video_calls")) redirect("/dashboard/billing");
  const call = await db.videoCall.create({
    data: { elderId: elder.id, roomName: `kinly-${crypto.randomBytes(6).toString("hex")}`, provider: videoProvider(), initiatedBy: "family", contactName: contactName || user.name.split(" ")[0], status: "ringing" },
  });
  await pushToScreen(elder.id, { type: "kinly-incoming-call", callId: call.id, from: call.contactName });
  redirect(`/call/${call.id}?as=family`);
}

// ---------------------------------------------------------------- care plan

export async function addMedicine(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { elder } = await requireContext();
  const name = str(form, "name");
  const times = str(form, "times").replace(/\s/g, "");
  if (!name || !/^\d{2}:\d{2}(,\d{2}:\d{2})*$/.test(times)) return { error: "Add a name and times like 09:00,21:00." };
  await db.medicine.create({ data: { elderId: elder.id, name, dosage: str(form, "dosage"), instructions: str(form, "instructions"), times } });
  revalidatePath("/dashboard/care");
  return { ok: true };
}

export async function removeMedicine(id: string) {
  const { elder } = await requireContext();
  await db.medicine.updateMany({ where: { id, elderId: elder.id }, data: { active: false } });
  revalidatePath("/dashboard/care");
}

export async function markDose(logId: string, status: "taken" | "skipped") {
  const { elder } = await requireContext();
  await db.medicineLog.updateMany({ where: { id: logId, elderId: elder.id }, data: { status, source: "family", confirmedAt: status === "taken" ? new Date() : null } });
  revalidatePath("/dashboard", "layout");
}

export async function saveSchedule(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { elder, family } = await requireContext();
  const times = form.getAll("time").map(String).filter((t) => /^\d{2}:\d{2}$/.test(t));
  const max = hasFeature(family.plan, "multi_calls") ? 3 : 1;
  if (times.length === 0) return { error: "Choose at least one time." };
  if (times.length > max) return { error: `Your plan includes ${max} call${max > 1 ? "s" : ""} a day. Premium includes up to 3.` };
  await db.$transaction([
    db.callSchedule.deleteMany({ where: { elderId: elder.id } }),
    ...times.map((t) => db.callSchedule.create({ data: { elderId: elder.id, timeLocal: t, days: str(form, "days") || "daily" } })),
  ]);
  revalidatePath("/dashboard/care");
  return { ok: true, message: "Call times saved." };
}

export async function addAppointment(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { elder } = await requireContext();
  const title = str(form, "title");
  const when = str(form, "startsAt");
  if (!title || !when) return { error: "Add a title and a date and time." };
  // datetime-local is in the elder's time zone; store as UTC.
  const startsAt = zonedToUtc(when, elder.timezone);
  await db.appointment.create({ data: { elderId: elder.id, title, location: str(form, "location"), startsAt } });
  revalidatePath("/dashboard/care");
  return { ok: true };
}

export async function removeAppointment(id: string) {
  const { elder } = await requireContext();
  await db.appointment.deleteMany({ where: { id, elderId: elder.id } });
  revalidatePath("/dashboard/care");
}

export async function addContact(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { elder } = await requireContext();
  const name = str(form, "name");
  if (!name) return { error: "Add a name." };
  await db.contact.create({ data: { elderId: elder.id, name, relation: str(form, "relation"), phone: str(form, "phone"), email: str(form, "email"), isEmergency: form.get("isEmergency") === "on" } });
  revalidatePath("/dashboard/care");
  return { ok: true };
}

export async function removeContact(id: string) {
  const { elder } = await requireContext();
  await db.contact.deleteMany({ where: { id, elderId: elder.id } });
  revalidatePath("/dashboard/care");
}

// ---------------------------------------------------------------- family

export async function inviteMember(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { family, isOwner } = await requireContext();
  if (!isOwner) return { error: "Only the plan owner can invite people." };
  const email = str(form, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  const count = (await db.familyMember.count({ where: { familyId: family.id } })) + (await db.invite.count({ where: { familyId: family.id, acceptedAt: null } }));
  if (count >= MEMBER_LIMIT[family.plan as PlanId]) return { error: `Your plan includes ${MEMBER_LIMIT[family.plan as PlanId]} family members. Upgrade to Family for up to 6.` };
  const invite = await db.invite.create({ data: { familyId: family.id, email, relation: str(form, "relation"), token: crypto.randomBytes(16).toString("base64url") } });
  revalidatePath("/dashboard/family");
  return { ok: true, message: `Invite link: /invite/${invite.token}` };
}

export async function removeMember(memberId: string) {
  const { family, isOwner } = await requireContext();
  if (!isOwner) return;
  await db.familyMember.deleteMany({ where: { id: memberId, familyId: family.id, role: { not: "owner" } } });
  revalidatePath("/dashboard/family");
}

export async function updateMyNotifications(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { membership } = await requireContext();
  await db.familyMember.update({
    where: { id: membership.id },
    data: { phone: str(form, "phone"), relation: str(form, "relation"), notifyWhatsapp: form.get("notifyWhatsapp") === "on", notifyEmail: form.get("notifyEmail") === "on" },
  });
  revalidatePath("/dashboard/family");
  return { ok: true, message: "Saved." };
}

// ---------------------------------------------------------------- settings

export async function updateElder(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { elder } = await requireContext();
  const languages = form.getAll("languages").map(String);
  if (!str(form, "name") || !str(form, "preferredName") || languages.length === 0) return { error: "Name, preferred name and at least one language are required." };
  await db.elder.update({
    where: { id: elder.id },
    data: {
      name: str(form, "name"), preferredName: str(form, "preferredName"), phone: str(form, "phone"), city: str(form, "city"),
      timezone: str(form, "timezone"), about: str(form, "about"), emergencyNumber: str(form, "emergencyNumber") || "112",
      gender: str(form, "gender"), languages: languages.join(","), age: str(form, "age") ? Number(str(form, "age")) : null,
    },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Saved." };
}

export async function resetConsent() {
  const { elder, family, user } = await requireContext();
  await db.elder.update({ where: { id: elder.id }, data: { consentStatus: "pending", consentAt: null, consentTranscript: null } });
  await db.auditLog.create({ data: { familyId: family.id, elderId: elder.id, actorUserId: user.id, action: "consent_reset", detail: "{}" } });
  revalidatePath("/dashboard/settings");
}

export async function rotateScreenLink() {
  const { elder } = await requireContext();
  await db.elder.update({ where: { id: elder.id }, data: { screenToken: crypto.randomBytes(12).toString("base64url") } });
  revalidatePath("/dashboard/settings");
}

// ---------------------------------------------------------------- memory book

export async function generateChapters(): Promise<ActionResult> {
  const { elder } = await requireContext();
  try {
    const res = await kinly<{ created: number }>(`/api/kinly/elders/${elder.id}/memory-book`, {});
    revalidatePath("/dashboard/memory-book");
    return { ok: true, message: res.created ? `${res.created} new chapter${res.created > 1 ? "s" : ""} written.` : "No new stories yet. Chapters appear as they share more." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleChapter(id: string, hidden: boolean) {
  const { elder } = await requireContext();
  await db.memoryBookChapter.updateMany({ where: { id, elderId: elder.id }, data: { hidden } });
  revalidatePath("/dashboard/memory-book");
}

// ---------------------------------------------------------------- helpers

function zonedToUtc(local: string, timeZone: string) {
  // Interpret "YYYY-MM-DDTHH:mm" as wall time in `timeZone`.
  const asUtc = new Date(local + ":00Z");
  const tzString = asUtc.toLocaleString("en-US", { timeZone });
  const offset = new Date(tzString + " UTC").getTime() - asUtc.getTime();
  return new Date(asUtc.getTime() - offset);
}
