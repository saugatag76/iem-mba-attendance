import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Exports the full student roster as an Excel workbook: one "All Students" sheet
 *  plus one sheet per section — matching the section-wise lists shown in the app. */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return new Response("forbidden", { status: 403 });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: { enrollments: { include: { classSection: true } } },
    orderBy: { name: "asc" },
  });

  const bySection = new Map<string, { name: string; phone: string }[]>();
  const allRows: { name: string; phone: string; sectionName: string }[] = [];

  for (const s of students) {
    const primary = s.enrollments[0]?.classSection;
    const sectionName = primary?.name ?? "Unassigned";
    allRows.push({ name: s.name, phone: s.phone ?? "", sectionName });
    if (!bySection.has(sectionName)) bySection.set(sectionName, []);
    bySection.get(sectionName)!.push({ name: s.name, phone: s.phone ?? "" });
  }

  const wb = XLSX.utils.book_new();

  const allSheetData = allRows.map((r, i) => ({
    "Sl. No.": i + 1,
    "Student Name": r.name,
    "Phone Number": r.phone,
    Section: r.sectionName,
  }));
  const allWs = XLSX.utils.json_to_sheet(allSheetData);
  allWs["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, allWs, "All Students");

  for (const [sectionName, rows] of bySection) {
    const data = rows.map((r, i) => ({
      "Sl. No.": i + 1,
      "Student Name": r.name,
      "Phone Number": r.phone,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 16 }];
    // Sheet names: max 31 chars, no \ / ? * [ ] :
    const safeName = sectionName.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Section";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
