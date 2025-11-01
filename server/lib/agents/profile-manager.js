/**
 * User Profile Manager
 * Manages user preferences, job search criteria, and learned behaviors
 */

import { prisma } from '../prisma-client.js';
import logger from '../logger.js';

/**
 * Default profile structure
 */
const DEFAULT_PROFILE = {
  // Explicit preferences
  preferences: {
    targetRoles: [],
    locations: [],
    salaryMin: null,
    salaryMax: null,
    experienceLevel: null,
    skills: [],
    industries: [],
    mustHaveAutoApply: false,
    preferredATS: []
  },

  // Learned from conversations
  learned: {
    preferredCompanies: [],
    avoidedCompanies: [],
    commonKeywords: [],
    searchPatterns: {}
  },

  // User context
  context: {
    currentRole: null,
    yearsExperience: null,
    education: null,
    careerGoals: null
  },

  // Conversation memories (rolling window)
  memories: [],

  // Metadata
  meta: {
    lastUpdated: new Date().toISOString(),
    conversationCount: 0
  }
};

/**
 * Get user profile
 * @param {number} userId
 * @returns {Promise<object>}
 */
export async function getUserProfile(userId) {
  try {
    let profile = await prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      // Create default profile
      profile = await prisma.profile.create({
        data: {
          userId,
          data: DEFAULT_PROFILE
        }
      });
      logger.info({ userId }, 'Created default user profile');
    }

    return profile.data;
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get user profile');
    return DEFAULT_PROFILE;
  }
}

/**
 * Update user profile
 * @param {number} userId
 * @param {object} updates - Partial profile updates
 * @returns {Promise<object>}
 */
export async function updateUserProfile(userId, updates) {
  try {
    // Get current profile
    const currentProfile = await getUserProfile(userId);

    // Deep merge updates
    const updatedProfile = mergeDeep(currentProfile, updates);

    // Ensure meta exists and update metadata
    if (!updatedProfile.meta) {
      updatedProfile.meta = {};
    }
    updatedProfile.meta.lastUpdated = new Date().toISOString();

    // Save to database
    const profile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        data: updatedProfile
      },
      update: {
        data: updatedProfile,
        updatedAt: new Date()
      }
    });

    logger.info({ userId, updatedFields: Object.keys(updates) }, 'Updated user profile');

    return profile.data;
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to update user profile');
    throw error;
  }
}

/**
 * Add memory to user profile
 * @param {number} userId
 * @param {object} memory - { date, summary, facts }
 */
export async function addMemory(userId, memory) {
  try {
    const profile = await getUserProfile(userId);

    // Add memory with timestamp
    const newMemory = {
      date: memory.date || new Date().toISOString(),
      summary: memory.summary,
      facts: memory.facts || []
    };

    // Keep only last 50 memories
    const memories = [...(profile.memories || []), newMemory].slice(-50);

    await updateUserProfile(userId, { memories });

    logger.info({ userId, memoryCount: memories.length }, 'Added conversation memory');
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to add memory');
  }
}

/**
 * Get search defaults from profile
 * @param {object} profile
 * @returns {object} - Default search parameters
 */
export function getSearchDefaults(profile) {
  const defaults = {};

  if (profile.preferences?.targetRoles?.length > 0) {
    defaults.role = profile.preferences.targetRoles[0]; // Use first target role
  }

  if (profile.preferences?.locations?.length > 0) {
    defaults.location = profile.preferences.locations[0];
  }

  if (profile.preferences?.mustHaveAutoApply) {
    defaults.filter = 'ai_applyable';
  }

  if (profile.preferences?.preferredATS?.length > 0) {
    defaults.atsType = profile.preferences.preferredATS[0];
  }

  return defaults;
}

/**
 * Extract profile context for LLM
 * @param {object} profile
 * @returns {string}
 */
export function getProfileContext(profile) {
  const parts = [];

  // Target roles
  if (profile.preferences?.targetRoles?.length > 0) {
    parts.push(`Target roles: ${profile.preferences.targetRoles.join(', ')}`);
  }

  // Location preferences
  if (profile.preferences?.locations?.length > 0) {
    parts.push(`Preferred locations: ${profile.preferences.locations.join(', ')}`);
  }

  // Salary
  if (profile.preferences?.salaryMin) {
    parts.push(`Minimum salary: $${profile.preferences.salaryMin.toLocaleString()}`);
  }

  // Experience
  if (profile.context?.yearsExperience) {
    parts.push(`${profile.context.yearsExperience} years of experience`);
  }

  // Current role
  if (profile.context?.currentRole) {
    parts.push(`Currently: ${profile.context.currentRole}`);
  }

  // Career goals
  if (profile.context?.careerGoals) {
    parts.push(`Goals: ${profile.context.careerGoals}`);
  }

  // Preferences
  if (profile.preferences?.mustHaveAutoApply) {
    parts.push('Prefers auto-apply jobs');
  }

  // Recent memories (last 3)
  const recentMemories = (profile.memories || []).slice(-3);
  if (recentMemories.length > 0) {
    parts.push('\nRecent context:');
    recentMemories.forEach(mem => {
      parts.push(`- ${mem.summary}`);
    });
  }

  return parts.length > 0 ? parts.join('\n') : 'No profile information yet';
}

/**
 * Deep merge two objects
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function mergeDeep(target, source) {
  const output = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}
