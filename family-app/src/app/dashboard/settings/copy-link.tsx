"use client";

import { ArrowSquareOut, Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4">
      <label className="field-label" htmlFor="screen-url">Screen link (keep it private)</label>
      <div className="flex gap-2">
        <input id="screen-url" readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn-secondary !px-3" aria-label="Copy link" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary !px-3" aria-label="Open screen in a new tab"><ArrowSquareOut size={18} /></a>
      </div>
    </div>
  );
}
