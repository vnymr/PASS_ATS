/**
 * Gemini-Powered Resume Generator
 *
 * AI-native resume generation using Google Gemini
 * with optional Google Search grounding for company-specific optimization.
 *
 * HTML-based output - NO LATEX DEPENDENCIES
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { generatePDFWithRetry } from './html-pdf-generator.js';
import { generateHTML, TEMPLATES } from './html-templates.js';
import {
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
  logger.info('Gemini Resume Generator initialized (HTML mode)');
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

    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    });

    const researchPrompt = `Research ${companyName} for a ${jobTitle || 'job'} application.
Provide brief insights on:
1. Company culture and values
2. Key products/services
3. Recent news or achievements
4. What they look for in candidates

Keep response concise (under 300 words).`;

    logger.info({ company: companyName, jobTitle }, 'Researching company');

    const result = await model.generateContent(researchPrompt);
    const response = await result.response;
    const insights = response.text();

    logger.info({ company: companyName }, 'Company research completed');
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
 * Generate resume content using Gemini
 * Returns structured JSON data for HTML generation
 */
async function generateResumeContent(profileData, jobDescription, companyInsights) {
  const client = initializeGemini();

  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json'
    }
  });

  const prompt = `You are an expert resume writer. Create an ATS-optimized resume.

CANDIDATE PROFILE:
${JSON.stringify(profileData, null, 2)}

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
      "highlights": ["Achievement bullet with metrics", "Another achievement"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Type",
      "field": "Field of Study",
      "location": "City, State",
      "endDate": "YYYY",
      "gpa": "GPA if above 3.5"
    }
  ],
  "skills": [
    { "category": "Languages", "items": ["Python", "JavaScript"] },
    { "category": "Frameworks", "items": ["React", "Node.js"] }
  ],
  "projects": [
    {
      "name": "Project Name",
      "technologies": ["Tech1", "Tech2"],
      "highlights": ["What it does", "Impact or metrics"]
    }
  ],
  "certifications": [
    { "name": "Certification Name", "issuer": "Organization", "date": "YYYY" }
  ]
}

Return ONLY valid JSON.`;

  const result = await model.generateContent(prompt);
  let responseText = result.response.text();

  try {
    responseText = responseText
      .replace(/^```json\n?/gm, '')
      .replace(/\n?```$/gm, '')
      .trim();

    return JSON.parse(responseText);
  } catch (parseError) {
    logger.warn({ error: parseError.message }, 'Failed to parse AI response, using fallback');
    return normalizeProfileData(profileData);
  }
}


/**
 * Normalize profile data to expected format (fallback)
 */
function normalizeProfileData(profileData) {
  const personalInfo = profileData.personalInfo || profileData.personal || {};

  return {
    name: personalInfo.name || profileData.name || profileData.fullName || '',
    email: personalInfo.email || profileData.email || '',
    phone: personalInfo.phone || profileData.phone || '',
    location: personalInfo.location || profileData.location || '',
    linkedin: personalInfo.linkedin || profileData.linkedin || '',
    github: personalInfo.github || profileData.github || '',
    portfolio: personalInfo.portfolio || profileData.website || '',
    summary: profileData.summary || profileData.objective || '',
    experience: profileData.experience || profileData.workExperience || [],
    education: profileData.education || [],
    skills: profileData.skills || {},
    projects: profileData.projects || [],
    certifications: profileData.certifications || []
  };
}


/**
 * Generate resume - returns HTML and metadata
 * @param {Object} profileData - User profile data (raw JSON)
 * @param {string} jobDescription - Target job description
 * @param {Object} options - Generation options
 * @returns {Promise<{html: string, metadata: Object}>}
 */
async function generateResume(profileData, jobDescription, options = {}) {
  const startTime = Date.now();
  const templateId = options.templateId || 'modern_dense';

  try {
    // Extract company name for potential research
    const companyName = extractCompanyName(jobDescription);
    const jobTitle = extractJobTitle(jobDescription);

    logger.info({
      company: companyName,
      jobTitle,
      templateId,
      enableSearch: options.enableSearch !== false,
      profileSize: JSON.stringify(profileData).length
    }, 'Starting Gemini resume generation (HTML)');

    // Research company if search is enabled
    let companyInsights = null;
    if (options.enableSearch !== false && companyName) {
      companyInsights = await researchCompany(companyName, jobTitle);
    }

    // Generate optimized resume content
    const resumeData = await generateResumeContent(profileData, jobDescription, companyInsights);

    // Generate HTML
    const html = generateHTML(resumeData, templateId);

    const generationTime = Date.now() - startTime;

    logger.info({
      generationTime,
      htmlLength: html.length,
      company: companyName,
      hasCompanyInsights: !!companyInsights
    }, 'Resume generation completed');

    return {
      html,
      latex: html, // Backward compatibility
      data: resumeData,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'gemini-2.0-flash',
        generationTime,
        company: companyName,
        jobTitle,
        templateId,
        usedCompanyResearch: !!companyInsights,
        approach: 'gemini-html'
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
 * @returns {Promise<{html: string, pdf: Buffer, metadata: Object}>}
 */
async function generateAndCompile(userData, jobDescription, options = {}) {
  // Generate the HTML
  const { html, data, metadata } = await generateResume(userData, jobDescription, options);

  // Generate PDF using Playwright
  logger.info('Generating PDF...');
  const pdf = await generatePDFWithRetry(html, {
    format: 'Letter',
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
  });
  logger.info('PDF generated successfully');

  return {
    html,
    latex: html, // Backward compatibility
    pdf,
    data,
    metadata
  };
}


/**
 * Regenerate a specific section of the resume
 */
async function regenerateSection(currentData, sectionName, userData, jobDescription) {
  const client = initializeGemini();

  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
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

Return as JSON with the improved ${sectionName} content in the same format as the input.`;

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


/**
 * Get available templates
 */
function getAvailableTemplates() {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    bestFor: t.bestFor
  }));
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

  async regenerateSection(currentData, sectionName, userData, jobDescription) {
    return regenerateSection(currentData, sectionName, userData, jobDescription);
  }

  async compileResume(htmlCode) {
    return generatePDFWithRetry(htmlCode);
  }

  getAvailableTemplates() {
    return getAvailableTemplates();
  }
}


export {
  GeminiResumeGenerator,
  generateResume,
  generateAndCompile,
  regenerateSection,
  researchCompany,
  isAvailable,
  getAvailableTemplates
};

export default GeminiResumeGenerator;
