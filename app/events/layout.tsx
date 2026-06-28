import { requireRole } from "@/lib/session";
import { AppShell } from "@/app/_components/AppShell";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER", "ADMIN");
  const pendingSubs = await prisma.substitutionRequest.count({
    where: user.role === "ADMIN"
      ? { status: "TEACHER_ACCEPTED" }
      : { substituteTeacherId: user.id, status: "PENDING_TEACHER" },
  });
  return (
    <AppShell role={user.role as Role} name={user.name ?? user.email ?? "User"} pendingCounts={{ substitutions: pendingSubs }}>
      {children}
    </AppShell>
  );
}
