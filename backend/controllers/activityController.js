const prisma = require('../config/db');

/**
 * POST /api/activities
 * Log event-driven learning activity in PostgreSQL
 */
const logActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, subject, topic, durationMinutes = 15, accuracy = 0, xpEarned = 0, metadata } = req.body;

    if (!type || !subject) {
      return res.status(400).json({ success: false, message: 'Activity type and subject are required' });
    }

    const activity = await prisma.learningActivity.create({
      data: {
        userId,
        type: type.toUpperCase(),
        subject,
        topic: topic || null,
        durationMinutes: parseInt(durationMinutes, 10) || 15,
        accuracy: parseFloat(accuracy) || 0,
        xpEarned: parseInt(xpEarned, 10) || 0,
        metadata: metadata || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Learning activity logged successfully',
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/activities
 * Get recent activity history and summary calculations
 */
const getActivities = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 30 } = req.query;

    const activities = await prisma.learningActivity.findMany({
      where: { userId },
      take: Math.min(100, parseInt(limit, 10) || 30),
      orderBy: { createdAt: 'desc' },
    });

    // Compute weekly study time and consistency
    const totalMinutes = activities.reduce((sum, a) => sum + a.durationMinutes, 0);
    const avgAccuracy = activities.length > 0
      ? Math.round(activities.reduce((sum, a) => sum + a.accuracy, 0) / activities.length)
      : 0;

    return res.json({
      success: true,
      data: {
        activities,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        avgAccuracy,
        count: activities.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  logActivity,
  getActivities,
};
