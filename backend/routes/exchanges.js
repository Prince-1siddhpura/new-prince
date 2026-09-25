/**
 * EduNova Peer Skill Exchange Routes
 * Base path: /api/exchanges
 */

const express = require('express');
const router = express.Router();
const skillExchangeController = require('../controllers/skillExchangeController');
const { requireAuth } = require('../middleware/auth');

// All skill exchange routes require authentication
router.use(requireAuth);

// GET /api/exchanges - List current user's sent and received proposals
router.get('/', skillExchangeController.getUserExchanges);

// GET /api/exchanges/:id - Exchange proposal details
router.get('/:id', skillExchangeController.getExchangeById);

// POST /api/exchanges/request - Create a skill swap proposal between two learners
router.post('/request', skillExchangeController.createExchangeRequest);

// PATCH /api/exchanges/:id/status - Accept/reject proposal (auto-provisions room if accepted)
router.patch('/:id/status', skillExchangeController.updateExchangeStatus);

// Meetings
router.get('/meetings', (req, res, next) => skillExchangeController.getMeetings(req, res, next));
router.post('/meetings', (req, res, next) => skillExchangeController.scheduleMeeting(req, res, next));
router.patch('/meetings/:id/status', (req, res, next) => skillExchangeController.updateMeetingStatus(req, res, next));
router.get('/:id/meetings', (req, res, next) => skillExchangeController.getMeetings(req, res, next));
router.post('/:id/meetings', (req, res, next) => skillExchangeController.scheduleMeeting(req, res, next));

// Goals & Milestones
router.get('/goals', (req, res, next) => skillExchangeController.getGoals(req, res, next));
router.post('/goals', (req, res, next) => skillExchangeController.createGoal(req, res, next));
router.patch('/goals/:id/progress', (req, res, next) => skillExchangeController.updateGoalProgress(req, res, next));
router.get('/:id/goals', (req, res, next) => skillExchangeController.getGoals(req, res, next));
router.post('/:id/goals', (req, res, next) => skillExchangeController.createGoal(req, res, next));
router.patch('/:id/goals/:goalId/toggle', (req, res, next) => skillExchangeController.toggleGoalMilestone(req, res, next));

module.exports = router;

