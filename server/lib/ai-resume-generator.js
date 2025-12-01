/**
 * AI Resume Generator - Gemini 2.5 Flash Implementation
 *
 * Migrated from OpenAI to Google Gemini for improved speed and cost efficiency.
 * Includes "Spotlight Strategy" for handling large profiles (10-20+ experiences).
 * Supports Google Search grounding for company-specific optimization.
 *
 * BACKWARD COMPATIBLE: Class name and method signatures remain unchanged.
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

class AIResumeGenerator {
  /**
   * Constructor - maintains backward compatibility
   * @param {string} apiKey - Originally OpenAI key, now accepts Gemini key or uses env
   */
  constructor(apiKey) {
    // Prefer GEMINI_API_KEY from environment, fall back to passed key
    const key = process.env.GEMINI_API_KEY || apiKey;

    if (!key) {
      throw new Error('GEMINI_API_KEY is required. Set it in environment variables.');
    }

    // Log if OpenAI key was passed (for migration awareness)
    if (apiKey && apiKey.startsWith('sk-')) {
      logger.warn('OpenAI API key detected. This generator now uses Gemini. Please update to GEMINI_API_KEY.');
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = 'gemini-2.5-flash';
    logger.info('AIResumeGenerator initialized with Gemini 2.5 Flash');
  }

  /**
   * Main generation method - BACKWARD COMPATIBLE SIGNATURE
   * @param {Object} userData - User profile data
   * @param {string} jobDescription - Target job description
   * @param {Object} options - Generation options
   * @returns {Promise<{latex: string, pdf: Buffer, metadata: Object}>}
   */
  async generateAndCompile(userData, jobDescription, options = {}) {
    const startTime = Date.now();

    logger.info({
      profileSize: JSON.stringify(userData).length,
      enableSearch: options.enableSearch !== false
    }, '🚀 Starting Gemini Resume Generation');

    try {
      // Phase 1: Company Research (optional but recommended)
      let companyInsights = null;
      const companyName = extractCompanyName(jobDescription);
      const jobTitle = extractJobTitle(jobDescription);

      if (companyName && options.enableSearch !== false) {
        companyInsights = await this.researchCompany(companyName, jobTitle);
      }

      // Phase 2: Generate LaTeX
      const latex = await this.generateLatex(userData, jobDescription, companyInsights);

      // Phase 3: Compile to PDF
      logger.info('⚙️ Compiling PDF...');
      let pdf;
      try {
        pdf = await compileLatex(latex);
        logger.info('✅ PDF compiled successfully');
      } catch (compileError) {
        logger.warn({ error: compileError.message }, 'First compilation failed, attempting fix...');

        // Try to fix LaTeX errors
        const fixedLatex = await this.fixLatexErrors(latex, compileError.message);
        pdf = await compileLatex(fixedLatex);
        logger.info('✅ PDF compiled after fix');
      }

      const totalTime = Date.now() - startTime;

      logger.info({
        totalTime,
        company: companyName,
        usedResearch: !!companyInsights
      }, `✅ Resume generated in ${(totalTime / 1000).toFixed(2)}s`);

      return {
        latex,
        pdf,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: this.model,
          generationTime: totalTime,
          company: companyName,
          jobTitle,
          usedCompanyResearch: !!companyInsights,
          approach: 'gemini-spotlight-strategy'
        }
      };

    } catch (error) {
      logger.error({ error: error.message }, '❌ Resume generation failed');
      throw new Error(`Resume generation failed: ${error.message}`);
    }
  }

  /**
   * Research company using Google Search grounding
   */
  async researchCompany(companyName, jobTitle) {
    try {
      logger.info({ company: companyName }, '🔍 Researching company...');

      const model = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        }
      }, {
        tools: [{ googleSearch: {} }]
      });

      const result = await model.generateContent(
        buildCompanyResearchPrompt(companyName, jobTitle)
      );
      const insights = result.response.text();

      logger.info({ company: companyName }, '✅ Company research completed');
      return insights;

    } catch (error) {
      logger.warn({ error: error.message, company: companyName },
        'Company research failed, proceeding without insights');
      return null;
    }
  }

  /**
   * Generate LaTeX resume using Gemini
   */
  async generateLatex(userData, jobDescription, companyInsights) {
    logger.info('✍️ Generating LaTeX...');

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: RESUME_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8000,
        topP: 0.9,
      }
    });

    const userPrompt = buildUserPrompt(userData, jobDescription, companyInsights);
    const result = await model.generateContent(userPrompt);
    let latex = result.response.text();

    // Clean the output
    latex = this.cleanLatex(latex);

    // Validate structure
    this.validateLatex(latex);

    logger.info({ latexLength: latex.length }, '✅ LaTeX generated');
    return latex;
  }

  /**
   * Clean LaTeX output
   */
  cleanLatex(latex) {
    // Remove markdown code blocks
    let cleaned = latex
      .replace(/^```latex?\n?/gm, '')
      .replace(/\n?```$/gm, '')
      .replace(/^```.*$/gm, '');

    // Replace unicode characters
    cleaned = cleaned
      .replace(/•/g, '')
      .replace(/→/g, ' to ')
      .replace(/—/g, '--')
      .replace(/–/g, '--')
      .replace(/"/g, "''")
      .replace(/"/g, "``")
      .replace(/'/g, "'")
      .replace(/'/g, "'");

    // Escape unescaped special characters (safety net)
    cleaned = cleaned.replace(/(?<!\\)&/g, '\\&');

    // Escape unescaped % (but not in comments)
    cleaned = cleaned.split('\n').map(line => {
      if (line.trim().startsWith('%')) return line;
      return line.replace(/(?<!\\)%/g, '\\%');
    }).join('\n');

    // Escape unescaped #
    cleaned = cleaned.replace(/(?<!\\)#(?!\d)/g, '\\#');

    return cleaned.trim();
  }

  /**
   * Validate LaTeX structure
   */
  validateLatex(latex) {
    if (!latex.includes('\\documentclass')) {
      throw new Error('Invalid LaTeX: missing \\documentclass');
    }
    if (!latex.includes('\\begin{document}')) {
      throw new Error('Invalid LaTeX: missing \\begin{document}');
    }
    if (!latex.includes('\\end{document}')) {
      throw new Error('Invalid LaTeX: missing \\end{document}');
    }
    return true;
  }

  /**
   * Fix LaTeX errors using Gemini
   */
  async fixLatexErrors(brokenLatex, errorMessage) {
    logger.info('🔧 Attempting to fix LaTeX errors...');

    const model = this.genAI.getGenerativeModel({
      model: this.model,
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
- No unicode characters

LATEX TO FIX:
${brokenLatex}

Return complete fixed LaTeX from \\documentclass to \\end{document}:`;

    const result = await model.generateContent(fixPrompt);
    let fixedLatex = result.response.text();

    fixedLatex = this.cleanLatex(fixedLatex);
    this.validateLatex(fixedLatex);

    return fixedLatex;
  }

  /**
   * Generate resume without compilation (LaTeX only)
   * BACKWARD COMPATIBLE
   */
  async generateResume(userData, jobDescription, options = {}) {
    const startTime = Date.now();

    let companyInsights = null;
    const companyName = extractCompanyName(jobDescription);
    const jobTitle = extractJobTitle(jobDescription);

    if (companyName && options.enableSearch !== false) {
      companyInsights = await this.researchCompany(companyName, jobTitle);
    }

    const latex = await this.generateLatex(userData, jobDescription, companyInsights);

    return {
      latex,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: this.model,
        generationTime: Date.now() - startTime,
        company: companyName,
        usedCompanyResearch: !!companyInsights
      }
    };
  }

  /**
   * Alias for backward compatibility
   */
  async generateResumeSimple(userData, jobDescription, options = {}) {
    return this.generateAndCompile(userData, jobDescription, options);
  }

  /**
   * Compile LaTeX to PDF
   * BACKWARD COMPATIBLE
   */
  async compileResume(latexCode) {
    return await compileLatex(latexCode);
  }

  /**
   * Regenerate a specific section
   */
  async regenerateSection(currentLatex, sectionName, userData, jobDescription) {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
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

Return ONLY the LaTeX code for the ${sectionName} section.`;

    const result = await model.generateContent(prompt);
    return this.cleanLatex(result.response.text());
  }
}

export default AIResumeGenerator;
