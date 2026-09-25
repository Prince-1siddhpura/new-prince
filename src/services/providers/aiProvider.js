/**
 * Secure AI Dispatch Provider (src/services/providers/aiProvider.js)
 * 
 * Routes AI requests strictly through authenticated backend gateway.
 * Surfaces genuine error states and service-unavailable feedback.
 */

import apiClient from '../../lib/apiClient';

export const dispatchAIRequest = async (prompt, systemPrompt = '', context = {}, isJsonMode = false) => {
  try {
    const response = await apiClient.post('/ai/chat', {
      message: prompt,
      conversationId: context.conversationId || null,
      metadata: {
        systemPrompt: systemPrompt || undefined,
        subject: context.subject || context.currentSubject,
        topic: context.topic || context.currentTopic,
      },
    });

    const reply = response.data?.reply || response.data?.data?.reply;
    if (!reply) {
      throw new Error('AI gateway returned an empty response.');
    }

    if (isJsonMode) {
      if (typeof reply === 'object') return reply;
      const cleanJson = reply.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
      return JSON.parse(cleanJson);
    }

    return reply;
  } catch (error) {
    const status = error.response?.status || 503;
    const code = error.response?.data?.code || 'AI_SERVICE_UNAVAILABLE';
    const message = error.response?.data?.message || 'Sage AI service is currently unavailable. Please try again shortly.';

    const aiError = new Error(message);
    aiError.status = status;
    aiError.code = code;
    throw aiError;
  }
};

export default { dispatchAIRequest };
