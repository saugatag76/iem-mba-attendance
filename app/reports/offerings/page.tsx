import Link from "next/link";
import { FileBarChart, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { parseDateRange, rangeQuery } from "@/lib/dateRange";
import { PageHeader, EmptyState, Badge } from "@/app/_components/ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { ShowMore } from "@/app/_components/ShowMore";
import { CollapsibleGroup, RouteTabs } from "@/app/_components/layout-ui";
import { DateRangePicker } from "@/app/_components/DateRangePicker";
import { STREAMS } from "@/lib/streams";

export const dynamic = "force-dynamic";

export default async function ReportsOfferings({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string; stream?: string; section?: string; teacher?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const isAdmin = user.role === "ADMIN";
  const { q = "", year = "", stream = "", section = "", teacher = "", ...rangeParams } = await searchParams;
  const needle = q.trim().toLowerCase();
  const range = parseDateRange(rangeParams);
  const qs = rangeQuery(rangeParams);

  const [offerings, classes, teachers] = await Promise.all([
    prisma.offering.findMany({
      where: isAdmin ? {} : { teacherId: user.id },
      include: {
        subject: true,
        classSection: true,
        teacher: true,
        _count: { select: { sessions: { where: range ? { date: { gte: range.from, lte: range.to } } : undefined } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.classSection.findMany({ orderBy: [{ year: "asc" }, { name: "asc" }] }),
    isAdmin ? prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const filtered = offerings.filter((o) => {
    if (year && String(o.classSection.year) !== year) return false;
    if (stream && o.classSection.stream !== stream) return false;
    if (section && o.classSectionId !== section) return false;
    if (teacher && o.teacherId !== teacher) return false;
    if (needle) {
      const hay = `${o.subject.code} ${o.subject.name} ${o.teacher.name}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const groups = new Map<string, typeof filtered>();
  for (const o of filtered) {
    const k = o.classSection.name;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(o);
  }
  const groupList = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, items]) => [
      name,
      [...items].sort((a, b) => b._count.sessions - a._count.sessions),
    ] as const);
  const fewGroups = groupList.length <= 4;

  const filters = [
    { name: "year", label: "Year", options: [{ value: "1", label: "Year 1" }, { value: "2", label: "Year 2" }] },
    { name: "stream", label: "Stream", options: STREAMS.map((s) => ({ value: s.value, label: s.label })) },
    { name: "section", label: "Section", options: classes.map((c) => ({ value: c.id, label: c.name })) },
    ...(isAdmin ? [{ name: "teacher", label: "Teacher", options: teachers.map((t) => ({ value: t.id, label: t.name })) }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Attendance reports"
        subtitle={`${filtered.length} of ${offerings.length} offerings · per-subject %, registers & scan locations`}
        action={<DateRangePicker />}
      />

      <RouteTabs
        active={`/reports/offerings${qs}`}
        tabs={[
          { label: "Overview", href: `/reports${qs}` },
          { label: "By subject", href: `/reports/offerings${qs}` },
          { label: "By student", href: `/reports/students${qs}` },
        ]}
      />

      {offerings.length === 0 ? (
        <EmptyState icon={<FileBarChart className="h-8 w-8" />} title="Nothing to report yet" />
      ) : (
        <>
          <FilterBar placeholder="Search subject or teacher…" filters={filters} />
          {groupList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No offerings match these filters.</p>
          ) : (
            groupList.map(([name, items]) => {
              const started = items.filter((o) => o._count.sessions > 0);
              const notStarted = items.filter((o) => o._count.sessions === 0);
              return (
                <CollapsibleGroup key={name} title={name} count={items.length} defaultOpen={fewGroups}>
                  {started.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {started.map((o) => (
                        <li key={o.id}>
                          <Link
                            href={`/reports/offering/${o.id}${qs}`}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="mb-1 flex items-center gap-2">
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-500">
                                  {o.subject.code}
                                </span>
                                <span className="truncate text-sm font-semibold text-slate-900">{o.subject.name}</span>
                              </p>
                              <p className="text-xs text-slate-400">{o.teacher.name}</p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              <Badge tone={o._count.sessions >= 8 ? "green" : o._count.sessions >= 4 ? "brand" : "amber"}>
                                {o._count.sessions} session{o._count.sessions > 1 ? "s" : ""}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-slate-300" />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-4 text-center text-xs text-slate-400">No sessions held yet for this section.</p>
                  )}
                  {notStarted.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2">
                      <ShowMore
                        cap={3}
                        itemName="subject"
                        items={notStarted.map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="mb-1 flex items-center gap-2">
                                <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-500">
                                  {o.subject.code}
                                </span>
                                <span className="truncate text-sm font-medium text-slate-600">{o.subject.name}</span>
                              </p>
                              <p className="text-xs text-slate-400">{o.teacher.name}</p>
                            </div>
                            <Badge tone="gray">Not started</Badge>
                          </li>
                        ))}
                      />
                    </div>
                  )}
                </CollapsibleGroup>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
