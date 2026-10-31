"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "./actions";

function PasswordField({ autoComplete }: { autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="field-label" htmlFor="password">Password</label>
      <div className="relative">
        <input id="password" name="password" type={show ? "text" : "password"} required minLength={8} autoComplete={autoComplete} className="input pr-12" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          {show ? <EyeSlash size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function FormError({ state }: { state: AuthState }) {
  if (!state.error) return null;
  return <p role="alert" className="rounded-xl border border-[#f3c5c0] bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]">{state.error}</p>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.fields?.email} className="input" />
      </div>
      <PasswordField autoComplete="current-password" />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
      <p className="text-center text-sm text-[var(--color-muted)]">New to Kinly? <Link href="/signup" className="font-medium text-[var(--color-evergreen)] underline-offset-4 hover:underline">Create an account</Link></p>
    </form>
  );
}

export function SignupForm({ plan, invite, email }: { plan?: string; invite?: string; email?: string }) {
  const [state, action, pending] = useActionState(signup, {});
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input type="hidden" name="plan" value={plan ?? ""} />
      <input type="hidden" name="invite" value={invite ?? ""} />
      <div>
        <label className="field-label" htmlFor="name">Your name</label>
        <input id="name" name="name" required autoComplete="name" defaultValue={state.fields?.name} className="input" />
      </div>
      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.fields?.email ?? email} className="input" />
      </div>
      <PasswordField autoComplete="new-password" />
      <p className="field-help -mt-2">At least 8 characters.</p>
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Creating your account…" : "Create account"}</button>
      <p className="text-center text-sm text-[var(--color-muted)]">Already have an account? <Link href="/login" className="font-medium text-[var(--color-evergreen)] underline-offset-4 hover:underline">Log in</Link></p>
    </form>
  );
}
