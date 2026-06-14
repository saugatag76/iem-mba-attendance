import { requireRole } from "@/lib/session";
import { TopBar } from "@/app/_components/TopBar";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("TEACHER", "ADMIN");
  return (
    <div>
      <TopBar title="QR Attendance" subtitle="Reports" />
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
