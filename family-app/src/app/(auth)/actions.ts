"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_PASSWORD } from "@/lib/demo-seed";

export type AuthState = { error?: string; fields?: Record<string, string> };

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  const fields = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists. Try logging in.", fields };
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);

  const invite = String(form.get("invite") ?? "");
  if (invite) redirect(`/invite/${invite}`);
  const plan = String(form.get("plan") ?? "");
  redirect(plan ? `/onboarding?plan=${plan}` : "/onboarding");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match.", fields: { email } };
  }
  await createSession(user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function demoLogin() {
  if (process.env.DEMO_MODE !== "true") redirect("/login");
  let user = await db.user.findUnique({ where: { email: "arjun@kinly.demo" } });
  if (!user) {
    const { resetDemo } = await import("@/lib/demo-seed");
    const path = await import("node:path");
    const { UPLOADS_DIR } = await import("@/lib/uploads");
    await resetDemo(db, {
      elderPhone: process.env.DEMO_ELDER_PHONE, familyPhone: process.env.DEMO_FAMILY_PHONE, uploadsDir: UPLOADS_DIR,
      assetsDir: path.resolve(process.cwd(), "prisma", "demo-assets"),
    });
    user = await db.user.findUnique({ where: { email: "arjun@kinly.demo" } });
  }
  if (!user || !(await verifyPassword(DEMO_PASSWORD, user.passwordHash))) redirect("/login");
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
