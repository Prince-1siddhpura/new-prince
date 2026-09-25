const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getNotifications,
  createNotification,
  markRead,
  markAllRead,
} = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', getNotifications);
router.post('/', createNotification);
router.patch('/:id/read', markRead);
router.post('/read-all', markAllRead);

module.exports = router;
