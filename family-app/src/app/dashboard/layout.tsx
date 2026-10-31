import { revalidatePath } from "next/cache";
import { Shell } from "@/components/shell";
import { logout } from "@/app/(auth)/actions";
import { requireContext, selectElder } from "@/lib/auth";
import { db } from "@/lib/db";
import { relative } from "@/lib/format";
import { kinlyHealth } from "@/lib/kinly-api";

export const dynamic = "force-dynamic";

async function switchElder(formData: FormData) {
  "use server";
  await selectElder(String(formData.get("elderId")));
  revalidatePath("/dashboard", "layout");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, elder, elders } = await requireContext();
  const [openAlerts, health] = await Promise.all([
    db.alert.count({ where: { elderId: elder.id, status: "open" } }),
    kinlyHealth(),
  ]);
  return (
    <Shell
      elder={{ name: elder.name, preferredName: elder.preferredName, online: !!health?.onlineScreens.includes(elder.id), lastActive: elder.lastActiveAt ? relative(elder.lastActiveAt) : null }}
      elders={elders.map((e) => ({ id: e.id, preferredName: e.preferredName }))}
      currentElderId={elder.id}
      user={{ name: user.name, email: user.email, isAdmin: user.isAdmin }}
      openAlerts={openAlerts}
      demoMode={process.env.DEMO_MODE === "true"}
      switchElder={switchElder}
      logout={logout}
    >
      {children}
    </Shell>
  );
}
