/**
 * AI Resume Generator - HTML-Based Implementation
 *
 * Uses Google Gemini for content generation and Playwright for PDF rendering.
 * NO LATEX DEPENDENCIES - Pure HTML/CSS output.
 *
 * Includes "Spotlight Strategy" for handling large profiles (10-20+ experiences).
 * Supports Google Search grounding for company-specific optimization.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { generatePDFWithRetry } from './html-pdf-generator.js';
import { generateHTML, TEMPLATES, getTemplateRecommendation } from './html-templates.js';
import { jsonToHtml } from './json-to-html.js';
import {
  extractCompanyName,
  extractJobTitle
} from './resume-prompts.js';
import logger from './logger.js';

class AIResumeGenerator {
  /**
   * Constructor
   * @param {string} apiKey - Gemini API key (or uses env)
   */
  constructor(apiKey) {
    const key = process.env.GEMINI_API_KEY || apiKey;

    if (!key) {
      throw new Error('GEMINI_API_KEY is required. Set it in environment variables.');
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = 'gemini-2.0-flash';
    logger.info('AIResumeGenerator initialized with Gemini (HTML mode)');
  }

  /**
   * Main generation method
   * @param {Object} userData - User profile data
   * @param {string} jobDescription - Target job description
   * @param {Object} options - Generation options
   * @returns {Promise<{html: string, pdf: Buffer, metadata: Object}>}
   */
  async generateAndCompile(userData, jobDescription, options = {}) {
    const startTime = Date.now();
    const templateId = options.templateId || 'jakes_resume';

    logger.info({
      profileSize: JSON.stringify(userData).length,
      templateId,
      enableSearch: options.enableSearch !== false
    }, 'Starting HTML Resume Generation');

    // Validate user data has minimum required fields
    if (!userData || Object.keys(userData).length === 0) {
      throw new Error('User data is required for resume generation');
    }

    try {
      // Phase 1: Company Research (optional but recommended)
      let companyInsights = null;
      const companyName = extractCompanyName(jobDescription);
      const jobTitle = extractJobTitle(jobDescription);

      if (companyName && options.enableSearch !== false) {
        companyInsights = await this.researchCompany(companyName, jobTitle);
      }

      // Phase 2: Generate optimized resume content
      const resumeData = await this.generateResumeContent(userData, jobDescription, companyInsights);

      // Phase 3: Generate HTML
      logger.info('Generating HTML...');
      const html = generateHTML(resumeData, templateId);
      logger.info({ htmlLength: html.length }, 'HTML generated');

      // Phase 4: Generate PDF
      logger.info('Generating PDF...');
      const pdf = await generatePDFWithRetry(html, {
        format: 'Letter',
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
      });
      logger.info('PDF generated successfully');

      const totalTime = Date.now() - startTime;

      logger.info({
        totalTime,
        company: companyName,
        usedResearch: !!companyInsights
      }, `Resume generated in ${(totalTime / 1000).toFixed(2)}s`);

      return {
        html,
        pdf,
        // Keep 'latex' key for backward compatibility (contains HTML now)
        latex: html,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: this.model,
          generationTime: totalTime,
          company: companyName,
          jobTitle,
          templateId,
          usedCompanyResearch: !!companyInsights,
          approach: 'html-gemini'
        }
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Resume generation failed');
      throw new Error(`Resume generation failed: ${error.message}`);
    }
  }

  /**
   * Research company using Google Search grounding
   */
  async researchCompany(companyName, jobTitle) {
    try {
      logger.info({ company: companyName }, 'Researching company...');

      const model = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        }
      });

      const prompt = `Research ${companyName} for a ${jobTitle || 'job'} application.
Provide brief insights on:
1. Company culture and values
2. Key products/services
3. Recent news or achievements
4. What they look for in candidates

Keep response concise (under 300 words).`;

      const result = await model.generateContent(prompt);
      const insights = result.response.text();

      logger.info({ company: companyName }, 'Company research completed');
      return insights;

    } catch (error) {
      logger.warn({ error: error.message, company: companyName },
        'Company research failed, proceeding without insights');
      return null;
    }
  }

  /**
   * Generate optimized resume content using Gemini
   * Returns structured JSON data for HTML generation
   */
  async generateResumeContent(userData, jobDescription, companyInsights) {
    logger.info('Generating optimized resume content...');

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8000,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `You are an expert resume writer. Create an ATS-optimized resume.

CANDIDATE PROFILE:
${JSON.stringify(userData, null, 2)}

TARGET JOB:
${jobDescription}

${companyInsights ? `COMPANY INSIGHTS:\n${companyInsights}` : ''}

INSTRUCTIONS:
1. Select the most relevant 3-5 experiences for this job
2. Rewrite bullet points with quantified achievements where possible
3. Match keywords from the job description naturally
4. Create a compelling professional summary
5. Organize skills by relevance to the job

OUTPUT FORMAT (JSON):
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "location": "City, State",
  "linkedin": "linkedin url or empty",
  "github": "github url or empty",
  "portfolio": "portfolio url or empty",
  "summary": "2-3 sentence professional summary tailored to the job",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY or Present",
      "highlights": [
        "Achievement bullet with metrics",
        "Another achievement"
      ]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Type",
      "field": "Field of Study",
      "location": "City, State",
      "endDate": "YYYY",
      "gpa": "GPA if above 3.5",
      "highlights": ["Relevant coursework or honors"]
    }
  ],
  "skills": [
    {
      "category": "Languages",
      "items": ["Python", "JavaScript"]
    },
    {
      "category": "Frameworks",
      "items": ["React", "Node.js"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "technologies": ["Tech1", "Tech2"],
      "highlights": ["What it does", "Impact or metrics"],
      "link": "optional url"
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "YYYY"
    }
  ]
}

Return ONLY valid JSON. Include only sections with content.`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // Parse JSON response
    try {
      // Clean up potential markdown formatting
      responseText = responseText
        .replace(/^```json\n?/gm, '')
        .replace(/\n?```$/gm, '')
        .trim();

      const resumeData = JSON.parse(responseText);
      logger.info('Resume content generated successfully');
      return resumeData;

    } catch (parseError) {
      logger.warn({ error: parseError.message }, 'Failed to parse AI response, using fallback');
      // Fallback: use original user data with basic normalization
      const normalized = this.normalizeUserData(userData);

      // Validate normalized data has minimum required content
      if (!normalized.name && !normalized.email) {
        logger.error('Fallback normalization produced empty resume - missing name and email');
        throw new Error('Unable to generate resume: profile missing name and email');
      }

      if ((!normalized.experience || normalized.experience.length === 0) &&
          (!normalized.education || normalized.education.length === 0)) {
        logger.warn('Resume has no experience or education - may appear sparse');
      }

      return normalized;
    }
  }

  /**
   * Normalize user data to expected format (fallback)
   * Handles various data structures from different sources
   */
  normalizeUserData(userData) {
    // Handle nested applicationData structure
    const appData = userData.applicationData || {};
    const personalInfo = appData.personalInfo || userData.personalInfo || userData.personal || userData.contact || {};

    // Extract name from various possible fields
    const name = personalInfo.fullName || personalInfo.name || userData.name || userData.fullName ||
                 `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || '';

    // Extract experience from various possible fields
    const experience = appData.experience || userData.experience || userData.workExperience ||
                       userData.experiences || [];

    // Extract education
    const education = appData.education || userData.education || [];

    // Extract skills - handle various formats
    let skills = appData.skills || userData.skills || {};
    if (Array.isArray(skills) && skills.length > 0 && typeof skills[0] === 'string') {
      // Convert simple string array to categorized format
      skills = [{ category: 'Skills', items: skills }];
    }

    const normalized = {
      name,
      email: personalInfo.email || userData.email || '',
      phone: personalInfo.phone || userData.phone || '',
      location: personalInfo.location || userData.location || '',
      linkedin: personalInfo.linkedin || userData.linkedin || '',
      github: personalInfo.github || userData.github || '',
      portfolio: personalInfo.portfolio || personalInfo.website || userData.website || '',
      summary: userData.summary || userData.objective || personalInfo.summary || '',
      experience,
      education,
      skills,
      projects: appData.projects || userData.projects || [],
      certifications: appData.certifications || userData.certifications || []
    };

    logger.info({
      hasName: !!normalized.name,
      hasEmail: !!normalized.email,
      experienceCount: normalized.experience?.length || 0,
      educationCount: normalized.education?.length || 0,
      hasSkills: Object.keys(normalized.skills || {}).length > 0 || (Array.isArray(normalized.skills) && normalized.skills.length > 0)
    }, 'Normalized user data for resume');

    return normalized;
  }

  /**
   * Generate resume without PDF compilation
   * Returns HTML and structured data
   */
  async generateResume(userData, jobDescription, options = {}) {
    const startTime = Date.now();
    const templateId = options.templateId || 'jakes_resume';

    let companyInsights = null;
    const companyName = extractCompanyName(jobDescription);
    const jobTitle = extractJobTitle(jobDescription);

    if (companyName && options.enableSearch !== false) {
      companyInsights = await this.researchCompany(companyName, jobTitle);
    }

    const resumeData = await this.generateResumeContent(userData, jobDescription, companyInsights);
    const html = generateHTML(resumeData, templateId);

    return {
      html,
      latex: html, // Backward compatibility
      data: resumeData,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: this.model,
        generationTime: Date.now() - startTime,
        company: companyName,
        templateId,
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
   * Compile HTML to PDF
   * Backward compatible method name
   */
  async compileResume(htmlCode) {
    return await generatePDFWithRetry(htmlCode);
  }

  /**
   * Generate resume with specific template
   */
  async generateWithTemplate(templateId, userData, jobDescription, options = {}) {
    const mergedOptions = { ...options, templateId };
    return this.generateAndCompile(userData, jobDescription, mergedOptions);
  }

  /**
   * Regenerate a specific section
   */
  async regenerateSection(currentHtml, sectionName, userData, jobDescription) {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `Regenerate ONLY the ${sectionName} section to better match the job.

JOB DESCRIPTION:
${jobDescription}

USER DATA FOR ${sectionName.toUpperCase()}:
${JSON.stringify(userData, null, 2)}

Return as JSON array with the improved section content.`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text()
      .replace(/^```json\n?/gm, '')
      .replace(/\n?```$/gm, '')
      .trim();

    try {
      return JSON.parse(responseText);
    } catch {
      return userData;
    }
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    return Object.values(TEMPLATES).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      bestFor: t.bestFor
    }));
  }

  /**
   * Get template recommendation based on job/profile
   */
  recommendTemplate(context) {
    return getTemplateRecommendation(context);
  }

  /**
   * Quick generate from profile data
   * Simplified method for common use case
   */
  async quickGenerate(profileData, jobDescription, templateId = 'jakes_resume') {
    return this.generateAndCompile(profileData, jobDescription, {
      templateId,
      enableSearch: true
    });
  }
}

export default AIResumeGenerator;
