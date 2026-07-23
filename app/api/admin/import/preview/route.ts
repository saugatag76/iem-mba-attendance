import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classifyIdentifier } from "@/lib/identifier";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { classSectionId, rows } = body as {
    classSectionId: string;
    rows: { line: number; identifier: string; name: string }[];
  };

  const classified = rows.map((r) => ({ row: r, identifier: classifyIdentifier(r.identifier) }));
  const phones = classified.filter((c) => c.identifier?.kind === "phone").map((c) => c.identifier!.value);
  const enrollmentNos = classified.filter((c) => c.identifier?.kind === "enrollment").map((c) => c.identifier!.value);

  const [existingUsers, existingEnrollments] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ phone: { in: phones } }, { enrollmentNo: { in: enrollmentNos } }] },
      select: { phone: true, enrollmentNo: true },
    }),
    prisma.enrollment.findMany({
      where: {
        classSectionId,
        student: { OR: [{ phone: { in: phones } }, { enrollmentNo: { in: enrollmentNos } }] },
      },
      select: { student: { select: { phone: true, enrollmentNo: true } } },
    }),
  ]);

  const existingIdentifiers = new Set(existingUsers.flatMap((u) => [u.phone, u.enrollmentNo].filter(Boolean)));
  const alreadyEnrolledIdentifiers = new Set(
    existingEnrollments.flatMap((e) => [e.student.phone, e.student.enrollmentNo].filter(Boolean)),
  );

  const result = classified.map(({ row, identifier }) => {
    if (!identifier) {
      return { ...row, status: "invalid", reason: !row.identifier.trim() ? "missing identifier" : "invalid phone (10–12 digits) or enrollment no. (14 digits)" };
    }
    if (alreadyEnrolledIdentifiers.has(identifier.value)) {
      return { ...row, status: "already_enrolled", reason: "already in this class" };
    }
    if (existingIdentifiers.has(identifier.value)) {
      return { ...row, status: "exists" };
    }
    return { ...row, status: "new" };
  });

  return NextResponse.json({ rows: result });
}
