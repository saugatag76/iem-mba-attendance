import { requireRole } from "@/lib/session";
import { AppShell } from "@/app/_components/AppShell";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  const pendingSubs = await prisma.substitutionRequest.count({
    where: { status: "TEACHER_ACCEPTED" },
  });
  return (
    <AppShell
      role={user.role}
      name={user.name ?? user.email ?? "User"}
      pendingCounts={{ substitutions: pendingSubs }}
    >
      {children}
    </AppShell>
  );
}
