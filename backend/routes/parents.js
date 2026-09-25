const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { getChildOverview, linkStudent, unlinkStudent } = require('../controllers/parentController');

// ── Parent Protection ─────────────────────────────────────────────────────────
router.use(requireAuth);
router.use(requireRole('PARENT'));

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/child-overview', getChildOverview);
router.post('/link-student', linkStudent);
router.post('/unlink-student', unlinkStudent);

module.exports = router;
