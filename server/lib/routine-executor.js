/**
 * Routine Executor Service
 * Checks for due routines and executes them automatically in the background
 */

import { prisma } from './prisma-client.js';
import { executeTool } from './agents/tools.js';
import logger from './logger.js';

// Track execution interval ID
let executorInterval = null;

/**
 * Calculate next run time for a routine
 * @param {object} routine
 * @returns {Date}
 */
function calculateNextRun(routine) {
  const now = new Date();
  let nextRun = new Date();

  switch (routine.frequency.toUpperCase()) {
    case 'HOURLY':
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
      break;

    case 'DAILY':
      const [hours, minutes] = routine.schedule.split(':').map(Number);
      nextRun.setHours(hours, minutes, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'WEEKLY':
      const [weekHours, weekMinutes] = routine.schedule.split(':').map(Number);
      nextRun.setHours(weekHours, weekMinutes, 0, 0);
      nextRun.setDate(nextRun.getDate() + 7);
      break;

    case 'MONTHLY':
      const [monthHours, monthMinutes] = routine.schedule.split(':').map(Number);
      nextRun.setHours(monthHours, monthMinutes, 0, 0);
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;

    default:
      // Default to 1 hour from now
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
  }

  return nextRun;
}

/**
 * Execute a routine's action
 * @param {object} routine
 */
async function executeRoutineAction(routine) {
  try {
    logger.info({ routineId: routine.id, type: routine.type, userId: routine.userId }, 'Executing routine');

    const ctx = {
      userId: routine.userId,
      conversationId: null,
      metadata: {
        source: 'routine_executor',
        routineId: routine.id
      }
    };

    // Build tool call based on routine type
    let toolName = null;
    let toolInput = {};

    switch (routine.type) {
      case 'SEARCH_JOBS':
        toolName = 'search_jobs';
        toolInput = routine.config || { limit: 10 };
        // Add recent jobs filter (last 24 hours)
        if (!toolInput.postedSince) {
          toolInput.postedSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        }
        break;

      case 'APPLY_TO_JOBS':
        // This would require more complex logic:
        // 1. Search for jobs
        // 2. Filter eligible ones
        // 3. Submit applications
        // For now, we'll log and skip
        logger.info({ routineId: routine.id }, 'APPLY_TO_JOBS routine requires manual implementation');
        return;

      case 'REVIEW_APPLICATIONS':
        toolName = 'track_applications';
        toolInput = routine.config || { limit: 10 };
        break;

      case 'UPDATE_GOALS':
        toolName = 'list_goals';
        toolInput = routine.config || { limit: 10 };
        break;

      default:
        logger.warn({ routineId: routine.id, type: routine.type }, 'Unknown routine type');
        return;
    }

    if (toolName) {
      // Execute the tool
      const result = await executeTool(toolName, toolInput, ctx);

      logger.info({
        routineId: routine.id,
        toolName,
        resultSize: JSON.stringify(result).length
      }, 'Routine executed successfully');

      // TODO: Store results or notify user
      // Could create a notification system here
    }

  } catch (error) {
    logger.error({
      error: error.message,
      routineId: routine.id,
      type: routine.type
    }, 'Routine execution failed');
  }
}

/**
 * Check for due routines and execute them
 */
async function checkAndExecuteDueRoutines() {
  try {
    const now = new Date();

    // Find all active routines that are due
    const dueRoutines = await prisma.routine.findMany({
      where: {
        isActive: true,
        nextRun: {
          lte: now
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (dueRoutines.length > 0) {
      logger.info({ count: dueRoutines.length }, 'Found due routines to execute');
    }

    // Execute each routine
    for (const routine of dueRoutines) {
      // Execute the routine action
      await executeRoutineAction(routine);

      // Update routine with new timestamps
      const nextRun = calculateNextRun(routine);

      await prisma.routine.update({
        where: { id: routine.id },
        data: {
          lastRun: now,
          nextRun,
          runCount: {
            increment: 1
          }
        }
      });

      logger.info({
        routineId: routine.id,
        nextRun
      }, 'Routine updated with next run time');
    }

  } catch (error) {
    logger.error({ error: error.message }, 'Error checking due routines');
  }
}

/**
 * Start the routine executor service
 * Checks for due routines every minute
 */
export function startRoutineExecutor() {
  if (executorInterval) {
    logger.warn('Routine executor already running');
    return;
  }

  logger.info('Starting routine executor service');

  // Run immediately on start
  checkAndExecuteDueRoutines();

  // Then run every minute
  executorInterval = setInterval(checkAndExecuteDueRoutines, 60 * 1000);

  logger.info('Routine executor service started (runs every 60 seconds)');
}

/**
 * Stop the routine executor service
 */
export function stopRoutineExecutor() {
  if (executorInterval) {
    clearInterval(executorInterval);
    executorInterval = null;
    logger.info('Routine executor service stopped');
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping routine executor');
  stopRoutineExecutor();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping routine executor');
  stopRoutineExecutor();
});
