import type { Metadata, Viewport } from "next";
import { elderByScreenToken } from "@/lib/access";
import { screenState } from "@/lib/screen-state";
import { ScreenApp } from "./screen-app";

export const metadata: Metadata = { title: "Kinly", manifest: undefined, robots: { index: false } };
export const viewport: Viewport = { themeColor: "#f3ede2", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default async function ScreenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const elder = await elderByScreenToken(token);
  if (!elder) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--color-linen)] p-8 font-[family-name:var(--font-elder)]">
        <div className="max-w-xl text-center">
          <h1 className="text-5xl font-bold">This screen is not set up yet</h1>
          <p className="mt-6 text-2xl text-[var(--color-ink-soft)]">Please ask your family to open the Kinly link from their app on this device.</p>
        </div>
      </main>
    );
  }
  return <ScreenApp token={token} initial={await screenState(elder)} />;
}
