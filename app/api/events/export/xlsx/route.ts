import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Exports attendees of completed (CLOSED) events as an Excel workbook.
 *  - ?id=<eventId>  → single event, one attendee sheet
 *  - no id          → bulk: a Summary sheet plus one sheet per completed event
 *  Teachers only get their own events; admins get all. */
export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "ADMIN" && role !== "TEACHER"))
    return new Response("forbidden", { status: 403 });

  const id = new URL(req.url).searchParams.get("id");

  const events = await prisma.event.findMany({
    where: {
      status: "CLOSED",
      ...(id ? { id } : {}),
      ...(role === "TEACHER" ? { createdById: session.user.id } : {}),
    },
    include: {
      targetSections: { include: { classSection: true } },
      attendances: {
        include: { student: { include: { enrollments: { include: { classSection: true } } } } },
        orderBy: { scannedAt: "asc" },
      },
    },
    orderBy: { eventDate: "desc" },
  });

  if (id && events.length === 0) return new Response("not found", { status: 404 });
  if (events.length === 0) return new Response("no completed events", { status: 404 });

  const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const sheetName = (base: string) => {
    const clean = base.replace(/[\\/?*[\]:]/g, "").trim() || "Event";
    let name = clean.slice(0, 31);
    for (let n = 2; usedNames.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      name = clean.slice(0, 31 - suffix.length) + suffix;
    }
    usedNames.add(name.toLowerCase());
    return name;
  };

  if (!id) {
    const summary = events.map((e, i) => ({
      "Sl. No.": i + 1,
      Event: e.title,
      Date: fmtDate(e.eventDate),
      Venue: e.venue ?? "",
      "Target": e.targetSections.length ? e.targetSections.map((s) => s.classSection.name).join(", ") : "All students",
      Attended: e.attendances.length,
    }));
    const ws = XLSX.utils.json_to_sheet(summary);
    ws["!cols"] = [{ wch: 8 }, { wch: 32 }, { wch: 14 }, { wch: 20 }, { wch: 30 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName("Summary"));
  }

  for (const e of events) {
    const rows = e.attendances.map((a, i) => ({
      "Sl. No.": i + 1,
      "Student Name": a.student.name,
      "Phone / Enrollment": a.student.phone ?? a.student.enrollmentNo ?? "",
      Email: a.student.email,
      Section: a.student.enrollments[0]?.classSection.name ?? "Unassigned",
      "Scanned At": `${fmtDate(a.scannedAt)} ${fmtTime(a.scannedAt)}`,
    }));
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["Sl. No.", "Student Name", "Phone / Enrollment", "Email", "Section", "Scanned At"],
    });
    ws["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName(e.title));
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  const slug = id ? events[0].title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event" : "all-events";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${slug}-${date}.xlsx"`,
    },
  });
}
