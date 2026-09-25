const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getHomework,
  createHomework,
  updateHomework,
  deleteHomework,
} = require('../controllers/homeworkController');

router.use(requireAuth);

router.get('/', getHomework);
router.post('/', createHomework);
router.patch('/:id', updateHomework);
router.delete('/:id', deleteHomework);

module.exports = router;
