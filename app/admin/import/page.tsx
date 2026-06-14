import { Upload, Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Card, Field, inputClass, selectClass, textareaClass, Submit, PageHeader } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

import { importStudents } from "../actions";

export default async function ImportPage() {
  await requireRole("ADMIN");
  const classes = await prisma.classSection.findMany({
    include: { _count: { select: { enrollments: true } } },
    orderBy: [{ year: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader title="Import students" subtitle="Bulk-create students and enroll them into a class." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Bulk import (CSV)" icon={<Upload className="h-4 w-4" />} className="mb-0 lg:col-span-2">
          <form action={importStudents} className="flex flex-col gap-3">
            <Field label="Enroll into class">
              <select name="classSectionId" className={selectClass} required>
                <option value="">Choose class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c._count.enrollments} enrolled)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Students — one per line: email,name">
              <textarea
                name="csv"
                rows={8}
                placeholder={"fina6@iem.edu,Neha Gupta\nfina7@iem.edu,Sam Lee"}
                className={`${textareaClass} font-mono text-xs`}
                required
              />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Field label="Default password" className="flex-1">
                <input name="defaultPassword" placeholder="stud123" className={inputClass} defaultValue="stud123" />
              </Field>
              <div className="flex items-end"><Submit>Import &amp; enroll</Submit></div>
            </div>
          </form>
        </Card>

        <Card title="How it works" icon={<Info className="h-4 w-4" />} className="mb-0">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• One student per line as <code className="rounded bg-slate-100 px-1 text-xs">email,name</code>.</li>
            <li>• Existing emails are reused (not duplicated) and just enrolled.</li>
            <li>• New students get the default password — ask them to change it.</li>
            <li>• Emails are case-insensitive at login.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
