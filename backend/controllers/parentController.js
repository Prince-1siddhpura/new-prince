const parentService = require('../services/parentService');
const authService = require('../services/authService');

/**
 * @desc    Get linked child's real-time progress and stats (supports optional ?studentUsername=)
 * @route   GET /api/parents/child-overview
 * @access  Private (PARENT)
 */
const getChildOverview = async (req, res) => {
  try {
    const { studentUsername } = req.query;
    const overview = await parentService.getChildOverview(req.user.id, studentUsername);
    res.json({
      success: true,
      message: `Child overview for ${overview.student.name} retrieved successfully`,
      data: overview,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get authorized child profile for a parent (read-only)
 * @route   GET /api/parents/child-profile
 * @access  Private (PARENT)
 */
const getChildProfile = async (req, res) => {
  try {
    const { studentUsername } = req.query;
    const profile = await parentService.getChildProfile(req.user.id, studentUsername);
    res.json({
      success: true,
      message: `Child profile for ${profile.student.name} retrieved successfully`,
      data: profile,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get list of all linked children for the parent account
 * @route   GET /api/parents/children
 * @access  Private (PARENT)
 */
const getLinkedChildren = async (req, res) => {
  try {
    const children = await parentService.getLinkedChildren(req.user.id);
    res.json({
      success: true,
      message: 'Linked children retrieved successfully',
      data: children,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Link parent to student using student username and active link code
 * @route   POST /api/parents/link-student
 * @access  Private (PARENT)
 */
const linkStudent = async (req, res) => {
  try {
    const { studentUsername, linkCode } = req.body;
    const result = await authService.linkParentToStudent(req.user.id, studentUsername, linkCode);
    res.json({ success: true, message: result.message, data: result });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Unlink current parent from student (optionally pass studentUsername to unlink specific child)
 * @route   POST /api/parents/unlink-student
 * @access  Private (PARENT)
 */
const unlinkStudent = async (req, res) => {
  try {
    const { studentUsername } = req.body;
    const result = await authService.unlinkParentStudent(req.user.id, studentUsername);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get parent companion settings & permissions from PostgreSQL
 * @route   GET /api/parents/companion-config
 */
const getCompanionConfig = async (req, res, next) => {
  try {
    const prisma = require('../config/db');
    const config = await prisma.parentCompanionConfig.findUnique({
      where: { parentId: req.user.id },
    });
    return res.json({
      success: true,
      data: config || {
        permissions: {
          todayLearning: true,
          progressOverview: true,
          subjectDetail: true,
          studyTime: true,
          quizAccuracy: true,
          dailyReport: true,
          weeklyReport: true,
          achievementAlerts: true,
        },
        notificationPreferences: {
          dailyReport: true,
          weeklyReport: true,
          achievementUnlocked: true,
          goalCompleted: true,
          examApproaching: true,
          longInactivity: true,
          channel: 'Email & In-App',
        },
        privacyRules: {
          exposeSagePrivateChats: false,
          exposePrivateNotes: false,
          exposePeerMessages: false,
          exposeCommunityPosts: false,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save parent companion settings in PostgreSQL
 * @route   PUT /api/parents/companion-config
 */
const updateCompanionConfig = async (req, res, next) => {
  try {
    const prisma = require('../config/db');
    const { permissions, notificationPreferences, privacyRules } = req.body;

    const updated = await prisma.parentCompanionConfig.upsert({
      where: { parentId: req.user.id },
      update: {
        permissions: permissions || undefined,
        notificationPreferences: notificationPreferences || undefined,
        privacyRules: privacyRules || undefined,
      },
      create: {
        parentId: req.user.id,
        permissions: permissions || {},
        notificationPreferences: notificationPreferences || {},
        privacyRules: privacyRules || {},
      },
    });

    return res.json({
      success: true,
      message: 'Companion settings updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChildOverview,
  getChildProfile,
  getLinkedChildren,
  linkStudent,
  unlinkStudent,
  getCompanionConfig,
  updateCompanionConfig,
};
