import { prisma } from "@/lib/prisma";
import type { Weekday } from "@prisma/client";

export const WEEKDAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI"];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
};

/** Today's Weekday enum, or null on weekends. */
export function todayWeekday(): Weekday | null {
  // Must use IST — Vercel runs UTC, which is 5h30m behind IST.
  // new Date().getDay() in UTC on a Saturday morning in India returns Friday (5),
  // causing the previous day's classes to show. Force IST for the day calculation.
  const istNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const d = istNow.getDay(); // 0=Sun … 6=Sat in IST
  return d >= 1 && d <= 5 ? WEEKDAYS[d - 1] : null;
}

const scheduleInclude = {
  offering: {
    include: { subject: true, classSection: true, teacher: true },
  },
} as const;

/** A teacher's scheduled classes for a given day (default: today). */
export async function teacherClassesForDay(teacherId: string, day: Weekday | null) {
  if (!day) return [];
  return prisma.scheduledClass.findMany({
    where: { day, offering: { teacherId } },
    include: scheduleInclude,
    orderBy: { slotIndex: "asc" },
  });
}

/** Today's classes across all sections a student is enrolled in. */
export async function studentClassesForDay(studentId: string, day: Weekday | null) {
  if (!day) return [];
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classSectionId: true },
  });
  const ids = enrollments.map((e) => e.classSectionId);
  if (ids.length === 0) return [];
  return prisma.scheduledClass.findMany({
    where: { day, classSectionId: { in: ids } },
    include: scheduleInclude,
    orderBy: { slotIndex: "asc" },
  });
}

export type ScheduleRow = Awaited<ReturnType<typeof teacherClassesForDay>>[number];

/** Full weekly schedule for one teacher, grouped by weekday. */
export async function teacherWeekly(teacherId: string) {
  const rows = await prisma.scheduledClass.findMany({
    where: { offering: { teacherId } },
    include: scheduleInclude,
    orderBy: [{ day: "asc" }, { slotIndex: "asc" }],
  });
  const byDay: Record<Weekday, ScheduleRow[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
  for (const r of rows) byDay[r.day].push(r);
  return byDay;
}

/** Full weekly schedule for one section, grouped by weekday. */
export async function sectionWeekly(sectionId: string) {
  const rows = await prisma.scheduledClass.findMany({
    where: { classSectionId: sectionId },
    include: scheduleInclude,
    orderBy: [{ day: "asc" }, { slotIndex: "asc" }],
  });
  const byDay: Record<Weekday, ScheduleRow[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
  for (const r of rows) byDay[r.day].push(r);
  return byDay;
}
