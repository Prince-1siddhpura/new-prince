const prisma = require('../config/db');

/**
 * GET /api/notifications
 * Fetch user's persistent notifications from PostgreSQL
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { unreadOnly } = req.query;

    const where = { userId };
    if (unreadOnly === 'true' || unreadOnly === true) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark single notification as read
 */
const markRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notif.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications
 * Create persistent notification
 */
const createNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, message, type = 'SYSTEM', accent = '#06b6d4', link } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const notif = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        linkUrl: link || null,
      },
    });


    return res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notif,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for current user
 */
const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  createNotification,
  markRead,
  markAllRead,
};


