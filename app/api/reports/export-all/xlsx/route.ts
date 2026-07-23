import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { reportsOverview, defaultersList, studentsOverallStats, offeringReport } from "@/lib/attendance";
import { fetchSubstitutionReportRows, ADMIN_APPROVAL_LABEL, fmtReportDate } from "@/lib/substitutionReport";
import { parseDateRange, type DateRange } from "@/lib/dateRange";

/** Excel sheet names: max 31 chars, and can't contain : \ / ? * [ ].
 *  When de-duplicating, the suffix is reserved space *before* truncation —
 *  truncating first and appending after can produce the same 31-char string
 *  for every suffix (e.g. long subject codes), looping forever. */
function sheetName(raw: string, suffix?: number): string {
  const cleaned = raw.replace(/[:\\/?*[\]]/g, "-");
  if (!suffix) return cleaned.slice(0, 31);
  const suffixStr = `-${suffix}`;
  return cleaned.slice(0, 31 - suffixStr.length) + suffixStr;
}

/** All per-offering registers can be fetched independently — run them together
 *  rather than one at a time to stay well clear of serverless timeouts. */
async function fetchOfferingRegisters(offeringWhere: object, range?: DateRange) {
  const offeringsWithSessions = await prisma.offering.findMany({
    where: { ...offeringWhere, sessions: { some: {} } },
    include: { subject: true, classSection: true },
    orderBy: [{ subject: { code: "asc" } }, { classSection: { name: "asc" } }],
  });

  const reports = await Promise.all(offeringsWithSessions.map((o) => offeringReport(o.id, range)));

  return offeringsWithSessions
    .map((o, i) => ({ offering: o, report: reports[i] }))
    .filter((x): x is { offering: typeof x.offering; report: NonNullable<typeof x.report> } => !!x.report && x.report.sessions.length > 0);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN"))
    return new Response("forbidden", { status: 403 });

  const isAdmin = session.user.role === "ADMIN";
  const url = new URL(req.url);
  const range = parseDateRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const offeringWhere = isAdmin ? {} : { teacherId: session.user.id };

  // All five data sources are independent of each other — fetch concurrently.
  const [{ summaries }, defaulters, students, subRows, registers] = await Promise.all([
    reportsOverview(offeringWhere, range),
    defaultersList(offeringWhere, range),
    studentsOverallStats(isAdmin ? undefined : session.user.id, range),
    fetchSubstitutionReportRows({ userId: session.user.id, isAdmin, from: range?.from, to: range?.to }),
    fetchOfferingRegisters(offeringWhere, range),
  ]);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summaries.map((s) => ({
        "Subject Code": s.subjectCode,
        Subject: s.subjectName,
        Section: s.className,
        ...(isAdmin ? { Teacher: s.teacherName } : {}),
        Sessions: s.totalSessions,
        "Below 75%": s.defaulters,
        "Avg %": s.avgPercent,
      })),
    ),
    "Overview",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      defaulters.map((r) => ({
        Student: r.studentName,
        Email: r.studentEmail,
        "Subject Code": r.subjectCode,
        Subject: r.subjectName,
        Section: r.className,
        Teacher: r.teacherName,
        Attended: r.attended,
        Total: r.total,
        Percent: r.percent,
      })),
    ),
    "Defaulters",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      students.map((s) => ({
        Name: s.name,
        Email: s.email,
        Section: s.className,
        Sessions: s.totalSessions,
        Attended: s.attended,
        Percent: s.percent,
      })),
    ),
    "By Student",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      subRows.map((r) => ({
        Date: fmtReportDate(r.date),
        Day: r.scheduledClass.day,
        Time: `${r.scheduledClass.startTime}–${r.scheduledClass.endTime}`,
        Subject: r.scheduledClass.offering?.subject.name ?? "",
        "Subject Code": r.scheduledClass.offering?.subject.code ?? "",
        Semester: r.scheduledClass.offering?.term ?? "",
        Section: r.scheduledClass.offering?.classSection.name ?? "",
        "Original Teacher": r.requestedBy.name,
        ...(isAdmin ? { "Substitute Teacher": r.substituteTeacher.name } : {}),
        Status: r.classStatus,
        "Admin Approval": ADMIN_APPROVAL_LABEL[r.status],
        Remarks: r.adminNote || r.teacherNote || "",
      })),
    ),
    "Substitutions",
  );

  // One register sheet per subject that actually held sessions — subjects with
  // zero sessions have nothing to show and would just be empty sheets.
  const usedNames = new Set<string>();
  for (const { offering: o, report } of registers) {
    const registerData = report.rows.map((r) => {
      const row: Record<string, string | number> = { Student: r.name, Email: r.email };
      for (const s of report.sessions) {
        const d = new Date(s.date);
        const label = `${d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
        row[label] = r.bySession[s.id] ? "P" : "A";
      }
      row["Attended"] = r.attended;
      row["Total"] = r.total;
      row["Percent"] = r.percent;
      return row;
    });

    const base = `${o.subject.code}-${o.classSection.name}`;
    let suffix = 0;
    let name = sheetName(base);
    while (usedNames.has(name)) {
      if (++suffix > 1000) throw new Error(`Could not find a unique sheet name for "${base}"`);
      name = sheetName(base, suffix);
    }
    usedNames.add(name);

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(registerData), name);
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-full-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
