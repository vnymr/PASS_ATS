/**
 * Profile Management API
 * Endpoints for managing user preferences and profile data
 */

import express from 'express';
import { getUserProfile, updateUserProfile } from '../lib/agents/profile-manager.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * GET /api/profile
 * Get user profile with preferences and memories
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.userId; // Set by authenticateToken middleware

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const profile = await getUserProfile(userId);

    res.json({
      success: true,
      profile
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to get profile');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile'
    });
  }
});

/**
 * POST /api/profile
 * Update user profile preferences
 *
 * Body: {
 *   preferences?: {
 *     targetRoles?: string[],
 *     locations?: string[],
 *     salaryMin?: number,
 *     experienceLevel?: string,
 *     skills?: string[],
 *     mustHaveAutoApply?: boolean,
 *     preferredATS?: string[]
 *   },
 *   context?: {
 *     currentRole?: string,
 *     yearsExperience?: number,
 *     education?: string,
 *     careerGoals?: string
 *   }
 * }
 */
router.post('/profile', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const updates = req.body;

    // Validate input
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid profile data' });
    }

    // Update profile
    const updatedProfile = await updateUserProfile(userId, updates);

    logger.info({ userId, updatedFields: Object.keys(updates) }, 'Profile updated via API');

    res.json({
      success: true,
      profile: updatedProfile
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to update profile');
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * POST /api/profile/preferences
 * Update only preferences (convenience endpoint)
 */
router.post('/profile/preferences', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const preferences = req.body;

    // Wrap in preferences object
    const updates = { preferences };

    const updatedProfile = await updateUserProfile(userId, updates);

    res.json({
      success: true,
      preferences: updatedProfile.preferences
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to update preferences');
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

/**
 * GET /api/profile/memories
 * Get conversation memories
 */
router.get('/profile/memories', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const profile = await getUserProfile(userId);

    res.json({
      success: true,
      memories: profile.memories || []
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to get memories');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve memories'
    });
  }
});

export default router;
