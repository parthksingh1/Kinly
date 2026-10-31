import { NextRequest, NextResponse } from "next/server";
import { canAccessElder } from "@/lib/access";
import { db } from "@/lib/db";
import { kinly } from "@/lib/kinly-api";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const avatar = await db.familyAvatar.findUnique({ where: { id }, include: { elder: true } });
  if (!avatar || !(await canAccessElder(avatar.elderId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const text = `Hi ${avatar.elder.preferredName}, it's ${avatar.displayName}'s AI voice. The real ${avatar.displayName} will call you soon.`;
  try {
    const audio = await kinly<ArrayBuffer>(`/api/kinly/avatar/${id}/preview`, { text });
    return new NextResponse(audio, { headers: { "Content-Type": "audio/wav" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
