/**
 * EduNova Analytics Controller
 * 
 * Endpoints:
 * - GET   /api/analytics/overview                      (Powers Next.js ProgressAnalyticsPage)
 * - GET   /api/analytics/student/:userId?              (Learner analytics)
 * - POST  /api/analytics/study-sessions                (Schedule study session)
 * - PATCH /api/analytics/study-sessions/:id/complete   (Complete study session)
 */

const prisma = require('../config/db');
const analyticsService = require('../services/analyticsService');

/**
 * GET /api/analytics/overview
 * Real PostgreSQL performance analytics (study hours, mastery, revision radar, consistency)
 * If requester is PARENT, automatically resolves their linked student's performance.
 */
const getOverview = async (req, res, next) => {
  try {
    let targetUserId = req.user.id;

    if (req.user.role === 'PARENT') {
      const parent = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { studentUsername: true },
      });

      if (!parent?.studentUsername) {
        return res.json({
          success: true,
          message: 'No student currently linked to parent account',
          data: {
            isParentViewingChild: true,
            hasLinkedChild: false,
            kpis: { plannedHours: 0, completedHours: 0, overallAccuracy: 0, syllabusCoverage: 0 },
            subjects: [],
            studySessions: [],
            quizAttempts: [],
            learner: { name: 'No linked child', xp: 0, level: 1, streakDays: 0 },
          },
        });
      }

      const student = await prisma.user.findFirst({
        where: {
          role: 'STUDENT',
          OR: [
            { email: { equals: parent.studentUsername, mode: 'insensitive' } },
            { studentUsername: { equals: parent.studentUsername, mode: 'insensitive' } },
            { name: { equals: parent.studentUsername, mode: 'insensitive' } },
            { id: parent.studentUsername },
          ],
        },
        select: { id: true, name: true },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Linked student with identifier "${parent.studentUsername}" was not found.`,
        });
      }

      targetUserId = student.id;
    }

    const overview = await analyticsService.getLearnerOverview(targetUserId);
    return res.json({
      success: true,
      message: req.user.role === 'PARENT' ? 'Child performance analytics retrieved successfully' : 'Learner performance analytics retrieved successfully',
      data: overview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/student/:userId?
 * Student analytics with strict parent-child role guard
 */
const getStudentAnalytics = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.user.id;

    // 1. STUDENT can only access their own analytics
    if (req.user.role === 'STUDENT' && targetUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view other students analytics.',
      });
    }

    // 2. PARENT can only access their linked child's analytics
    if (req.user.role === 'PARENT') {
      const parent = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { studentUsername: true },
      });

      if (!parent?.studentUsername) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No linked student found for your parent account.',
        });
      }

      const targetStudent = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, studentUsername: true, email: true, name: true, role: true },
      });

      if (!targetStudent || targetStudent.role !== 'STUDENT') {
        return res.status(404).json({
          success: false,
          message: 'Target student not found.',
        });
      }

      const parentIdentifiers = parent.studentUsername
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const isLinked = parentIdentifiers.some(
        (id) =>
          id === targetStudent.email?.toLowerCase() ||
          id === targetStudent.studentUsername?.toLowerCase() ||
          id === targetStudent.name?.toLowerCase() ||
          id === targetStudent.id
      );

      if (!isLinked) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view analytics for your verified linked student.',
        });
      }
    }

    // 3. INSTRUCTOR can only access students enrolled in their courses
    if (req.user.role === 'INSTRUCTOR') {
      const isEnrolledInCourse = await prisma.userCourseProgress.findFirst({
        where: {
          userId: targetUserId,
          course: { instructorId: req.user.id },
        },
      });

      if (!isEnrolledInCourse) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view analytics for students enrolled in your courses.',
        });
      }
    }

    const data = await analyticsService.getLearnerOverview(targetUserId);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/analytics/study-sessions
 * Schedule or log a study session
 */
const createStudySession = async (req, res, next) => {
  try {
    const { subjectId, durationMinutes, plannedDate } = req.body;
    const session = await analyticsService.createStudySession(req.user.id, {
      subjectId,
      durationMinutes,
      plannedDate,
    });
    return res.status(201).json({
      success: true,
      message: 'Study session logged successfully',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/analytics/study-sessions/:id/complete
 * Mark study session complete and award XP
 */
const completeStudySession = async (req, res, next) => {
  try {
    const result = await analyticsService.completeStudySession(req.user.id, req.params.id);
    return res.json({
      success: true,
      message: `Study session completed! +${result.xpEarned} XP awarded.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/study-sessions
 * List student study sessions
 */
const getStudySessions = async (req, res, next) => {
  try {
    const sessions = await analyticsService.getStudySessions(req.user.id, req.query);
    return res.json({
      success: true,
      message: 'Study sessions retrieved successfully',
      data: sessions,
      count: sessions.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/analytics/study-sessions/:id
 * Remove a scheduled study session
 */
const deleteStudySession = async (req, res, next) => {
  try {
    await analyticsService.deleteStudySession(req.user.id, req.params.id);
    return res.json({
      success: true,
      message: 'Study session deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getStudentAnalytics,
  createStudySession,
  completeStudySession,
  getStudySessions,
  deleteStudySession,
};

