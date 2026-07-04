import { prisma } from "@/lib/prisma";

/** A random 6-digit code as a zero-padded string ("000000"–"999999"). */
export function sixDigit(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

async function generate(exists: (code: string) => Promise<boolean>): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = sixDigit();
    if (!(await exists(code))) return code;
  }
  throw new Error("Could not generate a unique code after 25 attempts.");
}

/** Unique session check-in code (globally unique across all sessions). */
export function uniqueSessionCode(): Promise<string> {
  return generate(async (code) => !!(await prisma.session.findUnique({ where: { code }, select: { id: true } })));
}

/** Unique event check-in code (globally unique across all events). */
export function uniqueEventCode(): Promise<string> {
  return generate(async (code) => !!(await prisma.event.findUnique({ where: { code }, select: { id: true } })));
}

/** Unique permanent personal code (globally unique across all users). */
export function uniquePersonalCode(): Promise<string> {
  return generate(async (code) => !!(await prisma.user.findUnique({ where: { personalCode: code }, select: { id: true } })));
}
