import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsHome() {
  const user = await requireRole("TEACHER", "ADMIN");

  const offerings = await prisma.offering.findMany({
    where: user.role === "ADMIN" ? {} : { teacherId: user.id },
    include: {
      subject: true,
      classSection: true,
      teacher: true,
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Attendance reports</h1>
      {offerings.length === 0 && <p className="text-sm text-gray-500">Nothing to report yet.</p>}
      {offerings.map((o) => (
        <Card key={o.id}>
          <Link href={`/reports/offering/${o.id}`} className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {o.subject.code} · {o.subject.name}
              </p>
              <p className="text-sm text-gray-500">
                {o.classSection.name} · {o.teacher.name} · {o._count.sessions} sessions
              </p>
            </div>
            <span className="text-sm text-gray-400">View →</span>
          </Link>
        </Card>
      ))}
    </div>
  );
}
