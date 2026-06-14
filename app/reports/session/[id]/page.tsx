import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { sessionRegister } from "@/lib/attendance";
import { Badge } from "@/app/_components/ui";

export default async function SessionReport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { id } = await params;
  const data = await sessionRegister(id);
  if (!data) notFound();
  if (user.role !== "ADMIN" && data.session.teacherId !== user.id) notFound();

  const { session, rows } = data;
  const presentCount = rows.filter((r) => r.present).length;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {session.offering.subject.code} · {session.offering.subject.name}
          </h1>
          <p className="text-sm text-gray-500">
            {session.offering.classSection.name} · {new Date(session.date).toLocaleString()} ·{" "}
            {presentCount}/{rows.length} present
          </p>
        </div>
        <a
          href={`/api/reports/session/${id}/csv`}
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
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <div>{r.name}</div>
                  <div className="text-xs text-gray-400">
                    {r.present && r.scannedAt ? new Date(r.scannedAt).toLocaleTimeString() : ""}
                    {r.method === "MANUAL" && " · manual"}
                    {r.flagged && " · ⚑ flagged"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <Badge tone={r.present ? "green" : "red"}>{r.present ? "Present" : "Absent"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
