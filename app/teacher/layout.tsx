import { requireRole } from "@/lib/session";
import { AppShell } from "@/app/_components/AppShell";
import { activeSessionFor } from "@/lib/sessions";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER", "ADMIN");
  const active = await activeSessionFor(user.id);
  const liveSession = active
    ? {
        id: active.id,
        label: `${active.offering.subject.name} · ${active.offering.classSection.name}`,
      }
    : null;
  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "User"} liveSession={liveSession}>
      {children}
    </AppShell>
  );
}
