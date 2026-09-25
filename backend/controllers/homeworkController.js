const prisma = require('../config/db');

/**
 * GET /api/homework
 */
const getHomework = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const items = await prisma.homeworkItem.findMany({
      where: { userId },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/homework
 */
const createHomework = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { subject, title, dueDate, priority = 'Medium', status = 'In Progress', notes } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ success: false, message: 'Title and subject are required' });
    }

    const item = await prisma.homeworkItem.create({
      data: {
        userId,
        subject,
        title: title.trim(),
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        status,
        notes: notes || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/homework/:id
 */
const updateHomework = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, priority, title, dueDate, notes } = req.body;

    const existing = await prisma.homeworkItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Homework item not found' });
    if (existing.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updated = await prisma.homeworkItem.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(title && { title: title.trim() }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/homework/:id
 */
const deleteHomework = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.homeworkItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Item not found' });
    if (existing.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await prisma.homeworkItem.delete({ where: { id } });
    return res.json({ success: true, message: 'Homework item deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHomework,
  createHomework,
  updateHomework,
  deleteHomework,
};
