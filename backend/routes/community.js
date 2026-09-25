/**
 * EduNova Community Routes
 * Base path: /api/community
 */

const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Publicly browse discussions (with optional auth to check user likes)
router.get('/posts', optionalAuth, communityController.getPosts);
router.get('/posts/:id', optionalAuth, communityController.getPostById);

// Authenticated discussion actions
router.post('/posts', requireAuth, communityController.createPost);
router.post('/posts/:id/like', requireAuth, communityController.toggleLike);
router.post('/posts/:id/comments', requireAuth, communityController.addComment);
router.post('/posts/:id/accept-answer', requireAuth, communityController.acceptAnswer);
router.delete('/posts/:id', requireAuth, communityController.deletePost);
router.patch('/posts/:id/pin', requireAuth, communityController.togglePin);

module.exports = router;
