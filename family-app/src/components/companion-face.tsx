"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kinly's on-screen companion: a calm, warm presence (not an anime character, not a cartoon person).
 * A softly lit evergreen sphere with cream features:
 * - the mouth opens with the speech volume (lip sync from the server's 20 ms volume envelope)
 * - halo rings breathe with the voice while Kinly speaks
 * - expressions: neutral, happy, laughing, concerned, listening, surprised
 * - natural blinking and slow idle breathing (disabled with reduced motion)
 */
export type Expression = "neutral" | "happy" | "laughing" | "concerned" | "listening" | "surprised";

const CREAM = "#f7efe3";

export function CompanionFace({ mouth, expression, speaking, size = 360 }: {
  mouth: number;
  expression: Expression;
  speaking: boolean;
  size?: number;
}) {
  const [blink, setBlink] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const schedule = () => {
      timer.current = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        schedule();
      }, 3000 + Math.random() * 3500);
    };
    schedule();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const level = Math.min(1, Math.max(0, mouth));
  const happyEyes = expression === "happy" || expression === "laughing";
  const look = expression === "listening" ? { x: 5, y: -4 } : { x: 0, y: 0 };
  const eyeH = blink ? 2 : expression === "surprised" ? 22 : 17;
  const smile = { laughing: 16, happy: 12, listening: 7, neutral: 6, surprised: 0, concerned: -4 }[expression];
  const open = level * 22 + (expression === "surprised" ? 8 : 0) + (expression === "laughing" ? 6 : 0);
  const mw = expression === "surprised" ? 26 : 46;
  const mouthPath = `M ${-mw / 2} 0 Q 0 ${smile} ${mw / 2} 0 Q 0 ${smile + open} ${-mw / 2} 0 Z`;
  const ring = speaking ? 1 + level * 0.07 : 1;

  return (
    <svg viewBox="-170 -170 340 340" width={size} height={size} role="img" aria-label={`Kinly, ${speaking ? "speaking" : expression}`} className="max-w-full">
      <defs>
        <radialGradient id="kinly-body" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#3f8a74" />
          <stop offset="55%" stopColor="#1f5c4d" />
          <stop offset="100%" stopColor="#123b31" />
        </radialGradient>
        <radialGradient id="kinly-glow" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#e8b48f" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#e8b48f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="kinly-shine" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* voice halo */}
      <g style={{ transform: `scale(${ring})`, transition: "transform 80ms linear", transformOrigin: "0 0" }}>
        <circle r="166" fill="url(#kinly-glow)" />
        <circle r="146" fill="none" stroke="#1d5547" strokeOpacity={speaking ? 0.16 : 0.08} strokeWidth="2" />
      </g>

      <g className="motion-safe:animate-breathe" style={{ transformOrigin: "0 0" }}>
        <circle r="120" fill="url(#kinly-body)" />
        <ellipse cx="-38" cy="-58" rx="46" ry="30" fill="url(#kinly-shine)" />

        <g transform={`translate(${look.x} ${look.y})`} style={{ transition: "transform 500ms cubic-bezier(.2,.7,.2,1)" }}>
          {/* brows only when concerned or surprised */}
          {(expression === "concerned" || expression === "surprised") && (
            <g stroke={CREAM} strokeWidth="5" strokeLinecap="round" opacity="0.9">
              <line x1="-52" y1={expression === "concerned" ? -42 : -50} x2="-24" y2={expression === "concerned" ? -50 : -52} />
              <line x1="24" y1={expression === "concerned" ? -50 : -52} x2="52" y2={expression === "concerned" ? -42 : -50} />
            </g>
          )}
          {/* eyes */}
          {happyEyes && !blink ? (
            <g stroke={CREAM} strokeWidth="7" fill="none" strokeLinecap="round">
              <path d="M -50 -14 Q -38 -28 -26 -14" />
              <path d="M 26 -14 Q 38 -28 50 -14" />
            </g>
          ) : (
            <g fill={CREAM}>
              <rect x="-45" y={-18 - eyeH / 2} width="14" height={eyeH} rx="7" style={{ transition: "all 90ms ease" }} />
              <rect x="31" y={-18 - eyeH / 2} width="14" height={eyeH} rx="7" style={{ transition: "all 90ms ease" }} />
            </g>
          )}
          {/* cheeks */}
          <circle cx="-62" cy="16" r="11" fill="#e8b48f" opacity={happyEyes ? 0.55 : 0.28} />
          <circle cx="62" cy="16" r="11" fill="#e8b48f" opacity={happyEyes ? 0.55 : 0.28} />
          {/* mouth */}
          <g transform="translate(0 30)">
            <path d={mouthPath} fill={open > 2 ? CREAM : "none"} fillOpacity={0.95} stroke={CREAM} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}
