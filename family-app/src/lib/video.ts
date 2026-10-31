import "server-only";
import { AccessToken } from "livekit-server-sdk";

/**
 * Video calls between the elder screen and family.
 * - "livekit": LiveKit Cloud (or self hosted) when LIVEKIT_* keys are set. Best quality, TURN included.
 * - "p2p":     keyless fallback. 1:1 WebRTC with public STUN; signalling through this app.
 *              Works on most home networks, ideal for demos without accounts.
 */
export type VideoProvider = "livekit" | "p2p";

export function videoProvider(): VideoProvider {
  const forced = process.env.VIDEO_PROVIDER as VideoProvider | undefined;
  if (forced === "p2p") return "p2p";
  if (process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) return "livekit";
  return "p2p";
}

export async function livekitToken(room: string, identity: string, name: string) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, name, ttl: "2h" });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
  return { token: await at.toJwt(), url: process.env.LIVEKIT_URL! };
}
