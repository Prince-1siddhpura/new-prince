/**
 * Secure AI Provider Proxy (src/services/providers/openaiProvider.js)
 * 
 * SECURITY COMPLIANCE (PHASE 7):
 * - Direct browser-side calls to external AI APIs (OpenAI/Anthropic/Google) are prohibited.
 * - Private API keys are never exposed in browser bundles or client environment variables.
 * - All AI inference requests are securely routed through the authenticated backend gateway (/api/ai/chat).
 */

import apiClient from '../../lib/apiClient';

export const callOpenAIAPI = async (prompt, systemInstruction = '') => {
  try {
    const response = await apiClient.post('/ai/chat', {
      message: prompt,
      metadata: {
        systemInstruction: systemInstruction || undefined,
        proxyChannel: 'openai_legacy_adapter',
      },
    });

    const reply = response.data?.reply || response.data?.data?.reply || response.data?.text;
    if (reply) {
      return reply;
    }

    throw new Error('No response returned from backend AI gateway');
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message || 'AI service request failed';
    const status = err.response?.status || 500;
    
    const secureError = new Error(`[Secure AI Gateway] (${status}): ${errorMsg}`);
    secureError.status = status;
    secureError.code = err.response?.data?.code || 'AI_SERVICE_ERROR';
    throw secureError;
  }
};

export default { callOpenAIAPI };
