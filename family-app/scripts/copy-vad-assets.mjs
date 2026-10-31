// Copies the voice-activity-detection model and ONNX runtime files into public/vad,
// so the elder screen works without any CDN (demo reliability).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "vad");
fs.mkdirSync(out, { recursive: true });

const sources = [
  [path.join(root, "node_modules", "@ricky0123", "vad-web", "dist"), /\.(onnx|js)$/],
  [path.join(root, "node_modules", "onnxruntime-web", "dist"), /^ort-wasm.*\.(wasm|mjs)$/],
];
let copied = 0;
for (const [dir, pattern] of sources) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!pattern.test(file) || (dir.includes("vad-web") && !/^(silero_vad.*\.onnx|vad\.worklet\.bundle\.min\.js)$/.test(file))) continue;
    fs.copyFileSync(path.join(dir, file), path.join(out, file));
    copied++;
  }
}
console.log(`VAD assets: ${copied} files in public/vad`);
