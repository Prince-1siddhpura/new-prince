const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getTasks,
  getTaskSummary,
  createTask,
  updateTask,
  toggleSubtask,
  completeTask,
  deleteTask,
} = require('../controllers/taskController');

router.use(requireAuth);

router.get('/', getTasks);
router.get('/summary', getTaskSummary);
router.post('/', createTask);
router.patch('/:id', updateTask);
router.patch('/:id/toggle-subtask', toggleSubtask);
router.post('/:id/complete', completeTask);
router.delete('/:id', deleteTask);

module.exports = router;
