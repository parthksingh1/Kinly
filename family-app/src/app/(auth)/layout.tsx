import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="Kinly home"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-[var(--color-evergreen-deep)] p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <svg className="absolute -right-24 -top-24 h-[520px] w-[520px] text-white/[0.04]" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="96" fill="currentColor" />
          <circle cx="100" cy="100" r="64" fill="currentColor" />
        </svg>
        <blockquote className="relative max-w-md">
          <p className="display text-[2rem] leading-snug">
            “Every morning Kinly asks about her roses. She waits for that call now. And I finally sleep at night.”
          </p>
          <footer className="mt-6 text-sm text-white/60">The kind of morning we are building Kinly for.</footer>
        </blockquote>
      </aside>
    </div>
  );
}
