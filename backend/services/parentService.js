const prisma = require('../config/db');

/**
 * Helper to extract array of linked usernames from parent record
 */
const getLinkedUsernames = (studentUsernameField) => {
  if (!studentUsernameField) return [];
  return studentUsernameField
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Get all linked children for an authenticated parent
 */
const getLinkedChildren = async (parentId) => {
  const parent = await prisma.user.findUnique({
    where: { id: parentId },
    select: { id: true, name: true, studentUsername: true, role: true },
  });

  if (!parent) throw { status: 404, message: 'Parent account not found' };

  const usernames = getLinkedUsernames(parent.studentUsername);
  if (usernames.length === 0) return [];

  const children = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      OR: [
        { email: { in: usernames } },
        { studentUsername: { in: usernames } },
        { name: { in: usernames } },
        { id: { in: usernames } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      studentUsername: true,
      avatar: true,
      learnerType: true,
      createdAt: true,
      learnerProfile: {
        select: {
          board: true,
          degree: true,
          xp: true,
          level: true,
          streakDays: true,
        },
      },
      _count: {
        select: {
          subjectProgress: true,
          courseProgress: true,
          quizAttempts: true,
        },
      },
    },
  });

  return children.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    studentUsername: c.studentUsername || c.email || c.name,
    avatar: c.avatar,
    learnerType: c.learnerType,
    board: c.learnerProfile?.board || null,
    degree: c.learnerProfile?.degree || null,
    level: c.learnerProfile?.level || 1,
    xp: c.learnerProfile?.xp || 0,
    streakDays: c.learnerProfile?.streakDays || 0,
    totalSubjects: c._count.subjectProgress,
    totalCourses: c._count.courseProgress,
    totalQuizzes: c._count.quizAttempts,
  }));
};

/**
 * Get comprehensive child overview for an authenticated parent
 */
const getChildOverview = async (parentId, requestedUsername = null) => {
  const parent = await prisma.user.findUnique({
    where: { id: parentId },
    select: { id: true, name: true, studentUsername: true, role: true },
  });

  if (!parent) {
    throw { status: 404, message: 'Parent account not found' };
  }

  const usernames = getLinkedUsernames(parent.studentUsername);
  if (usernames.length === 0) {
    throw {
      status: 400,
      message: 'No student username linked to this parent account. Please link your student first.',
    };
  }

  // Determine which student to inspect
  let targetUsername = usernames[0];
  if (requestedUsername) {
    const trimmedReq = requestedUsername.trim();
    // Check if matches username, email, or id
    const isLinked = usernames.some((u) => u.toLowerCase() === trimmedReq.toLowerCase());
    if (!isLinked) {
      throw {
        status: 403,
        message: `Unauthorized: Student "${requestedUsername}" is not linked to your parent account.`,
      };
    }
    targetUsername = trimmedReq;
  }

  // Find linked student
  const student = await prisma.user.findFirst({
    where: {
      role: 'STUDENT',
      OR: [
        { email: { equals: targetUsername, mode: 'insensitive' } },
        { studentUsername: { equals: targetUsername, mode: 'insensitive' } },
        { name: { equals: targetUsername, mode: 'insensitive' } },
        { id: targetUsername },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      studentUsername: true,
      avatar: true,
      learnerType: true,
      createdAt: true,
      learnerProfile: true,
      subjectProgress: {
        include: {
          subject: {
            select: { id: true, name: true, category: true, class: true, board: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      },
      courseProgress: {
        include: {
          course: {
            select: { id: true, title: true, category: true, difficulty: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      },
      xpTransactions: {
        take: 7,
        orderBy: { createdAt: 'desc' },
      },
      userMissions: {
        where: { completed: true },
        take: 5,
        include: {
          mission: { select: { title: true, rewardXp: true, category: true } },
        },
        orderBy: { completedAt: 'desc' },
      },
    },
  });

  if (!student) {
    throw {
      status: 404,
      message: `No student found with linked username "${targetUsername}".`,
    };
  }

  // Summaries
  const totalSubjects = student.subjectProgress.length;
  const avgSubjectProgress = totalSubjects > 0
    ? student.subjectProgress.reduce((sum, sp) => sum + sp.progress, 0) / totalSubjects
    : 0;

  const totalCourses = student.courseProgress.length;
  const avgCourseProgress = totalCourses > 0
    ? student.courseProgress.reduce((sum, cp) => sum + cp.progress, 0) / totalCourses
    : 0;

  return {
    student: {
      id: student.id,
      name: student.name,
      studentUsername: student.studentUsername,
      avatar: student.avatar,
      learnerType: student.learnerType,
      memberSince: student.createdAt,
    },
    availableChildren: usernames,
    academics: {
      board: student.learnerProfile?.board || 'N/A',
      degree: student.learnerProfile?.degree || null,
      goals: student.learnerProfile?.goals || [],
      weakTopics: student.learnerProfile?.weakTopics || [],
      academicDetails: student.learnerProfile?.academicDetails || null,
      totalSubjects,
      avgSubjectProgress: Math.round(avgSubjectProgress * 10) / 10,
      totalCourses,
      avgCourseProgress: Math.round(avgCourseProgress * 10) / 10,
    },
    gamification: {
      xp: student.learnerProfile?.xp || 0,
      level: student.learnerProfile?.level || 1,
      streakDays: student.learnerProfile?.streakDays || 0,
      recentActivity: student.xpTransactions,
      completedMissions: student.userMissions.map((um) => ({
        title: um.mission.title,
        rewardXp: um.mission.rewardXp,
        completedAt: um.completedAt,
      })),
    },
    subjects: student.subjectProgress.map((sp) => ({
      id: sp.subject.id,
      name: sp.subject.name,
      category: sp.subject.category,
      progress: sp.progress,
      syllabusCoverage: sp.syllabusCoverage,
      targetScore: sp.targetScore,
    })),
    courses: student.courseProgress.map((cp) => ({
      id: cp.course.id,
      title: cp.course.title,
      category: cp.course.category,
      progress: cp.progress,
      completedModulesCount: cp.completedModuleIds.length,
      enrolledAt: cp.enrolledAt,
    })),
  };
};

/**
 * Get authorized child profile for a parent (read-only, does not expose parent profile)
 */
const getChildProfile = async (parentId, requestedUsername = null) => {
  const overview = await getChildOverview(parentId, requestedUsername);
  return {
    student: overview.student,
    academics: overview.academics,
    gamification: overview.gamification,
    subjects: overview.subjects,
    courses: overview.courses,
    availableChildren: overview.availableChildren,
  };
};

module.exports = {
  getChildOverview,
  getChildProfile,
  getLinkedChildren,
  getLinkedUsernames,
};
