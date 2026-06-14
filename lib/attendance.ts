import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo";
import type { DateRange } from "@/lib/dateRange";

const PASS_THRESHOLD = 75;

/** Session `where` clause restricting to a date range, or `{}` when unset. */
function sessionDateWhere(range?: DateRange): Prisma.SessionWhereInput {
  if (!range?.from && !range?.to) return {};
  return {
    date: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  };
}

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
 * of the classes the student is enrolled in. If `teacherId` is given, only offerings taught
 * by that teacher are included (used when a teacher looks up one of their own students).
 */
export async function studentSubjectStats(studentId: string, teacherId?: string, range?: DateRange): Promise<SubjectStat[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classSectionId: true },
  });
  const classIds = enrollments.map((e) => e.classSectionId);
  if (classIds.length === 0) return [];

  const dateWhere = sessionDateWhere(range);
  const offerings = await prisma.offering.findMany({
    where: { classSectionId: { in: classIds }, ...(teacherId ? { teacherId } : {}) },
    include: {
      subject: true,
      classSection: true,
      _count: { select: { sessions: { where: dateWhere } } },
    },
  });

  const stats: SubjectStat[] = [];
  for (const o of offerings) {
    const attended = await prisma.attendanceRecord.count({
      where: {
        studentId,
        status: { in: ["PRESENT", "LATE"] },
        session: { offeringId: o.id, ...dateWhere },
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
  /** sessionId -> present, for the day-wise register. */
  bySession: Record<string, boolean>;
}

export interface SessionColumn {
  id: string;
  date: Date;
  status: string;
}

export interface StudentOfferingRegister {
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  sessions: SessionColumn[];
  bySession: Record<string, boolean>;
  attended: number;
  total: number;
  percent: number;
}

/**
 * Day-by-day attendance for one student, broken down per subject — the day-wise
 * register from `offeringReport`, but for a single student across all their offerings.
 */
export async function studentDayWiseReport(studentId: string, teacherId?: string, range?: DateRange): Promise<StudentOfferingRegister[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classSectionId: true },
  });
  const classIds = enrollments.map((e) => e.classSectionId);
  if (classIds.length === 0) return [];

  const offerings = await prisma.offering.findMany({
    where: { classSectionId: { in: classIds }, ...(teacherId ? { teacherId } : {}) },
    include: {
      subject: true,
      sessions: { where: sessionDateWhere(range), select: { id: true, date: true, status: true }, orderBy: { date: "asc" } },
    },
  });

  const allSessionIds = offerings.flatMap((o) => o.sessions.map((s) => s.id));
  const records = allSessionIds.length
    ? await prisma.attendanceRecord.findMany({
        where: { sessionId: { in: allSessionIds }, studentId, status: { in: ["PRESENT", "LATE"] } },
        select: { sessionId: true },
      })
    : [];
  const presentSet = new Set(records.map((r) => r.sessionId));

  return offerings
    .filter((o) => o.sessions.length > 0)
    .map((o) => {
      const sessions: SessionColumn[] = o.sessions;
      const bySession: Record<string, boolean> = {};
      let attended = 0;
      for (const s of sessions) {
        const present = presentSet.has(s.id);
        bySession[s.id] = present;
        if (present) attended++;
      }
      const total = sessions.length;
      return {
        offeringId: o.id,
        subjectCode: o.subject.code,
        subjectName: o.subject.name,
        sessions,
        bySession,
        attended,
        total,
        percent: total === 0 ? 0 : Math.round((attended / total) * 100),
      };
    });
}

/** Per-student attendance across all sessions of one offering (the per-subject report). */
export async function offeringReport(offeringId: string, range?: DateRange) {
  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    include: {
      subject: true,
      classSection: { include: { enrollments: { include: { student: true } } } },
      sessions: { where: sessionDateWhere(range), select: { id: true, date: true, status: true }, orderBy: { date: "asc" } },
    },
  });
  if (!offering) return null;

  const sessions: SessionColumn[] = offering.sessions;
  const sessionIds = sessions.map((s) => s.id);
  const total = sessionIds.length;

  // All attendance records across these sessions, for the day-wise register.
  const records =
    sessionIds.length === 0
      ? []
      : await prisma.attendanceRecord.findMany({
          where: { sessionId: { in: sessionIds }, status: { in: ["PRESENT", "LATE"] } },
          select: { sessionId: true, studentId: true },
        });
  const presentByStudent = new Map<string, Set<string>>();
  for (const r of records) {
    if (!presentByStudent.has(r.studentId)) presentByStudent.set(r.studentId, new Set());
    presentByStudent.get(r.studentId)!.add(r.sessionId);
  }

  const rows: StudentRow[] = offering.classSection.enrollments
    .map((e) => {
      const presentSessions = presentByStudent.get(e.studentId) ?? new Set<string>();
      const attended = presentSessions.size;
      const bySession: Record<string, boolean> = {};
      for (const sid of sessionIds) bySession[sid] = presentSessions.has(sid);
      return {
        studentId: e.studentId,
        name: e.student.name,
        email: e.student.email,
        attended,
        total,
        percent: total === 0 ? 0 : Math.round((attended / total) * 100),
        bySession,
      };
    })
    .sort((a, b) => a.percent - b.percent);

  return { offering, total, sessions, rows };
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

  const anchorLat = session.geoLat;
  const anchorLng = session.geoLng;
  const present = new Map(session.records.map((r) => [r.studentId, r]));
  const rows = session.offering.classSection.enrollments
    .map((e) => {
      const rec = present.get(e.studentId);
      const lat = rec?.geoLat ?? null;
      const lng = rec?.geoLng ?? null;
      // Distance from the classroom anchor, if we have both points.
      const distanceM =
        lat != null && lng != null && anchorLat != null && anchorLng != null
          ? Math.round(haversineMeters(anchorLat, anchorLng, lat, lng))
          : null;
      return {
        name: e.student.name,
        email: e.student.email,
        present: !!rec,
        method: rec?.method ?? null,
        flagged: rec?.flagged ?? false,
        scannedAt: rec?.scannedAt ?? null,
        lat,
        lng,
        distanceM,
        outOfRange: distanceM != null ? distanceM > session.geoRadiusM : false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { session, rows };
}

export interface OfferingSummary {
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  teacherName: string;
  totalSessions: number;
  totalStudents: number;
  avgPercent: number;
  defaulters: number;
}

export interface TrendPoint {
  date: string; // yyyy-mm-dd
  percent: number;
}

/**
 * Macro view across a set of offerings (filtered by `where`): per-offering average
 * attendance % and defaulter counts, plus an overall day-by-day attendance % trend.
 */
export async function reportsOverview(where: Prisma.OfferingWhereInput, range?: DateRange) {
  const offerings = await prisma.offering.findMany({
    where,
    include: {
      subject: true,
      classSection: { include: { enrollments: true } },
      teacher: true,
      sessions: { where: sessionDateWhere(range), select: { id: true, date: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const allSessionIds = offerings.flatMap((o) => o.sessions.map((s) => s.id));
  const records = allSessionIds.length
    ? await prisma.attendanceRecord.findMany({
        where: { sessionId: { in: allSessionIds }, status: { in: ["PRESENT", "LATE"] } },
        select: { sessionId: true, studentId: true },
      })
    : [];

  const sessionToOffering = new Map<string, string>();
  for (const o of offerings) for (const s of o.sessions) sessionToOffering.set(s.id, o.id);

  const presentBySession = new Map<string, number>();
  const presentByOfferingStudent = new Map<string, number>();
  for (const r of records) {
    presentBySession.set(r.sessionId, (presentBySession.get(r.sessionId) ?? 0) + 1);
    const offeringId = sessionToOffering.get(r.sessionId);
    if (!offeringId) continue;
    const key = `${offeringId}:${r.studentId}`;
    presentByOfferingStudent.set(key, (presentByOfferingStudent.get(key) ?? 0) + 1);
  }

  const summaries: OfferingSummary[] = [];
  const trendByDate = new Map<string, { present: number; total: number }>();

  for (const o of offerings) {
    const total = o.sessions.length;
    const totalStudents = o.classSection.enrollments.length;
    let sumPercent = 0;
    let defaulters = 0;
    if (total > 0 && totalStudents > 0) {
      for (const e of o.classSection.enrollments) {
        const attended = presentByOfferingStudent.get(`${o.id}:${e.studentId}`) ?? 0;
        const pct = Math.round((attended / total) * 100);
        sumPercent += pct;
        if (pct < PASS_THRESHOLD) defaulters++;
      }
    }
    summaries.push({
      offeringId: o.id,
      subjectCode: o.subject.code,
      subjectName: o.subject.name,
      className: o.classSection.name,
      teacherName: o.teacher.name,
      totalSessions: total,
      totalStudents,
      avgPercent: total > 0 && totalStudents > 0 ? Math.round(sumPercent / totalStudents) : 0,
      defaulters,
    });

    for (const s of o.sessions) {
      const key = s.date.toISOString().slice(0, 10);
      const cur = trendByDate.get(key) ?? { present: 0, total: 0 };
      cur.present += presentBySession.get(s.id) ?? 0;
      cur.total += totalStudents;
      trendByDate.set(key, cur);
    }
  }

  const trend: TrendPoint[] = [...trendByDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, { present, total }]) => ({
      date,
      percent: total > 0 ? Math.round((present / total) * 100) : 0,
    }));

  return { summaries, trend };
}

export interface DefaulterRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  teacherName: string;
  attended: number;
  total: number;
  percent: number;
}

/**
 * Every (student, offering) pair below the attendance threshold — the drill-down
 * behind the "Below 75%" stat on the Reports overview, sorted worst-first.
 */
export async function defaultersList(
  where: Prisma.OfferingWhereInput,
  range?: DateRange,
  threshold = PASS_THRESHOLD,
): Promise<DefaulterRow[]> {
  const offerings = await prisma.offering.findMany({
    where,
    include: {
      subject: true,
      teacher: true,
      classSection: { include: { enrollments: { include: { student: true } } } },
      sessions: { where: sessionDateWhere(range), select: { id: true } },
    },
  });

  const allSessionIds = offerings.flatMap((o) => o.sessions.map((s) => s.id));
  const records = allSessionIds.length
    ? await prisma.attendanceRecord.findMany({
        where: { sessionId: { in: allSessionIds }, status: { in: ["PRESENT", "LATE"] } },
        select: { sessionId: true, studentId: true },
      })
    : [];

  const sessionToOffering = new Map<string, string>();
  for (const o of offerings) for (const s of o.sessions) sessionToOffering.set(s.id, o.id);

  const presentByOfferingStudent = new Map<string, number>();
  for (const r of records) {
    const offeringId = sessionToOffering.get(r.sessionId);
    if (!offeringId) continue;
    const key = `${offeringId}:${r.studentId}`;
    presentByOfferingStudent.set(key, (presentByOfferingStudent.get(key) ?? 0) + 1);
  }

  const rows: DefaulterRow[] = [];
  for (const o of offerings) {
    const total = o.sessions.length;
    if (total === 0) continue;
    for (const e of o.classSection.enrollments) {
      const attended = presentByOfferingStudent.get(`${o.id}:${e.studentId}`) ?? 0;
      const percent = Math.round((attended / total) * 100);
      if (percent < threshold) {
        rows.push({
          studentId: e.studentId,
          studentName: e.student.name,
          studentEmail: e.student.email,
          offeringId: o.id,
          subjectCode: o.subject.code,
          subjectName: o.subject.name,
          className: o.classSection.name,
          teacherName: o.teacher.name,
          attended,
          total,
          percent,
        });
      }
    }
  }
  return rows.sort((a, b) => a.percent - b.percent);
}

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  className: string;
}

/** Students visible for the student-wise report: everyone for admin, or just the
 *  teacher's own class sections' students for a teacher. */
export async function studentsForReports(teacherId?: string): Promise<StudentListItem[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: teacherId ? { classSection: { offerings: { some: { teacherId } } } } : {},
    include: { student: true, classSection: true },
  });

  const byStudent = new Map<string, StudentListItem>();
  for (const e of enrollments) {
    if (!byStudent.has(e.studentId)) {
      byStudent.set(e.studentId, {
        id: e.studentId,
        name: e.student.name,
        email: e.student.email,
        className: e.classSection.name,
      });
    }
  }
  return [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
}
