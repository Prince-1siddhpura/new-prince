const prisma = require('../config/db');

/**
 * GET /api/tasks
 * Retrieve authenticated user's tasks with flexible filtering
 */
const getTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, priority, type, search, subject, importantOnly } = req.query;

    const where = { userId };

    if (status && status !== 'ALL') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (status === 'OVERDUE') {
        where.status = { not: 'COMPLETED' };
        where.dueDate = { lt: startOfToday };
      } else if (status === 'TODAY') {
        where.dueDate = { gte: startOfToday, lte: endOfToday };
      } else if (status === 'UPCOMING') {
        where.status = { not: 'COMPLETED' };
        where.dueDate = { gt: endOfToday };
      } else if (status === 'COMPLETED') {
        where.status = 'COMPLETED';
      } else if (status === 'IN_PROGRESS') {
        where.status = 'IN_PROGRESS';
      } else if (status === 'NOT_STARTED') {
        where.status = 'NOT_STARTED';
      }
    }

    if (priority && priority !== 'ALL') {
      where.priority = priority.toUpperCase();
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (subject && subject !== 'ALL') {
      where.subject = subject;
    }

    if (importantOnly === 'true' || importantOnly === true) {
      where.isImportant = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
      ];
    }

    const { page, limit, sortBy, sortOrder } = req.query;

    const allowedSortFields = ['dueDate', 'createdAt', 'title', 'priority', 'status', 'isImportant'];
    let orderBy = [{ isImportant: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }];
    if (sortBy && allowedSortFields.includes(sortBy)) {
      const order = sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';
      orderBy = [{ [sortBy]: order }];
    }

    const parsedPage = page ? Math.max(1, parseInt(page, 10) || 1) : null;
    const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) : null;

    if (parsedPage && parsedLimit) {
      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          orderBy,
          skip: (parsedPage - 1) * parsedLimit,
          take: parsedLimit,
        }),
        prisma.task.count({ where }),
      ]);

      return res.json({
        success: true,
        data: tasks,
        count: tasks.length,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      });
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
    });

    return res.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks/summary
 * Task statistics (today, upcoming, overdue, completed, important)
 */
const getTaskSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [total, completed, today, overdue, upcoming, important] = await Promise.all([
      prisma.task.count({ where: { userId } }),
      prisma.task.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.task.count({
        where: {
          userId,
          status: { not: 'COMPLETED' },
          dueDate: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { not: 'COMPLETED' },
          dueDate: { lt: startOfToday },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { not: 'COMPLETED' },
          dueDate: { gt: endOfToday },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { not: 'COMPLETED' },
          isImportant: true,
        },
      }),
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return res.json({
      success: true,
      data: {
        total,
        completed,
        todayTasks: today,
        today,
        overdue,
        upcoming,
        important,
        completionRate,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tasks
 * Create a new task in PostgreSQL
 */
const createTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      subject,
      topic,
      type,
      priority,
      status,
      dueDate,
      startDate,
      estimatedDuration,
      isImportant,
      tags,
      subtasks,
      notes,
      xpReward,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title: title.trim(),
        description: description?.trim() || null,
        subject: subject?.trim() || null,
        topic: topic?.trim() || null,
        type: type || 'Study',
        priority: (priority || 'MEDIUM').toUpperCase(),
        status: status || 'NOT_STARTED',
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        estimatedDuration: Number(estimatedDuration) || 30,
        isImportant: Boolean(isImportant),
        tags: Array.isArray(tags) ? tags : [],
        subtasks: Array.isArray(subtasks) ? subtasks : [],
        notes: notes?.trim() || null,
        xpReward: Number(xpReward) || 50,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tasks/:id
 * Update an existing task with ownership check
 */
const updateTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (existing.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this task' });
    }

    const {
      title,
      description,
      subject,
      topic,
      type,
      priority,
      status,
      dueDate,
      startDate,
      estimatedDuration,
      isImportant,
      tags,
      subtasks,
      notes,
      xpReward,
    } = req.body;

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (subject !== undefined) data.subject = subject?.trim() || null;
    if (topic !== undefined) data.topic = topic?.trim() || null;
    if (type !== undefined) data.type = type;
    if (priority !== undefined) data.priority = priority.toUpperCase();
    
    let shouldAwardXp = false;
    let xpToAward = existing.xpReward || 50;

    if (status !== undefined) {
      data.status = status;
      if (status === 'COMPLETED') {
        if (!existing.completedAt && existing.status !== 'COMPLETED') {
          data.completedAt = new Date();
          shouldAwardXp = true;
        }
      }
    }
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (estimatedDuration !== undefined) data.estimatedDuration = Number(estimatedDuration) || 30;
    if (isImportant !== undefined) data.isImportant = Boolean(isImportant);
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : [];
    if (subtasks !== undefined) data.subtasks = Array.isArray(subtasks) ? subtasks : [];
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (xpReward !== undefined) data.xpReward = Number(xpReward) || 50;

    let updated;
    if (shouldAwardXp) {
      updated = await prisma.$transaction(async (tx) => {
        const t = await tx.task.update({ where: { id }, data });
        await tx.xpTransaction.create({
          data: {
            userId,
            amount: xpToAward,
            sourceTitle: `Completed Task: ${existing.title}`,
          },
        });
        const profile = await tx.learnerProfile.findUnique({ where: { userId } });
        const currentXp = profile ? profile.xp : 0;
        const newXp = currentXp + xpToAward;
        const newLevel = Math.floor(newXp / 500) + 1;
        await tx.learnerProfile.upsert({
          where: { userId },
          create: { userId, xp: newXp, level: newLevel },
          update: { xp: newXp, level: newLevel },
        });
        return t;
      });
    } else {
      updated = await prisma.task.update({
        where: { id },
        data,
      });
    }

    return res.json({
      success: true,
      message: 'Task updated successfully',
      data: updated,
      xpAwarded: shouldAwardXp ? xpToAward : 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tasks/:id/toggle-subtask
 * Toggle subtask completion
 */
const toggleSubtask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { subtaskId } = req.body;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (existing.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this task' });
    }

    const subtasks = Array.isArray(existing.subtasks) ? [...existing.subtasks] : [];
    const target = subtasks.find((s) => s.id === subtaskId);
    if (target) {
      target.completed = !target.completed;
    }

    // Auto complete task if all subtasks are done
    const allDone = subtasks.length > 0 && subtasks.every((s) => s.completed);
    const newStatus = allDone ? 'COMPLETED' : existing.status === 'COMPLETED' ? 'IN_PROGRESS' : existing.status;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        subtasks,
        status: newStatus,
        completedAt: newStatus === 'COMPLETED' && !existing.completedAt ? new Date() : existing.completedAt,
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
 * POST /api/tasks/:id/complete
 * Mark complete and award verified XP server-side (strictly prevents duplicate awards)
 */
const completeTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (existing.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Exploit prevention: If already completed or XP already awarded, return zero additional XP
    if (existing.status === 'COMPLETED' || existing.completedAt) {
      return res.json({
        success: true,
        message: 'Task is already completed',
        data: existing,
        xpAwarded: 0,
      });
    }

    const xpToAward = existing.xpReward || 50;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update task
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 2. Award XP via XpTransaction
      await tx.xpTransaction.create({
        data: {
          userId,
          amount: xpToAward,
          sourceTitle: `Completed Task: ${existing.title}`,
        },
      });

      // 3. Increment LearnerProfile XP and level (upsert for new learners)
      const profile = await tx.learnerProfile.findUnique({ where: { userId } });
      const currentXp = profile ? profile.xp : 0;
      const newXp = currentXp + xpToAward;
      const newLevel = Math.floor(newXp / 500) + 1;

      await tx.learnerProfile.upsert({
        where: { userId },
        create: {
          userId,
          xp: newXp,
          level: newLevel,
        },
        update: {
          xp: newXp,
          level: newLevel,
        },
      });

      return updatedTask;

    });

    return res.json({
      success: true,
      message: `Task completed! +${xpToAward} XP awarded.`,
      data: result,
      xpAwarded: xpToAward,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tasks/:id
 * Remove task with ownership validation
 */
const deleteTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (existing.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this task' });
    }

    await prisma.task.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  getTaskSummary,
  createTask,
  updateTask,
  toggleSubtask,
  completeTask,
  deleteTask,
};
