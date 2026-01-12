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
import { TEMPLATES } from './resume-templates.js';
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
    this.model = 'gemini-3-flash-preview';
    logger.info('AIResumeGenerator initialized with Gemini 3 Flash');
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

    // Fix common LLM typos in LaTeX commands
    cleaned = cleaned
      .replace(/\\titrule/g, '\\titlerule')           // Missing 'le'
      .replace(/\\titerule/g, '\\titlerule')          // Typo variant
      .replace(/\\titlerul(?![e])/g, '\\titlerule')   // Missing 'e'
      .replace(/\\textbf\s*{/g, '\\textbf{')          // Remove space before brace
      .replace(/\\textit\s*{/g, '\\textit{')
      .replace(/\\href\s*{/g, '\\href{')
      .replace(/\\section\s*{/g, '\\section{')
      .replace(/\\subsection\s*{/g, '\\subsection{');

    // Remove tectonic-incompatible commands
    cleaned = cleaned
      .replace(/\\input{glyphtounicode}/g, '% glyphtounicode removed')
      .replace(/\\pdfglyphtounicode[^\n]*/g, '% pdfglyphtounicode removed');

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

    const fixPrompt = `Fix this LaTeX error. Output ONLY the corrected LaTeX code.

ERROR: ${errorMessage.substring(0, 300)}

BROKEN LATEX:
${brokenLatex}

Fix and return complete LaTeX:`;

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

  /**
   * Template rewrite method - SIMPLE AND RELIABLE
   *
   * The LLM directly rewrites the content in the user's template.
   * No JSON intermediary, no template filling, no escaping issues.
   *
   * Flow:
   * 1. Take user's existing template (valid LaTeX)
   * 2. LLM rewrites the content to match the job
   * 3. Compile to PDF
   *
   * @param {string} templateLatex - User's existing LaTeX template
   * @param {Object} userData - User profile data
   * @param {string} jobDescription - Target job description
   * @param {Object} options - Generation options
   * @returns {Promise<{latex: string, pdf: Buffer, metadata: Object}>}
   */
  async generateWithTemplate(templateLatex, userData, jobDescription, options = {}) {
    const startTime = Date.now();

    logger.info({
      profileSize: JSON.stringify(userData).length,
      hasTemplate: !!templateLatex,
      enableSearch: options.enableSearch !== false
    }, '🚀 Starting template rewrite');

    try {
      // Resolve template if ID was passed (for default templates)
      let template = templateLatex;
      if (typeof templateLatex === 'string' && TEMPLATES[templateLatex]) {
        template = TEMPLATES[templateLatex].latexTemplate;
        logger.info({ templateId: templateLatex }, 'Using built-in template');
      } else if (typeof templateLatex === 'string' && templateLatex.startsWith('default_')) {
        const templateKey = templateLatex.replace('default_', '');
        if (TEMPLATES[templateKey]) {
          template = TEMPLATES[templateKey].latexTemplate;
        }
      }

      // Company research (optional)
      let companyInsights = null;
      const companyName = extractCompanyName(jobDescription);
      const jobTitle = extractJobTitle(jobDescription);

      if (companyName && options.enableSearch !== false) {
        companyInsights = await this.researchCompany(companyName, jobTitle);
      }

      // SIMPLE: LLM directly rewrites the template content
      logger.info('✍️ Rewriting template content...');
      const latex = await this.rewriteTemplateContent(template, userData, jobDescription, companyInsights);
      logger.info({ latexLength: latex.length }, '✅ Template rewritten');

      // Compile to PDF
      logger.info('⚙️ Compiling PDF...');
      let pdf;
      try {
        pdf = await compileLatex(latex);
        logger.info('✅ PDF compiled successfully');
      } catch (compileError) {
        logger.warn({ error: compileError.message }, 'First compilation failed, attempting fix...');
        const fixedLatex = await this.fixLatexErrors(latex, compileError.message);
        pdf = await compileLatex(fixedLatex);
        logger.info('✅ PDF compiled after fix');
      }

      const totalTime = Date.now() - startTime;
      logger.info({ totalTime }, `✅ Resume generated in ${(totalTime / 1000).toFixed(2)}s`);

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
          approach: 'template-rewrite'
        }
      };

    } catch (error) {
      logger.error({ error: error.message }, '❌ Resume generation failed');
      throw new Error(`Resume generation failed: ${error.message}`);
    }
  }

  /**
   * Rewrite template content using LLM
   *
   * LLM has full flexibility to optimize the resume for the job
   */
  async rewriteTemplateContent(template, userData, jobDescription, companyInsights) {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.4,  // Slightly higher for creativity
        maxOutputTokens: 12000,
      }
    });

    const prompt = `Generate a one-page LaTeX resume optimized for ATS.

RULES:
- Basic LaTeX only: article, geometry, enumitem, hyperref
- Use section*, textbf, itemize - no custom commands
- Escape: & -> \\&, % -> \\%, $ -> \\$, # -> \\#, _ -> \\_
- Output raw LaTeX only, no markdown

PROFILE:
${JSON.stringify(userData, null, 2)}

JOB:
${jobDescription}
${companyInsights ? `\nCOMPANY INFO:\n${companyInsights}` : ''}
Generate:`;

    const result = await model.generateContent(prompt);
    let latex = result.response.text();

    // Clean up the output
    latex = this.cleanLatex(latex);
    this.validateLatex(latex);

    return latex;
  }

}

export default AIResumeGenerator;
