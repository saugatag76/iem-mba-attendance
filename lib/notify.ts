import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/** Create a persistent notification for one user. */
export async function notify(
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
) {
  await prisma.notification.create({
    data: { recipientId, type, title, body, link: link ?? null },
  });
}

/** Create the same notification for every user with the given role. */
export async function notifyRole(
  role: "ADMIN" | "TEACHER" | "STUDENT",
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
) {
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ recipientId: u.id, type, title, body, link: link ?? null })),
  });
}
