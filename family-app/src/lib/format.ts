export function inZone(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, ...opts }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts).format(date);
  }
}

export function timeIn(date: Date, timeZone: string) {
  return inZone(date, timeZone, { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

export function dayIn(date: Date, timeZone: string) {
  return inZone(date, timeZone, { weekday: "short", day: "numeric", month: "short" });
}

/** YYYY-MM-DD of `date` in a time zone. */
export function isoDayIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function relative(date: Date, now = new Date()) {
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function duration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${s.toString().padStart(2, "0")} s` : `${s} s`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export const MOOD_LABEL: Record<number, string> = { 1: "Very low", 2: "Low", 3: "Okay", 4: "Good", 5: "Very good" };

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", es: "Spanish", bn: "Bengali", ta: "Tamil", te: "Telugu", mr: "Marathi",
  gu: "Gujarati", kn: "Kannada", ml: "Malayalam", pa: "Punjabi", od: "Odia", fr: "French", de: "German", pt: "Portuguese", it: "Italian",
};
