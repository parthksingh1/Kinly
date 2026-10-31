import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

// One .env at the repository root configures both the companion server and this app.
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(rootEnv)) {
  for (const raw of fs.readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1).split(value[0])[0];
    else value = value.split(/\s+#/)[0].replace(/^#.*/, "").trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_KINLY_WS_URL: process.env.NEXT_PUBLIC_KINLY_WS_URL ?? "",
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? "false",
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  eslint: { ignoreDuringBuilds: true },
  devIndicators: false,
};

export default nextConfig;
