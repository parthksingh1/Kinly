"use client";

import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash } from "@phosphor-icons/react";
import "@livekit/components-styles";
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from "@livekit/components-react";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  callId: string;
  screenToken?: string;     // set on the elder screen
  large?: boolean;          // elder-friendly controls
  onEnd: () => void;
};

type CallInfo = { provider: "livekit" | "p2p"; status: string; contactName: string; elderName: string };

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }];

export function VideoCall({ callId, screenToken, large, onEnd }: Props) {
  const q = screenToken ? `t=${encodeURIComponent(screenToken)}&` : "";
  const [info, setInfo] = useState<CallInfo | null>(null);
  const [role, setRole] = useState<"elder" | "family">("family");
  const [livekit, setLivekit] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/calls/${callId}?${q}token=1`).then(async (r) => {
      if (!r.ok) throw new Error("This call is no longer available.");
      const data = await r.json();
      setInfo(data.call);
      setRole(data.role);
      if (data.livekit) setLivekit(data.livekit);
    }).catch((e) => setError(e.message));
  }, [callId, q]);

  const post = useCallback((body: object) => fetch(`/api/calls/${callId}?${q}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), [callId, q]);

  const end = useCallback(() => { post({ kind: "hangup", status: "ended" }).finally(onEnd); }, [post, onEnd]);

  if (error) return <CallFrame large={large}><p className="text-center text-xl text-white">{error}</p><button className="btn mt-6 bg-white text-[var(--color-ink)]" onClick={onEnd}>Close</button></CallFrame>;
  if (!info) return <CallFrame large={large}><p className="text-xl text-white/80">Connecting…</p></CallFrame>;

  if (info.provider === "livekit" && livekit) {
    return (
      <div className="fixed inset-0 z-50 bg-black" data-lk-theme="default">
        <LiveKitRoom serverUrl={livekit.url} token={livekit.token} connect video audio onConnected={() => post({ status: "active" })} onDisconnected={end} className="h-full">
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }
  return <P2PCall info={info} role={role} post={post} q={q} callId={callId} large={large} onEnd={end} />;
}

function CallFrame({ children, large }: { children: React.ReactNode; large?: boolean }) {
  return <div className={clsx("fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f1a17] p-6", large && "font-[family-name:var(--font-elder)]")}>{children}</div>;
}

function P2PCall({ info, role, post, q, callId, large, onEnd }: {
  info: CallInfo; role: "elder" | "family"; post: (b: object) => Promise<Response>; q: string; callId: string; large?: boolean; onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const [status, setStatus] = useState<"starting" | "waiting" | "connected" | "ended">("starting");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const other = role === "elder" ? info.contactName : info.elderName;

  useEffect(() => {
    let stopped = false;
    let after = 0;

    function newPeer() {
      pcRef.current?.close();
      const pc = new RTCPeerConnection({ iceServers: ICE });
      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));
      pc.onicecandidate = (e) => e.candidate && post({ kind: "candidate", payload: e.candidate.toJSON() });
      pc.ontrack = (e) => { if (remoteRef.current) remoteRef.current.srcObject = e.streams[0]; setStatus("connected"); post({ status: "active" }); };
      pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState) && !stopped) setStatus("waiting"); };
      pcRef.current = pc;
      return pc;
    }

    async function start() {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 }, audio: { echoCancellation: true } });
      } catch {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      }
      if (localRef.current && streamRef.current) localRef.current.srcObject = streamRef.current;
      if (role === "family") {
        const pc = newPeer();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await post({ kind: "offer", payload: offer });
      }
      setStatus("waiting");
      poll();
    }

    async function poll() {
      while (!stopped) {
        try {
          const r = await fetch(`/api/calls/${callId}?${q}after=${after}`);
          const data = await r.json();
          if (["ended", "declined"].includes(data.call?.status)) { setStatus("ended"); onEnd(); return; }
          for (const s of data.signals as { kind: string; payload: string; at: number }[]) {
            after = Math.max(after, s.at);
            const payload = JSON.parse(s.payload);
            if (s.kind === "offer" && role === "elder") {
              const pc = newPeer();
              await pc.setRemoteDescription(payload);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await post({ kind: "answer", payload: answer });
              for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
            } else if (s.kind === "answer" && role === "family" && pcRef.current && !pcRef.current.currentRemoteDescription) {
              await pcRef.current.setRemoteDescription(payload);
              for (const c of pendingIce.current.splice(0)) await pcRef.current.addIceCandidate(c).catch(() => {});
            } else if (s.kind === "candidate") {
              if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(payload).catch(() => {});
              else pendingIce.current.push(payload);
            } else if (s.kind === "hangup") {
              setStatus("ended"); onEnd(); return;
            }
          }
        } catch { /* network blip: keep polling */ }
        await new Promise((r) => setTimeout(r, 900));
      }
    }

    start();
    return () => {
      stopped = true;
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  const btn = large ? "h-20 w-20" : "h-14 w-14";
  return (
    <div className={clsx("fixed inset-0 z-50 bg-[#0f1a17] text-white", large && "font-[family-name:var(--font-elder)]")}>
      <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
      {status !== "connected" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <p className={large ? "text-4xl font-bold" : "text-2xl font-semibold"}>{status === "starting" ? "Starting camera…" : `Waiting for ${other}…`}</p>
          <p className={large ? "text-2xl text-white/70" : "text-white/60"}>{status === "starting" ? "" : "They have been sent a link to join."}</p>
        </div>
      )}
      <video ref={localRef} autoPlay playsInline muted className={clsx("absolute right-4 top-4 rounded-2xl border-2 border-white/30 object-cover shadow-2xl", large ? "h-44 w-32" : "h-36 w-28 sm:h-44 sm:w-60")} />
      <p className={clsx("absolute left-5 top-5 rounded-full bg-black/40 px-4 py-1.5 backdrop-blur", large ? "text-2xl" : "text-sm")}>{other}</p>
      <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-5">
        <button className={clsx("flex items-center justify-center rounded-full bg-white/15 backdrop-blur", btn)} aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => { streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted); }}>
          {muted ? <MicrophoneSlash size={large ? 36 : 24} /> : <Microphone size={large ? 36 : 24} />}
        </button>
        <button className={clsx("flex items-center justify-center gap-3 rounded-full bg-[var(--color-danger)] font-semibold", large ? "h-20 px-10 text-2xl" : "h-14 px-7")} onClick={onEnd} aria-label="End call">
          <PhoneDisconnect size={large ? 36 : 24} weight="fill" />{large && "End call"}
        </button>
        <button className={clsx("flex items-center justify-center rounded-full bg-white/15 backdrop-blur", btn)} aria-label={camOff ? "Turn camera on" : "Turn camera off"}
          onClick={() => { streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff); }}>
          {camOff ? <VideoCameraSlash size={large ? 36 : 24} /> : <VideoCamera size={large ? 36 : 24} />}
        </button>
      </div>
    </div>
  );
}
