import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { sessionRegister } from "@/lib/attendance";
import { Badge } from "@/app/_components/ui";
import { ScanMapClient } from "./ScanMapClient";

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

  const anchor =
    session.geoLat != null && session.geoLng != null
      ? { lat: session.geoLat, lng: session.geoLng, radius: session.geoRadiusM }
      : null;
  const mapPoints = rows
    .filter((r) => r.present && r.lat != null && r.lng != null)
    .map((r) => ({
      name: r.name,
      lat: r.lat as number,
      lng: r.lng as number,
      outOfRange: r.outOfRange,
      flagged: r.flagged,
    }));
  const hasLocations = anchor != null || mapPoints.length > 0;

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

      {hasLocations && (
        <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">
            Scan locations
            <span className="ml-2 text-xs font-normal text-gray-400">
              blue = classroom · green = in range · red = outside · amber = flagged
            </span>
          </div>
          <ScanMapClient anchor={anchor} points={mapPoints} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Location</th>
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
                <td className="px-3 py-2 text-xs">
                  {r.lat != null && r.lng != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`underline ${r.outOfRange ? "text-red-600" : "text-blue-600"}`}
                    >
                      📍 {r.distanceM != null ? `${r.distanceM} m away` : "view"}
                      {r.outOfRange && " (outside)"}
                    </a>
                  ) : r.present && r.method === "MANUAL" ? (
                    <span className="text-gray-400">manual — no GPS</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
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
