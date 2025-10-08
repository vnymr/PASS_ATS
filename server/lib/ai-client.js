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
    logger.info({ model, jsonMode }, 'Generating with Gemini');

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
  }

  /**
   * Generate with OpenAI
   * @private
   */
  async _generateWithOpenAI({ prompt, systemPrompt, model, temperature, maxTokens, jsonMode }) {
    logger.info({ model, jsonMode }, 'Generating with OpenAI');

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

    const requestParams = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

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
