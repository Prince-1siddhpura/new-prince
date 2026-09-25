/**
 * EduNova Quiz Routes
 * Base path: /api/quizzes
 */

const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { requireAuth, requireRole } = require('../middleware/auth');

// All quiz routes require authentication
router.use(requireAuth);

// GET /api/quizzes - List quizzes
router.get('/', quizController.listQuizzes);

// POST /api/quizzes - Create quiz (restricted to ADMIN and INSTRUCTOR)
router.post('/', requireRole('ADMIN', 'INSTRUCTOR'), quizController.createQuiz);

// GET /api/quizzes/:id - Get quiz questions (sanitized without answer keys)
router.get('/:id', quizController.getQuiz);

// POST /api/quizzes/:id/submit - Submit answers and evaluate server-side
router.post('/:id/submit', quizController.submitQuiz);

module.exports = router;
