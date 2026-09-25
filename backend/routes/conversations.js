/**
 * EduNova Conversation & Chat Routes
 * Base path: /api/conversations
 */

const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { requireAuth } = require('../middleware/auth');

// All conversation routes require authentication
router.use(requireAuth);

// GET /api/conversations - List user's active threads
router.get('/', conversationController.getUserConversations);

// POST /api/conversations/direct - Initialize direct conversation with peer
router.post('/direct', conversationController.getOrCreateDirectConversation);

// GET /api/conversations/:id - Thread details
router.get('/:id', conversationController.getConversationById);

// POST /api/conversations/:id/read - Mark conversation read
router.post('/:id/read', conversationController.markAsRead);

// GET /api/conversations/:id/messages - Paginated message history (cursor-based)
router.get('/:id/messages', conversationController.getConversationMessages);

// POST /api/conversations/:id/messages - Post message (REST fallback)
router.post('/:id/messages', conversationController.sendMessage);

// Message-level interactions
router.post('/messages/:messageId/react', conversationController.toggleReaction);
router.post('/messages/:messageId/pin', conversationController.togglePin);

module.exports = router;
