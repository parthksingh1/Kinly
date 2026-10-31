import { NextRequest, NextResponse } from "next/server";
import { canAccessElder } from "@/lib/access";
import { db } from "@/lib/db";
import { livekitToken } from "@/lib/video";

type Ctx = { params: Promise<{ id: string }> };

async function authorize(req: NextRequest, id: string) {
  const call = await db.videoCall.findUnique({ where: { id } });
  if (!call) return null;
  const access = await canAccessElder(call.elderId, req.nextUrl.searchParams.get("t"));
  return access ? { call, access } : null;
}

// GET ?t=&for=elder|family&after=<ms>  -> call info, LiveKit token or pending P2P signals
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await authorize(req, (await params).id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { call, access } = ctx;
  const role = access.via === "screen" ? "elder" : "family";
  const after = new Date(Number(req.nextUrl.searchParams.get("after") ?? 0));
  const signals = call.provider === "p2p"
    ? await db.callSignal.findMany({ where: { callId: call.id, sender: { not: role }, createdAt: { gt: after } }, orderBy: { createdAt: "asc" } })
    : [];
  let livekit = null;
  if (call.provider === "livekit" && req.nextUrl.searchParams.get("token") === "1") {
    const identity = role === "elder" ? `elder-${call.elderId}` : `family-${access.user?.id}`;
    livekit = await livekitToken(call.roomName, identity, role === "elder" ? access.elder.preferredName : access.user?.name ?? "Family");
  }
  return NextResponse.json({
    call: { id: call.id, provider: call.provider, status: call.status, contactName: call.contactName, elderName: access.elder.preferredName, initiatedBy: call.initiatedBy },
    role,
    signals: signals.map((s) => ({ kind: s.kind, payload: s.payload, at: s.createdAt.getTime() })),
    livekit,
  });
}

// POST { kind: offer|answer|candidate|hangup, payload } or { status }
export async function POST(req: NextRequest, { params }: Ctx) {
  const ctx = await authorize(req, (await params).id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { call, access } = ctx;
  const role = access.via === "screen" ? "elder" : "family";
  const body = await req.json();
  if (body.kind) {
    if (body.kind === "offer") await db.callSignal.deleteMany({ where: { callId: call.id } }); // fresh negotiation
    await db.callSignal.create({ data: { callId: call.id, sender: role, kind: body.kind, payload: JSON.stringify(body.payload ?? null) } });
  }
  if (body.status && ["active", "ended", "declined", "missed"].includes(body.status)) {
    await db.videoCall.update({
      where: { id: call.id },
      data: { status: body.status, answeredAt: body.status === "active" ? call.answeredAt ?? new Date() : undefined, endedAt: body.status === "ended" ? new Date() : undefined },
    });
  }
  return NextResponse.json({ ok: true });
}
