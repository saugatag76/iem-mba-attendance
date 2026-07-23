/*
 * Shared parsing + diff/apply engine for the weekly timetable, used by both
 * scripts/sync-timetable.ts (CLI) and the admin routine-import UI
 * (app/admin/routine/routine-import-actions.ts). All state here is scoped to
 * a single parseTimetableWorkbook() call — no module-level Maps/Sets — so
 * concurrent requests on the Next.js server never share or corrupt state.
 *
 * Safety model (unchanged from the original CLI script): never a destructive
 * `scheduledClass.deleteMany({})` — instead a keyed diff against what's live:
 *   - slot in new file but not live      -> CREATE
 *   - slot in both but offering changed  -> UPDATE
 *   - slot live but not in new file      -> null out offeringId if it has
 *                                           substitution history (preserves
 *                                           the row), otherwise DELETE
 */
import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { FACULTY } from "./facultyInitials";
import type { Weekday } from "@prisma/client";

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

export const SECTIONS: Record<string, { name: string; year: number; stream: string }> = {
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

export interface ScheduleEntry {
  sectionName: string;
  day: string;
  slotIndex: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  teacherInitials: string;
  subgroup: string | null;
  rawLabel: string;
}

export interface ParsedTimetable {
  subjects: Map<string, { code: string; name: string; semester: number; stream: string }>;
  offerings: Map<string, { subjectCode: string; sectionName: string; teacherInitials: string; term: string }>;
  schedule: ScheduleEntry[];
  usedInitials: Set<string>;
  unresolved: Set<string>;
  newInitials: Set<string>;
  /** Per-call copy of lib/facultyInitials.ts's FACULTY map, extended with any
   *  brand-new initials found in this file — never mutates the shared import. */
  faculty: Record<string, string>;
}

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

/** Parses a timetable .xlsx buffer into subjects/offerings/schedule — pure
 *  parsing, no DB access, all state local to this call. */
export function parseTimetableWorkbook(buffer: Buffer): ParsedTimetable {
  const subjects: ParsedTimetable["subjects"] = new Map();
  const offerings: ParsedTimetable["offerings"] = new Map();
  const schedule: ScheduleEntry[] = [];
  const usedInitials = new Set<string>(["NA"]);
  const unresolved = new Set<string>();
  const newInitials = new Set<string>();
  const faculty: Record<string, string> = { ...FACULTY };

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
  function teacherOf(initials: string): string {
    const t = norm(initials).toUpperCase().replace(/\.$/, "");
    if (!t) return "NA";
    if (!faculty[t]) {
      if (/^[A-Z]{2,4}$/.test(t)) {
        faculty[t] = t;
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

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets["Timetable"];
  const tt: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  // Merged cells: SheetJS only keeps the value in the merge's top-left cell — every other
  // cell it visually covers comes back blank in `tt`, which the day/section/slot walk below
  // then silently skips (`if (!raw) continue`). This drops two real cases: a class that spans
  // two consecutive time slots (merged across slot columns — only the first slot got scheduled),
  // and a class shared across multiple sections with no textual hint (merged across section
  // rows, e.g. a plain "Mentoring" cell — only the first section got it). Broadcast each
  // merge's value into every cell it covers first, so the existing per-cell parsing logic
  // (which already handles multi-section "/"-routing when the text has a hint) gets a chance
  // to read every affected cell on its own.
  for (const merge of sheet["!merges"] ?? []) {
    const value = tt[merge.s.r]?.[merge.s.c];
    if (!norm(String(value ?? ""))) continue;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      if (!tt[r]) tt[r] = [];
      for (let c = merge.s.c; c <= merge.e.c; c++) tt[r][c] = value;
    }
  }

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
        const tInit = teacherOf(e.teacherInitials);
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

  // A merge spanning both rows and columns (e.g. a combined-offering cell merged across
  // several section rows AND two slot columns) gets its text broadcast into every one of
  // those cells above — and since that text's own "/"-routing already explodes it to all
  // target sections regardless of which row triggered it, each broadcast copy re-derives
  // the exact same entries. De-dupe by the same key syncTimetable uses before returning;
  // genuine duplicates here are byte-identical, so keeping the first occurrence is safe.
  const seenKeys = new Set<string>();
  const dedupedSchedule = schedule.filter((e) => {
    const key = scheduleKey(e);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  return { subjects, offerings, schedule: dedupedSchedule, usedInitials, unresolved, newInitials, faculty };
}

function scheduleKey(e: { sectionName: string; day: string; slotIndex: number; subgroup: string | null }) {
  return `${e.sectionName}|${e.day}|${e.slotIndex}|${e.subgroup ?? ""}`;
}

export interface DiffRow {
  type: "add" | "update" | "remove-deleted" | "remove-kept";
  section: string;
  day: string;
  slotIndex: number;
  subgroup: string | null;
  before: string | null;
  after: string | null;
  historyCount?: number;
}

export interface DiffResult {
  added: number;
  updated: number;
  unchanged: number;
  removedKept: number;
  removedDeleted: number;
  rows: DiffRow[];
  unresolvedSubjects: string[];
  newTeacherInitials: string[];
  skippedOtherSections: number;
}

/** Computes the diff against the live DB, and — only when `apply` is true —
 *  writes it (upserts teachers/subjects/offerings, then creates/updates/
 *  deletes/nulls-out ScheduledClass rows). Read-only when `apply` is false,
 *  identical to the diff a subsequent `apply` run would perform. */
export async function syncTimetable(parsed: ParsedTimetable, apply: boolean): Promise<DiffResult> {
  const { subjects, offerings, schedule, usedInitials, faculty } = parsed;

  const dept = await prisma.department.findFirst({ where: { name: "Master of Business Administration (MBA)" } });
  if (!dept) throw new Error("Department not found — run the initial seed first.");

  // Teachers, subjects, sections: batch-read (and, on apply, concurrently
  // write) instead of one round-trip per row — a real timetable can have
  // ~250+ offerings, and sequential awaits here previously took 20s+.
  const teacherId = new Map<string, string>();
  if (apply) {
    const teachHash = await (await import("bcryptjs")).default.hash("Teacher@2026", 10);
    await Promise.all(
      [...usedInitials].map(async (init) => {
        const email = (init === "NA" ? "staff" : init.toLowerCase()) + "@iem.edu.in";
        const name = faculty[init] ?? init;
        const u = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name, role: "TEACHER", passwordHash: teachHash, personalCode: String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0") },
        });
        teacherId.set(init, u.id);
      }),
    );
  } else {
    const existing = await prisma.user.findMany({ where: { role: "TEACHER" }, select: { id: true, email: true } });
    for (const init of usedInitials) {
      const email = (init === "NA" ? "staff" : init.toLowerCase()) + "@iem.edu.in";
      const match = existing.find((u) => u.email === email);
      if (match) teacherId.set(init, match.id);
    }
  }

  const subjectId = new Map<string, string>();
  if (apply) {
    await Promise.all(
      [...subjects.values()].map(async (s) => {
        const subj = await prisma.subject.upsert({
          where: { departmentId_code: { departmentId: dept.id, code: s.code } },
          update: { name: s.name, semester: s.semester, stream: s.stream as never },
          create: { code: s.code, name: s.name, semester: s.semester, stream: s.stream as never, departmentId: dept.id },
        });
        subjectId.set(s.code, subj.id);
      }),
    );
  } else {
    const rows = await prisma.subject.findMany({ where: { departmentId: dept.id, code: { in: [...subjects.keys()] } } });
    for (const row of rows) subjectId.set(row.code, row.id);
  }

  const sectionNames = Object.values(SECTIONS)
    .map((s) => s.name)
    .filter((v, i, a) => a.indexOf(v) === i);
  const sectionId = new Map<string, string>();
  const sectionRows = await prisma.classSection.findMany({ where: { departmentId: dept.id, name: { in: sectionNames } } });
  for (const row of sectionRows) sectionId.set(row.name, row.id);

  // Offerings: resolve each parsed offering's (subjectId, classSectionId,
  // teacherId) first, then a single batched findMany for everything that
  // might already exist, then only CREATE the ones genuinely missing
  // (concurrently) — replaces what was one findUnique/upsert per offering.
  const offeringId = new Map<string, string>();
  const resolvedOfferings = [...offerings.values()]
    .map((o) => ({
      o,
      sid: subjectId.get(o.subjectCode),
      csid: sectionId.get(o.sectionName),
      tid: teacherId.get(o.teacherInitials) ?? teacherId.get("NA"),
    }))
    .filter((x): x is { o: typeof x.o; sid: string; csid: string; tid: string } => !!x.sid && !!x.csid && !!x.tid);

  const existingOfferings = resolvedOfferings.length
    ? await prisma.offering.findMany({
        where: {
          subjectId: { in: [...new Set(resolvedOfferings.map((x) => x.sid))] },
          classSectionId: { in: [...new Set(resolvedOfferings.map((x) => x.csid))] },
          teacherId: { in: [...new Set(resolvedOfferings.map((x) => x.tid))] },
          term: { in: [...new Set(resolvedOfferings.map((x) => x.o.term))] },
        },
        select: { id: true, subjectId: true, classSectionId: true, teacherId: true, term: true },
      })
    : [];
  const existingOfferingByKey = new Map(
    existingOfferings.map((row) => [`${row.subjectId}|${row.classSectionId}|${row.teacherId}|${row.term}`, row.id]),
  );

  const offeringWrites: Promise<void>[] = [];
  for (const { o, sid, csid, tid } of resolvedOfferings) {
    const dbKey = `${sid}|${csid}|${tid}|${o.term}`;
    const key = `${o.subjectCode}|${o.sectionName}|${o.teacherInitials}|${o.term}`;
    const existingId = existingOfferingByKey.get(dbKey);
    if (existingId) {
      offeringId.set(key, existingId);
    } else if (apply) {
      offeringWrites.push(
        prisma.offering.create({ data: { subjectId: sid, classSectionId: csid, teacherId: tid, term: o.term } }).then((created) => {
          offeringId.set(key, created.id);
        }),
      );
    }
  }
  await Promise.all(offeringWrites);

  // Scope strictly to the timetable's own sections — "Demo Class" is a
  // separate synthetic section for live demos, never sourced from any xlsx,
  // and must never be touched (added/updated/removed) by this sync.
  const knownSectionNames = new Set(sectionId.keys());
  const allLiveRows = await prisma.scheduledClass.findMany({
    include: { classSection: true, offering: { include: { subject: true, teacher: true } }, _count: { select: { substitutionRequests: true } } },
  });
  const liveRows = allLiveRows.filter((r) => knownSectionNames.has(r.classSection.name));
  const skippedOtherSections = allLiveRows.length - liveRows.length;

  const liveByKey = new Map<string, (typeof liveRows)[number]>();
  for (const r of liveRows) {
    liveByKey.set(scheduleKey({ sectionName: r.classSection.name, day: r.day, slotIndex: r.slotIndex, subgroup: r.subgroup }), r);
  }

  const matchedLiveIds = new Set<string>();
  let added = 0, updated = 0, unchanged = 0;
  const rows: DiffRow[] = [];
  const scheduleWrites: Promise<unknown>[] = [];

  for (const e of schedule) {
    const csid = sectionId.get(e.sectionName);
    if (!csid) continue;
    const term = e.sectionName.startsWith("Sec") ? "2026-T1" : "2026-T4";
    const offId = offeringId.get(`${e.subjectCode}|${e.sectionName}|${e.teacherInitials}|${term}`) ?? null;
    const key = scheduleKey(e);
    const live = liveByKey.get(key);

    if (!live) {
      added++;
      rows.push({ type: "add", section: e.sectionName, day: e.day, slotIndex: e.slotIndex, subgroup: e.subgroup, before: null, after: e.rawLabel });
      if (apply) {
        scheduleWrites.push(
          prisma.scheduledClass.create({
            data: { classSectionId: csid, day: e.day as Weekday, slotIndex: e.slotIndex, startTime: e.startTime, endTime: e.endTime, offeringId: offId, subgroup: e.subgroup, rawLabel: e.rawLabel },
          }),
        );
      }
      continue;
    }

    matchedLiveIds.add(live.id);
    if (live.offeringId !== offId || live.rawLabel !== e.rawLabel) {
      updated++;
      const before = live.offering ? `${live.offering.subject.code} / ${live.offering.teacher.name}` : "—";
      rows.push({ type: "update", section: e.sectionName, day: e.day, slotIndex: e.slotIndex, subgroup: e.subgroup, before, after: e.rawLabel });
      if (apply) {
        scheduleWrites.push(
          prisma.scheduledClass.update({ where: { id: live.id }, data: { offeringId: offId, startTime: e.startTime, endTime: e.endTime, rawLabel: e.rawLabel } }),
        );
      }
    } else {
      unchanged++;
    }
  }

  let removedKept = 0, removedDeleted = 0;
  for (const r of liveRows) {
    if (matchedLiveIds.has(r.id)) continue;
    const label = r.offering ? `${r.offering.subject.code} / ${r.offering.teacher.name}` : r.rawLabel;
    if (r._count.substitutionRequests > 0) {
      removedKept++;
      rows.push({ type: "remove-kept", section: r.classSection.name, day: r.day, slotIndex: r.slotIndex, subgroup: r.subgroup, before: label, after: null, historyCount: r._count.substitutionRequests });
      if (apply) {
        scheduleWrites.push(prisma.scheduledClass.update({ where: { id: r.id }, data: { offeringId: null } }));
      }
    } else {
      removedDeleted++;
      rows.push({ type: "remove-deleted", section: r.classSection.name, day: r.day, slotIndex: r.slotIndex, subgroup: r.subgroup, before: label, after: null });
      if (apply) {
        scheduleWrites.push(prisma.scheduledClass.delete({ where: { id: r.id } }));
      }
    }
  }
  await Promise.all(scheduleWrites);

  return {
    added,
    updated,
    unchanged,
    removedKept,
    removedDeleted,
    rows,
    unresolvedSubjects: [...parsed.unresolved],
    newTeacherInitials: [...parsed.newInitials],
    skippedOtherSections,
  };
}
