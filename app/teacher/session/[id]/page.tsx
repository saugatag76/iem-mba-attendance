import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge } from "@/app/_components/ui";
import { closeSession } from "../../actions";
import { LiveSession } from "./LiveSession";
import { ManualScanButton } from "./ManualScanButton";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { id } = await params;

  const s = await prisma.session.findUnique({
    where: { id },
    include: { offering: { include: { subject: true, classSection: true } } },
  });
  if (!s) notFound();
  if (s.teacherId !== user.id && user.role !== "ADMIN") notFound();

  const hasGeofence = s.geoLat != null && s.geoLng != null;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {s.offering.subject.code} · {s.offering.subject.name}
          </h1>
          <p className="text-sm text-gray-500">
            {s.offering.classSection.name} · {new Date(s.date).toLocaleString()}
          </p>
          <div className="mt-1 flex gap-2">
            <Badge tone={s.status === "OPEN" ? "green" : "gray"}>{s.status}</Badge>
            <Badge tone={hasGeofence ? "green" : "amber"}>
              {hasGeofence ? `geofence ${s.geoRadiusM}m` : "no geofence"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {s.status === "OPEN" && (
            <form action={closeSession}>
              <input type="hidden" name="sessionId" value={s.id} />
              <button className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 active:scale-[0.98]">
                Close session
              </button>
            </form>
          )}
          <Link href={`/reports/session/${s.id}`} className="text-xs text-gray-500 underline">
            View report
          </Link>
        </div>
      </div>

      <LiveSession sessionId={s.id} />

      {s.status === "OPEN" && (
        <div className="mt-4">
          <ManualScanButton sessionId={s.id} />
        </div>
      )}
    </div>
  );
}
