"use client";

import {
  Bell, BookOpenText, ChartLineUp, ChatsCircle, CreditCard, GearSix, House, List, Microphone, Pill, Presentation,
  SignOut, Sparkle, UsersThree, X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo, Monogram } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Today", icon: House },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell, badge: "alerts" as const },
  { href: "/dashboard/conversations", label: "Conversations", icon: ChatsCircle },
  { href: "/dashboard/care", label: "Care plan", icon: Pill },
  { href: "/dashboard/messages", label: "Voice messages", icon: Microphone },
  { href: "/dashboard/memory-book", label: "Memory Book", icon: BookOpenText },
  { href: "/dashboard/avatar", label: "Family Avatar", icon: Sparkle },
  { href: "/dashboard/family", label: "Family", icon: UsersThree },
  { href: "/dashboard/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: GearSix },
];

type Props = {
  children: React.ReactNode;
  elder: { name: string; preferredName: string; online: boolean; lastActive: string | null };
  elders: { id: string; preferredName: string }[];
  currentElderId: string;
  user: { name: string; email: string; isAdmin: boolean };
  openAlerts: number;
  demoMode: boolean;
  switchElder: (formData: FormData) => Promise<void>;
  logout: () => Promise<void>;
};

export function Shell({ children, elder, elders, currentElderId, user, openAlerts, demoMode, switchElder, logout }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
      {NAV.map(({ href, label, icon: Icon, badge }) => (
        <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}
          className={clsx("flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.92rem] transition-colors",
            isActive(href) ? "bg-white font-semibold text-[var(--color-ink)] shadow-[var(--shadow-card)]" : "text-[var(--color-ink-soft)] hover:bg-white/60")}>
          <Icon size={19} weight={isActive(href) ? "fill" : "regular"} aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {badge === "alerts" && openAlerts > 0 && (
            <span className="rounded-full bg-[var(--color-danger)] px-2 py-0.5 text-[0.7rem] font-semibold text-white" aria-label={`${openAlerts} open alerts`}>{openAlerts}</span>
          )}
        </Link>
      ))}
      {(user.isAdmin || demoMode) && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <p className="eyebrow px-3 pb-2">Team</p>
          <Link href="/admin/metrics" className={clsx("flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.92rem]", isActive("/admin") ? "bg-white font-semibold shadow-[var(--shadow-card)]" : "text-[var(--color-ink-soft)] hover:bg-white/60")}>
            <ChartLineUp size={19} aria-hidden="true" /> Metrics
          </Link>
          {demoMode && (
            <Link href="/demo" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.92rem] text-[var(--color-ink-soft)] hover:bg-white/60">
              <Presentation size={19} aria-hidden="true" /> Demo controls
            </Link>
          )}
        </div>
      )}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-5 py-5">
      <div className="px-6"><Link href="/dashboard" aria-label="Kinly dashboard"><Logo /></Link></div>
      <div className="mx-3 rounded-2xl border border-[var(--color-line)] bg-white/70 p-3">
        <div className="flex items-center gap-3">
          <Monogram name={elder.name} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{elder.preferredName}</p>
            <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              <span className={clsx("h-2 w-2 rounded-full", elder.online ? "bg-[#2f9e62]" : "bg-[var(--color-faint)]")} aria-hidden="true" />
              {elder.online ? "Screen is on" : elder.lastActive ? `Last chat ${elder.lastActive}` : "No chats yet"}
            </p>
          </div>
        </div>
        {elders.length > 1 && (
          <form action={switchElder} className="mt-3">
            <label htmlFor="elder-switch" className="sr-only">Switch person</label>
            <select id="elder-switch" name="elderId" defaultValue={currentElderId} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="input !min-h-9 !py-1 text-sm">
              {elders.map((e) => <option key={e.id} value={e.id}>{e.preferredName}</option>)}
            </select>
          </form>
        )}
      </div>
      {nav}
      <div className="mx-3 flex items-center gap-3 rounded-xl px-3 py-2">
        <Monogram name={user.name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">{user.email}</p>
        </div>
        <form action={logout}><button className="btn btn-ghost !min-h-9 !px-2" aria-label="Log out"><SignOut size={18} /></button></form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-dvh print:!hidden border-r border-[var(--color-line)] bg-[var(--color-linen)] lg:block">{sidebar}</aside>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between print:hidden border-b border-[var(--color-line)] bg-[var(--color-linen)]/90 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" aria-label="Kinly dashboard"><Logo /></Link>
        <button className="btn btn-ghost !px-2" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><List size={24} /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-[var(--color-ink)]/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-xs bg-[var(--color-linen)] shadow-[var(--shadow-lift)]">
            <button className="btn btn-ghost absolute right-2 top-3 !px-2" onClick={() => setOpen(false)} aria-label="Close menu"><X size={22} /></button>
            {sidebar}
          </div>
        </div>
      )}
      <main id="main" className="min-w-0 px-4 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
