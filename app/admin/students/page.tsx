import Link from "next/link";
import { UserPlus, Download, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Field, inputClass, selectClass, Submit, PageHeader, Avatar, Badge, EmptyState, cn } from "@/app/_components/ui";
import { SectionHeader } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { createStudent } from "./actions";
import { EditStudentDialog } from "./EditStudentDialog";
import { DeleteStudentButton } from "./DeleteStudentButton";
import { PrintButton } from "@/app/_components/PrintButton";
import { ResetPasswordDialog } from "@/app/_components/ResetPasswordDialog";

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
    enrollmentNo: string | null;
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
      enrollmentNo: s.enrollmentNo,
      sectionId: primary?.id ?? null,
      sectionName: primary?.name ?? null,
      attendanceCount: s._count.attendanceRecords,
    };
  });

  // Search text applies regardless of which section tab is active — used both
  // to filter the table and to compute the per-tab counts below.
  const searchFiltered = allRows.filter((r) => {
    if (!needle) return true;
    const hay = `${r.name} ${r.phone ?? ""} ${r.enrollmentNo ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });

  const filtered = searchFiltered.filter((r) => {
    if (!section) return true;
    if (section === "unassigned") return !r.sectionId;
    return r.sectionId === section;
  });

  function tabHref(sectionId: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sectionId) params.set("section", sectionId);
    const qs = params.toString();
    return `/admin/students${qs ? `?${qs}` : ""}`;
  }
  const sectionCounts = new Map<string, number>();
  let unassignedCount = 0;
  for (const r of searchFiltered) {
    if (!r.sectionId) { unassignedCount++; continue; }
    sectionCounts.set(r.sectionId, (sectionCounts.get(r.sectionId) ?? 0) + 1);
  }
  const sectionTabs = [
    { label: `All (${searchFiltered.length})`, href: tabHref(""), value: "" },
    ...sections
      .filter((s) => (sectionCounts.get(s.id) ?? 0) > 0)
      .map((s) => ({ label: `${s.name} (${sectionCounts.get(s.id)})`, href: tabHref(s.id), value: s.id })),
    ...(unassignedCount > 0 ? [{ label: `Unassigned (${unassignedCount})`, href: tabHref("unassigned"), value: "unassigned" }] : []),
  ];

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
          <Field label="Phone or enrollment no."><input name="identifier" placeholder="9876543210 or 14-digit enrollment no." className={inputClass} required /></Field>
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
        <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {sectionTabs.map((t) => (
            <Link
              key={t.value}
              href={t.href}
              aria-current={section === t.value ? "page" : undefined}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
                section === t.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <FilterBar placeholder="Search by name, phone or enrollment no…" />
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
                <th className="px-4 py-2.5 font-medium">Phone / Enrollment</th>
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
                  <td className="px-4 py-2.5 font-mono text-foreground">{r.phone ?? r.enrollmentNo ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {r.sectionName ? <Badge tone="brand">{r.sectionName}</Badge> : <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="px-4 py-2.5 print:hidden">
                    <div className="flex items-center justify-end gap-2">
                      <EditStudentDialog
                        student={{ id: r.id, name: r.name, phone: r.phone, enrollmentNo: r.enrollmentNo, sectionId: r.sectionId }}
                        sections={sections.map((s) => ({ id: s.id, name: s.name }))}
                      />
                      <ResetPasswordDialog userId={r.id} userName={r.name} role="STUDENT" redirectTo="/admin/students" />
                      <DeleteStudentButton id={r.id} name={r.name} attendanceCount={r.attendanceCount} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
