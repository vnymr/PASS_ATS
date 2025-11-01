/**
 * Memory Extraction Service
 * Extracts facts, preferences, and context from conversations using LLM
 */

import OpenAI from 'openai';
import { updateUserProfile, addMemory } from './profile-manager.js';
import logger from '../logger.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extract and update user profile from conversation
 * @param {number} userId
 * @param {Array} conversation - Array of { role, content } messages
 * @returns {Promise<object>} - Extracted information
 */
export async function extractAndUpdateProfile(userId, conversation) {
  try {
    // Build conversation text
    const conversationText = conversation
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    logger.info({ userId, messageCount: conversation.length }, 'Extracting profile information from conversation');

    // Call OpenAI to extract information
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a profile extraction assistant. Analyze the conversation and extract:
1. Job search preferences (target roles, locations, salary, experience level)
2. User context (current role, years of experience, education, career goals)
3. Learned preferences (preferred companies, ATS types, auto-apply preference)
4. A brief summary of what the user is looking for

Return ONLY a JSON object with this structure:
{
  "preferences": {
    "targetRoles": ["role1", "role2"],
    "locations": ["location1"],
    "salaryMin": number or null,
    "experienceLevel": "Junior|Mid|Senior|Staff|Principal" or null,
    "skills": ["skill1", "skill2"],
    "mustHaveAutoApply": boolean
  },
  "context": {
    "currentRole": "string or null",
    "yearsExperience": number or null,
    "careerGoals": "string or null"
  },
  "learned": {
    "preferredCompanies": ["company1"],
    "avoidedCompanies": ["company2"],
    "preferredATS": ["GREENHOUSE", "LEVER"]
  },
  "summary": "One sentence about what the user is looking for"
}

IMPORTANT:
- Only extract information that is EXPLICITLY mentioned
- Use null for fields not mentioned
- For targetRoles, normalize to standard titles (e.g., "pm" → "Product Manager", "swe" → "Software Engineer")
- Return empty arrays if no data for that category
- Be conservative - don't infer too much`
        },
        {
          role: 'user',
          content: `Extract profile information from this conversation:\n\n${conversationText}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800
    });

    const extracted = JSON.parse(completion.choices[0].message.content);

    logger.info({ userId, extracted }, 'Extracted profile information');

    // Update profile with extracted information (only non-null/non-empty values)
    const updates = {};

    // Merge preferences
    if (hasContent(extracted.preferences)) {
      updates.preferences = filterNonEmpty(extracted.preferences);
    }

    // Merge context
    if (hasContent(extracted.context)) {
      updates.context = filterNonEmpty(extracted.context);
    }

    // Merge learned
    if (hasContent(extracted.learned)) {
      updates.learned = filterNonEmpty(extracted.learned);
    }

    // Only update if we extracted something
    if (Object.keys(updates).length > 0) {
      await updateUserProfile(userId, updates);
    }

    // Add conversation memory
    if (extracted.summary) {
      await addMemory(userId, {
        summary: extracted.summary,
        facts: extractFactsFromJson(extracted)
      });
    }

    return extracted;

  } catch (error) {
    logger.error({ error: error.message, userId }, 'Memory extraction failed');
    return null;
  }
}

/**
 * Quick fact extraction (faster, for every conversation)
 * @param {number} userId
 * @param {string} userMessage
 * @param {string} assistantResponse
 * @returns {Promise<void>}
 */
export async function quickExtract(userId, userMessage, assistantResponse) {
  try {
    // Simple pattern matching for common preferences
    const updates = {};

    // Extract target roles
    const rolePatterns = [
      /looking for (.+?) (roles|jobs|positions)/i,
      /interested in (.+?) (roles|jobs|positions)/i,
      /want (.+?) (roles|jobs|positions)/i,
      /find (.+?) (roles|jobs|positions)/i
    ];

    for (const pattern of rolePatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        const role = match[1].trim();
        // Normalize common abbreviations
        const normalized = normalizeRole(role);
        if (normalized) {
          updates.preferences = { targetRoles: [normalized] };
          break;
        }
      }
    }

    // Extract location preferences
    if (/remote/i.test(userMessage)) {
      updates.preferences = { ...updates.preferences, locations: ['Remote'] };
    }

    // Extract auto-apply preference
    if (/auto.?apply/i.test(userMessage)) {
      updates.preferences = { ...updates.preferences, mustHaveAutoApply: true };
    }

    // Update if we found anything
    if (Object.keys(updates).length > 0) {
      await updateUserProfile(userId, updates);
      logger.info({ userId, updates }, 'Quick profile update from patterns');
    }

  } catch (error) {
    logger.error({ error: error.message, userId }, 'Quick extraction failed');
  }
}

/**
 * Check if object has any non-null/non-empty content
 * @param {object} obj
 * @returns {boolean}
 */
function hasContent(obj) {
  if (!obj) return false;

  for (const value of Object.values(obj)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length > 0) return true;
      if (typeof value === 'string' && value.trim().length > 0) return true;
      if (typeof value === 'number') return true;
      if (typeof value === 'boolean') return true;
    }
  }

  return false;
}

/**
 * Filter out null/empty values from object
 * @param {object} obj
 * @returns {object}
 */
function filterNonEmpty(obj) {
  const filtered = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        if (value.length > 0) filtered[key] = value;
      } else if (typeof value === 'string') {
        if (value.trim().length > 0) filtered[key] = value;
      } else {
        filtered[key] = value;
      }
    }
  }

  return filtered;
}

/**
 * Extract facts from JSON for memory storage
 * @param {object} extracted
 * @returns {Array<string>}
 */
function extractFactsFromJson(extracted) {
  const facts = [];

  if (extracted.preferences?.targetRoles?.length > 0) {
    facts.push(`Target roles: ${extracted.preferences.targetRoles.join(', ')}`);
  }

  if (extracted.preferences?.locations?.length > 0) {
    facts.push(`Locations: ${extracted.preferences.locations.join(', ')}`);
  }

  if (extracted.preferences?.salaryMin) {
    facts.push(`Minimum salary: $${extracted.preferences.salaryMin.toLocaleString()}`);
  }

  if (extracted.context?.currentRole) {
    facts.push(`Current role: ${extracted.context.currentRole}`);
  }

  if (extracted.context?.yearsExperience) {
    facts.push(`Experience: ${extracted.context.yearsExperience} years`);
  }

  return facts;
}

/**
 * Normalize role names
 * @param {string} role
 * @returns {string|null}
 */
function normalizeRole(role) {
  const normalized = role.toLowerCase().trim();

  const roleMap = {
    'pm': 'Product Manager',
    'product manager': 'Product Manager',
    'product mgmt': 'Product Manager',
    'swe': 'Software Engineer',
    'software engineer': 'Software Engineer',
    'software developer': 'Software Engineer',
    'backend': 'Backend Engineer',
    'frontend': 'Frontend Engineer',
    'full stack': 'Full Stack Engineer',
    'data scientist': 'Data Scientist',
    'data engineer': 'Data Engineer',
    'ml engineer': 'Machine Learning Engineer'
  };

  return roleMap[normalized] || (role.length > 3 ? role : null);
}
