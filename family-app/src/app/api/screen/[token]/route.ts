import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { elderByScreenToken } from "@/lib/access";
import { db } from "@/lib/db";
import { notifyFamily } from "@/lib/kinly-api";
import { hasFeature } from "@/lib/plans";
import { screenState, todayAt } from "@/lib/screen-state";
import { videoProvider } from "@/lib/video";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  const elder = await elderByScreenToken((await params).token);
  if (!elder) return NextResponse.json({ error: "Not paired" }, { status: 404 });
  return NextResponse.json(await screenState(elder));
}

// Actions from the elder screen: { action: "dose" | "played" | "call" | "call-status", ... }
export async function POST(req: NextRequest, { params }: Ctx) {
  const elder = await elderByScreenToken((await params).token);
  if (!elder) return NextResponse.json({ error: "Not paired" }, { status: 404 });
  const body = await req.json();

  if (body.action === "dose") {
    const scheduledFor = todayAt(String(body.time), elder.timezone);
    await db.medicineLog.upsert({
      where: { medicineId_scheduledFor: { medicineId: body.medicineId, scheduledFor } },
      create: { elderId: elder.id, medicineId: body.medicineId, scheduledFor, status: "taken", confirmedAt: new Date(), source: "screen" },
      update: { status: "taken", confirmedAt: new Date(), source: "screen" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "played") {
    await db.voiceMessage.updateMany({ where: { id: body.messageId, elderId: elder.id, playedAt: null }, data: { playedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "call") {
    if (!hasFeature(elder.family.plan, "video_calls")) return NextResponse.json({ error: "Video calls are part of the Family plan" }, { status: 402 });
    const contact = await db.contact.findFirst({ where: { id: body.contactId, elderId: elder.id } });
    if (!contact) return NextResponse.json({ error: "Unknown contact" }, { status: 404 });
    const call = await db.videoCall.create({
      data: { elderId: elder.id, roomName: `kinly-${crypto.randomBytes(6).toString("hex")}`, provider: videoProvider(), initiatedBy: "elder", contactId: contact.id, contactName: contact.name, status: "ringing" },
    });
    const appUrl = process.env.APP_URL || req.nextUrl.origin;
    await notifyFamily(elder.id, `${elder.preferredName} wants to video call ${contact.name}`,
      `${elder.preferredName} pressed "Call ${contact.name}" on their Kinly screen. Join the video call now: ${appUrl}/call/${call.id}?as=family`);
    return NextResponse.json({ ok: true, callId: call.id, provider: call.provider });
  }

  if (body.action === "call-status") {
    const status = String(body.status);
    if (!["active", "ended", "declined", "missed"].includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });
    await db.videoCall.updateMany({
      where: { id: body.callId, elderId: elder.id },
      data: { status, answeredAt: status === "active" ? new Date() : undefined, endedAt: status !== "active" ? new Date() : undefined },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
