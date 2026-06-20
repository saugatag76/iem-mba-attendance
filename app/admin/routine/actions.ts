"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Weekday } from "@prisma/client";

async function adminOnly() {
  await requireRole("ADMIN");
}

/** Reassign an existing slot to a different offering (or clear it). */
export async function updateSlotOffering(
  scheduledClassId: string,
  offeringId: string | null,
  subgroup: string | null,
) {
  await adminOnly();
  await prisma.scheduledClass.update({
    where: { id: scheduledClassId },
    data: { offeringId: offeringId ?? null, subgroup: subgroup || null },
  });
  revalidatePath("/admin/routine");
}

/** Add a new subgroup entry to an existing slot (lab splits). */
export async function addSlotEntry(
  classSectionId: string,
  day: Weekday,
  slotIndex: number,
  startTime: string,
  endTime: string,
  offeringId: string | null,
  subgroup: string | null,
) {
  await adminOnly();
  await prisma.scheduledClass.create({
    data: {
      classSectionId,
      day,
      slotIndex,
      startTime,
      endTime,
      offeringId: offeringId ?? null,
      subgroup: subgroup || null,
      rawLabel: subgroup ? `(split) ${subgroup}` : "(new slot)",
    },
  });
  revalidatePath("/admin/routine");
}

/** Remove a slot entry entirely (deletes the ScheduledClass row). */
export async function removeSlotEntry(scheduledClassId: string) {
  await adminOnly();
  await prisma.scheduledClass.delete({ where: { id: scheduledClassId } });
  revalidatePath("/admin/routine");
}
