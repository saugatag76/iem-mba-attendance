/*
 * Exports current seed logins (admin/teacher/student) to one Excel file per role
 * under data/logins/. Run:  npx tsx scripts/export-logins.ts
 */
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import data from "../prisma/timetable-data.json";

const OUT_DIR = path.join("data", "logins");
fs.mkdirSync(OUT_DIR, { recursive: true });

function writeSheet(filename: string, rows: { Name: string; Email: string; Password: string }[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 26 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Logins");
  XLSX.writeFile(wb, path.join(OUT_DIR, filename));
}

// --- Admin ---
writeSheet("admin-logins.xlsx", [{ Name: "MBA Admin", Email: "admin@iem.edu", Password: "admin123" }]);

// --- Teachers ---
writeSheet(
  "teacher-logins.xlsx",
  data.teachers.map((t) => ({ Name: t.name, Email: t.email, Password: "teach123" })),
);

// --- Students (5 sample students per section, matching prisma/seed.ts) ---
const emailBase = (sectionName: string) => sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "");
const students: { Name: string; Email: string; Password: string }[] = [];
for (const sec of data.sections) {
  const base = emailBase(sec.name);
  for (let i = 1; i <= 5; i++) {
    students.push({ Name: `${sec.name} Student ${i}`, Email: `${base}.s${i}@iem.edu`, Password: "stud123" });
  }
}
writeSheet("student-logins.xlsx", students);

console.log(`Wrote ${OUT_DIR}/admin-logins.xlsx, teacher-logins.xlsx (${data.teachers.length}), student-logins.xlsx (${students.length})`);
