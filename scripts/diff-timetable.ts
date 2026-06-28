/**
 * Thorough diff: compare v7 (timetable-data.json) vs v8 xlsx.
 * Checks by slot position for teacher/subject changes.
 * Run:  npx tsx scripts/diff-timetable.ts
 */
import * as XLSX from "xlsx";
import path from "node:path";
import { FACULTY } from "../lib/facultyInitials";

const V8_PATH = path.join("Timetable_term1_term4_june,2026_v8.xlsx");
const OLD_DATA = require("../prisma/timetable-data.json") as {
  schedule: {
    sectionName: string; day: string; slotIndex: number;
    startTime: string; endTime: string; subjectCode: string;
    teacherInitials: string; subgroup: string | null; rawLabel: string;
  }[];
};

const ALIAS: Record<string, string> = {
  mathematics: "MBA101", "micro economics": "MBA103", frsa: "MBA102", lbece: "MBA104",
  "marketing mgmt": "MBA105", "marketing mgmt.": "MBA105", ob: "MBA171",
  communication: "MBA172", cab: "MBA173", "research methodology": "MBA174",
  "excel lab": "MBA191", "entrepreneurship lab": "MBA192", "language lab": "MBA193",
  "tally lab": "MBA194", "entrepreneurship masterclass": "MBA195",
  b2b: "CM401", "retail strategy": "CM402", "consumer behaviour": "MM401",
  "customer experience and relationship management": "MM402",
  "international finance": "FM401", iapm: "FM402", "hr analytics": "HR401",
  "compensation & benefits management": "HR402", "supply chain analytics": "SC401",
  "supply chain design & planning": "SC402", "data mining": "TM401",
  "business forecasting": "TM402", "corporate strategy": "MBA471",
  "boardroom simulation": "MBA493", "advanced excel": "MBA492",
  "tech enablers for digital business": "MBA491",
};
const SECTIONS: Record<string, { name: string }> = {
  A: { name: "Sec A" }, B: { name: "Sec B" }, C: { name: "Sec C" }, D: { name: "Sec D" },
  "FINANCE 1": { name: "Finance 1" }, "FINANCE 2": { name: "Finance 2" },
  HR: { name: "HR" }, SC: { name: "SC" }, MM: { name: "MM" }, TM: { name: "TM" },
};
const MAJOR_TO_SECTION: Record<string, string[]> = {
  FM: ["Finance 1", "Finance 2"], HR: ["HR"], MM: ["MM"], SC: ["SC"], TM: ["TM"],
};
const DAYS: Record<string, string> = {
  monday: "MON", tuesday: "TUE", wednesday: "WED", thursday: "THU", friday: "FRI",
};

function norm(s: string) { return s.replace(/\s+/g, " ").trim(); }
function pad(t: string) {
  const [h, m] = t.trim().split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
function resolveSubject(rawName: string): string {
  const name = norm(rawName);
  const codeMatch = name.match(/^([A-Za-z]{2,4})\s?-?\s?(\d{3})$/);
  if (codeMatch) return (codeMatch[1] + codeMatch[2]).toUpperCase();
  const alias = ALIAS[name.toLowerCase()];
  if (alias) return alias;
  return "ACT-" + slug(name);
}
function resolveTeacher(initials: string): string {
  const t = norm(initials).toUpperCase().replace(/\.$/, "");
  if (!t) return "NA";
  if (!FACULTY[t] && !/^[A-Z]{2,4}$/.test(t)) return "NA";
  return t;
}
function parseCell(text: string, currentSection: string) {
  const out: { sectionName: string; subjectCode: string; teacherInitials: string; subgroup: string | null }[] = [];
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
        out.push({ sectionName: sec, subjectCode: resolveSubject(subjectText), teacherInitials: resolveTeacher(init), subgroup: grp.toUpperCase() });
      }
      continue;
    }
    const init = inside || "NA";
    if (routedSections) {
      for (const sec of routedSections) out.push({ sectionName: sec, subjectCode: resolveSubject(subjectText), teacherInitials: resolveTeacher(init), subgroup: null });
    } else {
      out.push({ sectionName: currentSection, subjectCode: resolveSubject(subjectText), teacherInitials: resolveTeacher(init), subgroup: null });
    }
  }
  return out;
}

// Parse v8
const wb = XLSX.readFile(V8_PATH);
const tt: string[][] = XLSX.utils.sheet_to_json(wb.Sheets["Timetable"], { header: 1, raw: false, defval: "" });
const header = tt[1] ?? [];
const slots: { col: number; idx: number; start: string; end: string }[] = [];
let idx2 = 0;
for (let c = 2; c <= 10; c++) {
  const h = norm(String(header[c] ?? ""));
  const m = h.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (m) { idx2++; slots.push({ col: c, idx: idx2, start: pad(m[1]), end: pad(m[2]) }); }
}

type Entry = { sectionName: string; day: string; slotIndex: number; startTime: string; endTime: string; subjectCode: string; teacherInitials: string; subgroup: string | null };
const v8Entries: Entry[] = [];
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
    for (const e of parseCell(raw, sec.name)) {
      v8Entries.push({ sectionName: e.sectionName, day: currentDay, slotIndex: s.idx, startTime: s.start, endTime: s.end, subjectCode: e.subjectCode, teacherInitials: e.teacherInitials, subgroup: e.subgroup });
    }
  }
}

// Group by slot position key (section|day|slotIndex|subgroup)
function slotKey(e: Entry) { return `${e.sectionName}|${e.day}|${e.slotIndex}|${e.subgroup ?? ""}`; }
function fullKey(e: Entry) { return `${slotKey(e)}|${e.subjectCode}|${e.teacherInitials}`; }

const v7Map = new Map<string, Entry>();
for (const e of OLD_DATA.schedule as Entry[]) {
  // use first occurrence per slot (some slots appear twice due to lab splits handled by subgroup)
  const k = slotKey(e);
  if (!v7Map.has(k)) v7Map.set(k, e);
  // also store with subgroup in key if set
  v7Map.set(fullKey(e), e);
}

const v8Map = new Map<string, Entry[]>();
for (const e of v8Entries) {
  const k = slotKey(e);
  if (!v8Map.has(k)) v8Map.set(k, []);
  v8Map.get(k)!.push(e);
}

// Build v7 slot groups too
const v7SlotMap = new Map<string, Entry[]>();
for (const e of OLD_DATA.schedule as Entry[]) {
  const k = slotKey(e);
  if (!v7SlotMap.has(k)) v7SlotMap.set(k, []);
  v7SlotMap.get(k)!.push(e);
}

const facName = (init: string) => FACULTY[init] ?? init;

const changes: string[] = [];

// Check all v7 slots against v8
const allSlotKeys = new Set([...v7SlotMap.keys(), ...v8Map.keys()]);
for (const k of allSlotKeys) {
  const v7s = v7SlotMap.get(k) ?? [];
  const v8s = v8Map.get(k) ?? [];

  if (v7s.length === 0 && v8s.length > 0) {
    for (const e of v8s)
      changes.push(`➕ ADDED   ${e.sectionName.padEnd(10)} ${e.day} slot${e.slotIndex}  ${e.subjectCode.padEnd(28)} teacher: ${e.teacherInitials} (${facName(e.teacherInitials)})`);
    continue;
  }
  if (v8s.length === 0 && v7s.length > 0) {
    for (const e of v7s)
      changes.push(`➖ REMOVED ${e.sectionName.padEnd(10)} ${e.day} slot${e.slotIndex}  ${e.subjectCode.padEnd(28)} teacher: ${e.teacherInitials} (${facName(e.teacherInitials)})`);
    continue;
  }

  // Same slot — check what changed
  for (let i = 0; i < Math.max(v7s.length, v8s.length); i++) {
    const a = v7s[i];
    const b = v8s[i];
    if (!a && b) {
      changes.push(`➕ ADDED   ${b.sectionName.padEnd(10)} ${b.day} slot${b.slotIndex}  ${b.subjectCode.padEnd(28)} teacher: ${b.teacherInitials} (${facName(b.teacherInitials)})`);
    } else if (a && !b) {
      changes.push(`➖ REMOVED ${a.sectionName.padEnd(10)} ${a.day} slot${a.slotIndex}  ${a.subjectCode.padEnd(28)} teacher: ${a.teacherInitials} (${facName(a.teacherInitials)})`);
    } else if (a && b) {
      const diffs: string[] = [];
      if (a.subjectCode !== b.subjectCode) diffs.push(`subject: ${a.subjectCode} → ${b.subjectCode}`);
      if (a.teacherInitials !== b.teacherInitials) diffs.push(`teacher: ${facName(a.teacherInitials)} → ${facName(b.teacherInitials)}`);
      if (diffs.length) {
        changes.push(`✏️  CHANGED ${a.sectionName.padEnd(10)} ${a.day} slot${a.slotIndex}${a.subgroup ? " (" + a.subgroup + ")" : ""}  ${diffs.join("  |  ")}`);
      }
    }
  }
}

console.log(`\nv7 entries: ${OLD_DATA.schedule.length}   v8 entries: ${v8Entries.length}\n`);
if (changes.length === 0) {
  console.log("✅  No changes — v8 is identical to v7.\n");
} else {
  console.log(`Found ${changes.length} change(s):\n`);
  for (const c of changes) console.log(" ", c);
  console.log("\n💡  Run scripts/parse-timetable.ts with v8 path then re-seed to apply.\n");
}
