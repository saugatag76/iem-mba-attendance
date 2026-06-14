import { prisma } from "@/lib/prisma";
import { Card, inputClass, Submit } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

const STREAMS = [
  { value: "COMMON", label: "Common" },
  { value: "FINANCE", label: "Finance" },
  { value: "HR", label: "HR" },
  { value: "TECH_MANAGEMENT", label: "Tech Mgmt" },
];
import {
  createDepartment,
  createClass,
  createSubject,
  createOffering,
  createUser,
  importStudents,
} from "./actions";

export default async function AdminPage() {
  const [departments, classes, subjects, teachers, offerings, counts] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.classSection.findMany({ include: { department: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ include: { department: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } }),
    prisma.offering.findMany({
      include: { subject: true, classSection: true, teacher: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
  ]);

  const countOf = (r: string) => counts.find((c) => c.role === r)?._count ?? 0;

  return (
    <div>
      <div className="mb-4 flex gap-2 text-xs text-gray-500">
        <span>{departments.length} depts</span>·<span>{classes.length} classes</span>·
        <span>{subjects.length} subjects</span>·<span>{countOf("TEACHER")} teachers</span>·
        <span>{countOf("STUDENT")} students</span>
      </div>

      <Card title="Add department">
        <form action={createDepartment} className="flex gap-2">
          <input name="name" placeholder="Department name" className={inputClass} required />
          <Submit>Add</Submit>
        </form>
      </Card>

      <Card title="Add class section">
        <form action={createClass} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input name="name" placeholder="e.g. Year 2 Finance — Sec A" className={inputClass} required />
          <select name="year" className={inputClass} defaultValue={1}>
            <option value={1}>Year 1</option>
            <option value={2}>Year 2</option>
          </select>
          <select name="stream" className={inputClass} defaultValue="COMMON">
            {STREAMS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select name="departmentId" className={inputClass} required>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <Submit>Add</Submit>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          Year 1 → use stream &quot;Common&quot;. Year 2 → pick Finance/HR/Tech-Mgmt, or
          &quot;Common&quot; for the shared Marketing group.
        </p>
      </Card>

      <Card title="Add subject">
        <form action={createSubject} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <input name="name" placeholder="Subject name" className={inputClass} required />
          <input name="code" placeholder="Code e.g. FN201" className={inputClass} required />
          <select name="semester" className={inputClass} defaultValue={1}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>Sem {n}</option>
            ))}
          </select>
          <select name="stream" className={inputClass} defaultValue="COMMON">
            {STREAMS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select name="departmentId" className={inputClass} required>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <Submit>Add</Submit>
        </form>
      </Card>

      <Card title="Add user (teacher / admin / student)">
        <form action={createUser} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input name="email" type="email" placeholder="Email" className={inputClass} required />
          <input name="name" placeholder="Full name" className={inputClass} required />
          <select name="role" className={inputClass} defaultValue="TEACHER">
            <option value="ADMIN">Admin</option>
            <option value="TEACHER">Teacher</option>
            <option value="STUDENT">Student</option>
          </select>
          <input name="password" placeholder="Password" className={inputClass} defaultValue="changeme" />
          <Submit>Save</Submit>
        </form>
      </Card>

      <Card title="Create offering (subject → class → teacher)">
        <form action={createOffering} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select name="subjectId" className={inputClass} required>
            <option value="">Subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · Sem {s.semester} · {s.name}
              </option>
            ))}
          </select>
          <select name="classSectionId" className={inputClass} required>
            <option value="">Class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select name="teacherId" className={inputClass} required>
            <option value="">Teacher…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input name="term" placeholder="Term" className={inputClass} defaultValue="2026-ODD" />
          <Submit>Create</Submit>
        </form>
        {offerings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-gray-600">
            {offerings.map((o) => (
              <li key={o.id}>
                {o.subject.code} {o.subject.name} → {o.classSection.name} · {o.teacher.name} ({o.term})
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Bulk import students (CSV: email,name per line)">
        <form action={importStudents} className="flex flex-col gap-2">
          <select name="classSectionId" className={inputClass} required>
            <option value="">Enroll into class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <textarea
            name="csv"
            rows={5}
            placeholder={"student6@iem.edu,Neha Gupta\nstudent7@iem.edu,Sam Lee"}
            className={inputClass}
            required
          />
          <div className="flex items-center gap-2">
            <input name="defaultPassword" placeholder="Default password" className={inputClass} defaultValue="stud123" />
            <Submit>Import &amp; enroll</Submit>
          </div>
        </form>
      </Card>
    </div>
  );
}
