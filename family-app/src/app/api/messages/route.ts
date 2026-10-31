import { NextRequest, NextResponse } from "next/server";
import { canAccessElder } from "@/lib/access";
import { db } from "@/lib/db";
import { pushToScreen } from "@/lib/kinly-api";
import { hasFeature } from "@/lib/plans";
import { saveUpload } from "@/lib/uploads";

const MAX_BYTES = 12 * 1024 * 1024;

// POST multipart: audio, elderId, [screenToken] -> family message to elder, or elder reply
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const audio = form.get("audio");
  const elderId = String(form.get("elderId") ?? "");
  const screenToken = form.get("screenToken") ? String(form.get("screenToken")) : null;
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Recording is too long" }, { status: 413 });
  const access = await canAccessElder(elderId, screenToken);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const family = await db.family.findUniqueOrThrow({ where: { id: access.elder.familyId } });
  if (!hasFeature(family.plan, "voice_messages")) return NextResponse.json({ error: "Voice messages are part of the Family plan" }, { status: 402 });

  const rel = await saveUpload(audio, `messages/${elderId}`);
  const fromElder = access.via === "screen";
  const msg = await db.voiceMessage.create({
    data: {
      elderId, direction: fromElder ? "from_elder" : "to_elder",
      fromName: fromElder ? access.elder.preferredName : access.user!.name.split(" ")[0],
      fromUserId: fromElder ? null : access.user!.id,
      audioPath: rel, mimeType: (audio.type || "audio/webm").split(";")[0],
      durationSec: Math.round(Number(form.get("duration") ?? 0)),
    },
  });
  if (!fromElder) await pushToScreen(elderId, { type: "kinly-new-message", messageId: msg.id, from: msg.fromName });
  return NextResponse.json({ ok: true, id: msg.id });
}
