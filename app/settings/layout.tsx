import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/app/_components/AppShell";
import type { Role } from "@prisma/client";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, role: true },
  });
  if (!user) redirect("/login");

  return (
    <AppShell role={user.role as Role} name={user.name}>
      {children}
    </AppShell>
  );
}
