/**
 * Mock AI Provider Engine (src/services/providers/mockAIProvider.js)
 * 
 * AUDIT & COMPLIANCE (PHASE 7):
 * - Simulated AI responses have been removed from production application logic.
 * - All AI requests are dispatched to the authentic backend AI gateway.
 * - Explicit service-unavailable states are surfaced if the backend is unreachable.
 */

import apiClient from '../../lib/apiClient';

export const callMockAI = async (prompt, intentObj = {}, context = {}) => {
  try {
    const response = await apiClient.post('/ai/chat', {
      message: prompt,
      conversationId: context.conversationId || null,
      metadata: {
        intent: intentObj.intent || 'GENERAL',
        constraints: intentObj.constraints || {},
        subject: context.currentSubject || null,
        topic: context.currentTopic || null,
      },
    });

    const reply = response.data?.reply || response.data?.data?.reply;
    if (reply) {
      return reply;
    }

    throw new Error('AI gateway returned an empty response.');
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Sage AI service is currently unavailable. Please verify API configuration or try again shortly.';
    const serviceError = new Error(errorMsg);
    serviceError.code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
    serviceError.status = error.response?.status || 503;
    throw serviceError;
  }
};

export default { callMockAI };
