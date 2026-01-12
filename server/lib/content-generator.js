/**
 * Content Generator - Generates structured JSON content for resume templates
 *
 * This module generates CONTENT ONLY, not LaTeX structure.
 * The content is tailored to job descriptions and formatted as JSON
 * that can be injected into templates.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from './logger.js';

const CONTENT_GENERATION_PROMPT = `You are an expert resume content writer. Generate structured resume content as JSON that will be used to fill a LaTeX template.

CRITICAL RULES:
1. Output ONLY valid JSON - no markdown, no explanations
2. Tailor all content to the job description provided
3. Use strong action verbs (Led, Developed, Implemented, Optimized, etc.)
4. Include quantifiable metrics where possible (%, $, numbers)
5. Each bullet should follow: "[Action verb] [what you did] [result/impact]"
6. Keep bullets concise but impactful (1-2 lines max)
7. Match keywords from the job description naturally
8. DO NOT escape special characters - output plain text only (the system will handle LaTeX escaping)
9. Use plain ASCII characters only - avoid unicode symbols, smart quotes, em-dashes

OUTPUT JSON STRUCTURE:
{
  "header": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "(123) 456-7890",
    "location": "City, State",
    "linkedin": "linkedin.com/in/username",
    "website": "portfolio.com",
    "github": "github.com/username"
  },
  "summary": "2-3 sentences tailored professional summary highlighting fit for the role",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "dates": "Jan 2022 - Present",
      "bullets": [
        "Led cross-functional team of 8 engineers to deliver microservices architecture, reducing latency by 40%",
        "Implemented CI/CD pipeline using GitHub Actions, cutting deployment time from 2 hours to 15 minutes"
      ]
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Science in Computer Science",
      "school": "University Name",
      "location": "City, State",
      "dates": "2016 - 2020",
      "gpa": "3.8/4.0",
      "honors": "Magna Cum Laude"
    }
  ],
  "skills": {
    "Languages": ["Python", "JavaScript", "TypeScript", "Go"],
    "Frameworks": ["React", "Node.js", "FastAPI", "Django"],
    "Tools": ["Docker", "Kubernetes", "AWS", "PostgreSQL"],
    "Other": ["Agile/Scrum", "System Design", "Technical Leadership"]
  },
  "projects": [
    {
      "name": "Project Name",
      "technologies": "React, Node.js, PostgreSQL",
      "dates": "2023",
      "description": "Brief description with impact",
      "bullets": [
        "Built full-stack application serving 10K+ daily users"
      ]
    }
  ],
  "certifications": [
    {
      "name": "AWS Solutions Architect",
      "issuer": "Amazon Web Services",
      "date": "2023"
    }
  ],
  "publications": [
    {
      "title": "Paper Title",
      "venue": "Conference/Journal Name",
      "year": "2023",
      "authors": "Author1, Author2, You"
    }
  ]
}

SELECTION RULES:
- Experience: Include 2-4 most relevant positions, 3-5 bullets each, prioritize recent and relevant
- Skills: Group into 3-4 categories, include ONLY skills from the profile that match the JD
- Projects: Include 1-3 most relevant projects
- Certifications: Include only if relevant to the role
- Publications: Include only for academic roles or if relevant

Return ONLY the JSON object, no additional text.`;

/**
 * Generate structured resume content as JSON
 *
 * @param {Object} options
 * @param {Object} options.profileData - User's profile data
 * @param {string} options.jobDescription - Target job description
 * @param {Object} options.companyInsights - Optional company research
 * @returns {Promise<Object>} Structured content JSON
 */
export async function generateContent({ profileData, jobDescription, companyInsights = null }) {
  const startTime = Date.now();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for content generation');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.4, // Balanced for creativity but consistency
      maxOutputTokens: 8000,
    }
  });

  logger.info({
    profileSize: JSON.stringify(profileData).length,
    hasInsights: !!companyInsights
  }, 'Generating resume content as JSON');

  // Build the user prompt
  let userPrompt = `USER PROFILE DATA:
${JSON.stringify(profileData, null, 2)}

TARGET JOB DESCRIPTION:
${jobDescription}`;

  if (companyInsights) {
    userPrompt += `

COMPANY RESEARCH INSIGHTS:
${JSON.stringify(companyInsights, null, 2)}

Use these insights to better tailor the content to the company's culture and values.`;
  }

  userPrompt += `

Generate the JSON content now. Remember:
- Prioritize experiences and skills that match the job description
- Use metrics and quantifiable achievements
- Match keywords from the JD naturally
- Escape LaTeX special characters`;

  try {
    const result = await model.generateContent([
      { text: CONTENT_GENERATION_PROMPT },
      { text: userPrompt }
    ]);

    const response = result.response.text();

    // Parse JSON response
    let content;
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

      content = JSON.parse(cleanResponse);
    } catch (parseError) {
      logger.error({ error: parseError.message, response: response.substring(0, 1000) }, 'Failed to parse content JSON');
      throw new Error('Failed to parse AI-generated content. Please try again.');
    }

    // Validate required fields
    if (!content.header || !content.experience || !content.education || !content.skills) {
      throw new Error('Generated content missing required sections');
    }

    const elapsed = Date.now() - startTime;
    logger.info({
      elapsed,
      experienceCount: content.experience?.length,
      skillCategories: Object.keys(content.skills || {}).length
    }, 'Content generation completed');

    return content;

  } catch (error) {
    logger.error({ error: error.message }, 'Content generation failed');
    throw error;
  }
}

/**
 * Escape special LaTeX characters in a string
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeLatex(text) {
  if (!text || typeof text !== 'string') return text;

  // Order matters - escape backslash first
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Recursively escape LaTeX characters in an object
 * @param {Object|Array|string} obj - Object to process
 * @returns {Object|Array|string} Processed object
 */
export function escapeLatexInObject(obj) {
  if (typeof obj === 'string') {
    return escapeLatex(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => escapeLatexInObject(item));
  }

  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = escapeLatexInObject(value);
    }
    return result;
  }

  return obj;
}

export default {
  generateContent,
  escapeLatex,
  escapeLatexInObject
};
