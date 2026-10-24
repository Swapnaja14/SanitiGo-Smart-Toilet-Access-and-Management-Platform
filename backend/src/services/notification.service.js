import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query) {
  const page = Number(query.page ?? DEFAULT_PAGE);
  const limit = Number(query.limit ?? DEFAULT_LIMIT);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    throw new ApiError(
      400,
      "page must be positive and limit must be between 1 and 100."
    );
  }

  return { page, limit };
}

export async function listNotifications(userId, query = {}) {
  const { page, limit } = parsePagination(query);

  const where = {
    userId,
  };

  if (query.unreadOnly === "true") {
    where.readAt = null;
  } else if (
    query.unreadOnly !== undefined &&
    query.unreadOnly !== "false"
  ) {
    throw new ApiError(
      400,
      "unreadOnly must be true or false."
    );
  }

  const [notifications, total, unreadCount] =
    await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          eventId: true,
          type: true,
          title: true,
          message: true,
          data: true,
          readAt: true,
          createdAt: true,
        },
      }),

      prisma.notification.count({ where }),

      prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
    ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    unreadCount,
  };
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

export async function markNotificationAsRead(
  userId,
  notificationId
) {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  if (result.count === 1) {
    return prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
      select: {
        id: true,
        eventId: true,
        type: true,
        title: true,
        message: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  // Treat an already-read notification as a successful,
  // idempotent operation.
  const existing = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: {
      id: true,
      eventId: true,
      type: true,
      title: true,
      message: true,
      data: true,
      readAt: true,
      createdAt: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, "Notification not found.");
  }

  return existing;
}

export async function markAllNotificationsAsRead(userId) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
}

export default {
  listNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
