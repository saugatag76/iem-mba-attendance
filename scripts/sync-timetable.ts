/*
 * Safely syncs the live database's weekly schedule to a new timetable Excel file.
 * The actual parsing/diff/write engine lives in lib/timetableSync.ts (shared with
 * the admin routine-import UI) — this script is now a thin CLI wrapper: read the
 * file, run the shared engine, print a human-readable report, and (only on
 * --apply) regenerate the committed prisma/timetable-data.json seed snapshot.
 *
 * Run:  npx tsx scripts/sync-timetable.ts <path-to-xlsx> [--apply]
 * Without --apply it only prints the diff (dry run, no writes).
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { parseTimetableWorkbook, syncTimetable, SECTIONS } from "../lib/timetableSync";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const XLSX_PATH = args.find((a) => !a.startsWith("--"));
if (!XLSX_PATH) {
  console.error("Usage: npx tsx scripts/sync-timetable.ts <path-to-xlsx> [--apply]");
  process.exit(1);
}

async function main() {
  const buffer = fs.readFileSync(path.resolve(XLSX_PATH!));
  const parsed = parseTimetableWorkbook(buffer);

  console.log(`Parsed ${XLSX_PATH}: subjects=${parsed.subjects.size} offerings=${parsed.offerings.size} schedule=${parsed.schedule.length}`);
  if (parsed.unresolved.size) console.log(`  New/unrecognized subjects (created as activities): ${[...parsed.unresolved].join(" | ")}`);
  if (parsed.newInitials.size) console.log(`  New teacher initials (not in lib/facultyInitials.ts, using initials as name): ${[...parsed.newInitials].join(", ")}`);

  const result = await syncTimetable(parsed, APPLY);

  if (result.skippedOtherSections > 0) {
    console.log(`Ignoring ${result.skippedOtherSections} scheduled class(es) outside the timetable's sections (e.g. Demo Class) — untouched.`);
  }

  console.log(`\n${APPLY ? "APPLIED" : "DRY RUN — nothing written (pass --apply to write)"}\n`);
  console.log(`Added: ${result.added}   Updated: ${result.updated}   Unchanged: ${result.unchanged}   Removed-kept(history): ${result.removedKept}   Removed-deleted: ${result.removedDeleted}\n`);
  for (const r of result.rows) {
    const icon = r.type === "add" ? "➕ ADD   " : r.type === "update" ? "✏️  UPDATE" : "➖ REMOVE";
    const label = `${r.section.padEnd(10)} ${r.day} slot${r.slotIndex}${r.subgroup ? `(${r.subgroup})` : ""}`;
    if (r.type === "add") console.log(" ", `${icon} ${label}  ${r.after}`);
    else if (r.type === "update") console.log(" ", `${icon} ${label}  ${r.before}  →  ${r.after}`);
    else if (r.type === "remove-kept") console.log(" ", `${icon} ${label}  ${r.before}  (kept — ${r.historyCount} substitution record(s) attached; offering cleared instead of deleting)`);
    else console.log(" ", `${icon} ${label}  ${r.before}  (deleted — no history attached)`);
  }

  if (APPLY) {
    // Keep the committed seed snapshot in sync with what's now live.
    const out = {
      sections: Object.values(SECTIONS).filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i),
      subjects: [...parsed.subjects.values()].sort((a, b) => a.code.localeCompare(b.code)),
      teachers: [...parsed.usedInitials].sort().map((init) => ({ initials: init, name: parsed.faculty[init] ?? init, email: (init === "NA" ? "staff" : init.toLowerCase()) + "@iem.edu.in" })),
      offerings: [...parsed.offerings.values()],
      schedule: parsed.schedule,
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
