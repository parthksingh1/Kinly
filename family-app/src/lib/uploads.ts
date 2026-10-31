import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Uploaded voice messages, consent recordings and avatar photos live outside the repo in
// data/uploads (shared with the companion server via KINLY_UPLOADS_DIR).
export const UPLOADS_DIR = process.env.KINLY_UPLOADS_DIR || path.resolve(process.cwd(), "..", "data", "uploads");

const EXT: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav",
  "video/webm": "webm", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export async function saveUpload(file: File, folder: string): Promise<string> {
  const type = (file.type || "application/octet-stream").split(";")[0];
  const ext = EXT[type] || "bin";
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const rel = path.posix.join(folder, name);
  const abs = path.join(UPLOADS_DIR, folder, name);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return rel;
}

export async function readUpload(rel: string): Promise<Buffer | null> {
  const abs = path.resolve(UPLOADS_DIR, rel);
  if (!abs.startsWith(path.resolve(UPLOADS_DIR))) return null; // no path traversal
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export async function deleteUpload(rel: string) {
  if (!rel) return;
  const abs = path.resolve(UPLOADS_DIR, rel);
  if (!abs.startsWith(path.resolve(UPLOADS_DIR))) return;
  await fs.rm(abs, { force: true });
}

export function mimeFor(rel: string) {
  const ext = rel.split(".").pop() || "";
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] || "application/octet-stream";
}
