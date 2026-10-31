// Dev helper: prints a session cookie for a user (for local smoke tests and screenshots).
// Usage: node scripts/dev-session.mjs arjun@kinly.demo
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(import.meta.dirname, "..", "..", ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).split(/\s+#/)[0].trim()]),
);
const db = new PrismaClient();
const user = await db.user.findUnique({ where: { email: process.argv[2] ?? "arjun@kinly.demo" } });
if (!user) throw new Error("No such user");
const token = await new SignJWT({ uid: user.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(env.AUTH_SECRET || "dev-only-kinly-auth-secret-change-me"));
console.log(`kinly_session=${token}`);
await db.$disconnect();
