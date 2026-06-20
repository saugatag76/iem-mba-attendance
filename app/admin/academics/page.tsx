import { Building2, Layers, BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Field, inputClass, selectClass, Submit, PageHeader, Badge } from "@/app/_components/ui";
import { TabNav } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { STREAMS, STREAM_LABEL } from "@/lib/streams";
import { createDepartment, createClass, createSubject } from "../actions";

export const dynamic = "force-dynamic";

const TABS = [
  { label: "Subjects", value: "subjects" },
  { label: "Classes", value: "classes" },
  { label: "Departments", value: "departments" },
];

export default async function AcademicsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  const { tab = "subjects", q = "" } = await searchParams;
  const needle = q.trim().toLowerCase();

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader title="Academics" subtitle="Departments, class sections and subjects." />
      <TabNav basePath="/admin/academics" active={tab} tabs={TABS} />

      {tab === "departments" && (
        <>
          <Card title="Add department" icon={<Building2 className="h-4 w-4" />}>
            <form action={createDepartment} className="flex gap-2">
              <input name="name" placeholder="Department name" className={inputClass} required />
              <Submit>Add</Submit>
            </form>
          </Card>
          <ul className="overflow-hidden rounded-xl border border-border bg-card text-sm shadow-sm">
            {departments.map((d) => (
              <li key={d.id} className="border-b border-border px-4 py-2.5 text-foreground last:border-0">
                {d.name}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "classes" && (
        <>
          <Card title="Add class section" icon={<Layers className="h-4 w-4" />}>
            <form action={createClass} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Name" className="col-span-2 sm:col-span-1">
                <input name="name" placeholder="Finance — Sec A" className={inputClass} required />
              </Field>
              <Field label="Year">
                <select name="year" className={selectClass} defaultValue={1}>
                  <option value={1}>Year 1</option>
                  <option value={2}>Year 2</option>
                </select>
              </Field>
              <Field label="Stream">
                <select name="stream" className={selectClass} defaultValue="COMMON">
                  {STREAMS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Department">
                <select name="departmentId" className={selectClass} required>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end"><Submit>Add</Submit></div>
            </form>
          </Card>

          <FilterBar placeholder="Search classes…" />
          <ClassList needle={needle} />
        </>
      )}

      {tab === "subjects" && (
        <>
          <Card title="Add subject" icon={<BookOpen className="h-4 w-4" />}>
            <form action={createSubject} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <Field label="Name" className="col-span-2 sm:col-span-2">
                <input name="name" placeholder="Subject name" className={inputClass} required />
              </Field>
              <Field label="Code"><input name="code" placeholder="FN201" className={inputClass} required /></Field>
              <Field label="Semester">
                <select name="semester" className={selectClass} defaultValue={1}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Sem {n}</option>)}
                </select>
              </Field>
              <Field label="Stream">
                <select name="stream" className={selectClass} defaultValue="COMMON">
                  {STREAMS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select name="departmentId" className={selectClass} required>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <div className="col-span-2 flex items-end sm:col-span-6"><Submit>Add subject</Submit></div>
            </form>
          </Card>

          <FilterBar placeholder="Search subjects by name or code…" />
          <SubjectList needle={needle} />
        </>
      )}
    </div>
  );
}

async function ClassList({ needle }: { needle: string }) {
  const classes = await prisma.classSection.findMany({
    include: { _count: { select: { offerings: true, enrollments: true } } },
    orderBy: [{ year: "asc" }, { name: "asc" }],
  });
  const rows = needle ? classes.filter((c) => c.name.toLowerCase().includes(needle)) : classes;
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">No classes match.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Section</th>
            <th className="px-4 py-2.5 font-medium">Year</th>
            <th className="px-4 py-2.5 font-medium">Stream</th>
            <th className="px-4 py-2.5 text-right font-medium">Offerings</th>
            <th className="px-4 py-2.5 text-right font-medium">Students</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">Year {c.year}</td>
              <td className="px-4 py-2.5"><Badge tone="gray">{STREAM_LABEL[c.stream] ?? c.stream}</Badge></td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c._count.offerings}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c._count.enrollments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function SubjectList({ needle }: { needle: string }) {
  const subjects = await prisma.subject.findMany({ orderBy: { code: "asc" } });
  const rows = needle
    ? subjects.filter((s) => s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle))
    : subjects;
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">No subjects match.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Code</th>
            <th className="px-4 py-2.5 font-medium">Subject</th>
            <th className="px-4 py-2.5 font-medium">Sem</th>
            <th className="px-4 py-2.5 font-medium">Stream</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">{s.code}</td>
              <td className="px-4 py-2.5 text-foreground">{s.name}</td>
              <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{s.semester}</td>
              <td className="px-4 py-2.5"><Badge tone="gray">{STREAM_LABEL[s.stream] ?? s.stream}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
