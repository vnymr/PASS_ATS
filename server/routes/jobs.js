/**
 * Jobs API Routes
 *
 * Endpoints for browsing aggregated jobs and triggering job sync.
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import jobSyncService from '../lib/job-sync-service.js';
import jobRecommendationEngine from '../lib/job-recommendation-engine.js';
import jobProfileMatcher from '../lib/job-profile-matcher.js';
import logger from '../lib/logger.js';
import cacheManager from '../lib/cache-manager.js';

const router = express.Router();

function respondWithJobsError(res, error, fallbackMessage) {
  if (error?.code === 'P2021') {
    return res.status(500).json({
      error: 'Job data is unavailable. Run the latest database migrations to create the required tables.',
      code: 'SCHEMA_MISSING'
    });
  }

  const payload = {
    error: fallbackMessage
  };

  if (error?.code) {
    payload.code = error.code;
  }

  if (process.env.NODE_ENV !== 'production') {
    payload.details = error.message;
  }

  return res.status(500).json(payload);
}

/**
 * GET /api/jobs
 * Get all jobs with filtering
 * Optionally uses personalized recommendations if ?personalized=true
 */
router.get('/jobs', async (req, res) => {
  try {
    const {
      filter = 'all',          // 'all', 'ai_applyable', 'manual'
      atsType,                  // Filter by specific ATS
      company,                  // Filter by company
      source,                   // Filter by source (greenhouse, lever, etc.)
      search,                   // Search in title/description
      personalized = 'false',   // Use personalized recommendations
      sort = 'recommended',     // Sort order: 'recommended', 'latest', 'salary'
      limit = '50',
      offset = '0',             // Offset for pagination
      cursor,                   // Cursor for pagination (job ID)
      // New filters (ATS best practices 2024-2025)
      experienceLevel,          // Comma-separated: 'entry,mid,senior'
      minYearsExperience,
      maxYearsExperience,
      minSalary,
      maxSalary,
      locations,                // Comma-separated: 'remote,San Francisco,New York'
      workType,                 // Comma-separated: 'remote,hybrid,onsite'
      jobType,                  // Comma-separated: 'full-time,contract'
      postedWithin,             // '24h', '7d', '14d', '30d'
      requiredSkills,           // Comma-separated: 'React,TypeScript'
      preferredSkills,          // Comma-separated: 'Next.js,GraphQL'
      excludeSkills,            // Comma-separated: 'PHP,jQuery'
      companySize,              // Comma-separated: '11-50,51-200'
      industries,               // Comma-separated: 'fintech,healthcare'
      benefits,                 // Comma-separated: '401k,remote'
      aiApplyable,              // 'true' or 'false'
      applicationComplexity     // Comma-separated: 'easy,medium'
    } = req.query;

    // Check if personalized recommendations requested
    // Only use personalized for 'recommended' sort - for 'latest' and 'salary', skip personalization
    if (personalized === 'true' && req.userId && sort === 'recommended') {
      // Create cache key from parameters (include offset and sort)
      const cacheKey = `${filter}-${atsType || 'all'}-${company || 'all'}-${source || 'all'}-${search || 'all'}-${sort}-${limit}-${offset}-${cursor || 'start'}`;

      // Try cache first
      const cached = await cacheManager.getRecommendations(req.userId, cacheKey);
      if (cached) {
        logger.debug({ userId: req.userId, cacheKey }, 'Recommendations loaded from cache');
        // Disable browser caching to ensure pagination works correctly
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.json({
          ...cached,
          fromCache: true
        });
      }

      // Parse array parameters (comma-separated strings)
      const parseArray = (str) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : undefined;

      // Use recommendation engine with all new filters
      const result = await jobRecommendationEngine.getRecommendations(req.userId, {
        filter,
        atsType,
        company,
        source,
        search,
        limit: parseInt(limit),
        offset: parseInt(offset),
        cursor,
        // New filters
        experienceLevel: parseArray(experienceLevel),
        minYearsExperience: minYearsExperience ? parseInt(minYearsExperience) : undefined,
        maxYearsExperience: maxYearsExperience ? parseInt(maxYearsExperience) : undefined,
        minSalary: minSalary ? parseInt(minSalary) : undefined,
        maxSalary: maxSalary ? parseInt(maxSalary) : undefined,
        locations: parseArray(locations),
        workType: parseArray(workType),
        jobType: parseArray(jobType),
        postedWithin,
        requiredSkills: parseArray(requiredSkills),
        preferredSkills: parseArray(preferredSkills),
        excludeSkills: parseArray(excludeSkills),
        companySize: parseArray(companySize),
        industries: parseArray(industries),
        benefits: parseArray(benefits),
        aiApplyable: aiApplyable === 'true' ? true : aiApplyable === 'false' ? false : undefined,
        applicationComplexity: parseArray(applicationComplexity)
      });

      // Cache the result
      const response = {
        jobs: result.jobs,
        total: result.total,
        limit: parseInt(limit),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        personalized: true
      };
      await cacheManager.setRecommendations(req.userId, cacheKey, response);

      // Disable browser caching to ensure pagination works correctly
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.json(response);
    }

    // Otherwise, use default (chronological) listing
    const where = { isActive: true };
    const AND = [];

    // Filter out aggregator sources (only show direct job postings)
    const aggregatorSources = ['remotive', 'remote.co', 'weworkremotely', 'remoteok', 'flexjobs'];
    where.source = { notIn: aggregatorSources };

    // Parse array parameters (comma-separated strings)
    const parseArray = (str) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    // Apply basic filters
    if (filter === 'ai_applyable') {
      where.aiApplyable = true;
    } else if (filter === 'manual') {
      where.aiApplyable = false;
    }

    if (atsType) {
      where.atsType = atsType;
    }

    if (company) {
      where.company = {
        contains: company,
        mode: 'insensitive'
      };
    }

    if (source) {
      // Override the aggregator filter if user explicitly requests a specific source
      where.source = source;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Apply advanced filters
    // aiApplyable filter (only if filter param doesn't already set it)
    if (filter !== 'ai_applyable' && filter !== 'manual') {
      if (aiApplyable === 'true') {
        where.aiApplyable = true;
      } else if (aiApplyable === 'false') {
        where.aiApplyable = false;
      }
    }

    // Experience level filter (check extractedJobLevel)
    const experienceLevels = parseArray(experienceLevel);
    if (experienceLevels && experienceLevels.length > 0) {
      const levelFilters = experienceLevels.map(level => ({
        extractedJobLevel: { contains: level, mode: 'insensitive' }
      }));
      AND.push({ OR: levelFilters });
    }

    // Salary range filter
    if (minSalary || maxSalary) {
      const salaryFilter = {};
      if (minSalary) {
        salaryFilter.gte = parseInt(minSalary);
      }
      if (maxSalary) {
        salaryFilter.lte = parseInt(maxSalary);
      }
      // Handle salary stored as string "80000-120000" or "$80k-$120k"
      AND.push({
        OR: [
          { salary: salaryFilter },
          { salary: { contains: String(minSalary || maxSalary || ''), mode: 'insensitive' } }
        ]
      });
    }

    // Location filter (includes remote, hybrid, onsite)
    const locationsArray = parseArray(locations);
    if (locationsArray && locationsArray.length > 0) {
      const locationFilters = locationsArray.map(loc => ({
        location: { contains: loc, mode: 'insensitive' }
      }));
      AND.push({ OR: locationFilters });
    }

    // Work type filter (remote, hybrid, onsite)
    const workTypes = parseArray(workType);
    if (workTypes && workTypes.length > 0) {
      const workTypeFilters = workTypes.map(type => ({
        location: { contains: type, mode: 'insensitive' }
      }));
      AND.push({ OR: workTypeFilters });
    }

    // Posted within filter (recency)
    if (postedWithin) {
      const now = new Date();
      let daysAgo = 30; // default
      if (postedWithin === '24h') daysAgo = 1;
      else if (postedWithin === '7d') daysAgo = 7;
      else if (postedWithin === '14d') daysAgo = 14;
      else if (postedWithin === '30d') daysAgo = 30;

      const sinceDate = new Date(now);
      sinceDate.setDate(sinceDate.getDate() - daysAgo);
      AND.push({ postedDate: { gte: sinceDate } });
    }

    // Required skills filter (must have ALL)
    const requiredSkillsArray = parseArray(requiredSkills);
    if (requiredSkillsArray && requiredSkillsArray.length > 0) {
      const skillFilters = requiredSkillsArray.map(skill => ({
        OR: [
          { extractedSkills: { contains: skill, mode: 'insensitive' } },
          { description: { contains: skill, mode: 'insensitive' } },
          { requirements: { contains: skill, mode: 'insensitive' } }
        ]
      }));
      // All skills must be present (AND condition)
      AND.push(...skillFilters);
    }

    // Exclude skills filter (must NOT have)
    const excludeSkillsArray = parseArray(excludeSkills);
    if (excludeSkillsArray && excludeSkillsArray.length > 0) {
      const excludeFilters = excludeSkillsArray.map(skill => ({
        AND: [
          { NOT: { extractedSkills: { contains: skill, mode: 'insensitive' } } },
          { NOT: { description: { contains: skill, mode: 'insensitive' } } },
          { NOT: { requirements: { contains: skill, mode: 'insensitive' } } }
        ]
      }));
      AND.push(...excludeFilters);
    }

    // Application complexity filter
    const complexityArray = parseArray(applicationComplexity);
    if (complexityArray && complexityArray.length > 0) {
      const complexityFilters = complexityArray.map(comp => ({
        atsComplexity: { contains: comp, mode: 'insensitive' }
      }));
      AND.push({ OR: complexityFilters });
    }

    // Combine all AND conditions
    if (AND.length > 0) {
      where.AND = AND;
    }

    // Create cache key from parameters (include all filters and sort)
    const filterKey = [
      filter,
      atsType || 'all',
      company || 'all',
      source || 'all',
      search || 'all',
      sort,  // Include sort in cache key
      experienceLevel || 'all',
      minSalary || 'all',
      maxSalary || 'all',
      locations || 'all',
      workType || 'all',
      postedWithin || 'all',
      requiredSkills || 'all',
      excludeSkills || 'all',
      aiApplyable || 'all',
      applicationComplexity || 'all',
      limit,
      offset,  // Include offset for pagination
      cursor || 'start'
    ].join('-');
    const cacheKey = filterKey;

    // Try cache first
    const cached = await cacheManager.getJobList(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Job list loaded from cache');
      // Allow short-term browser caching (60 seconds)
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json({
        ...cached,
        fromCache: true
      });
    }

    // Get jobs with cursor-based pagination (more efficient than skip)
    const limitNum = parseInt(limit);

    // Determine orderBy based on sort parameter
    let orderBy;
    switch (sort) {
      case 'latest':
        orderBy = { postedDate: 'desc' };
        break;
      case 'salary':
        // Sort by salary - note: salary is stored as string, so this may not work perfectly
        // For better salary sorting, we'd need a numeric salary field
        orderBy = [{ salary: 'desc' }, { postedDate: 'desc' }];
        break;
      case 'recommended':
      default:
        // For recommended without personalization, sort by postedDate
        orderBy = { postedDate: 'desc' };
        break;
    }

    const queryOptions = {
      where,
      orderBy,
      take: limitNum + 1,  // Take one extra to check if there are more
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        salary: true,
        description: true,
        requirements: true,
        applyUrl: true,
        atsType: true,
        atsComplexity: true,
        aiApplyable: true,
        postedDate: true,
        source: true,
        // Include extracted metadata
        extractedSkills: true,
        extractedExperience: true,
        extractedEducation: true,
        extractedJobLevel: true,
        extractedKeywords: true,
        extractedBenefits: true,
        extractionConfidence: true,
        _count: {
          select: { applications: true }
        }
      }
    };

    // Add cursor if provided
    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;  // Skip the cursor itself
    }

    const [jobs, total] = await Promise.all([
      prisma.aggregatedJob.findMany(queryOptions),
      prisma.aggregatedJob.count({ where })
    ]);

    // Check if there are more results
    const hasMore = jobs.length > limitNum;
    const returnedJobs = hasMore ? jobs.slice(0, limitNum) : jobs;
    const nextCursor = hasMore ? returnedJobs[returnedJobs.length - 1].id : null;

    // Cache the result
    const response = {
      jobs: returnedJobs,
      total,
      limit: limitNum,
      nextCursor,
      hasMore,
      personalized: false
    };
    await cacheManager.setJobList(cacheKey, response);

    // Allow short-term browser caching (60 seconds)
    res.setHeader('Cache-Control', 'public, max-age=60');

    res.json(response);

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to fetch jobs');
    return respondWithJobsError(res, error, 'Failed to fetch jobs');
  }
});

/**
 * GET /api/jobs/:id
 * Get a specific job by ID
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.aggregatedJob.findUnique({
      where: { id },
      include: {
        applications: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            userId: true
          }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });

  } catch (error) {
    logger.error({ error: error.message, code: error.code, jobId: req.params.id }, 'Failed to fetch job');
    return respondWithJobsError(res, error, 'Failed to fetch job');
  }
});

/**
 * GET /api/jobs/stats
 * Get job statistics
 */
router.get('/jobs/stats', async (req, res) => {
  try {
    const stats = await jobSyncService.getJobCounts();
    const syncStats = jobSyncService.getStats();

    res.json({
      jobs: stats,
      sync: syncStats
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to fetch stats');
    return respondWithJobsError(res, error, 'Failed to fetch stats');
  }
});

/**
 * POST /api/jobs/sync
 * Manually trigger job sync
 */
router.post('/jobs/sync', async (req, res) => {
  try {
    logger.info('Manual job sync triggered via API');

    // Start sync in background
    jobSyncService.syncNow(req.body).then(result => {
      logger.info({ result }, 'Job sync completed');
    }).catch(error => {
      logger.error({ error: error.message }, 'Job sync failed');
    });

    res.json({
      success: true,
      message: 'Job sync started in background'
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to trigger sync');
    return respondWithJobsError(res, error, 'Failed to trigger sync');
  }
});

/**
 * GET /api/jobs/recommendations
 * Get personalized job recommendations for the authenticated user
 */
router.get('/jobs/recommendations', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required for personalized recommendations' });
    }

    const {
      filter = 'all',
      limit = '50',
      offset = '0',
      includeScores = 'false'  // Debug flag to see recommendation scores
    } = req.query;

    const result = await jobRecommendationEngine.getRecommendations(req.userId, {
      filter,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Optionally include score breakdowns for debugging
    if (includeScores === 'true') {
      res.json({
        jobs: result.jobs,
        total: result.total,
        hasMore: result.hasMore
      });
    } else {
      // Remove score data for cleaner response
      const cleanedJobs = result.jobs.map(job => {
        const { scoreBreakdown, ...cleanJob } = job;
        return cleanJob;
      });

      res.json({
        jobs: cleanedJobs,
        total: result.total,
        hasMore: result.hasMore
      });
    }

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to get recommendations');
    return respondWithJobsError(res, error, 'Failed to get recommendations');
  }
});

/**
 * POST /api/jobs/discover
 * Manually trigger company discovery (finds new companies automatically)
 */
router.post('/jobs/discover', async (req, res) => {
  try {
    logger.info('Manual company discovery triggered via API');

    // Start discovery in background
    jobSyncService.discoverNewCompanies().then(result => {
      logger.info({ result }, 'Company discovery completed');
    }).catch(error => {
      logger.error({ error: error.message }, 'Company discovery failed');
    });

    res.json({
      success: true,
      message: 'Company discovery started in background. This will find hundreds of new companies!'
    });

  } catch (error) {
    logger.error({ error: error.message, code: error.code }, 'Failed to trigger discovery');
    return respondWithJobsError(res, error, 'Failed to trigger discovery');
  }
});

/**
 * GET /api/jobs/:id/match-analysis
 * Get detailed match analysis between user profile and specific job
 */
router.get('/jobs/:id/match-analysis', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required for match analysis' });
    }

    const { id: jobId } = req.params;

    logger.info({ userId: req.userId, jobId }, 'Analyzing job-profile match');

    const analysis = await jobProfileMatcher.analyzeMatch(req.userId, jobId);

    if (analysis.error) {
      return res.status(400).json(analysis);
    }

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId, jobId: req.params.id }, 'Failed to analyze match');
    return respondWithJobsError(res, error, 'Failed to analyze job match');
  }
});

/**
 * POST /api/jobs/refresh-profile
 * Clear profile cache to force re-analysis of skills
 */
router.post('/jobs/refresh-profile', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Clear the cached profile
    await cacheManager.invalidateUserProfile(req.userId);

    logger.info({ userId: req.userId }, 'Profile cache cleared, will re-analyze on next request');

    res.json({
      success: true,
      message: 'Profile cache cleared. Your next job search will use freshly analyzed skills.'
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to refresh profile');
    return res.status(500).json({ error: 'Failed to refresh profile' });
  }
});

/**
 * GET /api/jobs/profile-insights
 * Get profile insights for personalized job feed
 * Returns profile completeness, top skills, and matching stats
 */
router.get('/jobs/profile-insights', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile || !profile.data) {
      return res.json({
        hasProfile: false,
        completeness: 0,
        missingFields: ['summary', 'experiences', 'skills', 'education'],
        topSkills: [],
        seniorityLevel: null,
        matchingJobsCount: 0
      });
    }

    const data = profile.data;

    // Calculate profile completeness
    const fields = {
      summary: Boolean(data.summary && data.summary.length > 50),
      experiences: Boolean(data.experiences && data.experiences.length > 0),
      skills: Boolean(data.skills && data.skills.length >= 3),
      education: Boolean(data.education && data.education.length > 0),
      location: Boolean(data.location),
      resumeText: Boolean(data.resumeText && data.resumeText.length > 100)
    };

    const completedFields = Object.values(fields).filter(Boolean).length;
    const completeness = Math.round((completedFields / Object.keys(fields).length) * 100);

    const missingFields = Object.entries(fields)
      .filter(([_, completed]) => !completed)
      .map(([field]) => field);

    // Get top skills
    const topSkills = (data.skills || []).slice(0, 6);

    // Infer seniority level
    const totalYears = (data.experiences || []).reduce((total, exp) => {
      if (!exp.dates) return total;
      const yearMatches = exp.dates.match(/\d{4}/g);
      if (!yearMatches || yearMatches.length === 0) return total + 1;
      const startYear = parseInt(yearMatches[0]);
      const endYear = yearMatches.length > 1 ? parseInt(yearMatches[1]) : new Date().getFullYear();
      return total + Math.max(endYear - startYear, 0.5);
    }, 0);

    let seniorityLevel = 'mid';
    if (totalYears < 2) seniorityLevel = 'entry';
    else if (totalYears < 4) seniorityLevel = 'junior';
    else if (totalYears < 7) seniorityLevel = 'mid';
    else if (totalYears < 10) seniorityLevel = 'senior';
    else seniorityLevel = 'lead';

    // Detect career domain using recommendation engine logic
    const careerDomain = jobRecommendationEngine.detectCareerDomain({
      experiences: data.experiences || [],
      allSkills: data.skills || [],
      skills: data.skills || [],
      domains: []
    });

    // Count matching jobs in user's domain
    let matchingJobsCount = 0;
    if (careerDomain && careerDomain.keywords.length > 0) {
      // Count jobs in user's career domain
      const domainFilters = careerDomain.keywords.slice(0, 5).map(keyword => ({
        title: { contains: keyword, mode: 'insensitive' }
      }));

      matchingJobsCount = await prisma.aggregatedJob.count({
        where: {
          isActive: true,
          OR: domainFilters
        }
      });
    } else if (topSkills.length > 0) {
      // Fallback to skill-based count
      const skillPatterns = topSkills.slice(0, 3).map(skill => ({
        OR: [
          { extractedSkills: { has: skill } },
          { description: { contains: skill, mode: 'insensitive' } }
        ]
      }));

      matchingJobsCount = await prisma.aggregatedJob.count({
        where: {
          isActive: true,
          OR: skillPatterns
        }
      });
    }

    res.json({
      hasProfile: true,
      completeness,
      missingFields,
      topSkills,
      seniorityLevel,
      totalYearsExperience: Math.round(totalYears),
      matchingJobsCount,
      location: data.location || null,
      careerDomain: careerDomain ? careerDomain.name : null
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to get profile insights');
    return res.status(500).json({ error: 'Failed to get profile insights' });
  }
});

export default router;
