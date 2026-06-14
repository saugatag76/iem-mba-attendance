import { requireRole } from "@/lib/session";
import { TopBar } from "@/app/_components/TopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return (
    <div>
      <TopBar title="QR Attendance" subtitle="Admin" />
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
