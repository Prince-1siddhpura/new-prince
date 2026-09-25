const prisma = require('../config/db');

/**
 * GET /api/instructor/dashboard
 * Aggregates high-level metrics for courses assigned to the authenticated instructor
 */
const getInstructorDashboard = async (req, res, next) => {
  try {
    const instructorId = req.user.id;

    // 1. Fetch instructor's courses with enrollments and modules
    const courses = await prisma.course.findMany({
      where: { instructorId },
      include: {
        modules: { select: { id: true, title: true, duration: true, order: true } },
        enrollments: {
          select: {
            id: true,
            userId: true,
            progress: true,
            completedModuleIds: true,
            enrolledAt: true,
            user: { select: { id: true, name: true, email: true, avatar: true, studentUsername: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const totalCourses = courses.length;
    const publishedCourses = courses.filter((c) => c.isPublished).length;
    const totalModules = courses.reduce((sum, c) => sum + c.modules.length, 0);

    // Unique enrolled students across all assigned courses
    const studentMap = new Map();
    let totalProgressSum = 0;
    let enrollmentCount = 0;

    courses.forEach((c) => {
      c.enrollments.forEach((e) => {
        enrollmentCount++;
        totalProgressSum += e.progress;
        if (!studentMap.has(e.userId)) {
          studentMap.set(e.userId, {
            ...e.user,
            enrolledCoursesCount: 1,
            avgProgress: e.progress,
            latestEnrollment: e.enrolledAt,
          });
        } else {
          const s = studentMap.get(e.userId);
          s.enrolledCoursesCount += 1;
        }
      });
    });

    const totalStudents = studentMap.size;
    const avgCompletion = enrollmentCount > 0 ? Math.round(totalProgressSum / enrollmentCount) : 0;

    return res.json({
      success: true,
      message: 'Instructor metrics retrieved successfully',
      data: {
        metrics: {
          totalCourses,
          publishedCourses,
          totalModules,
          totalStudents,
          totalEnrollments: enrollmentCount,
          avgCompletionRate: avgCompletion,
        },
        recentCourses: courses.slice(0, 5).map((c) => ({
          id: c.id,
          title: c.title,
          category: c.category,
          difficulty: c.difficulty,
          isPublished: c.isPublished,
          modulesCount: c.modules.length,
          enrollmentsCount: c.enrollments.length,
          updatedAt: c.updatedAt,
        })),
        recentStudents: Array.from(studentMap.values()).slice(0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/instructor/courses
 * List only courses assigned to this instructor
 */
const getAssignedCourses = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const { search, category, status } = req.query;

    const where = {
      instructorId,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && category !== 'All' && { category }),
      ...(status === 'published' && { isPublished: true }),
      ...(status === 'draft' && { isPublished: false }),
    };

    const courses = await prisma.course.findMany({
      where,
      include: {
        modules: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({
      success: true,
      data: courses.map((c) => ({
        ...c,
        enrollmentsCount: c._count.enrollments,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/instructor/courses
 * Create a new course authored by this instructor
 */
const createCourse = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const { title, description, category, difficulty = 'BEGINNER', thumbnail, modules = [] } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Course title is required' });
    }

    const course = await prisma.course.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category: category?.trim() || 'General',
        difficulty,
        thumbnail: thumbnail?.trim() || null,
        instructorId,
        isPublished: false,
        modules: {
          create: modules.map((m, index) => ({
            title: m.title.trim(),
            duration: Number(m.duration) || 30,
            order: Number(m.order ?? index),
          })),
        },
      },
      include: { modules: true },
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/instructor/courses/:id
 * Update assigned course (Enforces authorization: must be instructor's course)
 */
const updateCourse = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const { id } = req.params;
    const { title, description, category, difficulty, thumbnail, isPublished, modules } = req.body;

    // Verify ownership
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (existing.instructorId !== instructorId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to edit this course.',
      });
    }

    // Execute update inside transaction if modules are provided
    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(modules)) {
        await tx.courseModule.deleteMany({ where: { courseId: id } });
        await tx.courseModule.createMany({
          data: modules.map((m, index) => ({
            courseId: id,
            title: m.title,
            duration: Number(m.duration) || 30,
            order: Number(m.order ?? index),
          })),
        });
      }

      return tx.course.update({
        where: { id },
        data: {
          ...(title && { title: title.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(category && { category: category.trim() }),
          ...(difficulty && { difficulty }),
          ...(thumbnail !== undefined && { thumbnail: thumbnail?.trim() || null }),
          ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
        },
        include: { modules: { orderBy: { order: 'asc' } } },
      });
    });

    return res.json({
      success: true,
      message: 'Course updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/instructor/students
 * List all students enrolled in courses managed by this instructor
 */
const getEnrolledStudents = async (req, res, next) => {
  try {
    const instructorId = req.user.id;

    const enrollments = await prisma.userCourseProgress.findMany({
      where: {
        course: { instructorId },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentUsername: true,
            avatar: true,
            learnerType: true,
            learnerProfile: { select: { level: true, xp: true, streakDays: true, board: true } },
          },
        },
        course: { select: { id: true, title: true, category: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({
      success: true,
      data: enrollments.map((e) => ({
        enrollmentId: e.id,
        progress: e.progress,
        completedModulesCount: e.completedModuleIds.length,
        enrolledAt: e.enrolledAt,
        student: e.user,
        course: e.course,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/instructor/assessments
 * Assessments/Quizzes related to instructor's subjects or courses
 */
const getInstructorAssessments = async (req, res, next) => {
  try {
    const instructorId = req.user.id;

    const quizzes = await prisma.quiz.findMany({
      where: {
        subject: {
          createdById: instructorId,
        },
      },
      include: {
        subject: { select: { id: true, name: true, category: true } },
        topic: { select: { id: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        difficulty: q.difficulty,
        subjectName: q.subject?.name,
        topicName: q.topic?.title,
        questionCount: q._count.questions,
        attemptsCount: q._count.attempts,
        createdAt: q.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInstructorDashboard,
  getAssignedCourses,
  createCourse,
  updateCourse,
  getEnrolledStudents,
  getInstructorAssessments,
};
