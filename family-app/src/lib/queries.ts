import "server-only";
import type { Elder } from "@prisma/client";
import { db } from "./db";
import { isoDayIn, inZone, parseJson } from "./format";

export async function trends(elder: Elder, days = 14) {
  const since = new Date(Date.now() - days * 86400000);
  const [summaries, logs] = await Promise.all([
    db.dailySummary.findMany({ where: { elderId: elder.id }, orderBy: { date: "desc" }, take: days }),
    db.medicineLog.findMany({ where: { elderId: elder.id, scheduledFor: { gte: since, lte: new Date() } } }),
  ]);
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = isoDayIn(d, elder.timezone);
    const dayLogs = logs.filter((l) => isoDayIn(l.scheduledFor, elder.timezone) === key);
    series.push({
      key,
      day: inZone(d, elder.timezone, { day: "numeric", month: "short" }),
      mood: byDate.get(key)?.mood ?? null,
      taken: dayLogs.filter((l) => l.status === "taken").length,
      missed: dayLogs.filter((l) => l.status === "missed").length,
    });
  }
  const taken = logs.filter((l) => l.status === "taken").length;
  const missed = logs.filter((l) => l.status === "missed").length;
  const moods = series.map((s) => s.mood).filter((m): m is number => m !== null);
  return {
    series,
    adherence: taken + missed ? Math.round((taken / (taken + missed)) * 100) : null,
    taken, missed,
    avgMood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
    recentMood: moods.slice(-3),
  };
}

export async function latestSummary(elder: Elder) {
  const s = await db.dailySummary.findFirst({ where: { elderId: elder.id }, orderBy: { date: "desc" } });
  if (!s) return null;
  return {
    ...s,
    topics: parseJson<string[]>(s.topics, []),
    followUps: parseJson<string[]>(s.followUps, []),
    talkAbout: parseJson<string[]>(s.talkAbout, []),
    isToday: s.date === isoDayIn(new Date(), elder.timezone),
  };
}

export async function todaysDoses(elder: Elder) {
  const key = isoDayIn(new Date(), elder.timezone);
  const logs = await db.medicineLog.findMany({
    where: { elderId: elder.id, scheduledFor: { gte: new Date(Date.now() - 36 * 3600000), lte: new Date(Date.now() + 36 * 3600000) } },
    include: { medicine: true },
    orderBy: { scheduledFor: "asc" },
  });
  const today = logs.filter((l) => isoDayIn(l.scheduledFor, elder.timezone) === key);
  // Doses not yet created by the companion (it creates them lazily) are shown from the schedule.
  const meds = await db.medicine.findMany({ where: { elderId: elder.id, active: true } });
  const planned = meds.flatMap((m) => m.times.split(",").filter(Boolean).map((t) => ({ medicine: m, time: t })));
  return planned.map(({ medicine, time }) => {
    const log = today.find((l) => l.medicineId === medicine.id && inZone(l.scheduledFor, elder.timezone, { hour: "2-digit", minute: "2-digit", hour12: false }) === time);
    return { id: log?.id ?? null, medicine: medicine.name, dosage: medicine.dosage, time, status: log?.status ?? "pending" };
  }).sort((a, b) => a.time.localeCompare(b.time));
}
