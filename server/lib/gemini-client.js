/**
 * Google Gemini API Client for Resume Generation
 * Using Gemini 2.5 Flash for fast LaTeX generation
 * Production-ready implementation with error handling and logging
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import pino from 'pino';

// Initialize logger
const logger = pino({
  name: 'gemini-client',
  level: process.env.LOG_LEVEL || 'info'
});

// Initialize Gemini AI client with error handling
let genAI = null;
let isInitialized = false;

function initializeGemini() {
  if (isInitialized) return;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY is not configured, Gemini client will not be available');
      return;
    }
    genAI = new GoogleGenerativeAI(apiKey);
    isInitialized = true;
    logger.info('Gemini AI client initialized successfully');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize Gemini AI client');
    genAI = null;
  }
}

// Initialize on first import
initializeGemini();

/**
 * Generate LaTeX resume using Gemini 2.5 Flash
 * @param {string} systemPrompt - System prompt for LaTeX generation
 * @param {string} userPrompt - User prompt with job description and profile
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<{latex: string, generationTime: number, usage: object, model: string}>}
 */
export async function generateLatexWithGemini(systemPrompt, userPrompt, onProgress = null) {
  // Ensure client is initialized
  if (!genAI) {
    initializeGemini();
    if (!genAI) {
      throw new Error('Gemini AI client is not available. Check GEMINI_API_KEY configuration.');
    }
  }

  const startTime = Date.now();
  const MAX_RETRIES = 2;
  let lastError = null;

  // Retry loop for transient failures
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

  try {
    // Progress callback for starting
    if (onProgress) {
      onProgress({ type: 'generating', progress: 10, message: 'Starting Gemini generation...' });
    }

    // Get the Gemini 2.5 Flash model - optimized for speed
    // Using systemInstruction for the large LaTeX template (automatically cached by Gemini)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt, // Gemini automatically caches system instructions
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent LaTeX generation
        maxOutputTokens: 12000, // CRITICAL: High token limit to prevent incomplete LaTeX (fixes truncation issue)
        topP: 0.9, // More focused generation
        candidateCount: 1,
        stopSequences: [], // Don't stop early
      }
    });

    // Use only user prompt since system instruction is separate
    const fullPrompt = userPrompt;

    logger.debug({
      promptLength: fullPrompt.length,
      model: 'gemini-2.5-flash'
    }, 'Starting Gemini generation');

    // Generate content with timeout (120 seconds max)
    const GENERATION_TIMEOUT = 120000;
    const result = await Promise.race([
      model.generateContent(fullPrompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini generation timeout after 120s')), GENERATION_TIMEOUT)
      )
    ]);
    const response = await result.response;
    let latex = response.text();

    // Progress callback for completion
    if (onProgress) {
      onProgress({ type: 'generating', progress: 90, message: 'Generation complete, processing...' });
    }

    // Clean markdown code blocks
    latex = latex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '').replace(/^```.*$/gm, '');

    // Post-process to fix common LaTeX issues
    // 1. Ensure special characters are escaped outside of LaTeX commands
    const lines = latex.split('\n');
    const processedLines = lines.map(line => {
      // Skip lines that are LaTeX commands (start with \ or are comments)
      if (line.trim().startsWith('\\') || line.trim().startsWith('%')) {
        return line;
      }

      // For text content, ensure proper escaping
      // But don't escape inside LaTeX commands
      if (!line.includes('\\begin') && !line.includes('\\end') &&
          !line.includes('\\item') && !line.includes('\\section')) {
        // Only escape if not already escaped
        line = line.replace(/(?<!\\)&/g, '\\&');
        line = line.replace(/(?<!\\)%/g, '\\%');
        line = line.replace(/(?<!\\)\$/g, '\\$');
        line = line.replace(/(?<!\\)#/g, '\\#');
      }
      return line;
    });
    latex = processedLines.join('\n');

    // 2. Validate structure
    if (!latex.includes('\\documentclass')) {
      logger.error('Generated LaTeX missing document class - output truncated!');
      throw new Error('Incomplete LaTeX generation - missing document class');
    }
    if (!latex.includes('\\begin{document}')) {
      logger.error('Generated LaTeX missing \\begin{document}');
      throw new Error('Incomplete LaTeX generation - missing begin document');
    }
    if (!latex.includes('\\end{document}')) {
      logger.warn('Generated LaTeX missing \\end{document} - adding it');
      latex = latex.trim() + '\n\\end{document}';
    }

    // 3. Ensure all \item commands are within itemize environments
    // Count \item occurrences outside of proper environments
    const itemMatches = latex.match(/\\item(?![ize])/g) || [];
    const itemizeBegin = (latex.match(/\\begin\{itemize\}/g) || []).length;
    const itemizeEnd = (latex.match(/\\end\{itemize\}/g) || []).length;

    if (itemizeBegin !== itemizeEnd) {
      logger.warn('Mismatched itemize environments - fixing');
      // Ensure all itemize blocks are properly closed
      const difference = itemizeBegin - itemizeEnd;
      if (difference > 0) {
        // Add missing \end{itemize} before \end{document}
        latex = latex.replace(/\\end\{document\}/, '\\end{itemize}'.repeat(difference) + '\n\\end{document}');
      }
    }

    const generationTime = Date.now() - startTime;

    // Calculate approximate token usage (Gemini doesn't provide exact counts in SDK)
    const promptTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const completionTokens = Math.ceil(latex.length / 4);

    const usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };

    logger.info({
      generationTime,
      ...usage,
      latexLength: latex.length
    }, 'Gemini generation completed successfully');

    return {
      latex,
      generationTime,
      usage,
      model: 'gemini-2.5-flash'
    };
  } catch (error) {
    lastError = error;

    const errorDetails = {
      error: error.message,
      code: error.code,
      status: error.status,
      attempt: attempt,
      maxRetries: MAX_RETRIES,
      timeElapsed: Date.now() - startTime
    };

    // Check if it's a retryable error (rate limits, transient issues)
    const isRetryable = error.code === 429 || // Rate limit
                        error.code === 503 || // Service unavailable
                        error.status === 429 ||
                        error.status === 503 ||
                        error.message?.includes('quota') ||
                        error.message?.includes('temporarily unavailable');

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
      logger.warn({ ...errorDetails, retryDelay: delay }, `Gemini API error - retrying in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      continue; // Retry
    }

    logger.error(errorDetails, 'Gemini generation failed');
    break; // Non-retryable error or max retries reached
  }
  }

  // If we get here, all retries failed
  if (lastError) {
    const errorMessage = lastError.message || 'Unknown Gemini API error';
    throw new Error(`Gemini API error after ${MAX_RETRIES} attempts: ${errorMessage}`);
  }
}

/**
 * Fix LaTeX errors using Gemini
 * @param {string} brokenLatex - LaTeX code with errors
 * @param {string} errorMessage - Compilation error message
 * @returns {Promise<string>} - Fixed LaTeX code
 */
export async function fixLatexWithGemini(brokenLatex, errorMessage) {
  if (!genAI) {
    initializeGemini();
    if (!genAI) {
      throw new Error('Gemini AI client is not available');
    }
  }

  const startTime = Date.now();

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3, // Lower temperature for fixing
        maxOutputTokens: 12000, // High token limit for complete fixes
      }
    });

    const prompt = `You are a LaTeX expert. Fix the LaTeX compilation error and return ONLY valid LaTeX code.

COMMON LaTeX ERRORS AND FIXES:
1. "Undefined control sequence" - a command doesn't exist. Remove it or replace with valid command.
2. "Lonely \\item" - \\item used outside list. Wrap items in \\begin{itemize}...\\end{itemize}
3. Special characters not escaped:
   - & → \\&  (in text like "Sales & Marketing")
   - % → \\%  (in percentages like "30%")
   - $ → \\$  (in amounts like "$100K")
   - # → \\#  (in text like "#1")
   - _ → \\_  (in text like "user_data")

Error Message:
${errorMessage}

LaTeX Code to Fix:
${brokenLatex}

RULES FOR FIXING:
1. Return COMPLETE fixed LaTeX from \\documentclass to \\end{document}
2. Fix ALL instances of the error, not just the first one
3. Preserve all content - do not remove sections
4. Ensure proper structure with all environments closed
5. Return ONLY LaTeX code, no explanations or markdown

Fixed LaTeX code:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let fixedLatex = response.text();

    // Clean any markdown code blocks
    fixedLatex = fixedLatex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '').replace(/^```.*$/gm, '');

    logger.info({
      fixTime: Date.now() - startTime
    }, 'LaTeX errors fixed successfully with Gemini');

    return fixedLatex;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fix LaTeX with Gemini');
    throw error;
  }
}

/**
 * Generate simple JSON response using Gemini (for keyword extraction, job info, etc.)
 * @param {string} prompt - The prompt requesting JSON output
 * @returns {Promise<string>} JSON string response
 */
export async function generateSimpleJsonWithGemini(prompt) {
  if (!genAI) {
    throw new Error('Gemini client not initialized');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Calculate cost for Gemini 2.5 Flash
 * Pricing: $0.30 per 1M input tokens, $2.50 per 1M output tokens
 */
export function calculateGeminiCost(usage) {
  const inputCost = (usage.prompt_tokens / 1_000_000) * 0.30;
  const outputCost = (usage.completion_tokens / 1_000_000) * 2.50;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  };
}

/**
 * Check if Gemini client is available
 */
export function isGeminiAvailable() {
  return genAI !== null;
}

export default {
  generateLatexWithGemini,
  fixLatexWithGemini,
  generateSimpleJsonWithGemini,
  calculateGeminiCost,
  isGeminiAvailable
};