import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const COOKIE = "kinly_session";
const ELDER_COOKIE = "kinly_elder";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-kinly-auth-secret-change-me");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_INSECURE_COOKIES,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(ELDER_COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string") return null;
    return db.user.findUnique({ where: { id: payload.uid } });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in member, their family, and the elder currently in view. */
export async function requireContext() {
  const user = await requireUser();
  const membership = await db.familyMember.findFirst({
    where: { userId: user.id },
    include: { family: { include: { elders: { orderBy: { createdAt: "asc" } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) redirect("/onboarding");
  const elders = membership.family.elders;
  if (elders.length === 0) redirect("/onboarding");
  const wanted = (await cookies()).get(ELDER_COOKIE)?.value;
  const elder = elders.find((e) => e.id === wanted) ?? elders[0];
  return { user, membership, family: membership.family, elder, elders, isOwner: membership.role === "owner" };
}

export async function selectElder(elderId: string) {
  (await cookies()).set(ELDER_COOKIE, elderId, { httpOnly: true, sameSite: "lax", path: "/" });
}
