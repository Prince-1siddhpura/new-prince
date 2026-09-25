const prisma = require('../config/db');

/**
 * Get all subjects with optional curriculum filters
 */
const getSubjects = async ({ educationType, board, className, class: classAlt, degree, branch, semester, exam, category, search }) => {
  const targetClass = className || classAlt;
  const where = {};

  if (educationType) where.educationType = educationType;
  if (board) where.board = board;
  if (targetClass) where.class = targetClass;
  if (degree) where.degree = degree;
  if (branch) where.branch = branch;
  if (semester) where.semester = String(semester);
  if (exam) where.exam = exam;
  if (category) where.category = { contains: category };
  
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { category: { contains: search } },
    ];
  }

  let subjects = await prisma.subject.findMany({
    where,
    include: {
      topics: { orderBy: { order: 'asc' } },
      _count: { select: { progress: true } },
    },
    orderBy: { name: 'asc' },
  });

  return subjects;
};

/**
 * Get single subject with topics
 */
const getSubjectById = async (subjectId) => {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      topics: { orderBy: { order: 'asc' } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { progress: true } },
    },
  });

  if (!subject) throw { status: 404, message: 'Subject not found' };
  return subject;
};

/**
 * Create a subject (Admin/Instructor)
 */
const createSubject = async (data, createdById) => {
  const { name, category, educationType, className, board, topics } = data;

  const subject = await prisma.subject.create({
    data: {
      name,
      category,
      educationType: educationType || 'SCHOOL',
      class: className,
      board,
      createdById,
      ...(topics && topics.length > 0 && {
        topics: {
          create: topics.map((t, i) => ({
            title: t.title,
            order: t.order || i + 1,
          })),
        },
      }),
    },
    include: { topics: true },
  });

  return subject;
};

/**
 * Update a subject
 */
const updateSubject = async (subjectId, data) => {
  const { name, category, educationType, className, board } = data;

  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data: {
      ...(name && { name }),
      ...(category && { category }),
      ...(educationType && { educationType }),
      ...(className !== undefined && { class: className }),
      ...(board !== undefined && { board }),
    },
    include: { topics: { orderBy: { order: 'asc' } } },
  });

  return subject;
};

/**
 * Delete a subject
 */
const deleteSubject = async (subjectId) => {
  await prisma.subject.delete({ where: { id: subjectId } });
  return { message: 'Subject deleted successfully' };
};

/**
 * Add topic to a subject
 */
const addTopic = async (subjectId, { title, order }) => {
  // Get max order if not provided
  if (!order) {
    const maxTopic = await prisma.topic.findFirst({
      where: { subjectId },
      orderBy: { order: 'desc' },
    });
    order = (maxTopic?.order || 0) + 1;
  }

  const topic = await prisma.topic.create({
    data: { subjectId, title, order },
  });

  return topic;
};

/**
 * Delete a topic
 */
const deleteTopic = async (topicId) => {
  await prisma.topic.delete({ where: { id: topicId } });
  return { message: 'Topic deleted successfully' };
};

/**
 * Select/enroll a subject for a student (links to dashboard)
 */
const selectSubject = async (userId, subjectId) => {
  let subject = await prisma.subject.findUnique({ where: { id: subjectId } });

  if (!subject) {
    const idMap = {
      'sch_math_10': 'Mathematics',
      'sch_physics_10': 'Physics',
      'sch_chem_10': 'Chemistry',
      'sch_bio_10': 'Biology',
      'sch_eng_10': 'English',
      'sch_sst_10': 'Social Science',
      'sch_cs_10': 'Computer Applications',
      'col_dbms_sem5': 'Database Management Systems',
      'col_os_sem5': 'Operating Systems',
      'col_cn_sem5': 'Computer Networks',
      'col_dsa_sem5': 'Data Structures',
      'col_web_sem5': 'Web Engineering',
      'col_se_sem5': 'Software Engineering',
      'exm_quant': 'Quantitative',
      'exm_reasoning': 'Logical Reasoning',
      'exm_english': 'Language',
      'exm_gk': 'General Awareness',
      'skl_fullstack': 'Full Stack',
      'skl_uiux': 'UI/UX',
      'skl_backend': 'Backend Systems',
      'skl_devops': 'DevOps'
    };

    const targetKeyword = idMap[subjectId] || subjectId.replace(/^(sch_|col_|exm_|skl_)/, '').replace(/_\d+$/, '');
    
    subject = await prisma.subject.findFirst({
      where: { name: { contains: targetKeyword } }
    });

    if (!subject) {
      subject = await prisma.subject.findFirst();
    }
  }

  if (!subject) {
    return { success: true, message: 'Subject selected locally' };
  }

  // Upsert student subject progress (atomic idempotency)
  const progress = await prisma.studentSubjectProgress.upsert({
    where: { userId_subjectId: { userId, subjectId: subject.id } },
    update: {},
    create: {
      userId,
      subjectId: subject.id,
      progress: 0,
      targetScore: 80,
      syllabusCoverage: 0,
    },
    include: {
      subject: {
        include: { topics: { orderBy: { order: 'asc' } } },
      },
    },
  });

  return progress;
};

/**
 * Update subject progress, syllabus coverage, and weak topics atomically
 */
const updateProgressAndWeakTopics = async (userId, subjectId, data) => {
  const { progress, syllabusCoverage, targetScore, weakTopics } = data;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update StudentSubjectProgress
    const updatedProgress = await tx.studentSubjectProgress.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      update: {
        ...(progress !== undefined && { progress }),
        ...(syllabusCoverage !== undefined && { syllabusCoverage }),
        ...(targetScore !== undefined && { targetScore }),
      },
      create: {
        userId,
        subjectId,
        progress: progress || 0,
        syllabusCoverage: syllabusCoverage || 0,
        targetScore: targetScore || 80,
      },
      include: { subject: true },
    });

    // 2. If weakTopics provided, update LearnerProfile
    let updatedProfile = null;
    if (weakTopics && Array.isArray(weakTopics)) {
      const currentProfile = await tx.learnerProfile.findUnique({ where: { userId } });
      if (currentProfile) {
        // Merge and deduplicate weak topics
        const mergedWeakTopics = Array.from(new Set([...currentProfile.weakTopics, ...weakTopics]));
        updatedProfile = await tx.learnerProfile.update({
          where: { userId },
          data: { weakTopics: mergedWeakTopics },
        });
      }
    }

    return {
      progress: updatedProgress,
      weakTopics: updatedProfile?.weakTopics,
    };
  });

  return result;
};

/**
 * Get all subjects enrolled by a student
 */
const getEnrolledSubjects = async (userId) => {
  const enrollments = await prisma.studentSubjectProgress.findMany({
    where: { userId },
    include: {
      subject: {
        include: {
          topics: { orderBy: { order: 'asc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return enrollments;
};

/**
 * Unenroll / remove subject from dashboard
 */
const unenrollSubject = async (userId, subjectId) => {
  await prisma.studentSubjectProgress.deleteMany({
    where: { userId, subjectId },
  });
  return { message: 'Subject unenrolled successfully' };
};

module.exports = {
  getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject,
  addTopic, deleteTopic, selectSubject, updateProgressAndWeakTopics,
  getEnrolledSubjects, unenrollSubject,
};

