import Link from "next/link";
import { FileBarChart, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, PageHeader, EmptyState } from "@/app/_components/ui";

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
      <PageHeader title="Attendance reports" subtitle="Per-subject attendance, registers and scan locations." />

      {offerings.length === 0 && (
        <EmptyState icon={<FileBarChart className="h-8 w-8" />} title="Nothing to report yet" />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {offerings.map((o) => (
          <Link key={o.id} href={`/reports/offering/${o.id}`}>
            <Card className="mb-0 transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <FileBarChart className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{o.subject.name}</p>
                    <p className="text-xs text-slate-500">
                      {o.subject.code} · {o.classSection.name} · {o._count.sessions} sessions
                    </p>
                    <p className="text-xs text-slate-400">{o.teacher.name}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
