import { Link2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Field, inputClass, selectClass, Submit, PageHeader, Avatar } from "@/app/_components/ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { SectionHeader, CollapsibleGroup } from "@/app/_components/layout-ui";
import { STREAMS } from "@/lib/streams";
import { createOffering } from "../actions";

export const dynamic = "force-dynamic";

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
      include: { subject: true, classSection: true, teacher: true },
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

  // group by section
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
          <Field label="Term"><input name="term" placeholder="Term" className={inputClass} defaultValue="2026-T1" /></Field>
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
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-medium text-foreground">{o.subject.code}</span>{" "}
                    <span className="text-foreground">{o.subject.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">· {o.term}</span>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Avatar name={o.teacher.name} className="h-5 w-5 text-[9px]" />
                    {o.teacher.name}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleGroup>
        ))
      )}
    </div>
  );
}
