import {
  listNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notification.service.js";

export async function getNotifications(req, res, next) {
  try {
    const result = await listNotifications(
      req.user.id,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getUnreadNotificationCount(
  req,
  res,
  next
) {
  try {
    const unreadCount = await getUnreadCount(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully.",
      data: { unreadCount },
    });
  } catch (error) {
    return next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notification = await markNotificationAsRead(
      req.user.id,
      req.params.notificationId
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: { notification },
    });
  } catch (error) {
    return next(error);
  }
}

export async function markAllNotificationsRead(
  req,
  res,
  next
) {
  try {
    const result = await markAllNotificationsAsRead(
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
