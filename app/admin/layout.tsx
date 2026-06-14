import { requireRole } from "@/lib/session";
import { TopBar } from "@/app/_components/TopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <div>
      <TopBar role={user.role} name={user.name ?? user.email ?? "User"} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
