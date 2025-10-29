/**
 * Job Metadata Extractor
 * Extracts structured metadata from job descriptions using LLM
 */

import OpenAI from 'openai';
import logger from './logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extract metadata from job description and requirements
 * @param {string} title - Job title
 * @param {string} description - Job description (can be HTML)
 * @param {string} requirements - Job requirements (optional)
 * @returns {Promise<Object>} Extracted metadata
 */
export async function extractJobMetadata(title, description, requirements = '') {
  try {
    // Combine description and requirements
    const fullText = `${title}\n\n${description}\n\n${requirements || ''}`.substring(0, 8000);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `You are a job posting analyzer. Extract structured metadata from job postings.

Return valid JSON with these EXACT fields:
{
  "skills": string[],              // ALL skills mentioned (technical AND soft skills) - max 20
  "experience": string,            // Experience required (e.g., "3+ years", "5-7 years", "Entry level")
  "education": string,             // Education required (e.g., "Bachelor's degree in CS", "High school diploma")
  "jobLevel": string,              // Job level: "Entry-level", "Mid-level", "Senior", "Lead", "Executive"
  "keywords": string[],            // Important keywords/technologies - max 15
  "benefits": string[],            // Benefits mentioned - max 10
  "confidence": number             // 0.0 to 1.0 confidence in extraction quality
}

IMPORTANT:
- Include ALL types of skills: technical (e.g., "Python", "Salesforce"), soft skills (e.g., "Leadership", "Communication"), domain knowledge (e.g., "B2B Sales", "SaaS", "Enterprise")
- For sales roles, include: sales tools (Salesforce, Outreach, Gong), sales methodologies, market knowledge
- For technical roles, include: programming languages, frameworks, tools, platforms
- Extract the MINIMUM experience required (e.g., if it says "3+ years", use "3+ years", NOT "5+ years")
- Use null for any field that cannot be determined
- Benefits can include: Remote Work, Health Insurance, 401(k), PTO, Equity, Visa Sponsorship, etc.`
      }, {
        role: 'user',
        content: fullText
      }],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Validate and normalize
    return {
      extractedSkills: Array.isArray(result.skills) ? result.skills.slice(0, 20) : [],
      extractedExperience: result.experience || null,
      extractedEducation: result.education || null,
      extractedJobLevel: result.jobLevel || null,
      extractedKeywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 15) : [],
      extractedBenefits: Array.isArray(result.benefits) ? result.benefits.slice(0, 10) : [],
      extractionConfidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      lastExtractedAt: new Date()
    };

  } catch (error) {
    logger.error({ error: error.message }, 'Job metadata extraction failed');

    // Return basic fallback
    return {
      extractedSkills: [],
      extractedExperience: null,
      extractedEducation: null,
      extractedJobLevel: null,
      extractedKeywords: [],
      extractedBenefits: [],
      extractionConfidence: 0.0,
      lastExtractedAt: new Date()
    };
  }
}

/**
 * Batch extract metadata for multiple jobs
 * @param {Array} jobs - Array of job objects with title, description, requirements
 * @param {number} batchSize - Number of jobs to process concurrently
 * @returns {Promise<Array>} Array of extracted metadata
 */
export async function batchExtractMetadata(jobs, batchSize = 5) {
  const results = [];

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(job => extractJobMetadata(job.title, job.description, job.requirements))
    );

    results.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

export default {
  extractJobMetadata,
  batchExtractMetadata
};
