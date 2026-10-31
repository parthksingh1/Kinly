import { NextRequest, NextResponse } from "next/server";
import { canAccessElder } from "@/lib/access";
import { db } from "@/lib/db";
import { mimeFor, readUpload } from "@/lib/uploads";

// Serves uploaded audio/images only to the elder's family or the paired elder screen.
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.join("/");
  const owner =
    (await db.voiceMessage.findFirst({ where: { audioPath: rel }, select: { elderId: true } })) ??
    (await db.familyAvatar.findFirst({ where: { OR: [{ photoPath: rel }, { consentAudioPath: rel }] }, select: { elderId: true } }));
  if (!owner) return new NextResponse("Not found", { status: 404 });
  const access = await canAccessElder(owner.elderId, req.nextUrl.searchParams.get("t"));
  if (!access) return new NextResponse("Forbidden", { status: 403 });
  const data = await readUpload(rel);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": mimeFor(rel), "Cache-Control": "private, max-age=3600" } });
}
