/**
 * Gemini-Powered Resume Generator
 *
 * AI-native resume generation using Google Gemini 2.5 Flash
 * with optional Google Search grounding for company-specific optimization.
 *
 * This is a simplified, "mega-prompt" approach that lets the LLM handle
 * all data extraction, skill matching, and LaTeX generation in one pass.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { compileLatex } from './latex-compiler.js';
import {
  RESUME_SYSTEM_PROMPT,
  buildUserPrompt,
  buildCompanyResearchPrompt,
  extractCompanyName,
  extractJobTitle
} from './resume-prompts.js';
import logger from './logger.js';

// Initialize Gemini client
let genAI = null;

function initializeGemini() {
  if (genAI) return genAI;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  genAI = new GoogleGenerativeAI(apiKey);
  logger.info('Gemini Resume Generator initialized');
  return genAI;
}


/**
 * Research company using Google Search grounding
 * @param {string} companyName - Name of the company
 * @param {string} jobTitle - Job title being applied for
 * @returns {Promise<string|null>} Company insights or null if search fails/disabled
 */
async function researchCompany(companyName, jobTitle) {
  if (!companyName) return null;

  try {
    const client = initializeGemini();

    // Use Gemini with Google Search grounding
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    },
    {
      // Enable Google Search grounding
      tools: [{ googleSearch: {} }]
    });

    const researchPrompt = buildCompanyResearchPrompt(companyName, jobTitle);

    logger.info({ company: companyName, jobTitle }, 'Researching company with Google Search');

    const result = await model.generateContent(researchPrompt);
    const response = await result.response;
    const insights = response.text();

    // Check if grounding was used
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.searchEntryPoint) {
      logger.info({
        company: companyName,
        sourcesCount: groundingMetadata.groundingChunks?.length || 0
      }, 'Company research completed with grounding');
    }

    return insights;
  } catch (error) {
    logger.warn({
      error: error.message,
      company: companyName
    }, 'Company research failed, proceeding without insights');
    return null;
  }
}


/**
 * Generate LaTeX resume using Gemini
 * @param {Object} profileData - User profile data (raw JSON)
 * @param {string} jobDescription - Target job description
 * @param {Object} options - Generation options
 * @returns {Promise<{latex: string, metadata: Object}>}
 */
async function generateResume(profileData, jobDescription, options = {}) {
  const startTime = Date.now();

  try {
    const client = initializeGemini();

    // Extract company name for potential research
    const companyName = extractCompanyName(jobDescription);
    const jobTitle = extractJobTitle(jobDescription);

    logger.info({
      company: companyName,
      jobTitle,
      enableSearch: options.enableSearch !== false,
      profileSize: JSON.stringify(profileData).length
    }, 'Starting Gemini resume generation');

    // Research company if search is enabled (default: true)
    let companyInsights = null;
    if (options.enableSearch !== false && companyName) {
      companyInsights = await researchCompany(companyName, jobTitle);
    }

    // Build the user prompt with profile and job
    const userPrompt = buildUserPrompt(profileData, jobDescription, companyInsights);

    // Configure the model with system instruction
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: RESUME_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8000,
        topP: 0.9,
      }
    });

    // Generate the resume
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    let latex = response.text();

    // Clean the output
    latex = cleanLatex(latex);

    // Validate the LaTeX structure
    validateLatex(latex);

    const generationTime = Date.now() - startTime;

    logger.info({
      generationTime,
      latexLength: latex.length,
      company: companyName,
      hasCompanyInsights: !!companyInsights
    }, 'Resume generation completed');

    return {
      latex,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        generationTime,
        company: companyName,
        jobTitle,
        usedCompanyResearch: !!companyInsights,
        approach: 'gemini-mega-prompt'
      }
    };

  } catch (error) {
    logger.error({ error: error.message }, 'Resume generation failed');
    throw new Error(`Resume generation failed: ${error.message}`);
  }
}


/**
 * Generate and compile resume to PDF
 * MAINTAINS BACKWARD COMPATIBILITY with existing API
 *
 * @param {Object} userData - User profile data
 * @param {string} jobDescription - Target job description
 * @param {Object} options - Generation options
 * @returns {Promise<{latex: string, pdf: Buffer, metadata: Object}>}
 */
async function generateAndCompile(userData, jobDescription, options = {}) {
  // Generate the LaTeX
  let { latex, metadata } = await generateResume(userData, jobDescription, options);

  // Compile to PDF using existing compiler
  let pdf = null;
  let compilationAttempts = 0;
  const MAX_COMPILE_ATTEMPTS = 2;

  while (compilationAttempts < MAX_COMPILE_ATTEMPTS) {
    try {
      compilationAttempts++;
      pdf = await compileLatex(latex);
      logger.info('PDF compilation successful');
      break;
    } catch (compileError) {
      logger.warn({
        error: compileError.message,
        attempt: compilationAttempts
      }, 'PDF compilation failed');

      if (compilationAttempts >= MAX_COMPILE_ATTEMPTS) {
        throw new Error(`PDF compilation failed after ${MAX_COMPILE_ATTEMPTS} attempts: ${compileError.message}`);
      }

      // Try to fix LaTeX errors with Gemini
      try {
        const fixedLatex = await fixLatexErrors(latex, compileError.message);
        // Update latex to use the fixed version for return
        latex = fixedLatex;
        Object.assign(metadata, { latexFixed: true });
        pdf = await compileLatex(latex);
        logger.info('PDF compilation successful after fix');
        break;
      } catch (fixError) {
        logger.error({ error: fixError.message }, 'Failed to fix LaTeX');
      }
    }
  }

  if (!pdf) {
    throw new Error('Failed to compile PDF');
  }

  return {
    latex,
    pdf,
    metadata
  };
}


/**
 * Fix LaTeX errors using Gemini
 */
async function fixLatexErrors(brokenLatex, errorMessage) {
  const client = initializeGemini();

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8000,
    }
  });

  const fixPrompt = `Fix this LaTeX compilation error. Return ONLY the fixed LaTeX code.

ERROR:
${errorMessage.substring(0, 500)}

COMMON FIXES:
- Escape special chars: & → \\&, % → \\%, # → \\#, _ → \\_
- Close all environments: \\begin{X} needs \\end{X}
- \\item must be inside itemize/enumerate
- No unicode characters (use ASCII only)

LATEX TO FIX:
${brokenLatex}

Return the complete fixed LaTeX from \\documentclass to \\end{document}:`;

  const result = await model.generateContent(fixPrompt);
  const response = await result.response;
  let fixedLatex = response.text();

  // Clean and validate
  fixedLatex = cleanLatex(fixedLatex);
  validateLatex(fixedLatex);

  return fixedLatex;
}


/**
 * Clean LaTeX output from Gemini
 */
function cleanLatex(latex) {
  // Remove markdown code blocks
  let cleaned = latex
    .replace(/^```latex?\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .replace(/^```.*$/gm, '');

  // Ensure no unicode bullets or arrows
  cleaned = cleaned
    .replace(/•/g, '')
    .replace(/→/g, ' to ')
    .replace(/—/g, '--')
    .replace(/–/g, '--')
    .replace(/"/g, "''")
    .replace(/"/g, "``")
    .replace(/'/g, "'")
    .replace(/'/g, "'");

  // CRITICAL: Escape unescaped special characters
  // Only escape & that's not already escaped (not preceded by \)
  cleaned = cleaned.replace(/(?<!\\)&/g, '\\&');

  // Escape unescaped % (but not in comments which start with %)
  // Only escape % in the middle of lines, not at the start
  cleaned = cleaned.split('\n').map(line => {
    if (line.trim().startsWith('%')) return line; // Skip comment lines
    return line.replace(/(?<!\\)%/g, '\\%');
  }).join('\n');

  // Escape unescaped # (but not in \#)
  cleaned = cleaned.replace(/(?<!\\)#(?!\d)/g, '\\#');

  return cleaned.trim();
}


/**
 * Validate LaTeX structure
 */
function validateLatex(latex) {
  if (!latex.includes('\\documentclass')) {
    throw new Error('Invalid LaTeX: missing \\documentclass');
  }

  if (!latex.includes('\\begin{document}')) {
    throw new Error('Invalid LaTeX: missing \\begin{document}');
  }

  if (!latex.includes('\\end{document}')) {
    throw new Error('Invalid LaTeX: missing \\end{document}');
  }

  // Check balanced braces
  const openBraces = (latex.match(/{/g) || []).length;
  const closeBraces = (latex.match(/}/g) || []).length;

  if (Math.abs(openBraces - closeBraces) > 5) {
    logger.warn({
      open: openBraces,
      close: closeBraces
    }, 'Severely unbalanced braces in LaTeX');
  }

  return true;
}


/**
 * Regenerate a specific section of the resume
 */
async function regenerateSection(currentLatex, sectionName, userData, jobDescription) {
  const client = initializeGemini();

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
    }
  });

  const prompt = `Regenerate ONLY the ${sectionName} section of this LaTeX resume to better match the job.

JOB DESCRIPTION:
${jobDescription}

USER DATA FOR ${sectionName.toUpperCase()}:
${JSON.stringify(userData, null, 2)}

CURRENT LATEX:
${currentLatex}

Return ONLY the LaTeX code for the ${sectionName} section (from \\section{${sectionName}} to the next \\section or \\end{document}).`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return cleanLatex(response.text());
}


/**
 * Check if Gemini is available
 */
function isAvailable() {
  try {
    initializeGemini();
    return true;
  } catch {
    return false;
  }
}


// Export class-like interface for backward compatibility
class GeminiResumeGenerator {
  constructor(apiKey = null) {
    if (apiKey) {
      process.env.GEMINI_API_KEY = apiKey;
    }
    initializeGemini();
  }

  async generateResume(userData, jobDescription, options = {}) {
    return generateResume(userData, jobDescription, options);
  }

  async generateAndCompile(userData, jobDescription, options = {}) {
    return generateAndCompile(userData, jobDescription, options);
  }

  async regenerateSection(currentLatex, sectionName, userData, jobDescription) {
    return regenerateSection(currentLatex, sectionName, userData, jobDescription);
  }

  async compileResume(latexCode) {
    return compileLatex(latexCode);
  }
}


export {
  GeminiResumeGenerator,
  generateResume,
  generateAndCompile,
  regenerateSection,
  researchCompany,
  isAvailable
};

export default GeminiResumeGenerator;
