import "server-only";
import { currentUser } from "./auth";
import { db } from "./db";

/** Can the requester (family session or elder screen token) access this elder's data? */
export async function canAccessElder(elderId: string, screenToken?: string | null) {
  const elder = await db.elder.findUnique({ where: { id: elderId } });
  if (!elder) return null;
  if (screenToken && screenToken === elder.screenToken) return { elder, via: "screen" as const, user: null };
  const user = await currentUser();
  if (!user) return null;
  const member = await db.familyMember.findFirst({ where: { userId: user.id, familyId: elder.familyId } });
  return member ? { elder, via: "family" as const, user, member } : null;
}

export async function elderByScreenToken(token: string) {
  return db.elder.findUnique({ where: { screenToken: token }, include: { family: true } });
}
