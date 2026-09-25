const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  recordGameResult,
  getPersonalBests,
  getGameHistory,
  getGameLeaderboard,
} = require('../controllers/gameController');

router.use(requireAuth);

router.post('/record', recordGameResult);
router.post('/results', recordGameResult);
router.get('/bests', getPersonalBests);
router.get('/history', getGameHistory);
router.get('/leaderboard', getGameLeaderboard);


module.exports = router;
