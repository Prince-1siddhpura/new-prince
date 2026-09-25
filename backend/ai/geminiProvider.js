/**
 * Sage AI — Google Gemini Provider (backend/ai/geminiProvider.js)
 * 
 * Powered by Google Gemini via @google/generative-ai
 * 
 * Features:
 * - Real streaming generation (SSE / chunk callback)
 * - Structured JSON generation with strict validation and single-attempt retry
 * - Authentic multimodal document / image inspection
 * - Multi-model resilience pool with automatic failover on 503/429 spikes
 * - Genuine error handling with explicit service-unavailable states
 * - ZERO simulated AI responses in production logic
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    this.isRealKey = Boolean(
      this.apiKey &&
      this.apiKey !== 'your_gemini_api_key_here' &&
      !this.apiKey.includes('your_') &&
      this.apiKey.trim().length > 10
    );

    this.genAI = this.isRealKey ? new GoogleGenerativeAI(this.apiKey) : null;

    // Ordered pool of genuine fast candidate models for resilient failover
    this.candidateModels = Array.from(new Set([
      process.env.GEMINI_MODEL,
      'gemini-3-flash-preview',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.8-flash',
    ].filter(Boolean)));
  }

  /**
   * Check if Gemini API is properly configured
   */
  isConfigured() {
    return Boolean(this.genAI && this.isRealKey);
  }

  /**
   * Get an instance of the generative model with optional system instructions
   */
  _getModel(modelName = this.modelName, systemInstruction = '', generationConfig = {}) {
    if (!this.genAI) {
      const error = new Error('AI service is not configured on the backend');
      error.status = 503;
      error.code = 'AI_NOT_CONFIGURED';
      throw error;
    }

    return this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: 0.3,
        ...generationConfig,
      },
    });
  }

  /**
   * Normalize and classify external AI API errors
   */
  _normalizeError(err, context = 'AI operation') {
    const rawMsg = err.message || '';
    const errStatus = err.status || 500;

    const error = new Error();

    if (rawMsg.includes('503') || rawMsg.includes('Service Unavailable') || rawMsg.includes('high demand') || rawMsg.includes('overloaded')) {
      error.status = 503;
      error.code = 'AI_SERVICE_UNAVAILABLE';
      error.message = 'The AI tutoring service is currently experiencing high demand. Please try again in a few moments.';
    } else if (rawMsg.includes('429') || rawMsg.includes('ResourceExhausted') || rawMsg.includes('quota') || rawMsg.includes('rate limit')) {
      error.status = 429;
      error.code = 'AI_RATE_LIMIT_EXCEEDED';
      error.message = 'AI rate limit exceeded. Please wait a moment before sending another message.';
    } else if (rawMsg.includes('404') || rawMsg.includes('not found') || rawMsg.includes('no longer available')) {
      error.status = 503;
      error.code = 'AI_MODEL_NOT_FOUND';
      error.message = `The requested AI model (${this.modelName}) is currently not available. Please verify model configuration.`;
    } else if (rawMsg.includes('401') || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('unauthorized')) {
      error.status = 503;
      error.code = 'AI_AUTH_ERROR';
      error.message = 'AI API key authorization failed. Please verify the server GEMINI_API_KEY.';
    } else {
      error.status = errStatus >= 400 && errStatus < 600 ? errStatus : 503;
      error.code = 'AI_SERVICE_ERROR';
      error.message = `Sage AI encountered an unexpected error during ${context}: ${rawMsg}`;
    }

    error.originalError = err;
    return error;
  }

  /**
   * Helper to execute a promise with a timeout (default 25s)
   */
  _withTimeout(promise, timeoutMs = 25000, operationName = 'AI request') {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          const timeoutErr = new Error(`${operationName} timed out after ${timeoutMs / 1000}s`);
          timeoutErr.status = 504;
          timeoutErr.code = 'AI_TIMEOUT';
          reject(timeoutErr);
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Streaming response generator for Socratic tutoring with automatic model failover
   */
  async generateStream({ systemInstruction, history = [], message, onChunk = () => { } }) {
    if (!message || !message.trim()) {
      const err = new Error('Message is required');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!this.isConfigured()) {
      const err = new Error('Sage AI service is not configured. Please supply a valid GEMINI_API_KEY in the backend environment.');
      err.status = 503;
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }

    const formattedHistory = history.map((item) => ({
      role: item.role === 'assistant' ? 'model' : item.role,
      parts: Array.isArray(item.parts)
        ? item.parts
        : [{ text: typeof item.parts === 'string' ? item.parts : item.content || '' }],
    }));

    let lastError = null;

    // Resilient iteration through genuine fast candidate models
    for (let i = 0; i < this.candidateModels.length; i++) {
      const currentModelName = this.candidateModels[i];

      try {
        const model = this._getModel(currentModelName, systemInstruction);
        const chat = model.startChat({ history: formattedHistory });
        
        const streamCall = async () => {
          const result = await chat.sendMessageStream(message);
          let fullText = '';
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullText += chunkText;
            onChunk(chunkText);
          }
          return fullText;
        };

        const fullText = await this._withTimeout(streamCall(), 30000, `Streaming chat (${currentModelName})`);
        this.modelName = currentModelName; // Promote responsive model
        return { fullText, model: currentModelName };
      } catch (err) {
        lastError = err;
        const isDemandSpike = err.status === 503 || err.status === 429 || err.status === 404 ||
          err.message?.includes('503') || err.message?.includes('high demand') || err.message?.includes('429') || err.message?.includes('not found');

        if (isDemandSpike && i < this.candidateModels.length - 1) {
          console.warn(`[Gemini Failover] Model ${currentModelName} unavailable (${err.status || err.message}). Failing over to ${this.candidateModels[i + 1]}...`);
          continue;
        }

        break;
      }
    }

    throw this._normalizeError(lastError, 'Socratic chat streaming');
  }

  /**
   * Structured JSON generation with automatic model failover and single retry
   */
  async generateStructuredJson({ prompt, systemInstruction }) {
    if (!prompt) {
      const err = new Error('Prompt is required');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!this.isConfigured()) {
      const err = new Error('Sage AI service is not configured. Please configure GEMINI_API_KEY on the server.');
      err.status = 503;
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }

    let lastError = null;

    for (let i = 0; i < this.candidateModels.length; i++) {
      const currentModelName = this.candidateModels[i];

      try {
        const model = this._getModel(currentModelName, systemInstruction, {
          responseMimeType: 'application/json',
        });

        const call = async () => {
          const result = await model.generateContent(prompt);
          const response = await result.response;
          return this._parseJsonSafely(response.text());
        };

        const parsed = await this._withTimeout(call(), 25000, `Structured JSON (${currentModelName})`);
        this.modelName = currentModelName;
        return parsed;
      } catch (err) {
        lastError = err;
        const isDemandSpike = err.status === 503 || err.status === 429 || err.status === 404 ||
          err.message?.includes('503') || err.message?.includes('high demand') || err.message?.includes('429') || err.message?.includes('not found');

        if (isDemandSpike && i < this.candidateModels.length - 1) {
          console.warn(`[Gemini JSON Failover] ${currentModelName} unavailable. Failing over to ${this.candidateModels[i + 1]}...`);
          continue;
        }

        // Single-attempt retry on format failure if not a demand spike
        if (!isDemandSpike) {
          try {
            const retryPrompt = `${prompt}\n\nIMPORTANT: Previous attempt failed to parse as valid JSON. Return ONLY RFC-8259 JSON without markdown fences.`;
            const model = this._getModel(currentModelName, systemInstruction, {
              responseMimeType: 'application/json',
            });

            const retryCall = async () => {
              const retryResult = await model.generateContent(retryPrompt);
              const retryResponse = await retryResult.response;
              return this._parseJsonSafely(retryResponse.text());
            };

            return await this._withTimeout(retryCall(), 25000, `Structured JSON Retry (${currentModelName})`);
          } catch (retryErr) {
            lastError = retryErr;
          }
        }

        break;
      }
    }

    throw this._normalizeError(lastError, 'Structured JSON generation');
  }

  /**
   * Standard single-turn chat completion
   */
  async generateChatReply({ systemInstruction, history = [], message }) {
    let fullReply = '';
    await this.generateStream({
      systemInstruction,
      history,
      message,
      onChunk: (chunk) => {
        fullReply += chunk;
      },
    });
    return fullReply;
  }

  /**
   * Multimodal document or image analysis using genuine Gemini Vision API
   */
  async analyzeMultimodalContent({ buffer, mimeType, prompt = 'Analyze this educational material and extract key learning concepts.' }) {
    if (!this.isConfigured()) {
      const err = new Error('Multimodal AI analysis is not configured on this server.');
      err.status = 503;
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }

    if (!buffer || !Buffer.isBuffer(buffer)) {
      const err = new Error('Valid file buffer is required for multimodal analysis.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    let lastError = null;

    for (let i = 0; i < this.candidateModels.length; i++) {
      const currentModelName = this.candidateModels[i];

      try {
        const model = this._getModel(currentModelName, 'You are an expert educational document and visual diagram analyzer for EduNova.');
        
        const imagePart = {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType,
          },
        };

        const call = async () => {
          const result = await model.generateContent([prompt, imagePart]);
          const response = await result.response;
          return response.text();
        };

        const analysisText = await this._withTimeout(call(), 30000, `Multimodal analysis (${currentModelName})`);
        this.modelName = currentModelName;
        return {
          analysis: analysisText.trim(),
          model: currentModelName,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        lastError = err;
        const isDemandSpike = err.status === 503 || err.status === 429 || err.status === 404 ||
          err.message?.includes('503') || err.message?.includes('high demand') || err.message?.includes('429');

        if (isDemandSpike && i < this.candidateModels.length - 1) {
          console.warn(`[Gemini Multimodal Failover] ${currentModelName} unavailable. Failing over to ${this.candidateModels[i + 1]}...`);
          continue;
        }

        break;
      }
    }

    throw this._normalizeError(lastError, 'Multimodal document/image analysis');
  }

  /**
   * Extracts and parses JSON from raw LLM text
   */
  _parseJsonSafely(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Empty response from model');
    }

    let clean = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
    const firstCurly = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    
    if (firstBracket !== -1 && (firstCurly === -1 || firstBracket < firstCurly)) {
      const lastBracket = clean.lastIndexOf(']');
      if (lastBracket !== -1) {
        clean = clean.substring(firstBracket, lastBracket + 1);
      }
    } else if (firstCurly !== -1) {
      const lastCurly = clean.lastIndexOf('}');
      if (lastCurly !== -1) {
        clean = clean.substring(firstCurly, lastCurly + 1);
      }
    }

    clean = clean.replace(/,\s*([\]}])/g, '$1').trim();
    return JSON.parse(clean);
  }
}

module.exports = new GeminiProvider();
