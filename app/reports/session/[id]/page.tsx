import { notFound } from "next/navigation";
import { Download, MapPin, SmartphoneNfc } from "lucide-react";
import { requireRole } from "@/lib/session";
import { sessionRegister } from "@/lib/attendance";
import { Badge, Avatar } from "@/app/_components/ui";
import { ScanMapClient } from "./ScanMapClient";
import { resetStudentDevice } from "@/app/teacher/actions";

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

  const { session, rows, nonCompliant } = data;
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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{session.offering.subject.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {session.offering.subject.code} · {session.offering.classSection.name} ·{" "}
            {new Date(session.date).toLocaleString()}
          </p>
          <div className="mt-2">
            <Badge tone="brand">
              {presentCount}/{rows.length} present
            </Badge>
          </div>
        </div>
        <a
          href={`/api/reports/session/${id}/csv`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      {hasLocations && (
        <div className="mb-5 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" /> Scan locations
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              blue = classroom · green = in range · red = outside
            </span>
          </div>
          <ScanMapClient anchor={anchor} points={mapPoints} />
        </div>
      )}

      {/* Location non-compliant section */}
      {nonCompliant.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-xl border border-red-500/20 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-red-500/5 px-4 py-2.5 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <MapPin className="h-4 w-4 opacity-40" />
            Location non-compliant ({nonCompliant.length})
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Scanned QR but no location provided — marked absent
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {nonCompliant.map((r) => (
                <tr key={r.studentId} className="bg-red-500/5 dark:bg-red-500/8">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} />
                      <div>
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.scannedAt
                      ? new Date(r.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.flagReason}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge tone="red">Non-compliant</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.email}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.name} />
                    <div>
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.present && r.scannedAt
                          ? new Date(r.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : ""}
                        {r.method === "MANUAL" && " · manual"}
                        {r.flagged && r.flagReason && ` · ${r.flagReason.startsWith("Manual override") ? "manual override" : "⚑"}`}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {r.lat != null && r.lng != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 underline ${
                        r.outOfRange ? "text-red-600 dark:text-red-400" : "text-primary"
                      }`}
                    >
                      <MapPin className="h-3 w-3" />
                      {r.distanceM != null ? `${r.distanceM} m` : "view"}
                      {r.outOfRange && " (outside)"}
                    </a>
                  ) : r.present && r.method === "MANUAL" ? (
                    <span className="text-muted-foreground">manual — no GPS</span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Badge tone={r.present ? "green" : "gray"}>{r.present ? "Present" : "Absent"}</Badge>
                    {/* Device reset — shown for flagged records so teacher can unlock new device */}
                    {r.flagged && r.flagReason?.includes("Device mismatch") && (
                      <form action={resetStudentDevice}>
                        <input type="hidden" name="studentId" value={r.studentId} />
                        <input type="hidden" name="redirectTo" value={`/reports/session/${id}`} />
                        <button
                          type="submit"
                          title="Reset device binding so this student can scan from a new device"
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 px-2 py-1 text-[11px] font-medium text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          <SmartphoneNfc className="h-3 w-3" /> Reset device
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
