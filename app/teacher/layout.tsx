import { requireRole } from "@/lib/session";
import { AppShell } from "@/app/_components/AppShell";
import { activeSessionFor } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER", "ADMIN");
  const [active, pendingSubs] = await Promise.all([
    activeSessionFor(user.id),
    prisma.substitutionRequest.count({
      where: { substituteTeacherId: user.id, status: "PENDING_TEACHER" },
    }),
  ]);
  const liveSession = active
    ? {
        id: active.id,
        label: `${active.offering.subject.name} · ${active.offering.classSection.name}`,
      }
    : null;
  return (
    <AppShell
      role={user.role}
      name={user.name ?? user.email ?? "User"}
      liveSession={liveSession}
      pendingCounts={{ substitutions: pendingSubs }}
    >
      {children}
    </AppShell>
  );
}
