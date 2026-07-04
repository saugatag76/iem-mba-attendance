"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { uniqueEventCode } from "@/lib/code";

function flash(to: string, msg: string, type?: "error") {
  const sep = to.includes("?") ? "&" : "?";
  redirect(`${to}${sep}toast=${encodeURIComponent(msg)}${type ? `&toastType=${type}` : ""}`);
}

export async function createEvent(formData: FormData) {
  const user = await requireRole("TEACHER", "ADMIN");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "");
  // Multiple class sections — checkboxes submit as repeated "sections[]" values
  const sectionIds = formData.getAll("sections[]").map(String).filter(Boolean);

  if (!title || !eventDate) flash("/events/new", "Title and date are required.", "error");

  const isAdmin = user.role === "ADMIN";
  await prisma.event.create({
    data: {
      title,
      description: description || null,
      venue: venue || null,
      eventDate: new Date(eventDate),
      status: isAdmin ? "APPROVED" : "PENDING_APPROVAL",
      createdById: user.id,
      approvedById: isAdmin ? user.id : null,
      targetSections: sectionIds.length > 0
        ? { create: sectionIds.map((classSectionId) => ({ classSectionId })) }
        : undefined,
    },
  });
  revalidatePath("/events");
  flash("/events", isAdmin ? "Event created and approved." : "Event submitted — awaiting admin approval.");
}

export async function approveEvent(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const admin = await requireRole("ADMIN");
  await prisma.event.update({
    where: { id },
    data: { status: "APPROVED", approvedById: admin.id, adminNote: null },
  });
  revalidatePath("/events");
  flash("/events", "Event approved.");
}

export async function rejectEvent(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();
  await prisma.event.update({
    where: { id },
    data: { status: "REJECTED", approvedById: admin.id, adminNote: adminNote || null },
  });
  revalidatePath("/events");
  flash("/events", "Event rejected.");
}

export async function openEvent(formData: FormData) {
  const user = await requireRole("TEACHER", "ADMIN");
  const id = String(formData.get("id") ?? "");
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || (event.createdById !== user.id && user.role !== "ADMIN")) {
    flash("/events", "Not found.", "error");
  }
  if (event!.status !== "APPROVED") flash("/events", "Event must be approved before opening.", "error");
  // Assign a check-in code on first open; reuse if the event was opened before.
  const code = event!.code ?? (await uniqueEventCode());
  await prisma.event.update({ where: { id }, data: { status: "OPEN", code } });
  revalidatePath("/events");
  redirect(`/events/${id}`);
}

export async function closeEvent(formData: FormData) {
  const user = await requireRole("TEACHER", "ADMIN");
  const id = String(formData.get("id") ?? "");
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || (event.createdById !== user.id && user.role !== "ADMIN")) {
    flash("/events", "Not found.", "error");
  }
  await prisma.event.update({ where: { id }, data: { status: "CLOSED" } });
  revalidatePath("/events");
  flash(`/events/${id}`, "Event closed.");
}

export async function cancelEvent(formData: FormData) {
  const user = await requireRole("TEACHER", "ADMIN");
  const id = String(formData.get("id") ?? "");
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || (event.createdById !== user.id && user.role !== "ADMIN")) {
    flash("/events", "Not found.", "error");
  }
  await prisma.event.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/events");
  flash("/events", "Event cancelled.");
}
