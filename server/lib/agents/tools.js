/**
 * Tool implementations with real Prisma-based search_jobs
 */

import { prisma } from '../prisma-client.js';
import logger from '../logger.js';

/**
 * Search for jobs using Prisma (role-first, recency-first)
 * @param {object} args
 * @param {object} ctx - Execution context
 * @returns {Promise<object>}
 */
async function searchJobs(args, ctx = {}) {
  const {
    role,
    query,
    filter = 'all',
    atsType,
    company,
    location,
    postedSince,
    limit = 10,
    offset = 0
  } = args;

  logger.info({ args, ctx }, 'Executing search_jobs');

  // Build WHERE clause
  const where = {
    isActive: true
  };

  // Role-first: prioritize role if provided
  if (role) {
    where.title = {
      contains: role,
      mode: 'insensitive'
    };
  } else if (query) {
    // Fallback to general query search
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { company: { contains: query, mode: 'insensitive' } }
    ];
  }

  // Filter by application method
  if (filter === 'ai_applyable') {
    where.aiApplyable = true;
  } else if (filter === 'manual') {
    where.aiApplyable = false;
  }

  // Filter by ATS type
  if (atsType) {
    where.atsType = atsType;
  }

  // Filter by company
  if (company) {
    where.company = {
      contains: company,
      mode: 'insensitive'
    };
  }

  // Filter by location
  if (location) {
    where.location = {
      contains: location,
      mode: 'insensitive'
    };
  }

  // Filter by posted date (temporal filtering)
  if (postedSince) {
    // postedSince should be an ISO 8601 date string
    const sinceDate = new Date(postedSince);
    if (!isNaN(sinceDate.getTime())) {
      where.postedDate = {
        gte: sinceDate
      };
      logger.info({ postedSince, sinceDate }, 'Applied temporal filter');
    } else {
      logger.warn({ postedSince }, 'Invalid postedSince date format, ignoring');
    }
  }

  try {
    // Get total count for pagination
    const total = await prisma.aggregatedJob.count({ where });

    // Fetch jobs ordered by recency (postedDate desc)
    const jobs = await prisma.aggregatedJob.findMany({
      where,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        salary: true,
        applyUrl: true,
        atsType: true,
        aiApplyable: true,
        postedDate: true,
        extractedSkills: true,
        extractedJobLevel: true,
        description: true
      },
      orderBy: {
        postedDate: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Format response
    const items = jobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location || 'Remote',
      salary: job.salary || 'Not specified',
      applyUrl: job.applyUrl,
      atsType: job.atsType,
      aiApplyable: job.aiApplyable,
      postedDate: job.postedDate.toISOString(),
      skills: job.extractedSkills || [],
      level: job.extractedJobLevel || null,
      snippet: job.description ? job.description.substring(0, 200) + '...' : ''
    }));

    logger.info({ count: items.length, total, role }, 'search_jobs completed');

    return {
      items,
      paging: {
        limit,
        offset,
        total
      },
      role: role || null
    };
  } catch (error) {
    logger.error({ error: error.message, args }, 'search_jobs failed');
    throw new Error(`Failed to search jobs: ${error.message}`);
  }
}

/**
 * Generate resume preview with actual PDF generation
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function generateResumePreview(args, ctx = {}) {
  const { jobUrl, jobId, jobDescription } = args;
  const { userId } = ctx;

  logger.info({ jobUrl, jobId, userId }, 'Generating resume preview');

  try {
    // Import AIResumeGenerator dynamically
    const { default: AIResumeGenerator } = await import('../ai-resume-generator.js');
    const { getUserProfile } = await import('./profile-manager.js');

    // Get user profile data
    const profile = await getUserProfile(userId);
    if (!profile) {
      throw new Error('User profile not found. Please complete your profile first.');
    }

    // Get job description if not provided
    let targetJobDescription = jobDescription;
    if (!targetJobDescription && jobId) {
      // Try to fetch job from aggregated jobs
      const job = await prisma.aggregatedJob.findUnique({
        where: { id: jobId },
        select: { description: true, title: true, company: true, requirements: true }
      });

      if (job) {
        targetJobDescription = `${job.title} at ${job.company}\n\n${job.description}${job.requirements ? '\n\nRequirements:\n' + job.requirements : ''}`;
      }
    }

    if (!targetJobDescription) {
      throw new Error('Job description is required. Please provide jobDescription or jobId.');
    }

    // Generate resume using AI
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);
    const result = await generator.generateAndCompile(profile, targetJobDescription, {
      model: 'gpt-4'
    });

    // Store the generated resume (create a job entry for it)
    const job = await prisma.job.create({
      data: {
        userId: parseInt(userId),
        jobDescription: targetJobDescription,
        jobUrl: jobUrl || null,
        status: 'COMPLETED',
        aiMode: 'preview'
      }
    });

    // Store artifacts
    await prisma.artifact.create({
      data: {
        jobId: job.id,
        type: 'LATEX_SOURCE',
        content: Buffer.from(result.latex),
        validated: true
      }
    });

    const pdfArtifact = await prisma.artifact.create({
      data: {
        jobId: job.id,
        type: 'PDF_OUTPUT',
        content: result.pdf,
        validated: true
      }
    });

    logger.info({ jobId: job.id, userId }, 'Resume preview generated successfully');

    return {
      previewId: job.id,
      jobUrl,
      pdfUrl: `/api/jobs/${job.id}/artifacts/${pdfArtifact.id}`,
      highlights: result.metadata?.matchedSkills?.slice(0, 5) || [
        'Resume tailored to job requirements',
        'Relevant skills highlighted',
        'Experience optimized for ATS'
      ],
      risks: result.metadata?.unmatchedKeywords?.slice(0, 3).map(kw => `Missing: ${kw}`) || [],
      metadata: result.metadata,
      message: 'Resume preview ready! You can download the PDF or request changes.'
    };
  } catch (error) {
    logger.error({ error: error.message, jobUrl, userId }, 'Resume preview generation failed');
    throw new Error(`Failed to generate resume preview: ${error.message}`);
  }
}

/**
 * Prepare application preview with eligibility check
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function prepareApplicationPreview(args, ctx = {}) {
  const { jobUrl, jobId } = args;
  const { userId } = ctx;

  logger.info({ jobUrl, jobId, userId }, 'Preparing application preview');

  try {
    // Get job details
    let job;
    if (jobId) {
      job = await prisma.aggregatedJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          description: true,
          requirements: true,
          applyUrl: true,
          atsType: true,
          aiApplyable: true,
          atsComplexity: true,
          extractedSkills: true
        }
      });
    }

    if (!job) {
      throw new Error('Job not found. Please provide a valid jobId.');
    }

    // Check if user has profile
    const { getUserProfile } = await import('./profile-manager.js');
    const profile = await getUserProfile(userId);

    if (!profile) {
      return {
        eligible: false,
        reason: 'Please complete your profile before applying to jobs.',
        jobId: job.id,
        jobTitle: job.title,
        company: job.company
      };
    }

    // Check if job is AI-applyable
    if (!job.aiApplyable) {
      return {
        eligible: false,
        reason: `This job requires manual application. ATS Type: ${job.atsType}, Complexity: ${job.atsComplexity}`,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        applyUrl: job.applyUrl,
        message: 'You can still generate a tailored resume and apply manually.'
      };
    }

    // Check if user has already applied
    const existingApplication = await prisma.autoApplication.findUnique({
      where: {
        userId_jobId: {
          userId: parseInt(userId),
          jobId: job.id
        }
      }
    });

    if (existingApplication) {
      return {
        eligible: false,
        reason: `You have already applied to this job on ${existingApplication.createdAt.toLocaleDateString()}`,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        applicationStatus: existingApplication.status,
        appliedAt: existingApplication.createdAt
      };
    }

    // Generate resume preview for this job
    const jobDescription = `${job.title} at ${job.company}\n\n${job.description}${job.requirements ? '\n\nRequirements:\n' + job.requirements : ''}`;

    const { default: AIResumeGenerator } = await import('../ai-resume-generator.js');
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

    const result = await generator.generateAndCompile(profile, jobDescription, {
      model: 'gpt-4'
    });

    // Store the resume
    const resumeJob = await prisma.job.create({
      data: {
        userId: parseInt(userId),
        jobDescription,
        jobUrl: job.applyUrl,
        status: 'COMPLETED',
        aiMode: 'auto_apply_preview'
      }
    });

    await prisma.artifact.create({
      data: {
        jobId: resumeJob.id,
        type: 'LATEX_SOURCE',
        content: Buffer.from(result.latex),
        validated: true
      }
    });

    const pdfArtifact = await prisma.artifact.create({
      data: {
        jobId: resumeJob.id,
        type: 'PDF_OUTPUT',
        content: result.pdf,
        validated: true
      }
    });

    logger.info({ jobId: job.id, userId, resumeJobId: resumeJob.id }, 'Application preview prepared successfully');

    return {
      eligible: true,
      previewId: resumeJob.id,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      atsType: job.atsType,
      pdfUrl: `/api/jobs/${resumeJob.id}/artifacts/${pdfArtifact.id}`,
      estimatedTime: job.atsComplexity === 'SIMPLE' ? '1-2 minutes' : '2-4 minutes',
      requiredSkills: job.extractedSkills?.slice(0, 5) || [],
      matchedSkills: result.metadata?.matchedSkills?.slice(0, 5) || [],
      message: 'Application preview ready! Review the resume and confirm to submit automatically.',
      nextSteps: [
        'Review the generated resume',
        'Confirm personal information',
        'Submit application automatically'
      ]
    };
  } catch (error) {
    logger.error({ error: error.message, jobId, userId }, 'Application preview failed');
    throw new Error(`Failed to prepare application preview: ${error.message}`);
  }
}

/**
 * Create a goal for the user
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function createGoal(args, ctx = {}) {
  const { title, description, type, targetDate, metadata } = args;
  const { userId, conversationId } = ctx;

  logger.info({ userId, title, type }, 'Creating goal');

  try {
    const goal = await prisma.goal.create({
      data: {
        userId: parseInt(userId),
        conversationId: conversationId || null,
        title,
        description: description || null,
        type: type || 'JOB_SEARCH',
        status: 'ACTIVE',
        targetDate: targetDate ? new Date(targetDate) : null,
        metadata: metadata || null
      }
    });

    logger.info({ goalId: goal.id, userId }, 'Goal created successfully');

    return {
      goalId: goal.id,
      title: goal.title,
      type: goal.type,
      status: goal.status,
      targetDate: goal.targetDate,
      message: `Goal created: ${goal.title}`
    };
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to create goal');
    throw new Error(`Failed to create goal: ${error.message}`);
  }
}

/**
 * Update an existing goal
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function updateGoal(args, ctx = {}) {
  const { goalId, status, progress, notes } = args;
  const { userId } = ctx;

  logger.info({ userId, goalId, status }, 'Updating goal');

  try {
    // Verify goal belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: { id: goalId, userId: parseInt(userId) }
    });

    if (!existingGoal) {
      throw new Error('Goal not found');
    }

    const updateData = {};
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    // Store progress in metadata
    if (progress !== undefined || notes) {
      updateData.metadata = {
        ...(existingGoal.metadata || {}),
        progress: progress !== undefined ? progress : existingGoal.metadata?.progress,
        notes: notes || existingGoal.metadata?.notes,
        lastUpdated: new Date().toISOString()
      };
    }

    const goal = await prisma.goal.update({
      where: { id: goalId },
      data: updateData
    });

    logger.info({ goalId, userId, status: goal.status }, 'Goal updated successfully');

    return {
      goalId: goal.id,
      title: goal.title,
      status: goal.status,
      completedAt: goal.completedAt,
      message: `Goal updated: ${goal.title}`
    };
  } catch (error) {
    logger.error({ error: error.message, goalId, userId }, 'Failed to update goal');
    throw new Error(`Failed to update goal: ${error.message}`);
  }
}

/**
 * List all active goals for user
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function listGoals(args, ctx = {}) {
  const { status, limit = 10 } = args;
  const { userId } = ctx;

  logger.info({ userId, status }, 'Listing goals');

  try {
    const where = {
      userId: parseInt(userId)
    };

    if (status) {
      where.status = status;
    } else {
      // Default: show active goals
      where.status = 'ACTIVE';
    }

    const goals = await prisma.goal.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        targetDate: true,
        completedAt: true,
        metadata: true,
        createdAt: true
      }
    });

    logger.info({ userId, count: goals.length }, 'Goals retrieved');

    return {
      goals: goals.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        type: g.type,
        status: g.status,
        targetDate: g.targetDate,
        completedAt: g.completedAt,
        progress: g.metadata?.progress,
        notes: g.metadata?.notes
      })),
      count: goals.length,
      message: `Found ${goals.length} goal(s)`
    };
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to list goals');
    throw new Error(`Failed to list goals: ${error.message}`);
  }
}

/**
 * Submit application (actual auto-apply, not just preview)
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function submitApplication(args, ctx = {}) {
  const { jobId, resumeJobId } = args;
  const { userId } = ctx;

  logger.info({ userId, jobId }, 'Submitting application (auto-apply)');

  try {
    // Import auto-apply queue
    const { queueAutoApply } = await import('../auto-apply-queue.js');

    // Check if already applied
    const existing = await prisma.autoApplication.findUnique({
      where: {
        userId_jobId: {
          userId: parseInt(userId),
          jobId
        }
      }
    });

    if (existing) {
      return {
        success: false,
        message: 'You have already applied to this job',
        applicationId: existing.id,
        status: existing.status,
        submittedAt: existing.submittedAt
      };
    }

    // Queue the application
    const application = await queueAutoApply({
      userId: parseInt(userId),
      jobId,
      resumeJobId: resumeJobId || null
    });

    logger.info({ applicationId: application.id, userId, jobId }, 'Application queued successfully');

    return {
      success: true,
      applicationId: application.id,
      status: application.status,
      message: 'Application queued for submission. You will be notified when complete.',
      estimatedTime: '2-5 minutes'
    };
  } catch (error) {
    logger.error({ error: error.message, userId, jobId }, 'Failed to submit application');
    throw new Error(`Failed to submit application: ${error.message}`);
  }
}

/**
 * Track application status
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function trackApplications(args, ctx = {}) {
  const { status, limit = 10 } = args;
  const { userId } = ctx;

  logger.info({ userId, status }, 'Tracking applications');

  try {
    const where = {
      userId: parseInt(userId)
    };

    if (status) {
      where.status = status;
    }

    const applications = await prisma.autoApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            applyUrl: true
          }
        }
      }
    });

    // Get summary stats
    const stats = await prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId: parseInt(userId) },
      _count: { status: true }
    });

    const statusCounts = {};
    stats.forEach(stat => {
      statusCounts[stat.status.toLowerCase()] = stat._count.status;
    });

    logger.info({ userId, count: applications.length }, 'Applications retrieved');

    return {
      applications: applications.map(app => ({
        id: app.id,
        jobTitle: app.job.title,
        company: app.job.company,
        location: app.job.location,
        status: app.status,
        submittedAt: app.submittedAt,
        error: app.error,
        confirmationUrl: app.confirmationUrl,
        createdAt: app.createdAt
      })),
      stats: statusCounts,
      total: applications.length,
      message: `Found ${applications.length} application(s)`
    };
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to track applications');
    throw new Error(`Failed to track applications: ${error.message}`);
  }
}

/**
 * Calculate next run time based on frequency and schedule
 * @param {string} frequency - DAILY, WEEKLY, MONTHLY, HOURLY, CUSTOM
 * @param {string} schedule - Time in format "HH:MM" or cron expression
 * @returns {Date}
 */
function calculateNextRun(frequency, schedule) {
  const now = new Date();
  let nextRun = new Date();

  switch (frequency.toUpperCase()) {
    case 'HOURLY':
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
      break;

    case 'DAILY':
      // Parse HH:MM format
      const [hours, minutes] = schedule.split(':').map(Number);
      nextRun.setHours(hours, minutes, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'WEEKLY':
      // Schedule for next week, same day and time
      const [weekHours, weekMinutes] = schedule.split(':').map(Number);
      nextRun.setHours(weekHours, weekMinutes, 0, 0);
      nextRun.setDate(nextRun.getDate() + 7);
      break;

    case 'MONTHLY':
      // Schedule for next month, same day and time
      const [monthHours, monthMinutes] = schedule.split(':').map(Number);
      nextRun.setHours(monthHours, monthMinutes, 0, 0);
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;

    default:
      // Default to 1 hour from now for custom or unknown frequencies
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
  }

  return nextRun;
}

/**
 * Create a new routine/schedule
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function createRoutine(args, ctx = {}) {
  const { title, description, type, frequency, schedule, config } = args;
  const { userId } = ctx;

  logger.info({ userId, title, type, frequency }, 'Creating routine');

  try {
    const nextRun = calculateNextRun(frequency || 'DAILY', schedule || '09:00');

    const routine = await prisma.routine.create({
      data: {
        userId: parseInt(userId),
        title,
        description: description || null,
        type: type || 'SEARCH_JOBS',
        frequency: frequency || 'DAILY',
        schedule: schedule || '09:00',
        config: config || null,
        isActive: true,
        nextRun
      }
    });

    logger.info({ routineId: routine.id, userId, nextRun }, 'Routine created successfully');

    return {
      routineId: routine.id,
      title: routine.title,
      type: routine.type,
      frequency: routine.frequency,
      schedule: routine.schedule,
      nextRun: routine.nextRun,
      message: `Routine created: ${routine.title}. Next run at ${routine.nextRun.toISOString()}`
    };
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to create routine');
    throw new Error(`Failed to create routine: ${error.message}`);
  }
}

/**
 * List routines for user
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function listRoutines(args, ctx = {}) {
  const { isActive, limit = 10 } = args;
  const { userId } = ctx;

  logger.info({ userId, isActive }, 'Listing routines');

  try {
    const where = {
      userId: parseInt(userId)
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const routines = await prisma.routine.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { nextRun: 'asc' }
      ],
      take: parseInt(limit)
    });

    logger.info({ userId, count: routines.length }, 'Routines retrieved');

    return {
      routines: routines.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        frequency: r.frequency,
        schedule: r.schedule,
        isActive: r.isActive,
        lastRun: r.lastRun,
        nextRun: r.nextRun,
        runCount: r.runCount
      })),
      total: routines.length,
      message: `Found ${routines.length} routine(s)`
    };
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to list routines');
    throw new Error(`Failed to list routines: ${error.message}`);
  }
}

/**
 * Update a routine
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function updateRoutine(args, ctx = {}) {
  const { routineId, title, description, frequency, schedule, isActive, config } = args;
  const { userId } = ctx;

  logger.info({ userId, routineId }, 'Updating routine');

  try {
    // Check routine exists and belongs to user
    const existing = await prisma.routine.findFirst({
      where: {
        id: routineId,
        userId: parseInt(userId)
      }
    });

    if (!existing) {
      throw new Error('Routine not found or access denied');
    }

    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (config !== undefined) updateData.config = config;

    // Recalculate nextRun if frequency or schedule changed
    if (frequency !== undefined || schedule !== undefined) {
      updateData.nextRun = calculateNextRun(
        frequency || existing.frequency,
        schedule || existing.schedule
      );
    }

    const routine = await prisma.routine.update({
      where: { id: routineId },
      data: updateData
    });

    logger.info({ routineId, userId, updates: Object.keys(updateData) }, 'Routine updated');

    return {
      routineId: routine.id,
      title: routine.title,
      isActive: routine.isActive,
      nextRun: routine.nextRun,
      message: `Routine updated: ${routine.title}`
    };
  } catch (error) {
    logger.error({ error: error.message, userId, routineId }, 'Failed to update routine');
    throw new Error(`Failed to update routine: ${error.message}`);
  }
}

/**
 * Delete a routine
 * @param {object} args
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function deleteRoutine(args, ctx = {}) {
  const { routineId } = args;
  const { userId } = ctx;

  logger.info({ userId, routineId }, 'Deleting routine');

  try {
    // Check routine exists and belongs to user
    const existing = await prisma.routine.findFirst({
      where: {
        id: routineId,
        userId: parseInt(userId)
      }
    });

    if (!existing) {
      throw new Error('Routine not found or access denied');
    }

    await prisma.routine.delete({
      where: { id: routineId }
    });

    logger.info({ routineId, userId }, 'Routine deleted');

    return {
      success: true,
      routineId,
      message: `Routine "${existing.title}" deleted successfully`
    };
  } catch (error) {
    logger.error({ error: error.message, userId, routineId }, 'Failed to delete routine');
    throw new Error(`Failed to delete routine: ${error.message}`);
  }
}

/**
 * Execute tool by name
 * @param {string} toolName
 * @param {object} args
 * @param {object} ctx - Execution context (userId, conversationId, etc.)
 * @returns {Promise<object>}
 */
export async function executeTool(toolName, args, ctx = {}) {
  switch (toolName) {
    case 'search_jobs':
      return await searchJobs(args, ctx);

    case 'generate_resume_preview':
      return await generateResumePreview(args, ctx);

    case 'prepare_application_preview':
      return await prepareApplicationPreview(args, ctx);

    case 'create_goal':
      return await createGoal(args, ctx);

    case 'update_goal':
      return await updateGoal(args, ctx);

    case 'list_goals':
      return await listGoals(args, ctx);

    case 'submit_application':
      return await submitApplication(args, ctx);

    case 'track_applications':
      return await trackApplications(args, ctx);

    case 'create_routine':
      return await createRoutine(args, ctx);

    case 'list_routines':
      return await listRoutines(args, ctx);

    case 'update_routine':
      return await updateRoutine(args, ctx);

    case 'delete_routine':
      return await deleteRoutine(args, ctx);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Legacy export for backward compatibility
export const toolSchemas = [
  {
    type: 'function',
    function: {
      name: 'search_jobs',
      description: 'Search for jobs matching specific criteria',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for job titles, skills, or keywords'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_resume_preview',
      description: 'Generate a tailored resume preview for a specific job',
      parameters: {
        type: 'object',
        properties: {
          jobUrl: {
            type: 'string',
            description: 'URL of the job posting'
          }
        },
        required: ['jobUrl']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'prepare_application_preview',
      description: 'Prepare an application preview with form fields and resume',
      parameters: {
        type: 'object',
        properties: {
          jobUrl: {
            type: 'string',
            description: 'URL of the job posting'
          },
          jobId: {
            type: 'string',
            description: 'Internal job ID if available'
          }
        },
        required: []
      }
    }
  }
];
