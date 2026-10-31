import type { Metadata } from "next";
import { SignupForm } from "../forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; invite?: string; email?: string }> }) {
  const { plan, invite, email } = await searchParams;
  return (
    <>
      <h1 className="display text-4xl">{invite ? "Join your family on Kinly" : "Start your free trial"}</h1>
      <p className="mb-8 mt-2 text-[var(--color-muted)]">
        {invite ? "Create an account to see updates and send messages." : "7 days free. Then choose the plan that fits. No card needed to start."}
      </p>
      <SignupForm plan={plan} invite={invite} email={email} />
    </>
  );
}
