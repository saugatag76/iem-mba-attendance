import { prisma } from "@/lib/prisma";

/** If an OPEN session's chosen duration has elapsed, close it and return "CLOSED". */
export async function autoCloseExpired(s: { id: string; status: string; expiresAt: Date | null }) {
  if (s.status === "OPEN" && s.expiresAt && s.expiresAt.getTime() <= Date.now()) {
    await prisma.session.update({ where: { id: s.id }, data: { status: "CLOSED", endTime: s.expiresAt } });
    return "CLOSED" as const;
  }
  return s.status;
}

/** The teacher's currently live (open, not expired) session, if any — for quick-nav back. */
export async function activeSessionFor(teacherId: string) {
  const s = await prisma.session.findFirst({
    where: { teacherId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: { offering: { include: { subject: true, classSection: true } } },
  });
  if (!s) return null;
  if (await autoCloseExpired(s) === "CLOSED") return null;
  return s;
}
