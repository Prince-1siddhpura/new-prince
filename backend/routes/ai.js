/**
 * Sage AI Routes (backend/routes/ai.js)
 * Base path: /api/ai
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middleware/auth');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { validateFileUpload } = require('../middleware/uploadMiddleware');

// All AI routes require authentication
router.use(requireAuth);

const chatSchema = {
  body: z.object({
    message: z.string().trim().min(1, 'Message string is required'),
    conversationId: z.string().nullable().optional(),
  }),
};

// POST /api/ai/chat - Session-based Socratic Q&A with persistent PostgreSQL storage
router.post('/chat', validate(chatSchema), aiController.chat);

// POST /api/ai/generate-quiz & /api/ai/quiz - Dynamic quiz targeting user's weakTopics
router.post('/generate-quiz', aiController.generateQuiz);
router.post('/quiz', aiController.generateQuiz);

// GET /api/ai/history - Student's past Sage Q&A turns from PostgreSQL
router.get('/history', aiController.getChatHistory);

// POST /api/ai/weak-topic-plan - Targeted remediation plan based on diagnostic errors
router.post('/weak-topic-plan', aiController.generateWeakTopicPlan);

// POST /api/ai/flashcards - Active recall flashcards generator
router.post('/flashcards', aiController.generateFlashcards);

// POST /api/ai/study-plan - Adaptive 5-day study plan generator
router.post('/study-plan', aiController.generateStudyPlan);

// POST /api/ai/analyze-document - Multimodal file / image / document analysis
router.post('/analyze-document', validateFileUpload('file'), aiController.analyzeDocument);

// GET /api/ai/vision-status - Genuine status of visual & multimodal AI capabilities
router.get('/vision-status', aiController.getVisionStatus);

module.exports = router;
