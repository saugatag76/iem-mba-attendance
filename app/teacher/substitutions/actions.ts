"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notify, notifyRole } from "@/lib/notify";
import type { Weekday } from "@prisma/client";

function flash(redirectTo: string, message: string, type?: "error") {
  const sep = redirectTo.includes("?") ? "&" : "?";
  const extra = type ? `&toastType=${type}` : "";
  redirect(`${redirectTo}${sep}toast=${encodeURIComponent(message)}${extra}`);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Checks whether `teacherId` is already busy at (day, startTime–endTime) on `date` —
 * either with a regular scheduled class, or with another substitution they've already
 * accepted/been approved for. Returns a human-readable reason if busy, else null.
 */
async function findTimeConflict(
  teacherId: string,
  day: Weekday,
  startTime: string,
  endTime: string,
  date: Date,
  excludeRequestId: string,
): Promise<string | null> {
  const regular = await prisma.scheduledClass.findFirst({
    where: {
      offering: { teacherId },
      day,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (regular) return "You already have a regular class at this time.";

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const others = await prisma.substitutionRequest.findMany({
    where: {
      substituteTeacherId: teacherId,
      status: { in: ["TEACHER_ACCEPTED", "APPROVED"] },
      date: { gte: dayStart, lt: dayEnd },
      id: { not: excludeRequestId },
    },
    include: { scheduledClass: true },
  });
  const conflict = others.find(
    (o) => o.scheduledClass.startTime < endTime && startTime < o.scheduledClass.endTime,
  );
  if (conflict) return "You've already accepted another substitution at this time.";

  return null;
}

/** Teacher X creates a substitution request for a specific slot + date. */
export async function createSubstitutionRequest(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");

  const scheduledClassId = String(formData.get("scheduledClassId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const substituteTeacherId = String(formData.get("substituteTeacherId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!scheduledClassId || !dateStr || !substituteTeacherId || reason.length < 5) {
    flash("/teacher/substitutions/new", "Please fill in all fields (reason min 5 chars).", "error");
  }
  if (substituteTeacherId === teacher.id) {
    flash("/teacher/substitutions/new", "You cannot request yourself as a substitute.", "error");
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) flash("/teacher/substitutions/new", "Invalid date.", "error");

  const req = await prisma.substitutionRequest.create({
    data: {
      scheduledClassId,
      date,
      requestedById: teacher.id,
      substituteTeacherId,
      reason,
      status: "PENDING_TEACHER",
    },
    include: { scheduledClass: { include: { offering: { include: { subject: true } } } } },
  });

  await notify(
    substituteTeacherId,
    "SUBSTITUTION_REQUEST_SENT",
    "New substitution request",
    `${teacher.name} asked you to cover ${req.scheduledClass.offering?.subject.name ?? "a class"} on ${fmtDate(date)}.`,
    "/teacher/substitutions?tab=received",
  );

  revalidatePath("/teacher/substitutions");
  flash("/teacher/substitutions", "Substitution request sent. Waiting for the substitute teacher to respond.");
}

/** Teacher X cancels their own pending or accepted request. */
export async function cancelSubstitutionRequest(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const id = String(formData.get("id") ?? "");

  const req = await prisma.substitutionRequest.findUnique({ where: { id } });
  if (!req || req.requestedById !== teacher.id) {
    flash("/teacher/substitutions", "Request not found.", "error");
  }
  if (req!.status !== "PENDING_TEACHER" && req!.status !== "TEACHER_ACCEPTED") {
    flash("/teacher/substitutions", "This request can no longer be cancelled.", "error");
  }

  await prisma.substitutionRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/teacher/substitutions");
  flash("/teacher/substitutions", "Request cancelled.");
}

/**
 * Create multiple substitution requests for a leave period.
 * FormData fields:
 *   reason       – shared reason for all requests
 *   entry_{i}    – JSON string: { scheduledClassId, date, substituteTeacherId }
 * All non-empty entry_{i} values are processed.
 */
export async function createLeaveSubstitutions(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) {
    flash("/teacher/substitutions/leave", "Please provide a reason (min 5 chars).", "error");
  }

  const entries: { scheduledClassId: string; date: Date; substituteTeacherId: string }[] = [];
  let i = 0;
  while (true) {
    const raw = formData.get(`entry_${i}`);
    if (raw === null) break;
    const val = String(raw).trim();
    if (val) {
      try {
        const parsed = JSON.parse(val) as { scheduledClassId: string; date: string; substituteTeacherId: string };
        if (parsed.scheduledClassId && parsed.date && parsed.substituteTeacherId) {
          // Parse yyyy-mm-dd as local midnight (not UTC) to avoid day shift in IST
          const [y, m, d] = parsed.date.split("-").map(Number);
          entries.push({
            scheduledClassId: parsed.scheduledClassId,
            date: new Date(y, m - 1, d),
            substituteTeacherId: parsed.substituteTeacherId,
          });
        }
      } catch { /* skip malformed */ }
    }
    i++;
  }

  if (entries.length === 0) {
    flash("/teacher/substitutions/leave", "Please assign at least one substitute.", "error");
  }

  // Validate all scheduled classes belong to this teacher
  const scIds = entries.map((e) => e.scheduledClassId);
  const classes = await prisma.scheduledClass.findMany({
    where: { id: { in: scIds }, offering: { teacherId: teacher.id } },
    include: { offering: { include: { subject: true } } },
  });
  const classById = new Map(classes.map((c) => [c.id, c]));

  const toCreate = entries.filter((e) => classById.has(e.scheduledClassId));

  await prisma.substitutionRequest.createMany({
    data: toCreate.map((e) => ({
      scheduledClassId: e.scheduledClassId,
      date: e.date,
      requestedById: teacher.id,
      substituteTeacherId: e.substituteTeacherId,
      reason,
      status: "PENDING_TEACHER" as const,
    })),
    skipDuplicates: true,
  });

  // Notify each substitute teacher (best-effort, one per entry)
  await Promise.all(
    toCreate.map((e) => {
      const sc = classById.get(e.scheduledClassId)!;
      return notify(
        e.substituteTeacherId,
        "SUBSTITUTION_REQUEST_SENT",
        "New substitution request",
        `${teacher.name} asked you to cover ${sc.offering?.subject.name ?? "a class"} on ${fmtDate(e.date)}.`,
        "/teacher/substitutions?tab=received",
      );
    }),
  );

  revalidatePath("/teacher/substitutions");
  flash("/teacher/substitutions", `${toCreate.length} substitution request${toCreate.length > 1 ? "s" : ""} sent.`);
}

/** Teacher Y accepts or declines a substitution request. */
export async function respondToSubstitutionRequest(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("response") ?? ""); // "accept" | "decline"
  const teacherNote = String(formData.get("teacherNote") ?? "").trim();

  const req = await prisma.substitutionRequest.findUnique({
    where: { id },
    include: {
      requestedBy: true,
      scheduledClass: { include: { offering: { include: { subject: true } } } },
    },
  });
  if (!req || req.substituteTeacherId !== teacher.id) {
    flash("/teacher/substitutions", "Request not found.", "error");
  }
  if (req!.status !== "PENDING_TEACHER") {
    flash("/teacher/substitutions", "This request has already been responded to.", "error");
  }

  const subjectName = req!.scheduledClass.offering?.subject.name ?? "the class";
  const dateStr = fmtDate(req!.date);

  if (action === "accept") {
    const conflict = await findTimeConflict(
      teacher.id,
      req!.scheduledClass.day,
      req!.scheduledClass.startTime,
      req!.scheduledClass.endTime,
      req!.date,
      req!.id,
    );
    if (conflict) flash("/teacher/substitutions", conflict, "error");
  }

  const newStatus = action === "accept" ? "TEACHER_ACCEPTED" : "TEACHER_DECLINED";
  await prisma.substitutionRequest.update({
    where: { id },
    data: { status: newStatus, teacherNote: teacherNote || null },
  });
  revalidatePath("/teacher/substitutions");

  if (action === "accept") {
    await Promise.all([
      notify(
        req!.requestedById,
        "SUBSTITUTION_ACCEPTED",
        "Substitute accepted",
        `${teacher.name} accepted to cover ${subjectName} on ${dateStr}. Awaiting admin approval.`,
        "/teacher/substitutions",
      ),
      notifyRole(
        "ADMIN",
        "SUBSTITUTION_PENDING_ADMIN",
        "Substitution needs approval",
        `${teacher.name} accepted to cover ${subjectName} for ${req!.requestedBy.name} on ${dateStr}.`,
        "/admin/substitutions",
      ),
    ]);
  } else {
    await notify(
      req!.requestedById,
      "SUBSTITUTION_DECLINED",
      "Substitute declined",
      `${teacher.name} declined to cover ${subjectName} on ${dateStr}.`,
      "/teacher/substitutions",
    );
  }

  const msg = action === "accept"
    ? "You accepted the substitution. Awaiting admin approval."
    : "You declined the substitution request.";
  flash("/teacher/substitutions", msg);
}
