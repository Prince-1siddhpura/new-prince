/**
 * EduNova Performance Analytics Routes
 * Base path: /api/analytics
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getOverview,
  getStudentAnalytics,
  createStudySession,
  completeStudySession,
  getStudySessions,
  deleteStudySession,
} = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(requireAuth);

// GET /api/analytics/overview - Powers ProgressAnalyticsPage
router.get('/overview', getOverview);

// GET /api/analytics/student/:userId? - Detailed analytics for student or parent
router.get('/student/:userId?', getStudentAnalytics);

// GET /api/analytics/study-sessions - List study sessions
router.get('/study-sessions', getStudySessions);

// POST /api/analytics/study-sessions - Schedule a study session
router.post('/study-sessions', createStudySession);

// PATCH /api/analytics/study-sessions/:id/complete - Complete study session
router.patch('/study-sessions/:id/complete', completeStudySession);

// DELETE /api/analytics/study-sessions/:id - Delete study session
router.delete('/study-sessions/:id', deleteStudySession);


module.exports = router;
