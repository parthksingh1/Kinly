"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Recorder } from "@/components/recorder";

export function MessageComposer({ elderId }: { elderId: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  return (
    <div>
      <Recorder onSend={async (blob, seconds) => {
        const form = new FormData();
        form.append("audio", blob, "message.webm");
        form.append("elderId", elderId);
        form.append("duration", String(seconds));
        const res = await fetch("/api/messages", { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
        setSent(true);
        router.refresh();
      }} />
      {sent && <p className="mt-3 text-sm text-[var(--color-evergreen)]" aria-live="polite">Sent. Kinly will play it for them.</p>}
    </div>
  );
}
