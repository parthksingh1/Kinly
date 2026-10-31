"use client";

/**
 * Kinly's on-screen presence: a calm, premium voice orb (no cartoon face).
 * - the inner light and the voice bars follow the speech volume (the server's 20 ms envelope)
 * - the tint shifts gently with the moment: warm when happy, softer when concerned
 * - slow breathing at rest; respects reduced motion
 */
export type Expression = "neutral" | "happy" | "laughing" | "concerned" | "listening" | "surprised";

const TINT: Record<Expression, [string, string]> = {
  neutral: ["#3f8a74", "#123b31"],
  listening: ["#4b9a82", "#143f35"],
  happy: ["#5aa184", "#16443a"],
  laughing: ["#5aa184", "#16443a"],
  surprised: ["#4b9a82", "#143f35"],
  concerned: ["#5d7f8f", "#1b3440"],
};

export function CompanionFace({ mouth, expression, speaking, size = 360 }: {
  mouth: number;
  expression: Expression;
  speaking: boolean;
  size?: number;
}) {
  const level = Math.min(1, Math.max(0, mouth));
  const [light, deep] = TINT[expression];
  const bars = [0.45, 0.75, 1, 0.75, 0.45];
  const listening = expression === "listening" && !speaking;

  return (
    <svg viewBox="-170 -170 340 340" width={size} height={size} role="img" aria-label={`Kinly is ${speaking ? "speaking" : listening ? "listening" : "here"}`} className="max-w-full">
      <defs>
        <radialGradient id="orb-body" cx="40%" cy="32%" r="78%">
          <stop offset="0%" stopColor={light} style={{ transition: "stop-color 800ms ease" }} />
          <stop offset="100%" stopColor={deep} style={{ transition: "stop-color 800ms ease" }} />
        </radialGradient>
        <radialGradient id="orb-halo" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#e8b48f" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#e8b48f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6ea" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff6ea" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g style={{ transform: `scale(${1 + (speaking ? level * 0.08 : 0)})`, transition: "transform 90ms linear", transformOrigin: "0 0" }}>
        <circle r="168" fill="url(#orb-halo)" />
      </g>
      <circle r="146" fill="none" stroke="#1d5547" strokeOpacity={listening ? 0.28 : 0.1} strokeWidth="1.5" className={listening ? "motion-safe:animate-pulse" : ""} />
      <circle r="132" fill="none" stroke="#1d5547" strokeOpacity="0.06" strokeWidth="1" />

      <g className="motion-safe:animate-breathe" style={{ transformOrigin: "0 0" }}>
        <circle r="116" fill="url(#orb-body)" />
        <ellipse cx="-34" cy="-56" rx="52" ry="30" fill="#ffffff" opacity="0.13" />
        <circle r={40 + level * 26} fill="url(#orb-core)" opacity={0.35 + level * 0.5} style={{ transition: "r 90ms linear, opacity 90ms linear" }} />
        {/* voice bars */}
        <g fill="#f7efe3">
          {bars.map((b, i) => {
            const h = 10 + (speaking ? level * 64 * b : listening ? 8 * b : 4);
            return <rect key={i} x={-46 + i * 20 - 4} y={-h / 2} width="8" height={h} rx="4" opacity={0.92} style={{ transition: "all 90ms linear" }} />;
          })}
        </g>
      </g>
    </svg>
  );
}
