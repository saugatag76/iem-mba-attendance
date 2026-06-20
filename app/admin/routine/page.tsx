import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/app/_components/ui";
import { RoutineGrid, type GridCell, type OfferingOption } from "./RoutineGrid";
import { SectionSelector } from "./SectionSelector";
import type { Weekday } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function RoutinePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  await requireRole("ADMIN");
  const { section: sectionId } = await searchParams;

  const [sections, scheduledClasses, offerings] = await Promise.all([
    prisma.classSection.findMany({ orderBy: [{ year: "asc" }, { name: "asc" }] }),
    sectionId
      ? prisma.scheduledClass.findMany({
          where: { classSectionId: sectionId },
          include: { offering: { include: { subject: true, teacher: true } } },
          orderBy: [{ day: "asc" }, { slotIndex: "asc" }],
        })
      : Promise.resolve([]),
    sectionId
      ? prisma.offering.findMany({
          where: { classSectionId: sectionId },
          include: { subject: true, teacher: true },
          orderBy: { subject: { name: "asc" } },
        })
      : Promise.resolve([]),
  ]);

  const activeSectionId = sectionId ?? sections[0]?.id ?? null;
  const activeSection = sections.find((s) => s.id === activeSectionId);

  // Build GridCell[] — group ScheduledClass rows by (day, slotIndex)
  const cellMap = new Map<string, GridCell>();
  for (const sc of scheduledClasses) {
    const key = `${sc.day}|${sc.slotIndex}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, {
        day: sc.day as Weekday,
        slotIndex: sc.slotIndex,
        startTime: sc.startTime,
        endTime: sc.endTime,
        entries: [],
      });
    }
    cellMap.get(key)!.entries.push({
      id: sc.id,
      offeringId: sc.offeringId,
      subgroup: sc.subgroup,
      offering: sc.offering
        ? {
            id: sc.offering.id,
            subject: { name: sc.offering.subject.name, code: sc.offering.subject.code },
            teacher: { name: sc.offering.teacher.name },
          }
        : null,
    });
  }
  const cells: GridCell[] = [...cellMap.values()];

  const offeringOptions: OfferingOption[] = offerings.map((o) => ({
    id: o.id,
    subject: { name: o.subject.name, code: o.subject.code },
    teacher: { name: o.teacher.name },
  }));

  return (
    <div>
      <PageHeader
        title="Routine editor"
        subtitle="Live-edit the weekly timetable for each class section"
        action={
          <SectionSelector
            sections={sections.map((s) => ({ id: s.id, name: s.name }))}
            activeId={activeSectionId}
          />
        }
      />

      {!activeSectionId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No class sections found. Create one under Academics first.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Showing timetable for{" "}
            <span className="font-semibold text-foreground">{activeSection?.name}</span>.
            Click any cell to reassign a subject / teacher. Use &ldquo;Add split&rdquo; to add subgroups (e.g. lab A1/A2).
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <RoutineGrid
              classSectionId={activeSectionId}
              cells={cells}
              offerings={offeringOptions}
            />
          </div>
        </>
      )}
    </div>
  );
}
