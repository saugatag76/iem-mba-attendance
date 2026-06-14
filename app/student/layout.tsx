import { requireRole } from "@/lib/session";
import { TopBar } from "@/app/_components/TopBar";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT", "ADMIN");
  return (
    <div>
      <TopBar title="QR Attendance" subtitle="Student" />
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
    </div>
  );
}
