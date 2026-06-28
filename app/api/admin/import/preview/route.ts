import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { classSectionId, rows } = body as {
    classSectionId: string;
    rows: { line: number; email: string; name: string }[];
  };

  // Fetch all existing users and enrollments in one batch
  const phoneRegex = /^\d{10,12}$/;
  const phones = rows
    .map((r) => r.email.trim().replace(/[\s+\-()]/g, ""))
    .filter((p) => phoneRegex.test(p));

  const [existingUsers, existingEnrollments] = await Promise.all([
    prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true, phone: true },
    }),
    prisma.enrollment.findMany({
      where: { classSectionId, student: { phone: { in: phones } } },
      select: { student: { select: { phone: true } } },
    }),
  ]);

  const existingPhones = new Set(existingUsers.map((u) => u.phone ?? ""));
  const alreadyEnrolledPhones = new Set(existingEnrollments.map((e) => e.student.phone ?? ""));

  const result = rows.map((row) => {
    // row.email actually contains phone (field reuse from ImportForm parsing)
    const phone = row.email.trim().replace(/[\s+\-()]/g, "");
    if (!phone || !phoneRegex.test(phone)) {
      return { ...row, status: "invalid", reason: !phone ? "missing phone" : "invalid phone number (10–12 digits)" };
    }
    if (alreadyEnrolledPhones.has(phone)) {
      return { ...row, status: "already_enrolled", reason: "already in this class" };
    }
    if (existingPhones.has(phone)) {
      return { ...row, status: "exists" };
    }
    return { ...row, status: "new" };
  });

  return NextResponse.json({ rows: result });
}
