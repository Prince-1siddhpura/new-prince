const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  recordLabAttempt,
  getLabProgress,
  getLabAttempts,
  getLabAttemptById,
  saveXrProgress,
  getXrProgress,
} = require('../controllers/labController');

router.use(requireAuth);

router.post('/attempt', recordLabAttempt);
router.post('/attempts', recordLabAttempt);
router.post('/save-result', recordLabAttempt);
router.get('/progress', getLabProgress);
router.get('/attempts', getLabAttempts);
router.get('/attempts/:id', getLabAttemptById);
router.post('/xr-progress', saveXrProgress);
router.post('/xr/:modelId', (req, res, next) => {
  req.body.modelId = req.params.modelId;
  return saveXrProgress(req, res, next);
});
router.get('/xr-progress/:modelId', getXrProgress);
router.get('/xr/:modelId', getXrProgress);

module.exports = router;
