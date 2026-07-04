import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, FileBarChart, Square } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge } from "@/app/_components/ui";
import { autoCloseExpired } from "@/lib/sessions";
import { closeSession } from "../../actions";
import { LiveSession } from "./LiveSession";
import { ManualCodeEntry } from "./ManualCodeEntry";

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

  const status = await autoCloseExpired(s);
  const hasGeofence = s.geoLat != null && s.geoLng != null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{s.offering.subject.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {s.offering.subject.code} · {s.offering.classSection.name} · {new Date(s.date).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={status === "OPEN" ? "green" : "gray"}>
              {status === "OPEN" ? "● Live" : "Closed"}
            </Badge>
            <Badge tone={hasGeofence ? "brand" : "amber"}>
              <MapPin className="h-3 w-3" />
              {hasGeofence ? `Geofence ${s.geoRadiusM}m` : "No geofence"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/reports/session/${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <FileBarChart className="h-4 w-4" /> Report
          </Link>
          {status === "OPEN" && (
            <form action={closeSession}>
              <input type="hidden" name="sessionId" value={s.id} />
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-card px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/8 dark:text-red-400 dark:border-red-500/25 dark:hover:bg-red-500/12">
                <Square className="h-4 w-4" /> Close
              </button>
            </form>
          )}
        </div>
      </div>

      <LiveSession sessionId={s.id} />

      {status === "OPEN" && (
        <div className="mt-4">
          <ManualCodeEntry sessionId={s.id} />
        </div>
      )}
    </div>
  );
}
