import { prisma } from "@/lib/prisma";

export interface SubjectStat {
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  totalSessions: number;
  attended: number;
  percent: number; // 0..100
}

/**
 * Per-subject attendance for one student: attended / total sessions across each offering
 * of the classes the student is enrolled in.
 */
export async function studentSubjectStats(studentId: string): Promise<SubjectStat[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classSectionId: true },
  });
  const classIds = enrollments.map((e) => e.classSectionId);
  if (classIds.length === 0) return [];

  const offerings = await prisma.offering.findMany({
    where: { classSectionId: { in: classIds } },
    include: {
      subject: true,
      classSection: true,
      _count: { select: { sessions: true } },
    },
  });

  const stats: SubjectStat[] = [];
  for (const o of offerings) {
    const attended = await prisma.attendanceRecord.count({
      where: {
        studentId,
        status: { in: ["PRESENT", "LATE"] },
        session: { offeringId: o.id },
      },
    });
    const total = o._count.sessions;
    stats.push({
      offeringId: o.id,
      subjectCode: o.subject.code,
      subjectName: o.subject.name,
      className: o.classSection.name,
      totalSessions: total,
      attended,
      percent: total === 0 ? 0 : Math.round((attended / total) * 100),
    });
  }
  return stats;
}

export interface StudentRow {
  studentId: string;
  name: string;
  email: string;
  attended: number;
  total: number;
  percent: number;
}

/** Per-student attendance across all sessions of one offering (the per-subject report). */
export async function offeringReport(offeringId: string) {
  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    include: {
      subject: true,
      classSection: { include: { enrollments: { include: { student: true } } } },
      sessions: { select: { id: true } },
    },
  });
  if (!offering) return null;

  const sessionIds = offering.sessions.map((s) => s.id);
  const total = sessionIds.length;

  // Attended-session count per student in one query.
  const grouped =
    sessionIds.length === 0
      ? []
      : await prisma.attendanceRecord.groupBy({
          by: ["studentId"],
          where: { sessionId: { in: sessionIds }, status: { in: ["PRESENT", "LATE"] } },
          _count: true,
        });
  const attendedById = new Map(grouped.map((g) => [g.studentId, g._count]));

  const rows: StudentRow[] = offering.classSection.enrollments
    .map((e) => {
      const attended = attendedById.get(e.studentId) ?? 0;
      return {
        studentId: e.studentId,
        name: e.student.name,
        email: e.student.email,
        attended,
        total,
        percent: total === 0 ? 0 : Math.round((attended / total) * 100),
      };
    })
    .sort((a, b) => a.percent - b.percent);

  return { offering, total, rows };
}

/** Present/absent register for a single session. */
export async function sessionRegister(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      offering: {
        include: {
          subject: true,
          classSection: { include: { enrollments: { include: { student: true } } } },
        },
      },
      records: true,
    },
  });
  if (!session) return null;

  const present = new Map(session.records.map((r) => [r.studentId, r]));
  const rows = session.offering.classSection.enrollments
    .map((e) => {
      const rec = present.get(e.studentId);
      return {
        name: e.student.name,
        email: e.student.email,
        present: !!rec,
        method: rec?.method ?? null,
        flagged: rec?.flagged ?? false,
        scannedAt: rec?.scannedAt ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { session, rows };
}
