/**
 * Routine Executor Service
 * Checks for due routines and executes them automatically in the background
 * Stores execution results for user review
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
 * Save routine execution result
 * @param {string} routineId
 * @param {object} result - { status, summary, results, duration, error }
 */
async function saveExecutionResult(routineId, result) {
  try {
    await prisma.routineExecution.create({
      data: {
        routineId,
        status: result.status || 'SUCCESS',
        summary: result.summary || null,
        results: result.results || null,
        duration: result.duration || null,
        error: result.error || null
      }
    });
    logger.info({ routineId, status: result.status }, 'Execution result saved');
  } catch (error) {
    logger.error({ error: error.message, routineId }, 'Failed to save execution result');
  }
}

/**
 * Generate daily digest for a user
 * Summarizes job search activity, applications, and goals progress
 * @param {number} userId
 * @param {object} config - Optional configuration
 * @returns {object} - Digest data
 */
async function generateDailyDigest(userId, config = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Gather data from last 24 hours
  const [applications, goals, conversations] = await Promise.all([
    // Applications submitted in last 24 hours
    prisma.autoApplyJob.findMany({
      where: {
        userId,
        createdAt: { gte: yesterday }
      },
      select: {
        id: true,
        status: true,
        job: {
          select: {
            title: true,
            company: true
          }
        },
        createdAt: true
      }
    }),

    // Active goals
    prisma.goal.findMany({
      where: {
        userId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        title: true,
        type: true,
        targetDate: true
      }
    }),

    // Conversations from last 24 hours
    prisma.conversation.count({
      where: {
        userId,
        lastMessageAt: { gte: yesterday }
      }
    })
  ]);

  // Build summary
  const submittedApps = applications.filter(a => a.status === 'SUBMITTED').length;
  const pendingApps = applications.filter(a => ['QUEUED', 'APPLYING', 'RETRYING'].includes(a.status)).length;
  const failedApps = applications.filter(a => a.status === 'FAILED').length;

  const summary = [
    `Daily Digest for ${new Date().toLocaleDateString()}`,
    '',
    `Applications:`,
    `  - Submitted: ${submittedApps}`,
    `  - Pending: ${pendingApps}`,
    `  - Failed: ${failedApps}`,
    '',
    `Active Goals: ${goals.length}`,
    goals.slice(0, 3).map(g => `  - ${g.title}`).join('\n'),
    '',
    `Conversations today: ${conversations}`
  ].join('\n');

  return {
    summary,
    data: {
      applications: {
        submitted: submittedApps,
        pending: pendingApps,
        failed: failedApps,
        details: applications
      },
      goals: {
        active: goals.length,
        list: goals
      },
      conversations
    }
  };
}

/**
 * Generate weekly summary for a user
 * Comprehensive overview of the week's job search activity
 * @param {number} userId
 * @param {object} config - Optional configuration
 * @returns {object} - Summary data
 */
async function generateWeeklySummary(userId, config = {}) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Gather data from last 7 days
  const [applications, completedGoals, newGoals, routineRuns] = await Promise.all([
    // All applications this week
    prisma.autoApplyJob.findMany({
      where: {
        userId,
        createdAt: { gte: weekAgo }
      },
      select: {
        id: true,
        status: true,
        job: {
          select: {
            title: true,
            company: true
          }
        },
        createdAt: true
      }
    }),

    // Goals completed this week
    prisma.goal.count({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: { gte: weekAgo }
      }
    }),

    // Goals created this week
    prisma.goal.count({
      where: {
        userId,
        createdAt: { gte: weekAgo }
      }
    }),

    // Routine executions this week
    prisma.routineExecution.count({
      where: {
        routine: { userId },
        createdAt: { gte: weekAgo }
      }
    })
  ]);

  // Calculate stats by day
  const appsByDay = {};
  applications.forEach(app => {
    const day = app.createdAt.toLocaleDateString();
    appsByDay[day] = (appsByDay[day] || 0) + 1;
  });

  const totalApps = applications.length;
  const submittedApps = applications.filter(a => a.status === 'SUBMITTED').length;
  const successRate = totalApps > 0 ? Math.round((submittedApps / totalApps) * 100) : 0;

  const summary = [
    `Weekly Summary: ${weekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}`,
    '',
    `Applications:`,
    `  - Total: ${totalApps}`,
    `  - Successfully Submitted: ${submittedApps}`,
    `  - Success Rate: ${successRate}%`,
    '',
    `Goals:`,
    `  - Completed: ${completedGoals}`,
    `  - Created: ${newGoals}`,
    '',
    `Automated Routines Run: ${routineRuns}`,
    '',
    `Daily Breakdown:`,
    Object.entries(appsByDay).map(([day, count]) => `  - ${day}: ${count} applications`).join('\n') || '  No applications this week'
  ].join('\n');

  return {
    summary,
    data: {
      applications: {
        total: totalApps,
        submitted: submittedApps,
        successRate,
        byDay: appsByDay,
        details: applications
      },
      goals: {
        completed: completedGoals,
        created: newGoals
      },
      routineRuns
    }
  };
}

/**
 * Execute a routine's action
 * @param {object} routine
 * @returns {object} - Execution result
 */
async function executeRoutineAction(routine) {
  const startTime = Date.now();
  let result = { status: 'SUCCESS', summary: null, results: null, error: null };

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
        // Auto-apply workflow:
        // 1. Search for jobs matching criteria
        // 2. Filter to AI-applyable jobs
        // 3. Queue applications for eligible jobs
        toolName = 'search_jobs';
        toolInput = {
          ...(routine.config || {}),
          filter: 'ai_applyable',
          limit: routine.config?.maxApplications || 5
        };
        // Note: After search, results could trigger auto-apply queue
        // For now, just find the jobs - user reviews and confirms
        result.summary = 'Found AI-applyable jobs for review';
        break;

      case 'REVIEW_APPLICATIONS':
        toolName = 'track_applications';
        toolInput = routine.config || { limit: 20 };
        break;

      case 'UPDATE_GOALS':
        toolName = 'list_goals';
        toolInput = { status: 'ACTIVE', limit: 10 };
        break;

      case 'DAILY_DIGEST':
        // Generate daily digest - no tool call, custom logic
        const digest = await generateDailyDigest(routine.userId, routine.config);
        result.summary = digest.summary;
        result.results = digest.data;

        logger.info({
          routineId: routine.id,
          userId: routine.userId,
          digestSummaryLength: digest.summary.length
        }, 'Daily digest generated');

        // TODO: Send notification/email to user with digest
        break;

      case 'WEEKLY_SUMMARY':
        // Generate weekly summary - no tool call, custom logic
        const weeklySummary = await generateWeeklySummary(routine.userId, routine.config);
        result.summary = weeklySummary.summary;
        result.results = weeklySummary.data;

        logger.info({
          routineId: routine.id,
          userId: routine.userId,
          summaryLength: weeklySummary.summary.length
        }, 'Weekly summary generated');

        // TODO: Send notification/email to user with summary
        break;

      case 'CUSTOM':
        // Custom routines can specify tool name and input in config
        if (routine.config?.toolName) {
          toolName = routine.config.toolName;
          toolInput = routine.config.toolInput || {};
        } else {
          result.status = 'FAILED';
          result.error = 'Custom routine missing toolName in config';
        }
        break;

      default:
        logger.warn({ routineId: routine.id, type: routine.type }, 'Unknown routine type');
        result.status = 'FAILED';
        result.error = `Unknown routine type: ${routine.type}`;
        break;
    }

    // Execute the tool if one was selected
    if (toolName) {
      const toolResult = await executeTool(toolName, toolInput, ctx);
      result.results = toolResult;

      // Generate human-readable summary based on tool
      if (toolName === 'search_jobs') {
        const jobCount = toolResult.items?.length || 0;
        const total = toolResult.paging?.total || 0;
        result.summary = `Found ${jobCount} jobs (${total} total matching)`;
        if (jobCount > 0) {
          result.summary += '\nTop results:\n' + toolResult.items.slice(0, 3)
            .map(j => `  - ${j.title} at ${j.company}`)
            .join('\n');
        }
      } else if (toolName === 'track_applications') {
        const appCount = toolResult.applications?.length || 0;
        result.summary = `Tracking ${appCount} applications`;
      } else if (toolName === 'list_goals') {
        const goalCount = toolResult.goals?.length || 0;
        result.summary = `${goalCount} active goals`;
      }

      logger.info({
        routineId: routine.id,
        toolName,
        resultSize: JSON.stringify(toolResult).length
      }, 'Routine tool executed successfully');
    }

  } catch (error) {
    logger.error({
      error: error.message,
      routineId: routine.id,
      type: routine.type
    }, 'Routine execution failed');

    result.status = 'FAILED';
    result.error = error.message;
  }

  // Calculate duration
  result.duration = Date.now() - startTime;

  return result;
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
      const result = await executeRoutineAction(routine);

      // Save execution result for user review
      await saveExecutionResult(routine.id, result);

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
        nextRun,
        executionStatus: result.status
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

/**
 * Get recent execution history for a routine
 * @param {string} routineId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getRoutineExecutions(routineId, limit = 10) {
  return prisma.routineExecution.findMany({
    where: { routineId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

/**
 * Get all executions for a user's routines
 * @param {number} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getUserRoutineExecutions(userId, limit = 20) {
  return prisma.routineExecution.findMany({
    where: {
      routine: { userId }
    },
    include: {
      routine: {
        select: {
          id: true,
          title: true,
          type: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
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
