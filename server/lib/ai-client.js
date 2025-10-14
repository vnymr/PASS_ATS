/**
 * Unified AI Client - Uses Gemini FIRST, OpenAI as fallback
 *
 * Benefits:
 * - Gemini Flash is 10x cheaper than GPT-4o-mini
 * - Gemini Flash is faster
 * - Auto-fallback to OpenAI if Gemini fails
 * - Single interface for all AI calls
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config, getAIModel } from './config.js';
import logger from './logger.js';

class AIClient {
  constructor() {
    // Initialize Gemini (primary)
    if (config.gemini.apiKey) {
      this.gemini = new GoogleGenerativeAI(config.gemini.apiKey);
      logger.info('Gemini AI initialized (PRIMARY)');
    } else {
      logger.warn('Gemini API key not found, will use OpenAI only');
    }

    // Initialize OpenAI (fallback)
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
      logger.info('OpenAI initialized (FALLBACK)');
    } else {
      logger.warn('OpenAI API key not found');
    }
  }

  /**
   * Generate text completion using Gemini FIRST, OpenAI as fallback
   *
   * @param {Object} params
   * @param {string} params.prompt - The prompt to send
   * @param {string} params.systemPrompt - System instructions
   * @param {string} params.aiMode - 'fast' or 'quality'
   * @param {number} params.temperature - Temperature (0-1)
   * @param {number} params.maxTokens - Max tokens to generate
   * @param {boolean} params.jsonMode - Return JSON response
   * @returns {Promise<string>} Generated text
   */
  async generateText({
    prompt,
    systemPrompt = '',
    aiMode = 'fast',
    temperature,
    maxTokens,
    jsonMode = false
  }) {
    const modelInfo = getAIModel(aiMode);

    try {
      if (modelInfo.provider === 'gemini' && this.gemini) {
        return await this._generateWithGemini({
          prompt,
          systemPrompt,
          model: modelInfo.model,
          temperature: temperature || config.gemini.temperature,
          maxTokens: maxTokens || config.gemini.maxTokens,
          jsonMode
        });
      } else if (this.openai) {
        return await this._generateWithOpenAI({
          prompt,
          systemPrompt,
          model: modelInfo.model,
          temperature: temperature || config.openai.temperature,
          maxTokens: maxTokens || config.openai.maxTokens,
          jsonMode
        });
      } else {
        throw new Error('No AI provider available');
      }
    } catch (error) {
      // Fallback to OpenAI if Gemini fails
      if (modelInfo.provider === 'gemini' && this.openai) {
        logger.warn({ error: error.message }, 'Gemini failed, falling back to OpenAI');

        const fallbackModel = getAIModel(aiMode);
        return await this._generateWithOpenAI({
          prompt,
          systemPrompt,
          model: config.openai.textModels[aiMode] || config.openai.textModels.default,
          temperature: temperature || config.openai.temperature,
          maxTokens: maxTokens || config.openai.maxTokens,
          jsonMode
        });
      }

      throw error;
    }
  }

  /**
   * Generate with Gemini
   * @private
   */
  async _generateWithGemini({ prompt, systemPrompt, model, temperature, maxTokens, jsonMode }) {
    logger.info({ model, jsonMode, maxTokens }, 'Generating with Gemini');

    try {
      const geminiModel = this.gemini.getGenerativeModel({
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(jsonMode && { responseMimeType: 'application/json' })
        },
        systemInstruction: systemPrompt || undefined
      });

      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      logger.info({
        model,
        inputLength: prompt.length,
        outputLength: text.length
      }, 'Gemini generation complete');

      return text;
    } catch (error) {
      // Log detailed error information
      logger.error({
        error: error.message,
        errorCode: error.code,
        errorStatus: error.status,
        errorDetails: error.details || error.errorDetails,
        stack: error.stack,
        model,
        promptLength: prompt.length
      }, 'Gemini API error - detailed diagnostics');

      // Re-throw with more context
      const enhancedError = new Error(`Gemini API failed: ${error.message} (code: ${error.code || 'unknown'})`);
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }

  /**
   * Generate with OpenAI
   * @private
   */
  async _generateWithOpenAI({ prompt, systemPrompt, model, temperature, maxTokens, jsonMode }) {
    logger.info({ model, jsonMode, temperature }, 'Generating with OpenAI');

    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    // Build request params - only include temperature if it's the default (1.0)
    // or if we know the model supports custom temperature
    const requestParams = {
      model,
      messages,
      max_completion_tokens: maxTokens, // Updated from max_tokens for GPT-4o compatibility
    };

    // Only include temperature for models that support it
    // GPT-5 models require temperature = 1.0 (default)
    if (!model.startsWith('gpt-5') || temperature === 1.0) {
      requestParams.temperature = temperature;
    } else {
      // Log if we're skipping temperature for GPT-5
      logger.info({ model, requestedTemp: temperature }, 'Skipping temperature (GPT-5 only supports default)');
    }

    if (jsonMode) {
      requestParams.response_format = { type: 'json_object' };
    }

    const response = await this.openai.chat.completions.create(requestParams);
    const text = response.choices[0].message.content;

    logger.info({
      model,
      inputLength: prompt.length,
      outputLength: text.length
    }, 'OpenAI generation complete');

    return text;
  }
}

// Export singleton instance
export const aiClient = new AIClient();
export default aiClient;
