import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.invite.findUnique({ where: { token }, include: { family: { include: { elders: true } } } });
  const user = await currentUser();

  async function accept() {
    "use server";
    const u = await currentUser();
    if (!u || !invite || invite.acceptedAt) redirect("/dashboard");
    await db.familyMember.upsert({
      where: { familyId_userId: { familyId: invite.familyId, userId: u.id } },
      create: { familyId: invite.familyId, userId: u.id, role: invite.role, relation: invite.relation },
      update: {},
    });
    await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    redirect("/dashboard");
  }

  const elderNames = invite?.family.elders.map((e) => e.preferredName).join(" and ") || "your family";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5">
      <Logo className="mb-10" />
      <div className="card w-full max-w-md p-8 text-center">
        {!invite || invite.acceptedAt ? (
          <>
            <h1 className="display text-3xl">This invite has expired</h1>
            <p className="mt-2 text-[var(--color-muted)]">Ask the person who invited you to send a new link.</p>
          </>
        ) : (
          <>
            <h1 className="display text-3xl">Join {invite.family.name}</h1>
            <p className="mt-2 text-[var(--color-muted)]">You&apos;ll get updates about {elderNames}, alerts when something needs attention, and you can send voice messages.</p>
            {user ? (
              <form action={accept} className="mt-6"><button className="btn btn-primary w-full">Join as {user.name}</button></form>
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                <Link href={`/signup?invite=${token}&email=${encodeURIComponent(invite.email)}`} className="btn btn-primary">Create an account</Link>
                <Link href={`/login?next=/invite/${token}`} className="btn btn-secondary">I already have one</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
