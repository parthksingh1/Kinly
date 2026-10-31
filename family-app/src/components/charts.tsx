"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const MOOD = ["", "Very low", "Low", "Okay", "Good", "Very good"];

type MoodPoint = { day: string; mood: number | null };
type AdherencePoint = { day: string; taken: number; missed: number };

function ChartTooltip({ active, payload, label, kind }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string; kind: "mood" | "meds" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs shadow-[var(--shadow-lift)]">
      <p className="font-semibold">{label}</p>
      {kind === "mood"
        ? <p className="text-[var(--color-muted)]">Mood: {MOOD[Math.round(payload[0].value)] ?? "—"}</p>
        : payload.map((p) => <p key={p.name} className="text-[var(--color-muted)] capitalize">{p.name}: {p.value}</p>)}
    </div>
  );
}

export function MoodChart({ data }: { data: MoodPoint[] }) {
  const summary = data.filter((d) => d.mood).map((d) => `${d.day}: ${MOOD[d.mood!]}`).join(", ");
  return (
    <div className="h-52 w-full" role="img" aria-label={`Mood over the last ${data.length} days. ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d5547" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#1d5547" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ece6db" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#5f6b67", fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tickFormatter={(v) => ({ 1: "Low", 3: "Okay", 5: "Great" } as Record<number, string>)[v] ?? ""} tickLine={false} axisLine={false} tick={{ fill: "#5f6b67", fontSize: 11 }} width={52} />
          <Tooltip content={<ChartTooltip kind="mood" />} cursor={{ stroke: "#d3cbbb" }} />
          <Area isAnimationActive={false} type="monotone" dataKey="mood" stroke="#1d5547" strokeWidth={2.2} fill="url(#moodFill)" connectNulls dot={{ r: 3, fill: "#1d5547", strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdherenceChart({ data }: { data: AdherencePoint[] }) {
  const taken = data.reduce((a, d) => a + d.taken, 0);
  const missed = data.reduce((a, d) => a + d.missed, 0);
  return (
    <div className="h-52 w-full" role="img" aria-label={`Medicine doses over the last ${data.length} days: ${taken} taken, ${missed} missed.`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid vertical={false} stroke="#ece6db" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#5f6b67", fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#5f6b67", fontSize: 11 }} />
          <Tooltip content={<ChartTooltip kind="meds" />} cursor={{ fill: "#f3efe7" }} />
          <Bar isAnimationActive={false} dataKey="taken" stackId="a" fill="#1d5547" radius={[0, 0, 3, 3]} />
          <Bar isAnimationActive={false} dataKey="missed" stackId="a" fill="#b2603a" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
