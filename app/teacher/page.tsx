import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Badge } from "@/app/_components/ui";
import { OpenSessionButton } from "./_components/OpenSessionButton";

export const dynamic = "force-dynamic";

export default async function TeacherHome() {
  const teacher = await requireRole("TEACHER", "ADMIN");

  const offerings = await prisma.offering.findMany({
    where: { teacherId: teacher.id },
    include: {
      subject: true,
      classSection: true,
      _count: { select: { sessions: true } },
      sessions: { orderBy: { date: "desc" }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Your classes</h1>
      {offerings.length === 0 && (
        <p className="text-sm text-gray-500">No offerings assigned yet. Ask an admin to assign you one.</p>
      )}
      {offerings.map((o) => (
        <Card key={o.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {o.subject.code} · {o.subject.name}
              </p>
              <p className="text-sm text-gray-500">
                {o.classSection.name} · {o._count.sessions} sessions
              </p>
            </div>
            <OpenSessionButton offeringId={o.id} />
          </div>
          {o.sessions.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {o.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <Link href={`/teacher/session/${s.id}`} className="text-gray-700 underline">
                    {new Date(s.date).toLocaleString()}
                  </Link>
                  <Badge tone={s.status === "OPEN" ? "green" : "gray"}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
