/*
 * One-time domain migration: teacher and admin emails move from @iem.edu to
 * @iem.edu.in. Applies to ALL teacher/admin accounts (real faculty, staff/NA,
 * guest faculty, the demo teacher, and the test teacher) — confirmed with the
 * user that every institutional account moves for full consistency. Students
 * are unaffected (they log in by phone; their email is the internal
 * p<phone>@iem.internal placeholder, a different domain entirely).
 *
 * Idempotent — only touches rows still ending in "@iem.edu" (exact suffix,
 * not already "@iem.edu.in"), so re-running is a no-op after the first apply.
 *
 * Run:  npx tsx scripts/migrate-teacher-domain.ts [--apply]
 * Without --apply it only prints a report (dry run, no writes).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const OLD_SUFFIX = "@iem.edu";
const NEW_SUFFIX = "@iem.edu.in";

async function main() {
  const rows = await prisma.user.findMany({
    where: {
      role: { in: ["TEACHER", "ADMIN"] },
      email: { endsWith: OLD_SUFFIX },
      // Exclude anything already on the new domain (endsWith "@iem.edu.in" also
      // matches endsWith "@iem.edu" as a substring check safeguard — belt and braces).
      NOT: { email: { endsWith: NEW_SUFFIX } },
    },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: "asc" },
  });

  console.log(`${APPLY ? "APPLYING" : "DRY RUN — nothing written (pass --apply to write)"}`);
  console.log(`Accounts to migrate: ${rows.length}`);
  for (const r of rows) {
    const newEmail = r.email.slice(0, -OLD_SUFFIX.length) + NEW_SUFFIX;
    console.log(`  [${r.role}] ${r.email} -> ${newEmail}  (${r.name})`);
  }

  if (!APPLY) {
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const r of rows) {
    const newEmail = r.email.slice(0, -OLD_SUFFIX.length) + NEW_SUFFIX;
    await prisma.user.update({ where: { id: r.id }, data: { email: newEmail } });
    updated++;
  }
  console.log(`\nDone. Updated ${updated} account(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
