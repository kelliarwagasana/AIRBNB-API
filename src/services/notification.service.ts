import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createNotification(userId: string, payload: NotificationPayload) {
  return prisma.notification.create({
    data: {
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata,
    },
  });
}

export async function notifyUsers(userIds: string[], payload: NotificationPayload) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata,
    })),
  });
}

export async function notifyAdmins(payload: NotificationPayload) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  await notifyUsers(
    admins.map((admin) => admin.id),
    payload,
  );
}

export async function notifyUserUnlessSelf(
  userId: string,
  actorId: string | undefined,
  payload: NotificationPayload,
) {
  if (actorId && userId === actorId) return;
  await createNotification(userId, payload);
}
