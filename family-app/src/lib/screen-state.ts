import "server-only";
import type { Elder, Family } from "@prisma/client";
import { db } from "./db";
import { inZone, isoDayIn } from "./format";
import { FEATURES, type PlanId } from "./plans";

/** Everything the elder screen needs, in one payload. */
export async function screenState(elder: Elder & { family: Family }) {
  const tz = elder.timezone;
  const todayKey = isoDayIn(new Date(), tz);
  const [contacts, meds, logs, messages, avatar, ringing] = await Promise.all([
    db.contact.findMany({ where: { elderId: elder.id }, orderBy: [{ isEmergency: "desc" }, { name: "asc" }] }),
    db.medicine.findMany({ where: { elderId: elder.id, active: true } }),
    db.medicineLog.findMany({ where: { elderId: elder.id, scheduledFor: { gte: new Date(Date.now() - 36 * 3600000), lte: new Date(Date.now() + 36 * 3600000) } } }),
    db.voiceMessage.findMany({ where: { elderId: elder.id, direction: "to_elder" }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.familyAvatar.findFirst({ where: { elderId: elder.id, enabled: true, status: "active" } }),
    db.videoCall.findFirst({ where: { elderId: elder.id, initiatedBy: "family", status: "ringing", createdAt: { gte: new Date(Date.now() - 90000) } }, orderBy: { createdAt: "desc" } }),
  ]);
  const doses = meds.flatMap((m) => m.times.split(",").filter(Boolean).map((time) => {
    const log = logs.find((l) => l.medicineId === m.id && isoDayIn(l.scheduledFor, tz) === todayKey &&
      inZone(l.scheduledFor, tz, { hour: "2-digit", minute: "2-digit", hour12: false }) === time);
    return { medicineId: m.id, name: m.name, dosage: m.dosage, instructions: m.instructions, time, status: log?.status ?? "pending" };
  })).sort((a, b) => a.time.localeCompare(b.time));

  return {
    elder: { id: elder.id, name: elder.name, preferredName: elder.preferredName, languages: elder.languages.split(","), timezone: tz, consentStatus: elder.consentStatus },
    features: FEATURES[(elder.family.plan as PlanId)] ?? FEATURES.trial,
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, relation: c.relation })),
    doses,
    messages: messages.map((m) => ({ id: m.id, from: m.fromName, url: `/api/media/${m.audioPath}?t=${elder.screenToken}`, played: !!m.playedAt, at: m.createdAt.toISOString(), transcript: m.transcript })),
    avatar: avatar ? { name: avatar.displayName, photo: avatar.photoPath ? `/api/media/${avatar.photoPath}?t=${elder.screenToken}` : null } : null,
    ringing: ringing ? { callId: ringing.id, from: ringing.contactName } : null,
  };
}

export type ScreenState = Awaited<ReturnType<typeof screenState>>;

/** Turn a local "HH:MM" today in the elder's zone into a UTC Date. */
export function todayAt(time: string, timeZone: string) {
  const key = isoDayIn(new Date(), timeZone);
  const guess = new Date(`${key}T${time}:00Z`);
  const local = new Date(guess.toLocaleString("en-US", { timeZone }) + " UTC");
  return new Date(guess.getTime() - (local.getTime() - guess.getTime()));
}
