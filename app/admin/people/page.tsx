import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Field, inputClass, selectClass, Submit, PageHeader, Avatar, Badge } from "@/app/_components/ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { SectionHeader } from "@/app/_components/layout-ui";
import { createUser } from "../actions";

export const dynamic = "force-dynamic";

const ROLE_TONE = { ADMIN: "brand", TEACHER: "green", STUDENT: "gray" } as const;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  await requireRole("ADMIN");
  const { q = "", role = "" } = await searchParams;
  const needle = q.trim().toLowerCase();

  const users = await prisma.user.findMany({
    where: role ? { role: role as "ADMIN" | "TEACHER" | "STUDENT" } : {},
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  const rows = needle
    ? users.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
    : users;

  return (
    <div>
      <PageHeader title="People" subtitle="Teachers, admins and students." />

      <Card title="Add user" icon={<UserPlus className="h-4 w-4" />}>
        <form action={createUser} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Email"><input name="email" type="email" placeholder="Email" className={inputClass} required /></Field>
          <Field label="Full name"><input name="name" placeholder="Full name" className={inputClass} required /></Field>
          <Field label="Role">
            <select name="role" className={selectClass} defaultValue="TEACHER">
              <option value="ADMIN">Admin</option>
              <option value="TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
            </select>
          </Field>
          <Field label="Password"><input name="password" placeholder="Password" className={inputClass} defaultValue="changeme" /></Field>
          <div className="flex items-end"><Submit>Save</Submit></div>
        </form>
      </Card>

      <SectionHeader title={`Directory (${rows.length})`} />
      <FilterBar
        placeholder="Search by name or email…"
        filters={[
          {
            name: "role",
            label: "Role",
            options: [
              { value: "ADMIN", label: "Admins" },
              { value: "TEACHER", label: "Teachers" },
              { value: "STUDENT", label: "Students" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No people match.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 text-right font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 200).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} />
                      <span className="font-medium text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              Showing first 200 of {rows.length}. Refine your search to narrow down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
