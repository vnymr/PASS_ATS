/**
 * Profile Skill Extractor
 *
 * Comprehensively extracts ALL skills from user profile including:
 * - Explicit skills array
 * - Skills mentioned in experience bullets
 * - Skills in project descriptions
 * - Technologies in education
 * - Domain expertise from roles and companies
 */

import OpenAI from 'openai';
import logger from './logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Enhanced skill extraction from profile data
 * @param {Object} profileData - User profile data (JSON from Profile.data)
 * @returns {Promise<Object>} Comprehensive skill analysis
 */
export async function extractAllSkillsFromProfile(profileData) {
  try {
    // 1. Collect explicit skills
    const explicitSkills = profileData.skills || [];

    // 2. Build comprehensive text from all profile sections
    const profileText = buildProfileText(profileData);

    // 3. Use LLM to extract ALL skills comprehensively
    const extractedSkills = await extractSkillsWithLLM(profileText, explicitSkills);

    // 4. Calculate years of experience for each skill
    const skillsWithExperience = calculateSkillExperience(
      extractedSkills.allSkills,
      profileData.experiences || []
    );

    return {
      // Core skills (high confidence)
      coreSkills: extractedSkills.technical,
      // All skills including soft skills
      allSkills: extractedSkills.allSkills,
      // Skills with experience context
      skillsWithExperience,
      // Domain expertise
      domains: extractedSkills.domains,
      // Soft skills
      softSkills: extractedSkills.soft,
      // Total years of experience
      totalYearsExperience: calculateTotalYears(profileData.experiences || []),
      // Seniority level inferred from profile
      seniorityLevel: inferSeniorityLevel(profileData)
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to extract skills from profile');

    // Fallback to basic extraction
    return {
      coreSkills: profileData.skills || [],
      allSkills: profileData.skills || [],
      skillsWithExperience: {},
      domains: [],
      softSkills: [],
      totalYearsExperience: 0,
      seniorityLevel: 'mid'
    };
  }
}

/**
 * Build comprehensive profile text for analysis
 */
function buildProfileText(profileData) {
  const parts = [];

  // Summary
  if (profileData.summary) {
    parts.push(`SUMMARY: ${profileData.summary}`);
  }

  // Experiences
  if (profileData.experiences && Array.isArray(profileData.experiences)) {
    profileData.experiences.forEach((exp, idx) => {
      parts.push(`\nEXPERIENCE ${idx + 1}:`);
      parts.push(`Role: ${exp.role}`);
      parts.push(`Company: ${exp.company}`);
      parts.push(`Duration: ${exp.dates}`);
      if (exp.bullets && Array.isArray(exp.bullets)) {
        parts.push('Responsibilities:');
        exp.bullets.forEach(bullet => parts.push(`- ${bullet}`));
      }
    });
  }

  // Education
  if (profileData.education && Array.isArray(profileData.education)) {
    profileData.education.forEach((edu, idx) => {
      parts.push(`\nEDUCATION ${idx + 1}:`);
      parts.push(`${edu.degree} from ${edu.institution}`);
    });
  }

  // Projects
  if (profileData.projects && Array.isArray(profileData.projects)) {
    profileData.projects.forEach((project, idx) => {
      parts.push(`\nPROJECT ${idx + 1}:`);
      if (project.name) parts.push(`Name: ${project.name}`);
      if (project.description) parts.push(`Description: ${project.description}`);
      if (project.technologies) parts.push(`Technologies: ${project.technologies}`);
    });
  }

  // Certifications
  if (profileData.certifications && Array.isArray(profileData.certifications)) {
    parts.push('\nCERTIFICATIONS:');
    profileData.certifications.forEach(cert => parts.push(`- ${cert}`));
  }

  return parts.join('\n');
}

/**
 * Extract skills using LLM for comprehensive analysis
 */
async function extractSkillsWithLLM(profileText, explicitSkills = []) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `You are an expert skill analyzer. Extract ALL skills from the user's profile.

Return valid JSON with these EXACT fields:
{
  "technical": string[],    // All technical skills: languages, frameworks, tools, platforms
  "soft": string[],         // Soft skills: leadership, communication, problem-solving, etc.
  "domains": string[],      // Domain expertise: fintech, healthcare, e-commerce, SaaS, etc.
  "allSkills": string[]     // Combined list of ALL skills
}

IMPORTANT RULES:
1. Extract EVERY skill mentioned, even implicitly
2. For technical skills, include:
   - Programming languages (Python, JavaScript, Java, etc.)
   - Frameworks (React, Django, Spring, etc.)
   - Tools (Git, Docker, Kubernetes, etc.)
   - Platforms (AWS, GCP, Azure, etc.)
   - Databases (PostgreSQL, MongoDB, Redis, etc.)
   - Methodologies (Agile, Scrum, TDD, etc.)

3. For soft skills, look for:
   - Leadership indicators ("Led team", "Mentored", "Managed")
   - Communication ("Presented", "Collaborated", "Documented")
   - Problem-solving ("Optimized", "Improved", "Solved")
   - Project management ("Coordinated", "Planned", "Delivered")

4. For domains, identify:
   - Industry experience (fintech, healthcare, education, etc.)
   - Product types (SaaS, B2B, B2C, enterprise, etc.)
   - Special expertise (machine learning, security, scalability, etc.)

5. Normalize skill names (e.g., "React.js" -> "React", "Node.js" -> "Node.js")
6. Include variations (e.g., if profile mentions "CI/CD", include both "CI/CD" and "Continuous Integration")
7. Extract skills from accomplishments (e.g., "Reduced API response time by 60%" -> "API Optimization", "Performance Optimization")

The explicit skills list is: ${JSON.stringify(explicitSkills)}
Include ALL of these plus any additional skills found in the text.`
      }, {
        role: 'user',
        content: profileText
      }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);

    return {
      technical: Array.isArray(result.technical) ? result.technical : [],
      soft: Array.isArray(result.soft) ? result.soft : [],
      domains: Array.isArray(result.domains) ? result.domains : [],
      allSkills: Array.isArray(result.allSkills) ? result.allSkills : []
    };

  } catch (error) {
    logger.error({ error: error.message }, 'LLM skill extraction failed');

    // Fallback: return explicit skills
    return {
      technical: explicitSkills,
      soft: [],
      domains: [],
      allSkills: explicitSkills
    };
  }
}

/**
 * Calculate years of experience for each skill
 */
function calculateSkillExperience(skills, experiences) {
  const skillYears = {};

  experiences.forEach(exp => {
    const years = parseExperienceYears(exp.dates);
    const expText = [
      exp.role || '',
      ...(exp.bullets || [])
    ].join(' ').toLowerCase();

    skills.forEach(skill => {
      const skillLower = skill.toLowerCase();
      // Check if skill is mentioned in this experience
      if (expText.includes(skillLower)) {
        skillYears[skill] = (skillYears[skill] || 0) + years;
      }
    });
  });

  return skillYears;
}

/**
 * Parse years from date range string
 */
function parseExperienceYears(dateRange) {
  if (!dateRange) return 0;

  // Handle formats like "2020 - Present", "2017 - 2020", "Jan 2020 - Dec 2022"
  const currentYear = new Date().getFullYear();

  // Extract years
  const yearMatches = dateRange.match(/\d{4}/g);
  if (!yearMatches || yearMatches.length === 0) {
    // If no years found, assume 1 year
    return 1;
  }

  const startYear = parseInt(yearMatches[0]);
  let endYear = currentYear;

  if (yearMatches.length > 1) {
    endYear = parseInt(yearMatches[1]);
  } else if (dateRange.toLowerCase().includes('present') ||
             dateRange.toLowerCase().includes('current')) {
    endYear = currentYear;
  }

  return Math.max(endYear - startYear, 0.5); // Minimum 0.5 year
}

/**
 * Calculate total years of experience
 */
function calculateTotalYears(experiences) {
  if (!experiences || experiences.length === 0) return 0;

  let totalYears = 0;
  experiences.forEach(exp => {
    totalYears += parseExperienceYears(exp.dates);
  });

  return totalYears;
}

/**
 * Infer seniority level from profile
 */
function inferSeniorityLevel(profileData) {
  const totalYears = calculateTotalYears(profileData.experiences || []);
  const summary = (profileData.summary || '').toLowerCase();

  // Check for explicit level indicators
  if (summary.includes('senior') || summary.includes('lead')) {
    return 'senior';
  }
  if (summary.includes('principal') || summary.includes('staff')) {
    return 'lead';
  }
  if (summary.includes('director') || summary.includes('vp')) {
    return 'executive';
  }
  if (summary.includes('junior') || summary.includes('entry')) {
    return 'junior';
  }

  // Infer from years of experience
  if (totalYears < 2) return 'entry';
  if (totalYears < 4) return 'junior';
  if (totalYears < 7) return 'mid';
  if (totalYears < 10) return 'senior';
  return 'lead';
}

export default {
  extractAllSkillsFromProfile,
  calculateTotalYears,
  inferSeniorityLevel
};
