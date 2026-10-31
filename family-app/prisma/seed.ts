import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resetDemo } from "../src/lib/demo-seed";

// `npm run seed` -> (re)creates the demo family. Safe to run repeatedly.
const db = new PrismaClient();

resetDemo(db, {
  elderPhone: process.env.DEMO_ELDER_PHONE,
  familyPhone: process.env.DEMO_FAMILY_PHONE,
  uploadsDir: process.env.KINLY_UPLOADS_DIR || path.resolve(__dirname, "..", "..", "data", "uploads"),
  assetsDir: path.resolve(__dirname, "demo-assets"),
})
  .then(({ elder }) => {
    console.log(`Demo ready: ${elder.name}. Log in as arjun@kinly.demo / kinly-demo`);
    console.log(`Elder screen: /screen/${elder.screenToken}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
