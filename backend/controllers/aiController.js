/**
 * Sage AI Controller (backend/controllers/aiController.js)
 * 
 * Secure AI Orchestration:
 * - Next.js / React → /api/ai/* → requireAuth → rateLimiter → aiController → PostgreSQL + Gemini
 * - Zero simulated AI responses in production logic
 * - Genuine AI error handling and explicit service-unavailable states
 * - PostgreSQL persistence for multi-turn conversations
 * - Multimodal document and diagram analysis
 */

const contextBuilder = require('../ai/contextBuilder');
const geminiProvider = require('../ai/geminiProvider');
const { buildQuizPrompt } = require('../ai/prompts/quizGenPrompt');
const { buildWeakTopicPlanPrompt } = require('../ai/prompts/weakTopicPrompt');
const { validateQuizResponse, validateWeakTopicPlanResponse } = require('../ai/responseValidator');
const aiService = require('../services/aiService');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../middleware/uploadMiddleware');

class AiController {
  /**
   * POST /api/ai/chat
   * Socratic tutoring with persistent PostgreSQL storage
   */
  async chat(req, res, next) {
    try {
      const { message, conversationId = null } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Message string is required in request body',
        });
      }

      const result = await aiService.chat({
        userId: req.user.id,
        message,
        conversationId,
      });

      return res.json({
        success: true,
        message: 'Sage AI response generated',
        data: result,
      });
    } catch (error) {
      if (error.status && error.status !== 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'AI_ERROR',
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/ai/generate-quiz (and POST /api/ai/quiz)
   * Dynamically builds questions targeting user's weakTopics
   */
  async generateQuiz(req, res, next) {
    try {
      const {
        subject = 'General Science',
        topic = 'Core Concepts',
        questionCount = 5,
        difficulty = 'INTERMEDIATE',
      } = req.body;

      if (!geminiProvider.isConfigured()) {
        return res.status(503).json({
          success: false,
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'Sage AI Quiz Generator is currently not configured or unavailable on the server.',
        });
      }

      // 1. Fetch student context to extract weakTopics
      const studentContext = await contextBuilder.buildStudentContext(req.user.id);

      // 2. Build prompt with weak topics injection
      const prompt = buildQuizPrompt({
        subject,
        topic,
        questionCount,
        difficulty,
        learnerType: studentContext.learnerType,
        weakTopics: studentContext.weakTopics,
      });

      // 3. Generate structured JSON with Gemini (strict mode)
      const parsedQuiz = await geminiProvider.generateStructuredJson({
        prompt,
        systemInstruction: 'You are an expert curriculum assessment generator for EduNova. Output strictly valid RFC-8259 JSON.',
      });

      // 4. Validate output schema with Zod
      let validatedQuiz = null;
      if (parsedQuiz) {
        try {
          validatedQuiz = validateQuizResponse(parsedQuiz);
        } catch (zodErr) {
          console.warn('[Zod Validation Warning]', zodErr.message);
        }
      }

      // Zero mock fallback: Explicit 503 if genuine generation failed
      if (!validatedQuiz) {
        return res.status(503).json({
          success: false,
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'Sage AI Quiz Generator could not generate questions at this time. Please try again shortly.',
        });
      }

      return res.json({
        success: true,
        message: `Generated ${validatedQuiz.questions.length} questions tailored to ${studentContext.studentName}`,
        data: {
          ...validatedQuiz,
          weakTopicsTargeted: studentContext.weakTopics,
        },
      });
    } catch (error) {
      if (error.status && error.status !== 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'AI_ERROR',
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/ai/history
   * Retrieve student's past Sage AI Q&A turns from PostgreSQL
   */
  async getChatHistory(req, res, next) {
    try {
      const data = await aiService.getHistory({
        userId: req.user.id,
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json({
        success: true,
        message: 'Chat history retrieved',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/ai/weak-topic-plan
   * Diagnostic remediation planner
   */
  async generateWeakTopicPlan(req, res, next) {
    try {
      const { recentErrors = [], targetTopics = [] } = req.body;

      if (!geminiProvider.isConfigured()) {
        return res.status(503).json({
          success: false,
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'Sage AI Weak Topic Recovery Coach is not configured or unavailable.',
        });
      }

      const studentContext = await contextBuilder.buildStudentContext(req.user.id);
      const topicsToTarget = targetTopics.length > 0 ? targetTopics : studentContext.weakTopics;

      const prompt = buildWeakTopicPlanPrompt({
        studentName: studentContext.studentName,
        learnerType: studentContext.learnerType,
        board: studentContext.board,
        degree: studentContext.degree,
        weakTopics: topicsToTarget,
        recentErrors,
      });

      const rawJson = await geminiProvider.generateStructuredJson({
        prompt,
        systemInstruction: 'You are a master academic recovery coach. Return strictly valid JSON matching the schema.',
      });

      let validated = null;
      if (rawJson) {
        try {
          validated = validateWeakTopicPlanResponse(rawJson);
        } catch (err) {
          console.warn('[Weak Topic Plan Zod Warning]', err.message);
        }
      }

      // Zero mock fallback: Explicit 503 if genuine generation failed
      if (!validated) {
        return res.status(503).json({
          success: false,
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'Sage AI could not generate a remediation plan at this time. Please try again shortly.',
        });
      }

      return res.json({
        success: true,
        message: 'Weak topic recovery plan generated',
        data: validated,
      });
    } catch (error) {
      if (error.status && error.status !== 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'AI_ERROR',
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/ai/flashcards
   * Genuinely generate active recall flashcards
   */
  async generateFlashcards(req, res, next) {
    try {
      const { subject, topic, count } = req.body;
      const flashcards = await aiService.generateFlashcards({
        userId: req.user.id,
        subject,
        topic,
        count,
      });

      return res.json({
        success: true,
        message: `Generated ${flashcards.length} active recall flashcards`,
        data: flashcards,
      });
    } catch (error) {
      if (error.status && error.status !== 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'AI_ERROR',
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/ai/study-plan
   * Genuinely generate adaptive study plan
   */
  async generateStudyPlan(req, res, next) {
    try {
      const { goal, availableHoursPerWeek } = req.body;
      const plan = await aiService.generateStudyPlan({
        userId: req.user.id,
        goal,
        availableHoursPerWeek,
      });

      return res.json({
        success: true,
        message: 'Adaptive study plan generated',
        data: plan,
      });
    } catch (error) {
      if (error.status && error.status !== 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'AI_ERROR',
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/ai/analyze-document
   * Genuinely analyze uploaded file (image or document) using Multimodal Gemini
   */
  async analyzeDocument(req, res, next) {
    try {
      const file = req.file;
      const { prompt } = req.body;

      if (!file) {
        return res.status(400).json({
          success: false,
          code: 'NO_FILE_PROVIDED',
          message: 'An uploaded file is required for document analysis.',
        });
      }

      const result = await aiService.analyzeUploadedDocument({
        userId: req.user.id,
        fileBuffer: file.buffer,
        mimeType: file.mimetype,
        fileName: file.originalname,
        prompt,
      });

      return res.json({
        success: true,
        message: 'Document analyzed successfully',
        data: {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          ...result,
        },
      });
    } catch (error) {
      if (error.status && error.status !== 500) {
        return res.status(error.status).json({
          success: false,
          code: error.code || 'AI_ERROR',
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/ai/vision-status
   * Genuine reporting of multimodal vision capabilities
   */
  async getVisionStatus(req, res) {
    const isConfigured = geminiProvider.isConfigured();
    return res.json({
      success: true,
      data: {
        isAvailable: isConfigured,
        model: geminiProvider.modelName,
        maxFileSizeBytes: MAX_FILE_SIZE,
        maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
        supportedMimeTypes: ALLOWED_MIME_TYPES,
        status: isConfigured ? 'READY' : 'UNCONFIGURED',
        capabilities: {
          ocrAndDocumentAnalysis: isConfigured,
          imageInspection: isConfigured,
          cameraArSpatialOverlay: true, // Native 3D WebGL projection
        },
      },
    });
  }
}

module.exports = new AiController();
