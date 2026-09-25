const parentService = require('../services/parentService');
const authService = require('../services/authService');

/**
 * @desc    Get linked child's real-time progress and stats
 * @route   GET /api/parents/child-overview
 * @access  Private (PARENT)
 */
const getChildOverview = async (req, res) => {
  try {
    const overview = await parentService.getChildOverview(req.user.id);
    res.json({
      success: true,
      message: `Child overview for ${overview.student.name} retrieved successfully`,
      data: overview,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Link parent to student using student username and active link code
 * @route   POST /api/parents/link-student
 * @access  Private (PARENT)
 */
const linkStudent = async (req, res) => {
  try {
    const { studentUsername, linkCode } = req.body;
    const result = await authService.linkParentToStudent(req.user.id, studentUsername, linkCode);
    res.json({ success: true, message: result.message, data: result });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Unlink current parent from student
 * @route   POST /api/parents/unlink-student
 * @access  Private (PARENT)
 */
const unlinkStudent = async (req, res) => {
  try {
    const result = await authService.unlinkParentStudent(req.user.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

module.exports = { getChildOverview, linkStudent, unlinkStudent };
