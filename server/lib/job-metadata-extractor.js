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
        content: `You are an expert job posting analyzer. Extract ALL skills and metadata comprehensively.

Return valid JSON with these EXACT fields:
{
  "skills": string[],              // ALL skills mentioned (technical, soft, tools, platforms) - extract EVERYTHING, no limit
  "experience": string,            // Experience required (e.g., "3+ years", "5-7 years", "Entry level")
  "education": string,             // Education required (e.g., "Bachelor's degree in CS", "High school diploma")
  "jobLevel": string,              // Job level: "Entry-level", "Mid-level", "Senior", "Lead", "Executive"
  "keywords": string[],            // Important keywords/technologies - extract EVERYTHING relevant
  "benefits": string[],            // Benefits mentioned
  "confidence": number             // 0.0 to 1.0 confidence in extraction quality
}

CRITICAL INSTRUCTIONS - EXTRACT EVERY SKILL:

1. TECHNICAL SKILLS (extract ALL):
   - Programming languages: Python, JavaScript, Java, C++, Go, Ruby, PHP, TypeScript, etc.
   - Frameworks: React, Angular, Vue, Django, Flask, Spring, Rails, .NET, etc.
   - Tools: Git, Docker, Kubernetes, Jenkins, Terraform, Ansible, etc.
   - Platforms: AWS, Azure, GCP, Heroku, etc.
   - Databases: PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, etc.
   - APIs: REST, GraphQL, gRPC, etc.
   - Testing: Jest, Pytest, JUnit, Selenium, etc.

2. SOFT SKILLS (extract ALL):
   - Leadership: "lead", "mentor", "manage", "coordinate"
   - Communication: "present", "document", "collaborate", "stakeholder management"
   - Problem-solving: "analytical", "troubleshoot", "debug", "optimize"
   - Project management: "agile", "scrum", "kanban", "planning"

3. DOMAIN KNOWLEDGE:
   - Industry: fintech, healthcare, e-commerce, SaaS, gaming, etc.
   - Methodologies: Agile, DevOps, CI/CD, Microservices, etc.
   - Specializations: Machine Learning, Security, Performance, Scalability, etc.

4. TOOLS & PLATFORMS (extract ALL):
   - Version control: Git, GitHub, GitLab, Bitbucket
   - Project management: Jira, Asana, Trello, Confluence
   - Communication: Slack, Teams, Zoom
   - Sales tools: Salesforce, HubSpot, Outreach, Gong
   - Design: Figma, Sketch, Adobe XD
   - Any other tools mentioned

5. EXTRACTION RULES:
   - Extract EVERY skill, even if mentioned only once
   - Include variations (e.g., "React.js" -> include both "React" and "React.js")
   - Extract implied skills (e.g., "microservices" implies "distributed systems", "APIs")
   - Look in requirements, responsibilities, qualifications, nice-to-haves, and description
   - Extract the MINIMUM experience required (not preferred)
   - Use null for fields that cannot be determined
   - NO LIMITS on array sizes - extract everything relevant`
      }, {
        role: 'user',
        content: fullText
      }],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Validate and normalize (NO LIMITS - extract everything)
    return {
      extractedSkills: Array.isArray(result.skills) ? result.skills : [],
      extractedExperience: result.experience || null,
      extractedEducation: result.education || null,
      extractedJobLevel: result.jobLevel || null,
      extractedKeywords: Array.isArray(result.keywords) ? result.keywords : [],
      extractedBenefits: Array.isArray(result.benefits) ? result.benefits : [],
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
