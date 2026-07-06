import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/AppShell";
import type { Role } from "@prisma/client";

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <AppShell role={session.user.role as Role} name={session.user.name ?? session.user.email ?? "User"}>
      {children}
    </AppShell>
  );
}
