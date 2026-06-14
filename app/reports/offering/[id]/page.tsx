import { notFound } from "next/navigation";
import { Download, CalendarClock, Users, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/session";
import { offeringReport } from "@/lib/attendance";
import { Badge, Avatar, StatCard } from "@/app/_components/ui";

const THRESHOLD = 75;

export default async function OfferingReport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { id } = await params;
  const report = await offeringReport(id);
  if (!report) notFound();
  if (user.role !== "ADMIN" && report.offering.teacherId !== user.id) notFound();

  const { offering, total, rows } = report;
  const defaulters = rows.filter((r) => r.percent < THRESHOLD).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{offering.subject.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {offering.subject.code} · {offering.classSection.name}
          </p>
        </div>
        <a
          href={`/api/reports/offering/${id}/csv`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Sessions" value={total} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Students" value={rows.length} />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label={`Below ${THRESHOLD}%`}
          value={defaulters}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student</th>
              <th className="px-4 py-2.5 text-center font-medium">Attended</th>
              <th className="px-4 py-2.5 text-right font-medium">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.studentId} className={r.percent < THRESHOLD ? "bg-red-50/40" : undefined}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.name} />
                    <div>
                      <div className="font-medium text-slate-800">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">
                  {r.attended}/{r.total}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Badge tone={r.percent >= THRESHOLD ? "green" : r.percent >= 60 ? "amber" : "red"}>
                    {r.percent}%
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
