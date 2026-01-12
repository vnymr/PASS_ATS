/**
 * Template Chat AI - Gemini-powered template modification
 *
 * Allows users to modify their LaTeX resume template through natural language.
 * AI understands LaTeX structure and makes targeted modifications while
 * preserving template validity.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from './logger.js';

const TEMPLATE_MODIFICATION_PROMPT = `You are an expert LaTeX resume template designer. Your task is to modify a LaTeX resume template based on user requests.

CRITICAL RULES:
1. ONLY modify the LaTeX template structure, styling, and layout - NOT the content
2. ALWAYS preserve a valid LaTeX document structure:
   - Keep \\documentclass at the beginning
   - Keep all necessary \\usepackage declarations
   - Keep \\begin{document} and \\end{document}
   - Preserve all custom command definitions (\\newcommand)
3. Preserve placeholder markers like [NAME], [EMAIL], [PHONE], etc.
4. When modifying styles:
   - Adjust margins carefully (keep readable)
   - Adjust font sizes appropriately
   - Preserve section structure
5. If the user's request would break the template, explain why and suggest an alternative

COMMON MODIFICATIONS:
- Margins: Adjust \\addtolength{\\oddsidemargin}, \\addtolength{\\topmargin}, etc.
- Font size: Change \\documentclass option (10pt, 11pt, 12pt)
- Section spacing: Modify \\vspace values
- Header style: Modify the header block formatting
- Colors: Add \\usepackage{xcolor} if needed, use \\textcolor{}
- Icons: Ensure \\usepackage{fontawesome5} is present for icons

RESPONSE FORMAT:
You must respond with a JSON object containing:
{
  "latex": "The complete modified LaTeX template",
  "explanation": "A brief explanation of what was changed",
  "changes": ["List of specific changes made"]
}

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no additional text.`;

/**
 * Modify template based on user message using Gemini AI
 *
 * @param {Object} options
 * @param {string} options.currentLatex - Current LaTeX template
 * @param {string} options.userMessage - User's modification request
 * @param {number} options.userId - User ID for logging
 * @returns {Promise<{latex: string, explanation: string, changes: string[]}>}
 */
export async function modifyTemplateWithAI({ currentLatex, userMessage, userId }) {
  const startTime = Date.now();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for template chat');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.3, // Lower temperature for more consistent output
      maxOutputTokens: 16000,
    }
  });

  logger.info({ userId, messageLength: userMessage.length }, 'Processing template modification request');

  const userPrompt = `USER REQUEST: ${userMessage}

CURRENT TEMPLATE:
\`\`\`latex
${currentLatex}
\`\`\`

Modify the template based on the user's request. Remember to respond with ONLY a JSON object.`;

  try {
    const result = await model.generateContent([
      { text: TEMPLATE_MODIFICATION_PROMPT },
      { text: userPrompt }
    ]);

    const response = result.response.text();

    // Parse the JSON response
    let parsed;
    try {
      // Clean up potential markdown code blocks
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.slice(7);
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      cleanResponse = cleanResponse.trim();

      parsed = JSON.parse(cleanResponse);
    } catch (parseError) {
      logger.error({ error: parseError.message, response: response.substring(0, 500) }, 'Failed to parse AI response');
      throw new Error('AI response was not in expected format. Please try again.');
    }

    // Validate the response structure
    if (!parsed.latex) {
      throw new Error('AI response missing latex content');
    }

    // Basic validation of the modified template
    if (!parsed.latex.includes('\\documentclass')) {
      throw new Error('Modified template is missing \\documentclass');
    }
    if (!parsed.latex.includes('\\begin{document}')) {
      throw new Error('Modified template is missing \\begin{document}');
    }
    if (!parsed.latex.includes('\\end{document}')) {
      throw new Error('Modified template is missing \\end{document}');
    }

    const elapsed = Date.now() - startTime;
    logger.info({
      userId,
      elapsed,
      changesCount: parsed.changes?.length || 0
    }, 'Template modification completed');

    return {
      latex: parsed.latex,
      explanation: parsed.explanation || 'Template modified successfully',
      changes: parsed.changes || []
    };

  } catch (error) {
    logger.error({ error: error.message, userId }, 'Template modification failed');
    throw error;
  }
}

/**
 * Suggest template improvements based on target industry/role
 *
 * @param {Object} options
 * @param {string} options.currentLatex - Current LaTeX template
 * @param {string} options.targetIndustry - Target industry
 * @param {string} options.targetRole - Target role
 * @returns {Promise<{suggestions: string[], autoFixes: Object[]}>}
 */
export async function suggestTemplateImprovements({ currentLatex, targetIndustry, targetRole }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4000,
    }
  });

  const prompt = `Analyze this LaTeX resume template for someone targeting a ${targetRole} role in ${targetIndustry}.

TEMPLATE:
\`\`\`latex
${currentLatex}
\`\`\`

Provide suggestions for improving the template for this target. Focus on:
1. Appropriate formality/style for the industry
2. Space utilization
3. Visual hierarchy
4. ATS-friendliness

Respond with ONLY a JSON object:
{
  "suggestions": ["List of improvement suggestions"],
  "autoFixes": [
    {
      "description": "What this fix does",
      "find": "LaTeX code to find",
      "replace": "LaTeX code to replace with"
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON response
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7);
    }
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3);
    }

    const parsed = JSON.parse(cleanResponse.trim());

    return {
      suggestions: parsed.suggestions || [],
      autoFixes: parsed.autoFixes || []
    };

  } catch (error) {
    logger.error({ error: error.message }, 'Template suggestion failed');
    throw error;
  }
}

export default {
  modifyTemplateWithAI,
  suggestTemplateImprovements
};
