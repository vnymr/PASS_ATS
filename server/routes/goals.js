/**
 * Goals API - CRUD operations for user goals
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import { validateBody, asyncHandler, createError } from '../lib/error-handler.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * GET /api/goals
 * Get all goals for authenticated user
 */
router.get('/goals', asyncHandler(async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  // Parse query parameters
  const { status, type, limit = 50, offset = 0 } = req.query;

  // Build where clause
  const where = {
    userId: parseInt(userId)
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  if (type) {
    where.type = type.toUpperCase();
  }

  // Get goals with pagination
  const [goals, total] = await Promise.all([
    prisma.goal.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // Active goals first
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        conversation: {
          select: {
            id: true,
            title: true
          }
        }
      }
    }),
    prisma.goal.count({ where })
  ]);

  logger.info({ userId, count: goals.length, total }, 'Retrieved user goals');

  res.json({
    goals,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + goals.length < total
    }
  });
}));

/**
 * GET /api/goals/stats
 * Get goal statistics for authenticated user
 */
router.get('/goals/stats', asyncHandler(async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  // Get goal counts by status
  const stats = await prisma.goal.groupBy({
    by: ['status'],
    where: {
      userId: parseInt(userId)
    },
    _count: {
      status: true
    }
  });

  // Get goal counts by type
  const typeStats = await prisma.goal.groupBy({
    by: ['type'],
    where: {
      userId: parseInt(userId),
      status: 'ACTIVE'
    },
    _count: {
      type: true
    }
  });

  // Format response
  const statusCounts = {};
  stats.forEach(stat => {
    statusCounts[stat.status.toLowerCase()] = stat._count.status;
  });

  const typeCounts = {};
  typeStats.forEach(stat => {
    typeCounts[stat.type.toLowerCase()] = stat._count.type;
  });

  // Get upcoming goals (active goals with target dates)
  const upcomingGoals = await prisma.goal.findMany({
    where: {
      userId: parseInt(userId),
      status: 'ACTIVE',
      targetDate: {
        gte: new Date()
      }
    },
    orderBy: {
      targetDate: 'asc'
    },
    take: 5,
    select: {
      id: true,
      title: true,
      type: true,
      targetDate: true
    }
  });

  logger.info({ userId }, 'Retrieved goal stats');

  res.json({
    byStatus: statusCounts,
    byType: typeCounts,
    upcoming: upcomingGoals,
    total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
  });
}));

/**
 * GET /api/goals/:id
 * Get a specific goal by ID
 */
router.get('/goals/:id', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  const goal = await prisma.goal.findFirst({
    where: {
      id,
      userId: parseInt(userId)
    },
    include: {
      conversation: {
        select: {
          id: true,
          title: true,
          lastMessageAt: true
        }
      }
    }
  });

  if (!goal) {
    throw createError.notFound('Goal');
  }

  logger.info({ userId, goalId: id }, 'Retrieved goal');

  res.json({ goal });
}));

/**
 * POST /api/goals
 * Create a new goal
 */
router.post('/goals', validateBody({
  title: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 200
  },
  description: {
    required: false,
    type: 'string',
    maxLength: 2000
  },
  type: {
    required: false,
    type: 'string',
    enum: ['JOB_SEARCH', 'RESUME_IMPROVEMENT', 'SKILL_DEVELOPMENT', 'INTERVIEW_PREP', 'CAREER_PLANNING', 'OTHER']
  },
  targetDate: {
    required: false,
    type: 'string'
  },
  conversationId: {
    required: false,
    type: 'string'
  },
  metadata: {
    required: false,
    type: 'object'
  }
}), asyncHandler(async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  const { title, description, type, targetDate, conversationId, metadata } = req.body;

  // Validate conversationId if provided
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: parseInt(userId)
      }
    });

    if (!conversation) {
      throw createError.notFound('Conversation');
    }
  }

  // Build create data
  const createData = {
    userId: parseInt(userId),
    title,
    description: description || null,
    type: type || 'JOB_SEARCH',
    status: 'ACTIVE',
    targetDate: targetDate ? new Date(targetDate) : null,
    metadata: metadata || null
  };

  // Only add conversationId if provided
  if (conversationId) {
    createData.conversationId = conversationId;
  }

  // Create the goal
  const goal = await prisma.goal.create({
    data: createData,
    include: {
      conversation: conversationId ? {
        select: {
          id: true,
          title: true
        }
      } : false
    }
  });

  logger.info({ userId, goalId: goal.id, type: goal.type }, 'Goal created');

  res.status(201).json({ goal });
}));

/**
 * PUT /api/goals/:id
 * Update a goal
 */
router.put('/goals/:id', validateBody({
  title: {
    required: false,
    type: 'string',
    minLength: 1,
    maxLength: 200
  },
  description: {
    required: false,
    type: 'string',
    maxLength: 2000
  },
  type: {
    required: false,
    type: 'string',
    enum: ['JOB_SEARCH', 'RESUME_IMPROVEMENT', 'SKILL_DEVELOPMENT', 'INTERVIEW_PREP', 'CAREER_PLANNING', 'OTHER']
  },
  status: {
    required: false,
    type: 'string',
    enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']
  },
  targetDate: {
    required: false,
    type: 'string'
  },
  metadata: {
    required: false,
    type: 'object'
  }
}), asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  // Check if goal exists and belongs to user
  const existingGoal = await prisma.goal.findFirst({
    where: {
      id,
      userId: parseInt(userId)
    }
  });

  if (!existingGoal) {
    throw createError.notFound('Goal');
  }

  const { title, description, type, status, targetDate, metadata } = req.body;

  // Build update data
  const updateData = {};

  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (type !== undefined) updateData.type = type;
  if (status !== undefined) {
    updateData.status = status;
    // Set completedAt if status is COMPLETED
    if (status === 'COMPLETED' && !existingGoal.completedAt) {
      updateData.completedAt = new Date();
    }
    // Clear completedAt if status is not COMPLETED
    if (status !== 'COMPLETED' && existingGoal.completedAt) {
      updateData.completedAt = null;
    }
  }
  if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;
  if (metadata !== undefined) updateData.metadata = metadata;

  // Update the goal
  const goal = await prisma.goal.update({
    where: { id },
    data: updateData,
    include: {
      conversation: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  logger.info({ userId, goalId: id, updates: Object.keys(updateData) }, 'Goal updated');

  res.json({ goal });
}));

/**
 * DELETE /api/goals/:id
 * Delete a goal
 */
router.delete('/goals/:id', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  if (!userId) {
    throw createError.unauthorized('Authentication required');
  }

  // Check if goal exists and belongs to user
  const existingGoal = await prisma.goal.findFirst({
    where: {
      id,
      userId: parseInt(userId)
    }
  });

  if (!existingGoal) {
    throw createError.notFound('Goal');
  }

  // Delete the goal
  await prisma.goal.delete({
    where: { id }
  });

  logger.info({ userId, goalId: id }, 'Goal deleted');

  res.json({
    success: true,
    message: 'Goal deleted successfully'
  });
}));

export default router;
