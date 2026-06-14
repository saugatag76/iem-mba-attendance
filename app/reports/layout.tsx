import { requireRole } from "@/lib/session";
import { AppShell } from "@/app/_components/AppShell";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER", "ADMIN");
  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "User"}>
      {children}
    </AppShell>
  );
}
