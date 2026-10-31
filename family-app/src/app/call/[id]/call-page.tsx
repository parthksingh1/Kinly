"use client";

import { useRouter } from "next/navigation";
import { VideoCall } from "@/components/video-call";

export function CallPage({ callId, screenToken }: { callId: string; screenToken?: string }) {
  const router = useRouter();
  return <VideoCall callId={callId} screenToken={screenToken} large={!!screenToken} onEnd={() => router.push(screenToken ? `/screen/${screenToken}` : "/dashboard")} />;
}
