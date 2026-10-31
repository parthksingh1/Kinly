"use client";

import { useActionState, useEffect, useRef } from "react";

type Result = { ok?: boolean; error?: string; message?: string };

/** A form bound to a server action, with pending state and an accessible result message. */
export function ActionForm({ action, children, submit, className, resetOnSuccess = true, submitClass = "btn btn-primary" }: {
  action: (prev: Result, form: FormData) => Promise<Result>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  resetOnSuccess?: boolean;
  submitClass?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={submitClass} disabled={pending}>{pending ? "Saving…" : submit}</button>
        <p aria-live="polite" className={`text-sm ${state.error ? "text-[var(--color-danger)]" : "text-[var(--color-evergreen)]"}`}>
          {state.error || state.message || (state.ok ? "Saved." : "")}
        </p>
      </div>
    </form>
  );
}

export function ConfirmButton({ action, label, confirm, className = "btn btn-ghost btn-sm" }: {
  action: () => Promise<void>; label: React.ReactNode; confirm: string; className?: string;
}) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      <button className={className}>{label}</button>
    </form>
  );
}
