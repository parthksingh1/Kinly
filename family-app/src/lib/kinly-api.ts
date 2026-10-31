import "server-only";

// Server-side client for the Kinly companion server (Python, Open-LLM-VTuber based).
const BASE = (process.env.KINLY_API_URL || "http://localhost:12393").replace(/\/$/, "");
const TOKEN = process.env.KINLY_API_TOKEN || "dev-kinly-token";

export class KinlyApiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

export async function kinly<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      ...init,
    });
  } catch {
    throw new KinlyApiError("The Kinly companion server is not reachable. Is it running on " + BASE + "?", 503);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {}
    throw new KinlyApiError(detail, res.status);
  }
  const type = res.headers.get("content-type") || "";
  return (type.includes("json") ? res.json() : res.arrayBuffer()) as Promise<T>;
}

export async function kinlyHealth() {
  try {
    return await kinly<{
      ok: boolean;
      demoMode: boolean;
      providers: Record<string, boolean>;
      onlineScreens: string[];
    }>("/api/kinly/health");
  } catch {
    return null;
  }
}

export async function notifyFamily(elderId: string, subject: string, body: string) {
  try {
    return await kinly<{ deliveries: number }>("/api/kinly/notify", { elderId, subject, body });
  } catch {
    return { deliveries: 0 };
  }
}

export async function pushToScreen(elderId: string, message: Record<string, unknown>) {
  try {
    return await kinly<{ delivered: number }>("/api/kinly/screen/push", { elderId, message });
  } catch {
    return { delivered: 0 };
  }
}
