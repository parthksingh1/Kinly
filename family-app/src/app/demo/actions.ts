"use server";

import crypto from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { resetDemo } from "@/lib/demo-seed";
import { kinly, pushToScreen } from "@/lib/kinly-api";
import { UPLOADS_DIR } from "@/lib/uploads";
import { videoProvider } from "@/lib/video";

export type DemoResult = { ok: boolean; title: string; detail?: string; link?: string };

function guard() {
  if (process.env.DEMO_MODE !== "true") throw new Error("Demo controls are only available with DEMO_MODE=true");
}

async function demoElder() {
  const elder = await db.elder.findFirst({ where: { isDemo: true } });
  if (!elder) throw new Error("No demo family yet. Press “Reset demo” first.");
  return elder;
}

export async function simulate(kind: "checkin" | "fall" | "scam" | "missed_medicine" | "missed_call", language?: string): Promise<DemoResult> {
  guard();
  try {
    const elder = await demoElder();
    const res = await kinly<{ via: string; reply?: string; text?: string; alert?: { title: string } | null; medicine?: string }>(
      "/api/kinly/demo/simulate", { elderId: elder.id, kind, language },
    );
    revalidatePath("/dashboard", "layout");
    const titles = { checkin: "Check-in started on the screen", fall: "Fall mentioned", scam: "Scam call mentioned", missed_medicine: "Missed medicine escalated", missed_call: "Missed call alert sent" };
    if (res.via === "screen") return { ok: true, title: titles[kind], detail: `Kamala's screen is saying: “${res.text}”` };
    return { ok: true, title: titles[kind], detail: res.reply ? `Kinly replied: “${res.reply}”` : res.alert ? `Alert: ${res.alert.title}` : "Done." };
  } catch (e) {
    return { ok: false, title: "That didn't work", detail: (e as Error).message };
  }
}

export async function phoneCall(phone: string): Promise<DemoResult> {
  guard();
  try {
    const elder = await demoElder();
    const res = await kinly<{ ok: boolean; call: { status: string; error?: string; executionId?: string } }>("/api/kinly/calls/outbound", { elderId: elder.id, phone, reason: "demo" });
    if (!res.ok) return { ok: false, title: "Call not placed", detail: res.call.error };
    return { ok: true, title: "Calling now", detail: `Bolna execution ${res.call.executionId ?? ""}. The summary appears on the dashboard about a minute after the call ends.` };
  } catch (e) {
    return { ok: false, title: "Call not placed", detail: (e as Error).message };
  }
}

export async function riyaCalls(): Promise<DemoResult> {
  guard();
  const elder = await demoElder();
  const call = await db.videoCall.create({
    data: { elderId: elder.id, roomName: `kinly-${crypto.randomBytes(6).toString("hex")}`, provider: videoProvider(), initiatedBy: "family", contactName: "Riya", status: "ringing" },
  });
  const { delivered } = await pushToScreen(elder.id, { type: "kinly-incoming-call", callId: call.id, from: "Riya" });
  return {
    ok: true, title: delivered ? "Kamala's screen is ringing" : "Call created (screen will ring within a few seconds)",
    detail: "Open Riya's side to join the call.", link: `/call/${call.id}?as=family`,
  };
}

export async function sendRiyaMessage(): Promise<DemoResult> {
  guard();
  const elder = await demoElder();
  const msg = await db.voiceMessage.findFirst({ where: { elderId: elder.id, direction: "to_elder" }, orderBy: { createdAt: "desc" } });
  if (msg) await db.voiceMessage.update({ where: { id: msg.id }, data: { playedAt: null, createdAt: new Date() } });
  await pushToScreen(elder.id, { type: "kinly-new-message", messageId: msg?.id, from: "Riya" });
  return { ok: true, title: "Riya's voice message is waiting", detail: "Kamala can say “play my messages” or tap Messages." };
}

export async function reset(): Promise<DemoResult> {
  guard();
  try {
    await kinly("/api/kinly/sessions/end-all", {}).catch(() => null);
    await resetDemo(db, {
      elderPhone: process.env.DEMO_ELDER_PHONE, familyPhone: process.env.DEMO_FAMILY_PHONE, uploadsDir: UPLOADS_DIR,
      assetsDir: path.resolve(process.cwd(), "prisma", "demo-assets"),
    });
    revalidatePath("/", "layout");
    return { ok: true, title: "Demo reset", detail: "Kamala's 14 days of history are back. Log in again as arjun@kinly.demo if asked." };
  } catch (e) {
    return { ok: false, title: "Reset failed", detail: (e as Error).message };
  }
}
