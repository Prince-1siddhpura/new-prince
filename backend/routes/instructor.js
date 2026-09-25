const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getInstructorDashboard,
  getAssignedCourses,
  createCourse,
  updateCourse,
  getEnrolledStudents,
  getInstructorAssessments,
} = require('../controllers/instructorController');

// ── Instructor Role Authorization Guard ──────────────────────────────────────
router.use(requireAuth);
router.use(requireRole('INSTRUCTOR', 'ADMIN'));

// ── Instructor Routes ────────────────────────────────────────────────────────
router.get('/dashboard', getInstructorDashboard);
router.get('/courses', getAssignedCourses);
router.post('/courses', createCourse);
router.patch('/courses/:id', updateCourse);
router.get('/students', getEnrolledStudents);
router.get('/assessments', getInstructorAssessments);

module.exports = router;
