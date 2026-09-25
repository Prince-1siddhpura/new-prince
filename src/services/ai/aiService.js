import apiClient from '../../lib/apiClient';

class AIService {
  /**
   * Socratic Sage AI Chat Query
   * Multi-turn authorized conversation persisted in PostgreSQL
   */
  async askSage({ prompt, conversationId = null }) {
    try {
      const response = await apiClient.post('/ai/chat', {
        message: prompt,
        conversationId,
      });

      const data = response.data?.data || response.data;

      return {
        text: data.reply,
        conversationId: data.conversationId,
        model: data.model,
        type: 'text',
      };
    } catch (error) {
      const status = error.response?.status || 503;
      const code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
      const message = error.response?.data?.message || 'Sage AI service is currently unavailable. Please verify API configuration or try again shortly.';

      const err = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    }
  }

  /**
   * Retrieve authenticated student's past Sage Q&A conversation turns from PostgreSQL
   */
  async getHistory(page = 1, limit = 20) {
    try {
      const response = await apiClient.get(`/ai/history?page=${page}&limit=${limit}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.warn('[AIService getHistory Warning]', error.message);
      return { history: [], total: 0 };
    }
  }

  /**
   * Specialized Quiz Generator Mode (Structured Quiz Data from Gemini)
   */
  async generateQuiz({ subjectName, topicName, difficulty = 'Medium', count = 5 }) {
    try {
      const response = await apiClient.post('/ai/generate-quiz', {
        subject: subjectName,
        topic: topicName,
        difficulty: difficulty.toUpperCase(),
        questionCount: count,
      });
      return response.data?.data || response.data;
    } catch (error) {
      const status = error.response?.status || 503;
      const code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
      const message = error.response?.data?.message || 'Sage Quiz Generator is temporarily unavailable.';

      const err = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    }
  }

  /**
   * Wrong Answer Explanation Mode
   */
  async explainWrongAnswer({ questionText, userAnswer, correctAnswer }) {
    const prompt = `Explain why '${userAnswer}' is incorrect and why '${correctAnswer}' is correct for question: "${questionText}".`;
    return this.askSage({ prompt });
  }

  /**
   * Genuine Active Recall Flashcard Generator
   * Routes through backend Gemini structured generation
   */
  async generateFlashcards({ subjectName, topicName, count = 5 }) {
    try {
      const response = await apiClient.post('/ai/flashcards', {
        subject: subjectName,
        topic: topicName,
        count,
      });
      return response.data?.data || response.data;
    } catch (error) {
      const status = error.response?.status || 503;
      const code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
      const message = error.response?.data?.message || 'Flashcard generator is temporarily unavailable.';

      const err = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    }
  }

  /**
   * Genuine Adaptive Study Plan Generator
   * Routes through backend Gemini structured generation
   */
  async generateStudyPlan(goal, availableHoursPerWeek = 8) {
    try {
      const response = await apiClient.post('/ai/study-plan', {
        goal,
        availableHoursPerWeek,
      });
      return response.data?.data || response.data;
    } catch (error) {
      const status = error.response?.status || 503;
      const code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
      const message = error.response?.data?.message || 'Study plan generator is temporarily unavailable.';

      const err = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    }
  }

  /**
   * Diagnostic Weak Topic Recovery Plan
   */
  async generateWeakTopicPlan({ recentErrors = [], targetTopics = [] }) {
    try {
      const response = await apiClient.post('/ai/weak-topic-plan', {
        recentErrors,
        targetTopics,
      });
      return response.data?.data || response.data;
    } catch (error) {
      const status = error.response?.status || 503;
      const code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
      const message = error.response?.data?.message || 'Weak topic recovery planner is temporarily unavailable.';

      const err = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    }
  }

  /**
   * Multimodal File / Document Analysis
   */
  async analyzeDocument(file, prompt) {
    const formData = new FormData();
    formData.append('file', file);
    if (prompt) formData.append('prompt', prompt);

    try {
      const response = await apiClient.post('/ai/analyze-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data?.data || response.data;
    } catch (error) {
      const status = error.response?.status || 503;
      const code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
      const message = error.response?.data?.message || 'Document analysis is temporarily unavailable.';

      const err = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    }
  }

  /**
   * Check Genuine Vision & Multimodal Capabilities
   */
  async getVisionStatus() {
    try {
      const response = await apiClient.get('/ai/vision-status');
      return response.data?.data || response.data;
    } catch (error) {
      return { isAvailable: false, status: 'UNAVAILABLE' };
    }
  }
}

export const aiService = new AIService();
export default aiService;
