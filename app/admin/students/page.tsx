import { UserPlus, Download, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Field, inputClass, selectClass, Submit, PageHeader, Avatar, Badge, EmptyState } from "@/app/_components/ui";
import { SectionHeader, CollapsibleGroup } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { createStudent } from "./actions";
import { EditStudentDialog } from "./EditStudentDialog";
import { DeleteStudentButton } from "./DeleteStudentButton";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; section?: string }>;
}) {
  await requireRole("ADMIN");
  const { q = "", section = "" } = await searchParams;
  const needle = q.trim().toLowerCase();

  const [sections, students] = await Promise.all([
    prisma.classSection.findMany({ orderBy: [{ year: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        enrollments: { include: { classSection: true } },
        _count: { select: { attendanceRecords: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  type Row = {
    id: string;
    name: string;
    phone: string | null;
    sectionId: string | null;
    sectionName: string | null;
    attendanceCount: number;
  };

  const allRows: Row[] = students.map((s) => {
    const primary = s.enrollments[0]?.classSection ?? null;
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      sectionId: primary?.id ?? null,
      sectionName: primary?.name ?? null,
      attendanceCount: s._count.attendanceRecords,
    };
  });

  const filtered = allRows.filter((r) => {
    if (section && r.sectionId !== section) return false;
    if (needle) {
      const hay = `${r.name} ${r.phone ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  // Group by section for the section-wise lists
  const bySection = new Map<string, Row[]>();
  const unassigned: Row[] = [];
  for (const r of filtered) {
    if (!r.sectionId) { unassigned.push(r); continue; }
    if (!bySection.has(r.sectionId)) bySection.set(r.sectionId, []);
    bySection.get(r.sectionId)!.push(r);
  }
  const sectionGroups = sections
    .map((s) => ({ section: s, rows: bySection.get(s.id) ?? [] }))
    .filter((g) => g.rows.length > 0);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Add, edit and organize students by section."
        action={
          <div className="flex items-center gap-2 print:hidden">
            <a
              href="/api/admin/students/export/xlsx"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Export Excel
            </a>
            <PrintButton />
          </div>
        }
      />

      {/* Add student */}
      <Card title="Add student" icon={<UserPlus className="h-4 w-4" />} className="print:hidden">
        <form action={createStudent} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Student name"><input name="name" placeholder="Full name" className={inputClass} required /></Field>
          <Field label="Phone number"><input name="phone" placeholder="9876543210" className={inputClass} required /></Field>
          <Field label="Section">
            <select name="sectionId" className={selectClass} required defaultValue="">
              <option value="" disabled>Select section…</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end"><Submit>Add student</Submit></div>
        </form>
      </Card>

      <div className="print:hidden">
        <SectionHeader title={`All students (${filtered.length})`} />
        <FilterBar
          placeholder="Search by name or phone…"
          filters={[
            {
              name: "section",
              label: "Section",
              options: sections.map((s) => ({ value: s.id, label: s.name })),
            },
          ]}
        />
      </div>

      {/* Master table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<GraduationCap className="h-8 w-8" />} title="No students match" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Sl. No.</th>
                <th className="px-4 py-2.5 font-medium">Student Name</th>
                <th className="px-4 py-2.5 font-medium">Phone Number</th>
                <th className="px-4 py-2.5 font-medium">Section</th>
                <th className="px-4 py-2.5 text-right font-medium print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r, i) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} />
                      <span className="font-medium text-foreground">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-foreground">{r.phone ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {r.sectionName ? <Badge tone="brand">{r.sectionName}</Badge> : <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="px-4 py-2.5 print:hidden">
                    <div className="flex items-center justify-end gap-2">
                      <EditStudentDialog
                        student={{ id: r.id, name: r.name, phone: r.phone, sectionId: r.sectionId }}
                        sections={sections.map((s) => ({ id: s.id, name: s.name }))}
                      />
                      <DeleteStudentButton id={r.id} name={r.name} attendanceCount={r.attendanceCount} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section-wise lists */}
      <div className="mt-8">
        <SectionHeader title="Section-wise lists" />
        {sectionGroups.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No sections with students to show.</p>
        ) : (
          sectionGroups.map(({ section: s, rows }) => (
            <CollapsibleGroup key={s.id} title={s.name} count={rows.length} defaultOpen={sectionGroups.length <= 4}>
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Sl. No.</th>
                    <th className="px-4 py-2 font-medium">Student Name</th>
                    <th className="px-4 py-2 font-medium">Phone Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{r.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CollapsibleGroup>
          ))
        )}
        {unassigned.length > 0 && (
          <CollapsibleGroup title="Unassigned" count={unassigned.length}>
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Sl. No.</th>
                  <th className="px-4 py-2 font-medium">Student Name</th>
                  <th className="px-4 py-2 font-medium">Phone Number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unassigned.map((r, i) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{r.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleGroup>
        )}
      </div>
    </div>
  );
}
