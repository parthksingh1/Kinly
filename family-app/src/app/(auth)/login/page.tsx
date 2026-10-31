import type { Metadata } from "next";
import { demoLogin } from "../actions";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }) {
  const { next, demo } = await searchParams;
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <>
      <h1 className="display text-4xl">Welcome back</h1>
      <p className="mb-8 mt-2 text-[var(--color-muted)]">See how your family is doing today.</p>
      {demoMode && (
        <form action={demoLogin} className="mb-6">
          <button className={`btn w-full ${demo ? "btn-primary" : "btn-secondary"}`}>Explore the family (Kamala)</button>
          <p className="field-help text-center">Login: arjun@kinly.demo / kinly-demo</p>
        </form>
      )}
      <LoginForm next={next} />
    </>
  );
}
