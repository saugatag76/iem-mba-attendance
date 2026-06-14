import { requireRole } from "@/lib/session";
import { TopBar } from "@/app/_components/TopBar";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT", "ADMIN");
  return (
    <div>
      <TopBar role={user.role} name={user.name ?? user.email ?? "User"} />
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
