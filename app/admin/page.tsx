import {
  Building2,
  Layers,
  BookOpen,
  UserPlus,
  Link2,
  Upload,
  Users,
  GraduationCap,
  UserCog,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  Card,
  Field,
  inputClass,
  selectClass,
  textareaClass,
  Submit,
  StatCard,
  PageHeader,
} from "@/app/_components/ui";
import {
  createDepartment,
  createClass,
  createSubject,
  createOffering,
  createUser,
  importStudents,
} from "./actions";

export const dynamic = "force-dynamic";

const STREAMS = [
  { value: "COMMON", label: "Common" },
  { value: "FINANCE", label: "Finance" },
  { value: "HR", label: "HR" },
  { value: "TECH_MANAGEMENT", label: "Tech Mgmt" },
];

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
      <PageHeader title="Administration" subtitle="Set up departments, classes, subjects, offerings and people." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Departments" value={departments.length} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Classes" value={classes.length} />
        <StatCard icon={<BookOpen className="h-4 w-4" />} label="Subjects" value={subjects.length} />
        <StatCard icon={<UserCog className="h-4 w-4" />} label="Teachers" value={countOf("TEACHER")} />
        <StatCard icon={<GraduationCap className="h-4 w-4" />} label="Students" value={countOf("STUDENT")} />
      </div>

      <Card title="Add department" icon={<Building2 className="h-4 w-4" />}>
        <form action={createDepartment} className="flex gap-2">
          <input name="name" placeholder="Department name" className={inputClass} required />
          <Submit>Add</Submit>
        </form>
      </Card>

      <Card title="Add class section" icon={<Layers className="h-4 w-4" />}>
        <form action={createClass} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Name" className="col-span-2 sm:col-span-1">
            <input name="name" placeholder="Year 2 Finance — Sec A" className={inputClass} required />
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
          <div className="flex items-end">
            <Submit>Add</Submit>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Year 1 → stream &quot;Common&quot;. Year 2 → Finance/HR/Tech-Mgmt, or &quot;Common&quot; for the shared Marketing group.
        </p>
      </Card>

      <Card title="Add subject" icon={<BookOpen className="h-4 w-4" />}>
        <form action={createSubject} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Field label="Name" className="col-span-2 sm:col-span-2">
            <input name="name" placeholder="Subject name" className={inputClass} required />
          </Field>
          <Field label="Code">
            <input name="code" placeholder="FN201" className={inputClass} required />
          </Field>
          <Field label="Semester">
            <select name="semester" className={selectClass} defaultValue={1}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>Sem {n}</option>
              ))}
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
          <div className="col-span-2 flex items-end sm:col-span-6">
            <Submit>Add subject</Submit>
          </div>
        </form>
      </Card>

      <Card title="Add user (teacher / admin / student)" icon={<UserPlus className="h-4 w-4" />}>
        <form action={createUser} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Email">
            <input name="email" type="email" placeholder="Email" className={inputClass} required />
          </Field>
          <Field label="Full name">
            <input name="name" placeholder="Full name" className={inputClass} required />
          </Field>
          <Field label="Role">
            <select name="role" className={selectClass} defaultValue="TEACHER">
              <option value="ADMIN">Admin</option>
              <option value="TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
            </select>
          </Field>
          <Field label="Password">
            <input name="password" placeholder="Password" className={inputClass} defaultValue="changeme" />
          </Field>
          <div className="flex items-end">
            <Submit>Save</Submit>
          </div>
        </form>
      </Card>

      <Card title="Create offering (subject → class → teacher)" icon={<Link2 className="h-4 w-4" />}>
        <form action={createOffering} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Subject" className="col-span-2 sm:col-span-1">
            <select name="subjectId" className={selectClass} required>
              <option value="">Subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.code} · Sem {s.semester} · {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select name="classSectionId" className={selectClass} required>
              <option value="">Class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Teacher">
            <select name="teacherId" className={selectClass} required>
              <option value="">Teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Term">
            <input name="term" placeholder="Term" className={inputClass} defaultValue="2026-ODD" />
          </Field>
          <div className="flex items-end">
            <Submit>Create</Submit>
          </div>
        </form>
        {offerings.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-xs text-slate-600">
            {offerings.map((o) => (
              <li key={o.id} className="py-1.5">
                <span className="font-medium text-slate-800">{o.subject.code}</span> {o.subject.name}
                <span className="text-slate-400"> → </span>
                {o.classSection.name} · {o.teacher.name} <span className="text-slate-400">({o.term})</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Bulk import students (CSV: email,name per line)" icon={<Upload className="h-4 w-4" />}>
        <form action={importStudents} className="flex flex-col gap-3">
          <Field label="Enroll into class">
            <select name="classSectionId" className={selectClass} required>
              <option value="">Choose class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <textarea
            name="csv"
            rows={5}
            placeholder={"fina6@iem.edu,Neha Gupta\nfina7@iem.edu,Sam Lee"}
            className={textareaClass}
            required
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input name="defaultPassword" placeholder="Default password" className={inputClass} defaultValue="stud123" />
            <Submit>Import &amp; enroll</Submit>
          </div>
        </form>
      </Card>
    </div>
  );
}
