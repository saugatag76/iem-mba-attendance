import { Link2 } from "lucide-react";
import { DeleteOfferingButton } from "./DeleteOfferingButton";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Field, selectClass, Submit, PageHeader, Avatar, Badge } from "@/app/_components/ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { SectionHeader, CollapsibleGroup } from "@/app/_components/layout-ui";
import { STREAMS } from "@/lib/streams";
import { createOffering, deleteOffering, reassignOfferingTeacher } from "../actions";
import { ReassignTeacherSelect } from "./ReassignTeacherSelect";

export const dynamic = "force-dynamic";

// Trimester system: Terms 1–3 = Year 1, Terms 4–6 = Year 2
const TERMS = [
  { value: "2026-T1", label: "Term 1 · 2026 (Year 1)" },
  { value: "2026-T2", label: "Term 2 · 2026 (Year 1)" },
  { value: "2026-T3", label: "Term 3 · 2026 (Year 1)" },
  { value: "2026-T4", label: "Term 4 · 2026 (Year 2)" },
  { value: "2026-T5", label: "Term 5 · 2026 (Year 2)" },
  { value: "2026-T6", label: "Term 6 · 2026 (Year 2)" },
];

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string; stream?: string; section?: string }>;
}) {
  await requireRole("ADMIN");
  const { q = "", year = "", stream = "", section = "" } = await searchParams;
  const needle = q.trim().toLowerCase();

  const [subjects, classes, teachers, offerings] = await Promise.all([
    prisma.subject.findMany({ orderBy: { code: "asc" } }),
    prisma.classSection.findMany({ orderBy: [{ year: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } }),
    prisma.offering.findMany({
      include: { subject: true, classSection: true, teacher: true, _count: { select: { sessions: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const filtered = offerings.filter((o) => {
    if (year && String(o.classSection.year) !== year) return false;
    if (stream && o.classSection.stream !== stream) return false;
    if (section && o.classSectionId !== section) return false;
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
  const groupList = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const fewGroups = groupList.length <= 4;

  return (
    <div>
      <PageHeader title="Offerings" subtitle="Link a subject to a class and teacher." />

      <Card title="Create offering" icon={<Link2 className="h-4 w-4" />}>
        <form action={createOffering} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Subject" className="col-span-2 sm:col-span-1">
            <select name="subjectId" className={selectClass} required>
              <option value="">Subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </Field>
          <Field label="Class">
            <select name="classSectionId" className={selectClass} required>
              <option value="">Class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Teacher">
            <select name="teacherId" className={selectClass} required>
              <option value="">Teacher…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Term">
            <select name="term" className={selectClass} required defaultValue="2026-T1">
              {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <div className="flex items-end"><Submit>Create</Submit></div>
        </form>
      </Card>

      <SectionHeader title={`Offerings (${filtered.length})`} />
      <FilterBar
        placeholder="Search subject or teacher…"
        filters={[
          { name: "year", label: "Year", options: [{ value: "1", label: "Year 1" }, { value: "2", label: "Year 2" }] },
          { name: "stream", label: "Stream", options: STREAMS.map((s) => ({ value: s.value, label: s.label })) },
          { name: "section", label: "Section", options: classes.map((c) => ({ value: c.id, label: c.name })) },
        ]}
      />

      {groupList.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No offerings match these filters.</p>
      ) : (
        groupList.map(([name, items]) => (
          <CollapsibleGroup key={name} title={name} count={items.length} defaultOpen={fewGroups}>
            <ul className="divide-y divide-border">
              {items.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  {/* Subject info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                        {o.subject.code.length > 10 ? o.subject.code.split("-")[0] + "-…" : o.subject.code}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">{o.subject.name}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium">{o.term}</span>
                      {o._count.sessions > 0 && (
                        <span>{o._count.sessions} session{o._count.sessions !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  {/* Teacher + actions */}
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <div className="hidden items-center gap-2 sm:flex">
                      <Avatar name={o.teacher.name} className="h-7 w-7 text-[10px]" />
                      <ReassignTeacherSelect
                        offeringId={o.id}
                        currentTeacherId={o.teacherId}
                        teachers={teachers}
                        action={reassignOfferingTeacher}
                      />
                    </div>
                    <DeleteOfferingButton
                      id={o.id}
                      sessionCount={o._count.sessions}
                      action={deleteOffering}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CollapsibleGroup>
        ))
      )}
    </div>
  );
}
