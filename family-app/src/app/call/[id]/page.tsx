import type { Metadata } from "next";
import { CallPage } from "./call-page";

export const metadata: Metadata = { title: "Video call" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  return <CallPage callId={id} screenToken={t} />;
}
