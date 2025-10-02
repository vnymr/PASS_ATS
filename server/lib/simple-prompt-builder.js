/**
 * Simplified Prompt Builder - Send raw user data to LLM
 * Let the LLM extract and process everything
 * PROMPTS IMPORTED FROM enhanced-prompt-builder.js
 */

import { buildLatexSystemPrompt, buildLatexUserPrompt } from './enhanced-prompt-builder.js';

/**
 * Build the system prompt for LaTeX resume generation
 * NOTE: This now uses the enhanced prompt from enhanced-prompt-builder.js
 */
export function buildSimpleSystemPrompt() {
  return buildLatexSystemPrompt();
}

/**
 * Build the user prompt with raw data
 * NOTE: This now uses the enhanced prompt from enhanced-prompt-builder.js
 */
export function buildSimpleUserPrompt(userProfileData, jobDescription, options = {}) {
  return buildLatexUserPrompt(
    userProfileData,
    jobDescription,
    {}, // relevantContent - will be analyzed within the prompt
    options.targetJobTitle || ''
  );
}

/**
 * Simplified resume context builder
 */
export function buildSimpleResumeContext(userProfileData, jobDescription, options = {}) {
  // Just pass the raw data - let LLM do all the extraction
  return {
    systemPrompt: buildSimpleSystemPrompt(),
    userPrompt: buildSimpleUserPrompt(userProfileData, jobDescription, options),
    rawUserData: userProfileData,
    jobDescription: jobDescription
  };
}

export default {
  buildSimpleSystemPrompt,
  buildSimpleUserPrompt,
  buildSimpleResumeContext
};