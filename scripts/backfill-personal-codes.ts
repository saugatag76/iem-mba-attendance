/**
 * Assigns a unique 6-digit personalCode to every user that doesn't have one.
 * Run once after the QR→code migration:  npx tsx scripts/backfill-personal-codes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function sixDigit() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

async function main() {
  const users = await prisma.user.findMany({
    where: { personalCode: null },
    select: { id: true, name: true },
  });
  if (users.length === 0) {
    console.log("All users already have a personal code.");
    return;
  }

  // Seed the in-memory taken set with existing codes to avoid collisions.
  const existing = await prisma.user.findMany({
    where: { personalCode: { not: null } },
    select: { personalCode: true },
  });
  const taken = new Set(existing.map((u) => u.personalCode!));

  let count = 0;
  for (const u of users) {
    let code = sixDigit();
    while (taken.has(code)) code = sixDigit();
    taken.add(code);
    await prisma.user.update({ where: { id: u.id }, data: { personalCode: code } });
    count++;
  }
  console.log(`Assigned personal codes to ${count} user(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
