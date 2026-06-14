import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { offeringReport } from "@/lib/attendance";
import { Badge } from "@/app/_components/ui";

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
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {offering.subject.code} · {offering.subject.name}
          </h1>
          <p className="text-sm text-gray-500">
            {offering.classSection.name} · {total} sessions · {rows.length} students ·{" "}
            <span className="text-red-600">{defaulters} below {THRESHOLD}%</span>
          </p>
        </div>
        <a
          href={`/api/reports/offering/${id}/csv`}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium"
        >
          Export CSV
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2 text-center">Attended</th>
              <th className="px-3 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <div>{r.name}</div>
                  <div className="text-xs text-gray-400">{r.email}</div>
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {r.attended}/{r.total}
                </td>
                <td className="px-3 py-2 text-right">
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
