"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { kinly } from "@/lib/kinly-api";
import { hasFeature } from "@/lib/plans";
import { saveUpload } from "@/lib/uploads";

type Result = { ok?: boolean; error?: string; message?: string };

async function audit(familyId: string, elderId: string, actorUserId: string, action: string, detail: object) {
  await db.auditLog.create({ data: { familyId, elderId, actorUserId, action, detail: JSON.stringify(detail) } });
}

/** Step 1+2: the represented adult creates their own avatar with a recorded spoken consent. */
export async function createAvatar(form: FormData): Promise<Result> {
  const { elder, family, user } = await requireContext();
  if (!hasFeature(family.plan, "family_avatar")) return { error: "Family Avatar is part of Premium." };
  if (form.get("adult") !== "on") return { error: "Only adults (18+) can create a Family Avatar of themselves." };
  if (form.get("self") !== "on") return { error: "You can only create an avatar of yourself." };
  const consent = form.get("consent");
  const photo = form.get("photo");
  if (!(consent instanceof File) || consent.size < 2000) return { error: "Please record the consent statement." };
  const existing = await db.familyAvatar.findFirst({ where: { elderId: elder.id, userId: user.id, status: { not: "revoked" } } });
  if (existing) return { error: "You already have an avatar for this person. Delete it first to make a new one." };
  const consentPath = await saveUpload(consent, `avatars/${elder.id}`);
  const photoPath = photo instanceof File && photo.size > 0 ? await saveUpload(photo, `avatars/${elder.id}`) : "";
  const avatar = await db.familyAvatar.create({
    data: {
      elderId: elder.id, userId: user.id, displayName: String(form.get("displayName") || user.name.split(" ")[0]),
      relation: String(form.get("relation") ?? ""), photoPath, consentAudioPath: consentPath,
      consentTranscript: String(form.get("statement") ?? ""), consentAt: new Date(), adultConfirmed: true, status: "draft",
    },
  });
  await audit(family.id, elder.id, user.id, "avatar_created_with_consent", { avatarId: avatar.id });
  revalidatePath("/dashboard/avatar");
  return { ok: true };
}

export async function cloneVoice(avatarId: string): Promise<Result> {
  const { elder, user } = await requireContext();
  const avatar = await db.familyAvatar.findFirst({ where: { id: avatarId, elderId: elder.id } });
  if (!avatar || avatar.userId !== user.id) return { error: "Only the person represented can create their voice." };
  try {
    await kinly(`/api/kinly/avatar/${avatarId}/clone`, {});
    revalidatePath("/dashboard/avatar");
    return { ok: true, message: "Voice created." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function ownerApprove(avatarId: string, form: FormData): Promise<Result> {
  const { elder, family, user, isOwner } = await requireContext();
  if (!isOwner) return { error: "Only the plan owner can confirm suitability." };
  if (form.get("suitable") !== "on" || form.get("informed") !== "on") return { error: "Please confirm both statements." };
  await db.familyAvatar.updateMany({ where: { id: avatarId, elderId: elder.id }, data: { ownerApprovedAt: new Date(), ownerUserId: user.id, elderInformedAt: new Date() } });
  await audit(family.id, elder.id, user.id, "avatar_owner_approved_and_elder_informed", { avatarId });
  revalidatePath("/dashboard/avatar");
  return { ok: true };
}

export async function setEnabled(avatarId: string, enabled: boolean): Promise<Result> {
  const { elder, family, user, isOwner } = await requireContext();
  const avatar = await db.familyAvatar.findFirst({ where: { id: avatarId, elderId: elder.id } });
  if (!avatar) return { error: "Not found." };
  if (!isOwner && avatar.userId !== user.id) return { error: "Not allowed." };
  if (enabled && !(avatar.voiceId && avatar.ownerApprovedAt && avatar.elderInformedAt && avatar.consentAt)) {
    return { error: "All consent steps must be complete first." };
  }
  if (enabled) await db.familyAvatar.updateMany({ where: { elderId: elder.id, id: { not: avatarId } }, data: { enabled: false } });
  await db.familyAvatar.update({ where: { id: avatarId }, data: { enabled, status: enabled ? "active" : avatar.voiceId ? "consented" : "draft" } });
  await audit(family.id, elder.id, user.id, enabled ? "avatar_enabled" : "avatar_disabled", { avatarId });
  revalidatePath("/dashboard/avatar");
  return { ok: true };
}

export async function revokeAvatar(avatarId: string): Promise<Result> {
  const { elder, family, user, isOwner } = await requireContext();
  const avatar = await db.familyAvatar.findFirst({ where: { id: avatarId, elderId: elder.id } });
  if (!avatar) return { error: "Not found." };
  if (avatar.userId !== user.id && !isOwner) return { error: "Only the person represented (or the plan owner) can delete it." };
  try {
    await kinly(`/api/kinly/avatar/${avatarId}/revoke`, { actorUserId: user.id });
  } catch {
    // Companion offline: delete locally so revocation never fails.
    const { deleteUpload } = await import("@/lib/uploads");
    await deleteUpload(avatar.consentAudioPath);
    await deleteUpload(avatar.photoPath);
    await db.familyAvatar.update({ where: { id: avatarId }, data: { status: "revoked", enabled: false, voiceId: "", consentAudioPath: "", photoPath: "", revokedAt: new Date() } });
    await audit(family.id, elder.id, user.id, "avatar_revoked_and_deleted", { avatarId, note: "companion offline; provider voice deleted on next sync" });
  }
  revalidatePath("/dashboard/avatar");
  return { ok: true };
}
