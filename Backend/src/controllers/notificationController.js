const Notification = require('../models/Notification');
const socketService = require('../services/socketService');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Utility: create a notification and push it to the user via Socket.IO
 */
const sendNotification = async ({ userId, type, title, message, data = {}, priority = 'medium', actionUrl, actionText }) => {
  const notification = await Notification.create({
    user: userId,
    type,
    title,
    message,
    data,
    priority,
    actionUrl,
    actionText,
  });

  // Push in-app via Socket.IO (fire-and-forget; user may not be connected)
  try {
    socketService.emitToUser(userId.toString(), 'notification:new', {
      id: notification._id,
      type,
      title,
      message,
      priority,
      actionUrl,
      actionText,
      createdAt: notification.createdAt,
    });
  } catch {
    // Socket push is best-effort
  }

  return notification;
};

/**
 * GET /notifications
 * Auth — get paginated notifications for current user
 */
const listNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const filter = { user: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Notification.countDocuments(filter),
    Notification.getUnreadCount(req.user._id),
  ]);

  return ApiResponse.paginated(
    res,
    { notifications, unreadCount },
    { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
  );
});

/**
 * PATCH /notifications/:id/read
 * Auth — mark single notification as read
 */
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new NotFoundError('Notification not found');
  if (notification.user.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('Access denied');
  }

  await notification.markAsRead();

  return ApiResponse.success(res, notification, 'Marked as read');
});

/**
 * PATCH /notifications/read-all
 * Auth — mark all notifications as read
 */
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.markAllAsRead(req.user._id);
  return ApiResponse.success(res, null, 'All notifications marked as read');
});

/**
 * DELETE /notifications/:id
 * Auth — delete a notification
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new NotFoundError('Notification not found');
  if (notification.user.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('Access denied');
  }

  await notification.deleteOne();

  return ApiResponse.noContent(res);
});

/**
 * GET /notifications/unread-count
 * Auth — quick badge count
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.getUnreadCount(req.user._id);
  return ApiResponse.success(res, { count });
});

module.exports = {
  sendNotification,
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
};

// Made with Bob
