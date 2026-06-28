/*
 * Parses data/Timetable_*.xlsx into prisma/timetable-data.json (committed), so the seed is
 * reproducible without the Excel. Year-1 (Sec A–D) cells are clean; Year-2 combined/parallel
 * major cells are best-effort, with the original cell preserved in `rawLabel`.
 *
 * Run:  npx tsx scripts/parse-timetable.ts
 */
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { FACULTY } from "../lib/facultyInitials";

const XLSX_PATH = path.join("Timetable_term1_term4_june,2026_v8.xlsx");
const OUT = path.join("prisma", "timetable-data.json");

// ---- Subject display name (as written in the timetable) → code ----
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
  // Year 2
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

// code prefix in a combined Year-2 cell → target section name(s)
const MAJOR_TO_SECTION: Record<string, string[]> = {
  FM: ["Finance 1", "Finance 2"],
  HR: ["HR"],
  MM: ["MM"],
  SC: ["SC"],
  TM: ["TM"],
};

// ---- collectors ----
const subjects = new Map<string, { code: string; name: string; semester: number; stream: string }>();
const offerings = new Map<string, { subjectCode: string; sectionName: string; teacherInitials: string; term: string }>();
const schedule: any[] = [];
const usedInitials = new Set<string>(["NA"]);
const unresolved = new Set<string>();

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
  // Include teacher in key so the same subject taught by different teachers to the same
  // class gets separate offering records (e.g. OB Sec A: PC on Tue/Fri, CM on Thu).
  const key = `${subjectCode}|${sectionName}|${teacherInitials}|${term}`;
  if (!offerings.has(key)) offerings.set(key, { subjectCode, sectionName, teacherInitials, term });
}

/** Resolve a subject display text to a code; create an activity subject if unknown. */
function resolveSubject(rawName: string, semester: number, stream: string): string {
  let name = norm(rawName);
  // direct code like "FM 401", "HR402", "MBA194"
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
  // activity / unknown → synthesize
  const code = "ACT-" + slug(name);
  if (!subjects.has(code)) unresolved.add(name);
  addSubject(code, name, semester, stream);
  return code;
}

function teacher(initials: string): string {
  const t = norm(initials).toUpperCase().replace(/\.$/, "");
  if (!t) return "NA";
  // Valid only if a known initial, or a clean 2–4 letter token. Anything else
  // (e.g. "F1 + MM + TM" group descriptors) → unassigned staff.
  if (!FACULTY[t]) {
    if (/^[A-Z]{2,4}$/.test(t)) FACULTY[t] = t; // genuine but unmapped initials
    else return "NA";
  }
  usedInitials.add(t);
  return t;
}

/**
 * Parse one timetable cell into routed entries.
 * Returns: [{ sectionName, subjectText, teacherInitials, subgroup }]
 */
function parseCell(text: string, currentSection: string) {
  const out: { sectionName: string; subjectText: string; teacherInitials: string; subgroup: string | null }[] = [];
  const cell = norm(text);
  if (!cell) return out;

  // Combined major cell: has a course number AND a "/" separator.
  const parts = /\d/.test(cell) && cell.includes("/") ? cell.split("/") : [cell];

  for (const partRaw of parts) {
    const part = norm(partRaw);
    if (!part) continue;
    const paren = part.match(/^([^()]+)\(([^()]*)\)\s*$/);
    const subjectText = paren ? norm(paren[1]) : part.replace(/\(.*$/, "").trim() || part;
    const inside = paren ? norm(paren[2]) : "";

    // route by major code prefix (Year-2 combined)
    const codePref = subjectText.toUpperCase().match(/^([A-Z]{2})\s?\d{3}/);
    const routedSections = codePref ? MAJOR_TO_SECTION[codePref[1]] : undefined;

    // subgroups inside parens: "A1 - SAG, A2 - AKH" / "F1 - SD, F2 - NM"
    const sg = [...inside.matchAll(/([A-Za-z]\d)\s*-\s*([A-Za-z.]+)/g)];
    if (sg.length) {
      for (const [, grp, init] of sg) {
        // F1/F2 route to Finance 1/2; otherwise current (or routed) section
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

function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  const tt: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["Timetable"], { header: 1, raw: false, defval: "" });

  // header row (index 1): slot columns + times
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
    const semester = sec.year === 1 ? 1 : 4;

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
        void semester;
      }
    }
  }

  const teachers = [...usedInitials].sort().map((init) => ({
    initials: init,
    name: FACULTY[init] ?? init,
    email: (init === "NA" ? "staff" : init.toLowerCase()) + "@iem.edu",
  }));

  const out = {
    sections: Object.values(SECTIONS).filter(
      (v, i, arr) => arr.findIndex((x) => x.name === v.name) === i,
    ),
    subjects: [...subjects.values()].sort((a, b) => a.code.localeCompare(b.code)),
    teachers,
    offerings: [...offerings.values()],
    schedule,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  console.log(`Wrote ${OUT}`);
  console.log(
    `  sections=${out.sections.length} subjects=${out.subjects.length} teachers=${out.teachers.length} offerings=${out.offerings.length} schedule=${out.schedule.length}`,
  );
  if (unresolved.size) {
    console.log(`  activity/unknown subjects (created by name): ${[...unresolved].join(" | ")}`);
  }
}

main();
