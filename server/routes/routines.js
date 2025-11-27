/**
 * Routines management routes
 * Allows users to view, manage, and check execution history of their automated routines
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma-client.js';
import { getRoutineExecutions, getUserRoutineExecutions } from '../lib/routine-executor.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * GET /api/routines/executions/all
 * Get all recent executions across all user's routines
 * NOTE: This must be before /:id routes to avoid conflict
 */
router.get('/routines/executions/all', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = 50 } = req.query;
    const executions = await getUserRoutineExecutions(parseInt(userId), parseInt(limit));

    res.json({
      executions,
      total: executions.length
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to get user routine executions');
    res.status(500).json({ error: 'Failed to get routine executions' });
  }
});

/**
 * GET /api/routines
 * List all routines for the authenticated user
 */
router.get('/routines', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { isActive, limit = 50 } = req.query;

    const where = { userId: parseInt(userId) };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const routines = await prisma.routine.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { nextRun: 'asc' }
      ],
      take: parseInt(limit),
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        frequency: true,
        schedule: true,
        config: true,
        isActive: true,
        lastRun: true,
        nextRun: true,
        runCount: true,
        createdAt: true
      }
    });

    res.json({
      routines,
      total: routines.length
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to list routines');
    res.status(500).json({ error: 'Failed to list routines' });
  }
});

/**
 * GET /api/routines/:id
 * Get a specific routine with its recent execution history
 */
router.get('/routines/:id', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const routine = await prisma.routine.findFirst({
      where: { id, userId: parseInt(userId) },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            summary: true,
            duration: true,
            error: true,
            createdAt: true
          }
        }
      }
    });

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    res.json({ routine });

  } catch (error) {
    logger.error({ error: error.message, routineId: req.params.id }, 'Failed to get routine');
    res.status(500).json({ error: 'Failed to get routine' });
  }
});

/**
 * POST /api/routines
 * Create a new routine
 */
router.post('/routines', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { title, description, type, frequency, schedule, config } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Calculate initial nextRun
    const now = new Date();
    let nextRun = new Date();
    const [hours, minutes] = (schedule || '09:00').split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      // Schedule for next occurrence
      switch ((frequency || 'DAILY').toUpperCase()) {
        case 'HOURLY':
          nextRun.setHours(now.getHours() + 1, 0, 0, 0);
          break;
        case 'DAILY':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'WEEKLY':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'MONTHLY':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }

    const routine = await prisma.routine.create({
      data: {
        userId: parseInt(userId),
        title,
        description,
        type: type || 'SEARCH_JOBS',
        frequency: frequency || 'DAILY',
        schedule: schedule || '09:00',
        config: config || null,
        nextRun
      }
    });

    logger.info({ routineId: routine.id, userId, type: routine.type }, 'Routine created');

    res.status(201).json({
      success: true,
      routine
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to create routine');
    res.status(500).json({ error: 'Failed to create routine' });
  }
});

/**
 * PATCH /api/routines/:id
 * Update a routine
 */
router.patch('/routines/:id', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { title, description, frequency, schedule, config, isActive } = req.body;

    // Verify ownership
    const existing = await prisma.routine.findFirst({
      where: { id, userId: parseInt(userId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (config !== undefined) updateData.config = config;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Recalculate nextRun if schedule or frequency changed
    if (frequency !== undefined || schedule !== undefined) {
      const newSchedule = schedule || existing.schedule;
      const newFrequency = frequency || existing.frequency;
      const [hours, minutes] = newSchedule.split(':').map(Number);

      const now = new Date();
      let nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);

      if (nextRun <= now) {
        switch (newFrequency.toUpperCase()) {
          case 'HOURLY':
            nextRun.setHours(now.getHours() + 1, 0, 0, 0);
            break;
          case 'DAILY':
            nextRun.setDate(nextRun.getDate() + 1);
            break;
          case 'WEEKLY':
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          case 'MONTHLY':
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
        }
      }
      updateData.nextRun = nextRun;
    }

    const routine = await prisma.routine.update({
      where: { id },
      data: updateData
    });

    logger.info({ routineId: id, userId, updates: Object.keys(updateData) }, 'Routine updated');

    res.json({
      success: true,
      routine
    });

  } catch (error) {
    logger.error({ error: error.message, routineId: req.params.id }, 'Failed to update routine');
    res.status(500).json({ error: 'Failed to update routine' });
  }
});

/**
 * DELETE /api/routines/:id
 * Delete a routine
 */
router.delete('/routines/:id', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.routine.findFirst({
      where: { id, userId: parseInt(userId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    await prisma.routine.delete({
      where: { id }
    });

    logger.info({ routineId: id, userId }, 'Routine deleted');

    res.json({
      success: true,
      message: 'Routine deleted successfully'
    });

  } catch (error) {
    logger.error({ error: error.message, routineId: req.params.id }, 'Failed to delete routine');
    res.status(500).json({ error: 'Failed to delete routine' });
  }
});

/**
 * GET /api/routines/:id/executions
 * Get execution history for a specific routine
 */
router.get('/routines/:id/executions', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { limit = 20 } = req.query;

    // Verify ownership
    const existing = await prisma.routine.findFirst({
      where: { id, userId: parseInt(userId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    const executions = await getRoutineExecutions(id, parseInt(limit));

    res.json({
      executions,
      routineId: id,
      total: executions.length
    });

  } catch (error) {
    logger.error({ error: error.message, routineId: req.params.id }, 'Failed to get routine executions');
    res.status(500).json({ error: 'Failed to get routine executions' });
  }
});

/**
 * POST /api/routines/:id/trigger
 * Manually trigger a routine execution (for testing)
 */
router.post('/routines/:id/trigger', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Verify ownership
    const routine = await prisma.routine.findFirst({
      where: { id, userId: parseInt(userId) }
    });

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    // Update nextRun to now so it gets picked up next cycle
    await prisma.routine.update({
      where: { id },
      data: {
        nextRun: new Date()
      }
    });

    logger.info({ routineId: id, userId }, 'Routine manually triggered');

    res.json({
      success: true,
      message: 'Routine will execute within the next minute'
    });

  } catch (error) {
    logger.error({ error: error.message, routineId: req.params.id }, 'Failed to trigger routine');
    res.status(500).json({ error: 'Failed to trigger routine' });
  }
});

export default router;
