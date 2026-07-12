/*
 * Safely syncs the live database's weekly schedule to a new timetable Excel file,
 * WITHOUT the destructive `scheduledClass.deleteMany({})` that prisma/seed.ts uses
 * (that would cascade-delete SubstitutionRequest history — see schema.prisma's
 * `onDelete: Cascade` on SubstitutionRequest.scheduledClass).
 *
 * Instead this does a keyed diff against what's actually live right now:
 *   - slot in new file but not live      -> CREATE a new ScheduledClass
 *   - slot in both but offering changed  -> UPDATE the existing row's offeringId
 *   - slot live but not in new file      -> if it has substitution history, just
 *                                           null out offeringId (keeps the row so
 *                                           history stays intact); otherwise delete it
 *
 * Run:  npx tsx scripts/sync-timetable.ts <path-to-xlsx> [--apply]
 * Without --apply it only prints the diff (dry run, no writes).
 */
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Weekday } from "@prisma/client";
import { FACULTY } from "../lib/facultyInitials";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const XLSX_PATH = args.find((a) => !a.startsWith("--"));
if (!XLSX_PATH) {
  console.error("Usage: npx tsx scripts/sync-timetable.ts <path-to-xlsx> [--apply]");
  process.exit(1);
}

// ---- Same parsing rules as scripts/parse-timetable.ts ----
const ALIAS: Record<string, string> = {
  mathematics: "MBA101",
  "micro economics": "MBA103",
  frsa: "MBA102",
  lbece: "MBA104",
  "marketing mgmt": "MBA105",
  "marketing mgmt.": "MBA105",
  ob: "MBA171",
  communication: "MBA172",
  cab: "MBA173",
  "research methodology": "MBA174",
  "excel lab": "MBA191",
  "entrepreneurship lab": "MBA192",
  "language lab": "MBA193",
  "tally lab": "MBA194",
  "entrepreneurship masterclass": "MBA195",
  b2b: "CM401",
  "retail strategy": "CM402",
  "consumer behaviour": "MM401",
  "customer experience and relationship management": "MM402",
  "international finance": "FM401",
  iapm: "FM402",
  "hr analytics": "HR401",
  "compensation & benefits management": "HR402",
  "supply chain analytics": "SC401",
  "supply chain design & planning": "SC402",
  "data mining": "TM401",
  "business forecasting": "TM402",
  "corporate strategy": "MBA471",
  "boardroom simulation": "MBA493",
  "advanced excel": "MBA492",
  "tech enablers for digital business": "MBA491",
};

const SECTIONS: Record<string, { name: string; year: number; stream: string }> = {
  A: { name: "Sec A", year: 1, stream: "COMMON" },
  B: { name: "Sec B", year: 1, stream: "COMMON" },
  C: { name: "Sec C", year: 1, stream: "COMMON" },
  D: { name: "Sec D", year: 1, stream: "COMMON" },
  "FINANCE 1": { name: "Finance 1", year: 2, stream: "FINANCE" },
  "FINANCE 2": { name: "Finance 2", year: 2, stream: "FINANCE" },
  HR: { name: "HR", year: 2, stream: "HR" },
  SC: { name: "SC", year: 2, stream: "SUPPLY_CHAIN" },
  MM: { name: "MM", year: 2, stream: "MARKETING" },
  TM: { name: "TM", year: 2, stream: "TECH_MANAGEMENT" },
};

const DAYS: Record<string, string> = {
  monday: "MON",
  tuesday: "TUE",
  wednesday: "WED",
  thursday: "THU",
  friday: "FRI",
};

const MAJOR_TO_SECTION: Record<string, string[]> = {
  FM: ["Finance 1", "Finance 2"],
  HR: ["HR"],
  MM: ["MM"],
  SC: ["SC"],
  TM: ["TM"],
};

const subjects = new Map<string, { code: string; name: string; semester: number; stream: string }>();
const offerings = new Map<string, { subjectCode: string; sectionName: string; teacherInitials: string; term: string }>();
const schedule: {
  sectionName: string; day: string; slotIndex: number; startTime: string; endTime: string;
  subjectCode: string; teacherInitials: string; subgroup: string | null; rawLabel: string;
}[] = [];
const usedInitials = new Set<string>(["NA"]);
const unresolved = new Set<string>();
const newInitials = new Set<string>();

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
function pad(t: string) {
  const [h, m] = t.trim().split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}
function norm(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function addSubject(code: string, name: string, semester: number, stream: string) {
  if (!subjects.has(code)) subjects.set(code, { code, name, semester, stream });
}
function addOffering(subjectCode: string, sectionName: string, teacherInitials: string, term: string) {
  const key = `${subjectCode}|${sectionName}|${teacherInitials}|${term}`;
  if (!offerings.has(key)) offerings.set(key, { subjectCode, sectionName, teacherInitials, term });
}

function resolveSubject(rawName: string, semester: number, stream: string): string {
  const name = norm(rawName);
  const codeMatch = name.match(/^([A-Za-z]{2,4})\s?-?\s?(\d{3})$/);
  if (codeMatch) {
    const code = (codeMatch[1] + codeMatch[2]).toUpperCase();
    addSubject(code, name.toUpperCase(), semester, stream);
    return code;
  }
  const alias = ALIAS[name.toLowerCase()];
  if (alias) {
    addSubject(alias, name, semester, stream);
    return alias;
  }
  const code = "ACT-" + slug(name);
  if (!subjects.has(code)) unresolved.add(name);
  addSubject(code, name, semester, stream);
  return code;
}

function teacher(initials: string): string {
  const t = norm(initials).toUpperCase().replace(/\.$/, "");
  if (!t) return "NA";
  if (!FACULTY[t]) {
    if (/^[A-Z]{2,4}$/.test(t)) {
      FACULTY[t] = t;
      newInitials.add(t);
    } else return "NA";
  }
  usedInitials.add(t);
  return t;
}

function parseCell(text: string, currentSection: string) {
  const out: { sectionName: string; subjectText: string; teacherInitials: string; subgroup: string | null }[] = [];
  const cell = norm(text);
  if (!cell) return out;
  const parts = /\d/.test(cell) && cell.includes("/") ? cell.split("/") : [cell];
  for (const partRaw of parts) {
    const part = norm(partRaw);
    if (!part) continue;
    const paren = part.match(/^([^()]+)\(([^()]*)\)\s*$/);
    const subjectText = paren ? norm(paren[1]) : part.replace(/\(.*$/, "").trim() || part;
    const inside = paren ? norm(paren[2]) : "";
    const codePref = subjectText.toUpperCase().match(/^([A-Z]{2})\s?\d{3}/);
    const routedSections = codePref ? MAJOR_TO_SECTION[codePref[1]] : undefined;
    const sg = [...inside.matchAll(/([A-Za-z]\d)\s*-\s*([A-Za-z.]+)/g)];
    if (sg.length) {
      for (const [, grp, init] of sg) {
        let sec = currentSection;
        if (routedSections) {
          if (/^F1$/i.test(grp)) sec = "Finance 1";
          else if (/^F2$/i.test(grp)) sec = "Finance 2";
          else sec = routedSections[0];
        }
        out.push({ sectionName: sec, subjectText, teacherInitials: init, subgroup: grp.toUpperCase() });
      }
      continue;
    }
    const init = inside || "NA";
    if (routedSections) {
      for (const sec of routedSections) out.push({ sectionName: sec, subjectText, teacherInitials: init, subgroup: null });
    } else {
      out.push({ sectionName: currentSection, subjectText, teacherInitials: init, subgroup: null });
    }
  }
  return out;
}

function parseWorkbook(xlsxPath: string) {
  const wb = XLSX.readFile(xlsxPath);
  const tt: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["Timetable"], { header: 1, raw: false, defval: "" });
  const header = tt[1] ?? [];
  const slots: { col: number; idx: number; start: string; end: string }[] = [];
  let idx = 0;
  for (let c = 2; c <= 10; c++) {
    const h = norm(String(header[c] ?? ""));
    const m = h.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (m) {
      idx++;
      slots.push({ col: c, idx, start: pad(m[1]), end: pad(m[2]) });
    }
  }

  let currentDay = "";
  for (let r = 2; r < tt.length; r++) {
    const row = tt[r];
    if (!row) continue;
    const dayCell = norm(String(row[0] ?? "")).toLowerCase();
    if (DAYS[dayCell]) currentDay = DAYS[dayCell];
    const secLabel = norm(String(row[1] ?? "")).toUpperCase();
    const sec = SECTIONS[secLabel];
    if (!sec || !currentDay) continue;

    for (const s of slots) {
      const raw = norm(String(row[s.col] ?? ""));
      if (!raw) continue;
      const entries = parseCell(raw, sec.name);
      for (const e of entries) {
        const target = SECTIONS[Object.keys(SECTIONS).find((k) => SECTIONS[k].name === e.sectionName) ?? ""] ?? sec;
        const term = target.year === 1 ? "2026-T1" : "2026-T4";
        const sem = target.year === 1 ? 1 : 4;
        const code = resolveSubject(e.subjectText, sem, target.stream);
        const tInit = teacher(e.teacherInitials);
        addOffering(code, e.sectionName, tInit, term);
        schedule.push({
          sectionName: e.sectionName,
          day: currentDay,
          slotIndex: s.idx,
          startTime: s.start,
          endTime: s.end,
          subjectCode: code,
          teacherInitials: tInit,
          subgroup: e.subgroup,
          rawLabel: raw,
        });
      }
    }
  }
}

function scheduleKey(e: { sectionName: string; day: string; slotIndex: number; subgroup: string | null }) {
  return `${e.sectionName}|${e.day}|${e.slotIndex}|${e.subgroup ?? ""}`;
}

async function main() {
  parseWorkbook(path.resolve(XLSX_PATH!));

  console.log(`Parsed ${XLSX_PATH}: subjects=${subjects.size} offerings=${offerings.size} schedule=${schedule.length}`);
  if (unresolved.size) console.log(`  New/unrecognized subjects (created as activities): ${[...unresolved].join(" | ")}`);
  if (newInitials.size) console.log(`  New teacher initials (not in lib/facultyInitials.ts, using initials as name): ${[...newInitials].join(", ")}`);

  const dept = await prisma.department.findFirst({ where: { name: "Master of Business Administration (MBA)" } });
  if (!dept) throw new Error("Department not found — run the initial seed first.");

  // ---- Upsert teachers / subjects / sections / offerings (safe — no deletes) ----
  const teacherId = new Map<string, string>();
  if (APPLY) {
    const teachHash = await (await import("bcryptjs")).default.hash("Teacher@2026", 10);
    for (const init of usedInitials) {
      const email = (init === "NA" ? "staff" : init.toLowerCase()) + "@iem.edu.in";
      const name = FACULTY[init] ?? init;
      const u = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: { email, name, role: "TEACHER", passwordHash: teachHash, personalCode: String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0") },
      });
      teacherId.set(init, u.id);
    }
  } else {
    const existing = await prisma.user.findMany({ where: { role: "TEACHER" }, select: { id: true, email: true } });
    for (const init of usedInitials) {
      const email = (init === "NA" ? "staff" : init.toLowerCase()) + "@iem.edu.in";
      const match = existing.find((u) => u.email === email);
      if (match) teacherId.set(init, match.id);
    }
  }

  const subjectId = new Map<string, string>();
  for (const s of subjects.values()) {
    if (APPLY) {
      const subj = await prisma.subject.upsert({
        where: { departmentId_code: { departmentId: dept.id, code: s.code } },
        update: { name: s.name, semester: s.semester, stream: s.stream as never },
        create: { code: s.code, name: s.name, semester: s.semester, stream: s.stream as never, departmentId: dept.id },
      });
      subjectId.set(s.code, subj.id);
    } else {
      const subj = await prisma.subject.findUnique({ where: { departmentId_code: { departmentId: dept.id, code: s.code } } });
      if (subj) subjectId.set(s.code, subj.id);
    }
  }

  const sectionId = new Map<string, string>();
  for (const sec of Object.values(SECTIONS).filter((v, i, a) => a.findIndex((x) => x.name === v.name) === i)) {
    const cs = await prisma.classSection.findUnique({ where: { departmentId_name: { departmentId: dept.id, name: sec.name } } });
    if (cs) sectionId.set(sec.name, cs.id);
  }

  const offeringId = new Map<string, string>();
  for (const o of offerings.values()) {
    const sid = subjectId.get(o.subjectCode);
    const csid = sectionId.get(o.sectionName);
    const tid = teacherId.get(o.teacherInitials) ?? teacherId.get("NA");
    if (!sid || !csid || !tid) continue;
    if (APPLY) {
      const off = await prisma.offering.upsert({
        where: { subjectId_classSectionId_teacherId_term: { subjectId: sid, classSectionId: csid, teacherId: tid, term: o.term } },
        update: {},
        create: { subjectId: sid, classSectionId: csid, teacherId: tid, term: o.term },
      });
      offeringId.set(`${o.subjectCode}|${o.sectionName}|${o.teacherInitials}|${o.term}`, off.id);
    } else {
      const off = await prisma.offering.findUnique({
        where: { subjectId_classSectionId_teacherId_term: { subjectId: sid, classSectionId: csid, teacherId: tid, term: o.term } },
      });
      if (off) offeringId.set(`${o.subjectCode}|${o.sectionName}|${o.teacherInitials}|${o.term}`, off.id);
    }
  }

  // ---- Diff schedule: new file vs what's actually live ----
  // Scope strictly to the real timetable's sections — e.g. "Demo Class" is a
  // separate synthetic section for live demos, never sourced from any xlsx,
  // and must never be touched (added/updated/removed) by this sync.
  const knownSectionNames = new Set(sectionId.keys());
  const allLiveRows = await prisma.scheduledClass.findMany({
    include: { classSection: true, offering: { include: { subject: true, teacher: true } }, _count: { select: { substitutionRequests: true } } },
  });
  const liveRows = allLiveRows.filter((r) => knownSectionNames.has(r.classSection.name));
  const skippedOther = allLiveRows.length - liveRows.length;
  if (skippedOther > 0) {
    console.log(`Ignoring ${skippedOther} scheduled class(es) outside the timetable's sections (e.g. Demo Class) — untouched.`);
  }
  const liveByKey = new Map<string, (typeof liveRows)[number]>();
  for (const r of liveRows) {
    liveByKey.set(scheduleKey({ sectionName: r.classSection.name, day: r.day, slotIndex: r.slotIndex, subgroup: r.subgroup }), r);
  }

  const matchedLiveIds = new Set<string>();
  let added = 0, changed = 0, unchanged = 0;
  const report: string[] = [];

  for (const e of schedule) {
    const csid = sectionId.get(e.sectionName);
    if (!csid) continue;
    const term = e.sectionName.startsWith("Sec") ? "2026-T1" : "2026-T4";
    const offId = offeringId.get(`${e.subjectCode}|${e.sectionName}|${e.teacherInitials}|${term}`) ?? null;
    const key = scheduleKey(e);
    const live = liveByKey.get(key);

    if (!live) {
      added++;
      report.push(`➕ ADD    ${e.sectionName.padEnd(10)} ${e.day} slot${e.slotIndex}${e.subgroup ? `(${e.subgroup})` : ""}  ${e.rawLabel}`);
      if (APPLY) {
        await prisma.scheduledClass.create({
          data: { classSectionId: csid, day: e.day as Weekday, slotIndex: e.slotIndex, startTime: e.startTime, endTime: e.endTime, offeringId: offId, subgroup: e.subgroup, rawLabel: e.rawLabel },
        });
      }
      continue;
    }

    matchedLiveIds.add(live.id);
    if (live.offeringId !== offId || live.rawLabel !== e.rawLabel) {
      changed++;
      const before = live.offering ? `${live.offering.subject.code} / ${live.offering.teacher.name}` : "—";
      report.push(`✏️  UPDATE ${e.sectionName.padEnd(10)} ${e.day} slot${e.slotIndex}${e.subgroup ? `(${e.subgroup})` : ""}  ${before}  →  ${e.rawLabel}`);
      if (APPLY) {
        await prisma.scheduledClass.update({ where: { id: live.id }, data: { offeringId: offId, startTime: e.startTime, endTime: e.endTime, rawLabel: e.rawLabel } });
      }
    } else {
      unchanged++;
    }
  }

  // Anything live but not in the new file at all → removed
  let removedKept = 0, removedDeleted = 0;
  for (const r of liveRows) {
    if (matchedLiveIds.has(r.id)) continue;
    const label = r.offering ? `${r.offering.subject.code} / ${r.offering.teacher.name}` : r.rawLabel;
    if (r._count.substitutionRequests > 0) {
      removedKept++;
      report.push(`➖ REMOVE ${r.classSection.name.padEnd(10)} ${r.day} slot${r.slotIndex}${r.subgroup ? `(${r.subgroup})` : ""}  ${label}  (kept — ${r._count.substitutionRequests} substitution record(s) attached; offering cleared instead of deleting)`);
      if (APPLY) {
        await prisma.scheduledClass.update({ where: { id: r.id }, data: { offeringId: null } });
      }
    } else {
      removedDeleted++;
      report.push(`➖ REMOVE ${r.classSection.name.padEnd(10)} ${r.day} slot${r.slotIndex}${r.subgroup ? `(${r.subgroup})` : ""}  ${label}  (deleted — no history attached)`);
      if (APPLY) {
        await prisma.scheduledClass.delete({ where: { id: r.id } });
      }
    }
  }

  console.log(`\n${APPLY ? "APPLIED" : "DRY RUN — nothing written (pass --apply to write)"}\n`);
  console.log(`Added: ${added}   Updated: ${changed}   Unchanged: ${unchanged}   Removed-kept(history): ${removedKept}   Removed-deleted: ${removedDeleted}\n`);
  for (const line of report) console.log(" ", line);

  if (APPLY) {
    // Keep the committed seed snapshot in sync with what's now live.
    const out = {
      sections: Object.values(SECTIONS).filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i),
      subjects: [...subjects.values()].sort((a, b) => a.code.localeCompare(b.code)),
      teachers: [...usedInitials].sort().map((init) => ({ initials: init, name: FACULTY[init] ?? init, email: (init === "NA" ? "staff" : init.toLowerCase()) + "@iem.edu.in" })),
      offerings: [...offerings.values()],
      schedule,
    };
    fs.writeFileSync(path.join("prisma", "timetable-data.json"), JSON.stringify(out, null, 2));
    console.log("\nRegenerated prisma/timetable-data.json from this file.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
