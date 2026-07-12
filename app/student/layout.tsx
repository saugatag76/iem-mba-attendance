import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/app/_components/AppShell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT", "ADMIN");

  if (user.role === "STUDENT") {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { mustChangePassword: true } });
    if (dbUser?.mustChangePassword) redirect("/settings/change-password?forced=1");
  }

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "User"}>
      {children}
    </AppShell>
  );
}
