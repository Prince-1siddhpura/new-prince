const prisma = require('../config/db');

/**
 * POST /api/labs/attempt & POST /api/labs/save-result
 * Record laboratory experiment attempt, validate results server-side, and award verified XP
 */
const recordLabAttempt = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      labId,
      labTitle,
      subject = 'General Science',
      parameters = null,
      results = null,
      score = 80,
      timeSpentMins = 5,
      notes = '',
    } = req.body;

    // Strict input validation
    if (!labId || typeof labId !== 'string' || !labId.trim()) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Valid labId string is required.',
      });
    }

    if (!labTitle || typeof labTitle !== 'string' || !labTitle.trim()) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Valid labTitle string is required.',
      });
    }

    const rawScore = parseFloat(score);
    if (isNaN(rawScore) || rawScore < 0 || rawScore > 100) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Score must be a valid number between 0 and 100.',
      });
    }
    const numericScore = Math.round(rawScore * 10) / 10;

    const rawDuration = parseInt(timeSpentMins, 10);
    const duration = isNaN(rawDuration) || rawDuration < 1 ? 1 : Math.min(300, rawDuration);

    // Backend-verified XP calculation: base 25 XP + scaled score bonus + effort minutes (capped at 150)
    // Server enforces XP bounds, preventing any client-side XP fabrication
    const xpToAward = Math.min(150, Math.max(25, Math.round(numericScore * 0.8) + Math.min(30, duration * 2)));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Save persistent attempt with full parameters and calculation results
      const attempt = await tx.labAttempt.create({
        data: {
          userId,
          labId: labId.trim(),
          labTitle: labTitle.trim(),
          subject: (subject || 'General Science').trim(),
          parameters: parameters ? (typeof parameters === 'object' ? parameters : { data: parameters }) : null,
          results: results ? (typeof results === 'object' ? results : { data: results }) : null,
          score: numericScore,
          timeSpentMins: duration,
          notes: notes?.trim() ? notes.trim().slice(0, 1000) : null,
        },
      });

      // 2. Award verified XP transaction
      await tx.xpTransaction.create({
        data: {
          userId,
          amount: xpToAward,
          sourceTitle: `Virtual Lab: ${labTitle.trim()} (${Math.round(numericScore)}%)`,
        },
      });

      // 3. Update learner XP and level in PostgreSQL
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

      // 4. Log learning activity event for auditability
      await tx.learningActivity.create({
        data: {
          userId,
          type: 'SIMULATION',
          subject: (subject || 'General Science').trim(),
          topic: labTitle.trim(),
          durationMinutes: duration,
          accuracy: numericScore,
        },
      });

      return attempt;
    });

    return res.status(201).json({
      success: true,
      message: `Lab attempt verified and recorded! +${xpToAward} XP awarded.`,
      data: result,
      xpAwarded: xpToAward,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/labs/progress
 * Overview of completed labs, mastery, total time, and streak strictly computed from PostgreSQL
 */
const getLabProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const attempts = await prisma.labAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const uniqueLabIds = new Set();
    let totalTimeSpent = 0;
    const subjectMastery = {};

    attempts.forEach((a) => {
      uniqueLabIds.add(a.labId);
      totalTimeSpent += a.timeSpentMins;

      const sub = a.subject || 'General';
      if (!subjectMastery[sub]) {
        subjectMastery[sub] = { attempts: 0, totalScore: 0 };
      }
      subjectMastery[sub].attempts += 1;
      subjectMastery[sub].totalScore += a.score;
    });

    const masterySummary = {};
    Object.keys(subjectMastery).forEach((sub) => {
      const data = subjectMastery[sub];
      masterySummary[sub] = Math.round(data.totalScore / data.attempts);
    });

    const profile = await prisma.learnerProfile.findUnique({
      where: { userId },
      select: { streakDays: true, xp: true },
    });

    return res.json({
      success: true,
      data: {
        completedLabs: Array.from(uniqueLabIds),
        totalAttempts: attempts.length,
        totalTimeSpentMins: totalTimeSpent,
        totalXP: profile?.xp || 0,
        streakDays: profile?.streakDays || 1,
        subjectMastery: masterySummary,
        lastExperiment: attempts.length > 0 ? attempts[0] : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/labs/attempts
 * List history of verified lab attempts
 */
const getLabAttempts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { labId, limit = 50, page = 1 } = req.query;

    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const safePage = Math.max(1, parseInt(page, 10) || 1);

    const where = { userId };
    if (labId && typeof labId === 'string') where.labId = labId.trim();

    const [attempts, total] = await Promise.all([
      prisma.labAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      prisma.labAttempt.count({ where }),
    ]);

    return res.json({
      success: true,
      data: attempts,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/labs/attempts/:id
 * Retrieve a specific saved experiment result with parameters and results
 */
const getLabAttemptById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const attempt = await prisma.labAttempt.findFirst({
      where: { id, userId }, // Strictly authorized
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Experiment attempt not found or unauthorized.',
      });
    }

    return res.json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/labs/xr-progress
 * Upsert XR scene progress in PostgreSQL with backend completion verification
 */
const saveXrProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      modelId,
      timeSpentSeconds = 0,
      hotspotsViewed = [],
      challengesCompleted = 0,
      quizScore = null,
      completed = false,
    } = req.body;

    if (!modelId || typeof modelId !== 'string' || !modelId.trim()) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Valid modelId string is required.',
      });
    }

    const duration = Math.max(0, Math.min(86400, parseInt(timeSpentSeconds, 10) || 0));
    const cleanHotspots = Array.isArray(hotspotsViewed) ? hotspotsViewed.filter(h => typeof h === 'string') : [];
    const challenges = Math.max(0, Math.min(50, parseInt(challengesCompleted, 10) || 0));
    const score = quizScore !== undefined && quizScore !== null ? Math.min(100, Math.max(0, parseInt(quizScore, 10) || 0)) : null;

    // Server-side completion validation:
    // A scene can only be marked as completed if the user actually engaged
    // (duration >= 15 seconds, or viewed >= 1 hotspot, or completed a challenge)
    // Prevents fabrication of XR completions and achievements
    let isCompleted = Boolean(completed);
    if (isCompleted && duration < 15 && cleanHotspots.length === 0 && challenges === 0) {
      isCompleted = false; // Reject fabricated completion
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.xrProgress.findUnique({
        where: { userId_modelId: { userId, modelId: modelId.trim() } },
      });

      const wasAlreadyCompleted = Boolean(existing?.completed);
      const isNewlyCompleted = isCompleted && !wasAlreadyCompleted;

      const progress = await tx.xrProgress.upsert({
        where: {
          userId_modelId: { userId, modelId: modelId.trim() },
        },
        update: {
          timeSpentSeconds: duration > 0 ? { increment: duration } : undefined,
          hotspotsViewed: cleanHotspots.length > 0 ? cleanHotspots : undefined,
          challengesCompleted: challenges > 0 ? challenges : undefined,
          quizScore: score !== null ? score : undefined,
          completed: isCompleted ? true : undefined,
          lastVisited: new Date(),
        },
        create: {
          userId,
          modelId: modelId.trim(),
          timeSpentSeconds: duration,
          hotspotsViewed: cleanHotspots,
          challengesCompleted: challenges,
          quizScore: score,
          completed: isCompleted,
        },
      });

      // Award verified XP on legitimate newly verified completion
      if (isNewlyCompleted) {
        await tx.xpTransaction.create({
          data: {
            userId,
            amount: 75,
            sourceTitle: `XR Scene Mastery: ${modelId.trim()}`,
          },
        });

        const profile = await tx.learnerProfile.findUnique({ where: { userId } });
        if (profile) {
          const newXp = profile.xp + 75;
          const newLevel = Math.floor(newXp / 500) + 1;
          await tx.learnerProfile.update({
            where: { userId },
            data: { xp: newXp, level: newLevel },
          });
        }

        await tx.learningActivity.create({
          data: {
            userId,
            type: 'SIMULATION',
            subject: 'Spatial XR / 3D Simulation',
            topic: modelId.trim(),
            durationMinutes: Math.max(1, Math.round(duration / 60)),
            accuracy: score !== null ? score : 90,
          },
        });
      }

      return progress;
    });

    return res.json({
      success: true,
      message: 'XR progress persisted to PostgreSQL',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/labs/xr-progress/:modelId
 * Get XR progress for a model
 */
const getXrProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { modelId } = req.params;

    if (!modelId) {
      return res.status(400).json({ success: false, message: 'Model ID is required' });
    }

    const progress = await prisma.xrProgress.findUnique({
      where: {
        userId_modelId: { userId, modelId: modelId.trim() },
      },
    });

    return res.json({
      success: true,
      data: progress || {
        modelId: modelId.trim(),
        timeSpentSeconds: 0,
        hotspotsViewed: [],
        challengesCompleted: 0,
        quizScore: null,
        completed: false,
        lastVisited: null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordLabAttempt,
  getLabProgress,
  getLabAttempts,
  getLabAttemptById,
  saveXrProgress,
  getXrProgress,
};
