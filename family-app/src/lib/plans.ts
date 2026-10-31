// Plans, prices and feature flags. Prices are placeholders, configurable by env.
// Keep FEATURES in sync with PLAN_FEATURES in src/kinly/repo.py (the companion enforces them too).

export type PlanId = "trial" | "care" | "family" | "premium";
export type Feature =
  | "checkin_call" | "inbound" | "reminders" | "daily_summary" | "safety_alerts" | "screen"
  | "video_calls" | "voice_messages" | "memory_book" | "scam_shield" | "priority_alerts"
  | "family_avatar" | "multi_calls";

export const FEATURES: Record<PlanId, Feature[]> = {
  trial: ["checkin_call", "reminders", "daily_summary", "safety_alerts", "screen", "voice_messages", "video_calls", "memory_book", "scam_shield", "inbound"],
  care: ["checkin_call", "inbound", "reminders", "daily_summary", "safety_alerts"],
  family: ["checkin_call", "inbound", "reminders", "daily_summary", "safety_alerts", "screen", "video_calls", "voice_messages", "memory_book", "scam_shield"],
  premium: ["checkin_call", "inbound", "reminders", "daily_summary", "safety_alerts", "screen", "video_calls", "voice_messages", "memory_book", "scam_shield", "priority_alerts", "family_avatar", "multi_calls"],
};

export const MEMBER_LIMIT: Record<PlanId, number> = { trial: 2, care: 2, family: 6, premium: 6 };

export type Currency = "USD" | "INR";

const PRICE_DEFAULTS: Record<Currency, Record<Exclude<PlanId, "trial">, number>> = {
  USD: { care: 19, family: 39, premium: 69 },
  INR: { care: 999, family: 1999, premium: 3499 },
};

export function price(plan: Exclude<PlanId, "trial">, currency: Currency): number {
  const env = process.env[`PRICE_${plan.toUpperCase()}_${currency}`];
  return env ? Number(env) : PRICE_DEFAULTS[currency][plan];
}

export function formatPrice(amount: number, currency: Currency) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const PLANS: {
  id: PlanId;
  name: string;
  tagline: string;
  bullets: string[];
}[] = [
  {
    id: "trial",
    name: "Free trial",
    tagline: "7 days to see if Kinly fits your family.",
    bullets: ["Daily check-in call", "Medicine reminders", "Daily summary for family"],
  },
  {
    id: "care",
    name: "Care",
    tagline: "A daily call and a safety net.",
    bullets: ["Daily check-in call", "Call Kinly anytime", "Medicine & appointment reminders", "Daily summary", "Safety alerts", "2 family members"],
  },
  {
    id: "family",
    name: "Family",
    tagline: "Everything that keeps you close.",
    bullets: ["Everything in Care", "Companion on a tablet or TV", "Video calls with one tap", "Family voice messages", "Memory Book", "Scam Shield", "Up to 6 family members"],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "More time together, every day.",
    bullets: ["Everything in Family", "Up to 3 calls a day", "Priority alerts", "Family Avatar (consent based)"],
  },
];

export function hasFeature(plan: string, feature: Feature): boolean {
  if (feature === "safety_alerts") return true;
  return (FEATURES[(plan as PlanId)] ?? FEATURES.trial).includes(feature);
}

export function defaultCurrency(): Currency {
  return (process.env.PLAN_CURRENCY as Currency) === "INR" ? "INR" : "USD";
}
