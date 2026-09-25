const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { logActivity, getActivities } = require('../controllers/activityController');

router.use(requireAuth);

router.post('/', logActivity);
router.get('/', getActivities);

module.exports = router;
