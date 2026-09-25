const prisma = require('../config/db');
const contextBuilder = require('../ai/contextBuilder');
const geminiProvider = require('../ai/geminiProvider');

/**
 * Format conversation history for Gemini chat API
 */
const formatGeminiHistory = (messages) => {
  return messages.map((m) => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));
};

/**
 * Socratic Chat Service
 * Persists authorized conversations and messages to PostgreSQL
 */
const chat = async ({ userId, message, conversationId = null }) => {
  if (!message || typeof message !== 'string' || !message.trim()) {
    const error = new Error('Message is required and cannot be empty.');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const cleanMessage = message.trim();

  // 1. Build student context and Socratic instructions
  const studentContext = await contextBuilder.buildStudentContext(userId);
  const systemInstruction = await contextBuilder.getTutorSystemInstruction(userId);

  let existingConversation = null;
  let historyForGemini = [];

  // 2. Multi-turn conversation retrieval with strict authorization
  if (conversationId) {
    existingConversation = await prisma.aiConversation.findFirst({
      where: {
        id: conversationId,
        userId, // Strictly authorized to requesting user
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 30, // Preserve recent context
        },
      },
    });

    if (existingConversation && existingConversation.messages.length > 0) {
      historyForGemini = formatGeminiHistory(existingConversation.messages);
    }
  }

  // 3. Generate genuine response via Gemini (throws explicit 503/429 on failure, zero mock responses)
  const reply = await geminiProvider.generateChatReply({
    systemInstruction,
    history: historyForGemini,
    message: cleanMessage,
  });

  const cleanReply = reply.trim();

  // 4. PostgreSQL Persistence
  let activeConversationId = conversationId;

  if (existingConversation) {
    // Append to existing authorized conversation
    await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId: existingConversation.id,
          role: 'user',
          content: cleanMessage,
        },
      }),
      prisma.aiMessage.create({
        data: {
          conversationId: existingConversation.id,
          role: 'model',
          content: cleanReply,
        },
      }),
      prisma.aiConversation.update({
        where: { id: existingConversation.id },
        data: {
          response: cleanReply,
          updatedAt: new Date(),
        },
      }),
    ]);
    activeConversationId = existingConversation.id;
  } else {
    // Create new conversation record
    const newConv = await prisma.aiConversation.create({
      data: {
        userId,
        title: cleanMessage.slice(0, 80),
        prompt: cleanMessage,
        response: cleanReply,
        metadata: {
          model: geminiProvider.modelName,
          learnerType: studentContext.learnerType,
          goals: studentContext.goals,
          weakTopics: studentContext.weakTopics,
        },
      },
    });

    await prisma.aiMessage.createMany({
      data: [
        { conversationId: newConv.id, role: 'user', content: cleanMessage },
        { conversationId: newConv.id, role: 'model', content: cleanReply },
      ],
    });

    activeConversationId = newConv.id;
  }

  return {
    reply: cleanReply,
    conversationId: activeConversationId,
    model: geminiProvider.modelName,
  };
};

/**
 * Retrieve student's authorized conversation history with messages
 */
const getHistory = async ({ userId, page = 1, limit = 20 }) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [conversations, total] = await Promise.all([
    prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    }),
    prisma.aiConversation.count({ where: { userId } }),
  ]);

  return {
    history: conversations,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
};

/**
 * Genuinely generate active recall flashcards via Gemini
 */
const generateFlashcards = async ({ userId, subject = 'General Studies', topic = 'Core Concepts', count = 5 }) => {
  const studentContext = await contextBuilder.buildStudentContext(userId);
  const safeCount = Math.min(20, Math.max(1, Number(count) || 5));

  const prompt = `Generate exactly ${safeCount} high-yield active recall flashcards for ${subject} (${topic}).
The cards must target essential principles, definitions, or problem steps suitable for a ${studentContext.learnerType} learner.

Return strictly a JSON array of objects with "front" and "back" keys.
Example structure:
[
  { "front": "What is ...?", "back": "..." }
]`;

  const cards = await geminiProvider.generateStructuredJson({
    prompt,
    systemInstruction: 'You are an expert cognitive learning specialist and flashcard creator. Output strictly valid RFC-8259 JSON array of cards.',
  });

  if (!Array.isArray(cards)) {
    throw new Error('Flashcard generation returned invalid format');
  }

  return cards.slice(0, safeCount);
};

/**
 * Genuinely generate adaptive study plan via Gemini
 */
const generateStudyPlan = async ({ userId, goal = 'Exam Preparation', availableHoursPerWeek = 8 }) => {
  const studentContext = await contextBuilder.buildStudentContext(userId);
  const hrs = Math.max(1, Number(availableHoursPerWeek) || 8);

  const prompt = `Create a 5-day adaptive study plan for student ${studentContext.studentName}.
Goal: ${goal}
Available hours per week: ${hrs}
Enrolled subjects: ${studentContext.enrolledSubjects ? studentContext.enrolledSubjects.map((s) => s.name).join(', ') : 'Academic core'}
Identified weak topics to prioritize: ${studentContext.weakTopics ? studentContext.weakTopics.join(', ') : 'None specified'}
Learner track: ${studentContext.learnerType}

Return strictly a JSON array of 5 day objects. Each object must contain:
- day: string (e.g. "Monday")
- focus: string (core focus area)
- hours: number or string (planned hours for the day)
- topic: string (specific targeted topic)`;

  const plan = await geminiProvider.generateStructuredJson({
    prompt,
    systemInstruction: 'You are a master academic study planner for EduNova. Output strictly valid RFC-8259 JSON array of 5 daily schedule items.',
  });

  if (!Array.isArray(plan)) {
    throw new Error('Study plan generation returned invalid format');
  }

  return plan;
};

/**
 * Genuinely analyze uploaded document or image using Multimodal Gemini
 */
const analyzeUploadedDocument = async ({ userId, fileBuffer, mimeType, fileName, prompt }) => {
  const customPrompt = prompt || `Analyze this educational material (${fileName || 'document'}). Extract the core concept definitions, identify key formulas or steps, and suggest 3 active recall review questions.`;
  
  return geminiProvider.analyzeMultimodalContent({
    buffer: fileBuffer,
    mimeType,
    prompt: customPrompt,
  });
};

module.exports = {
  chat,
  getHistory,
  generateFlashcards,
  generateStudyPlan,
  analyzeUploadedDocument,
};