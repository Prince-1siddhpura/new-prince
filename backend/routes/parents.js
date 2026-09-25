const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getChildOverview,
  getChildProfile,
  getLinkedChildren,
  linkStudent,
  unlinkStudent,
  getCompanionConfig,
  updateCompanionConfig,
} = require('../controllers/parentController');

// ── Parent Protection ─────────────────────────────────────────────────────────
router.use(requireAuth);
router.use(requireRole('PARENT'));

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/children', getLinkedChildren);
router.get('/child-overview', getChildOverview);
router.get('/child-profile', getChildProfile);
router.post('/link-student', linkStudent);
router.post('/unlink-student', unlinkStudent);
router.get('/companion-config', getCompanionConfig);
router.post('/companion-config', updateCompanionConfig);
router.put('/companion-config', updateCompanionConfig);


module.exports = router;
