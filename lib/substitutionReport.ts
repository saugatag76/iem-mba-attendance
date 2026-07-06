import { prisma } from "@/lib/prisma";
import type { SubstitutionStatus } from "@prisma/client";

export const REPORT_STATUSES: SubstitutionStatus[] = ["TEACHER_ACCEPTED", "APPROVED", "REJECTED"];

export const ADMIN_APPROVAL_LABEL: Record<SubstitutionStatus, string> = {
  PENDING_TEACHER: "Awaiting teacher",
  TEACHER_ACCEPTED: "Pending admin approval",
  TEACHER_DECLINED: "Declined by teacher",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export type ClassStatus = "Upcoming" | "Completed" | "Cancelled";

/** Y/M/D-only ordinal so multi-day comparisons ignore time-of-day. */
function dayOrdinal(y: number, m: number, d: number) {
  return Date.UTC(y, m, d);
}

/** Derives the class-lifecycle status shown in the report from the admin workflow
 *  status plus the scheduled date/time — independent of the SubstitutionStatus enum. */
export function deriveClassStatus(reqDate: Date, endTime: string, adminStatus: SubstitutionStatus, nowIST: Date): ClassStatus {
  if (adminStatus === "REJECTED") return "Cancelled";
  const reqOrdinal = dayOrdinal(reqDate.getUTCFullYear(), reqDate.getUTCMonth(), reqDate.getUTCDate());
  const todayOrdinal = dayOrdinal(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
  if (reqOrdinal < todayOrdinal) return "Completed";
  if (reqOrdinal > todayOrdinal) return "Upcoming";
  const [h, m] = endTime.split(":").map(Number);
  const endMins = (h ?? 0) * 60 + (m ?? 0);
  const nowMins = nowIST.getHours() * 60 + nowIST.getMinutes();
  return endMins <= nowMins ? "Completed" : "Upcoming";
}

export function fmtReportDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export interface ReportParams {
  userId: string;
  isAdmin: boolean;
  q?: string;
  from?: Date;
  to?: Date;
  term?: string;
  teacherId?: string;
  sort?: string; // e.g. "date_desc"
}

const reportInclude = {
  scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
  requestedBy: true,
  substituteTeacher: true,
} as const;

/** Every substitute-teacher's own record, or (for admins) everyone's — filtered,
 *  searched and sorted per `params`. Shared by the report page and both exports
 *  so they can never drift out of sync with each other. */
export async function fetchSubstitutionReportRows(params: ReportParams) {
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const scopeWhere =
    params.isAdmin && params.teacherId
      ? { substituteTeacherId: params.teacherId }
      : params.isAdmin
      ? {}
      : { substituteTeacherId: params.userId };

  const rows = await prisma.substitutionRequest.findMany({
    where: {
      ...scopeWhere,
      status: { in: REPORT_STATUSES },
      ...(params.from || params.to
        ? { date: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
        : {}),
    },
    include: reportInclude,
  });

  const needle = (params.q ?? "").trim().toLowerCase();

  let filtered = rows
    .map((r) => ({ ...r, classStatus: deriveClassStatus(r.date, r.scheduledClass.endTime, r.status, nowIST) }))
    .filter((r) => !params.term || r.scheduledClass.offering?.term === params.term)
    .filter((r) => {
      if (!needle) return true;
      const hay = [
        r.scheduledClass.offering?.subject.name,
        r.scheduledClass.offering?.subject.code,
        r.scheduledClass.offering?.classSection.name,
        r.scheduledClass.offering?.term,
        r.requestedBy.name,
        fmtReportDate(r.date),
        r.scheduledClass.day,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });

  const sort = params.sort ?? "date_desc";
  const [sortKey, sortDir] = sort.split("_") as [string, "asc" | "desc"];
  const dir = sortDir === "asc" ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "subject":
        return dir * (a.scheduledClass.offering?.subject.name ?? "").localeCompare(b.scheduledClass.offering?.subject.name ?? "");
      case "section":
        return dir * (a.scheduledClass.offering?.classSection.name ?? "").localeCompare(b.scheduledClass.offering?.classSection.name ?? "");
      case "semester":
        return dir * (a.scheduledClass.offering?.term ?? "").localeCompare(b.scheduledClass.offering?.term ?? "");
      default:
        return dir * (a.date.getTime() - b.date.getTime());
    }
  });

  return filtered;
}

export type ReportRow = Awaited<ReturnType<typeof fetchSubstitutionReportRows>>[number];
