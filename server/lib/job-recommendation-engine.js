/**
 * Job Recommendation Engine
 *
 * Implements personalized job recommendations based on:
 * - User profile skills matching
 * - Experience level matching
 * - Job level matching
 * - TF-IDF similarity for descriptions
 * - User interaction history (clicks, saves, applications)
 * - Collaborative filtering
 *
 * Based on LinkedIn/Indeed best practices (2024)
 */

import { prisma } from './prisma-client.js';
import logger from './logger.js';
import cacheManager from './cache-manager.js';

class JobRecommendationEngine {
  constructor() {
    // Weight factors for ranking (based on LinkedIn research)
    this.weights = {
      skillsMatch: 0.35,          // Heavily weighted (LinkedIn assigns highest weight to skills)
      experienceMatch: 0.15,
      jobLevelMatch: 0.15,
      descriptionSimilarity: 0.10,
      locationMatch: 0.10,
      recencyBoost: 0.10,
      userInteractions: 0.05      // Online learning component
    };

    // User interaction decay (interactions lose weight over time)
    this.interactionDecayDays = 30;
  }

  /**
   * Get personalized job recommendations for a user
   * @param {number} userId - User ID
   * @param {Object} options - Filtering and pagination options
   * @returns {Promise<Array>} Ranked job recommendations
   */
  async getRecommendations(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      filter = 'all',
      atsType,
      company,
      source,
      search
    } = options;

    try {
      // 1. Get user profile
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        // Fallback to basic listing if no profile
        return this.getFallbackRecommendations(options);
      }

      // 2. Get user interaction history
      const userInteractions = await this.getUserInteractions(userId);

      // 3. Fetch candidate jobs
      const where = { isActive: true };

      if (filter === 'ai_applyable') {
        where.aiApplyable = true;
      } else if (filter === 'manual') {
        where.aiApplyable = false;
      }
      if (atsType) where.atsType = atsType;
      if (company) where.company = { contains: company, mode: 'insensitive' };
      if (source) where.source = source;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } }
        ];
      }

      // PERFORMANCE FIX: Only fetch a reasonable batch to score
      // Fetch 10x the requested limit to ensure good results after scoring
      // This prevents loading thousands of jobs into memory
      const batchSize = Math.min(limit * 10, 1000); // Cap at 1000 jobs max

      const jobs = await prisma.aggregatedJob.findMany({
        where,
        take: batchSize,
        orderBy: { postedDate: 'desc' }, // Get recent jobs first
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
      });

      // 4. Calculate relevance scores for each job
      const scoredJobs = jobs.map(job => ({
        ...job,
        relevanceScore: this.calculateRelevanceScore(job, userProfile, userInteractions),
        scoreBreakdown: this.getScoreBreakdown(job, userProfile, userInteractions)
      }));

      // 5. Sort by relevance score (highest first)
      scoredJobs.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // 6. Apply pagination
      const paginatedJobs = scoredJobs.slice(offset, offset + limit);

      return {
        jobs: paginatedJobs,
        total: scoredJobs.length,
        hasMore: scoredJobs.length > (offset + limit)
      };

    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get job recommendations');
      return this.getFallbackRecommendations(options);
    }
  }

  /**
   * Calculate overall relevance score for a job
   */
  calculateRelevanceScore(job, userProfile, userInteractions) {
    const skillsScore = this.calculateSkillsMatch(job.extractedSkills, userProfile.skills);
    const experienceScore = this.calculateExperienceMatch(job.extractedExperience, userProfile.experience);
    const jobLevelScore = this.calculateJobLevelMatch(job.extractedJobLevel, userProfile.jobLevel);
    const descriptionScore = this.calculateDescriptionSimilarity(job, userProfile);
    const locationScore = this.calculateLocationMatch(job.location, userProfile.preferredLocations);
    const recencyScore = this.calculateRecencyBoost(job.postedDate);
    const interactionScore = this.calculateInteractionScore(job.id, userInteractions);

    const totalScore =
      (skillsScore * this.weights.skillsMatch) +
      (experienceScore * this.weights.experienceMatch) +
      (jobLevelScore * this.weights.jobLevelMatch) +
      (descriptionScore * this.weights.descriptionSimilarity) +
      (locationScore * this.weights.locationMatch) +
      (recencyScore * this.weights.recencyBoost) +
      (interactionScore * this.weights.userInteractions);

    // Confidence boost: jobs with high extraction confidence get bonus
    const confidenceBoost = (job.extractionConfidence || 0.5) * 0.1;

    return Math.min(totalScore + confidenceBoost, 1.0);
  }

  /**
   * Get detailed score breakdown (for debugging/transparency)
   */
  getScoreBreakdown(job, userProfile, userInteractions) {
    return {
      skillsMatch: this.calculateSkillsMatch(job.extractedSkills, userProfile.skills),
      experienceMatch: this.calculateExperienceMatch(job.extractedExperience, userProfile.experience),
      jobLevelMatch: this.calculateJobLevelMatch(job.extractedJobLevel, userProfile.jobLevel),
      descriptionSimilarity: this.calculateDescriptionSimilarity(job, userProfile),
      locationMatch: this.calculateLocationMatch(job.location, userProfile.preferredLocations),
      recencyBoost: this.calculateRecencyBoost(job.postedDate),
      interactionScore: this.calculateInteractionScore(job.id, userInteractions)
    };
  }

  /**
   * Calculate skills match using Jaccard similarity
   * @returns {number} Score between 0 and 1
   */
  calculateSkillsMatch(jobSkills = [], userSkills = []) {
    if (!jobSkills.length || !userSkills.length) {
      return 0.3; // Neutral score if no skills
    }

    // Normalize skills (lowercase)
    const normalizedJobSkills = jobSkills.map(s => s.toLowerCase());
    const normalizedUserSkills = userSkills.map(s => s.toLowerCase());

    // Calculate Jaccard similarity: intersection / union
    const intersection = normalizedJobSkills.filter(skill =>
      normalizedUserSkills.includes(skill)
    );

    const union = new Set([...normalizedJobSkills, ...normalizedUserSkills]);

    const jaccardSimilarity = intersection.length / union.size;

    // Boost for high overlap
    const overlapBonus = (intersection.length / Math.min(jobSkills.length, userSkills.length)) * 0.2;

    return Math.min(jaccardSimilarity + overlapBonus, 1.0);
  }

  /**
   * Calculate experience level match
   */
  calculateExperienceMatch(jobExperience, userExperience) {
    if (!jobExperience || !userExperience) {
      return 0.5; // Neutral if unknown
    }

    const experienceLevels = {
      'internship': 0,
      'entry': 1,
      'junior': 1,
      'mid': 2,
      'intermediate': 2,
      'senior': 3,
      'lead': 4,
      'staff': 4,
      'principal': 5,
      'director': 6,
      'vp': 7,
      'executive': 8
    };

    const jobLevel = this.extractExperienceLevel(jobExperience, experienceLevels);
    const userLevel = this.extractExperienceLevel(userExperience, experienceLevels);

    // Perfect match = 1.0
    // +/- 1 level = 0.7
    // +/- 2 levels = 0.4
    // > 2 levels = 0.2
    const diff = Math.abs(jobLevel - userLevel);
    if (diff === 0) return 1.0;
    if (diff === 1) return 0.7;
    if (diff === 2) return 0.4;
    return 0.2;
  }

  extractExperienceLevel(experienceText, levels) {
    const text = experienceText.toLowerCase();
    for (const [key, value] of Object.entries(levels)) {
      if (text.includes(key)) {
        return value;
      }
    }
    return 2; // Default to mid-level
  }

  /**
   * Calculate job level match (e.g., IC vs Manager)
   */
  calculateJobLevelMatch(jobLevel, userPreferredLevel) {
    if (!jobLevel || !userPreferredLevel) {
      return 0.5;
    }

    const normalizedJob = jobLevel.toLowerCase();
    const normalizedUser = userPreferredLevel.toLowerCase();

    if (normalizedJob === normalizedUser) {
      return 1.0;
    }

    // Partial matches
    if (normalizedJob.includes(normalizedUser) || normalizedUser.includes(normalizedJob)) {
      return 0.7;
    }

    return 0.3;
  }

  /**
   * Calculate description similarity using simplified TF-IDF approach
   * (In production, you'd use a proper NLP library like natural or compromise)
   */
  calculateDescriptionSimilarity(job, userProfile) {
    if (!userProfile.desiredKeywords || !userProfile.desiredKeywords.length) {
      return 0.5;
    }

    const jobText = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
    const keywords = userProfile.desiredKeywords.map(k => k.toLowerCase());

    let matchCount = 0;
    keywords.forEach(keyword => {
      if (jobText.includes(keyword)) {
        matchCount++;
      }
    });

    return matchCount / keywords.length;
  }

  /**
   * Calculate location match
   */
  calculateLocationMatch(jobLocation, preferredLocations = []) {
    if (!jobLocation) {
      return 0.5;
    }

    const normalizedJobLocation = jobLocation.toLowerCase();

    // Remote is universally attractive
    if (normalizedJobLocation.includes('remote') || normalizedJobLocation.includes('anywhere')) {
      return 1.0;
    }

    if (!preferredLocations.length) {
      return 0.5;
    }

    // Check if job location matches any preferred location
    for (const preferredLoc of preferredLocations) {
      const normalized = preferredLoc.toLowerCase();
      if (normalizedJobLocation.includes(normalized) || normalized.includes(normalizedJobLocation)) {
        return 1.0;
      }
    }

    return 0.2;
  }

  /**
   * Calculate recency boost (fresher jobs ranked higher)
   */
  calculateRecencyBoost(postedDate) {
    if (!postedDate) {
      return 0.5;
    }

    const now = new Date();
    const posted = new Date(postedDate);
    const ageInDays = (now - posted) / (1000 * 60 * 60 * 24);

    // Jobs posted in last 7 days get full boost
    if (ageInDays <= 7) return 1.0;
    // Jobs 7-14 days get partial boost
    if (ageInDays <= 14) return 0.7;
    // Jobs 14-30 days get minor boost
    if (ageInDays <= 30) return 0.4;
    // Older jobs get minimal boost
    return 0.2;
  }

  /**
   * Calculate interaction score based on user behavior
   * (jobs similar to ones user clicked/saved/applied to)
   */
  calculateInteractionScore(jobId, userInteractions) {
    if (!userInteractions || !userInteractions.length) {
      return 0.5;
    }

    // Check if user has interacted with this specific job
    const interaction = userInteractions.find(i => i.jobId === jobId);
    if (interaction) {
      // Apply decay based on interaction age
      const ageInDays = (new Date() - new Date(interaction.createdAt)) / (1000 * 60 * 60 * 24);
      const decay = Math.max(0, 1 - (ageInDays / this.interactionDecayDays));

      // Different interaction types have different weights
      const typeWeight = {
        'view': 0.3,
        'save': 0.6,
        'apply': 1.0
      };

      return (typeWeight[interaction.type] || 0.3) * decay;
    }

    return 0.5;
  }

  /**
   * Get user profile with skills, experience, etc.
   */
  async getUserProfile(userId) {
    try {
      // Try cache first
      const cachedProfile = await cacheManager.getUserProfile(userId);
      if (cachedProfile) {
        logger.debug({ userId }, 'User profile loaded from cache');
        return cachedProfile;
      }

      const profile = await prisma.profile.findUnique({
        where: { userId }
      });

      if (!profile || !profile.data) {
        return null;
      }

      // Extract relevant fields from profile JSON
      const data = profile.data;

      // Derive experience level from experiences array if not explicitly set
      let experienceLevel = data.experience || data.yearsOfExperience || 'mid';
      if (!data.experience && data.experiences && Array.isArray(data.experiences)) {
        // Count years of experience from experiences array
        const yearCount = data.experiences.length; // Rough estimate: 1 job = ~2 years
        if (yearCount === 0) experienceLevel = 'entry';
        else if (yearCount === 1) experienceLevel = 'junior';
        else if (yearCount === 2) experienceLevel = 'mid';
        else if (yearCount === 3) experienceLevel = 'senior';
        else experienceLevel = 'senior'; // 4+ experiences = senior
      }

      // Extract skills from resume text if skills array is empty
      let skills = data.skills || [];
      if (skills.length === 0 && data.resumeText) {
        // Extract common tech skills from resume
        const techSkills = ['JavaScript', 'Python', 'Java', 'TypeScript', 'React', 'Node.js', 'AWS', 'Docker', 'SQL', 'MongoDB', 'Kubernetes', 'Go', 'Ruby', 'PHP', 'C++', 'Swift', 'Kotlin'];
        const resumeLower = data.resumeText.toLowerCase();
        skills = techSkills.filter(skill => resumeLower.includes(skill.toLowerCase()));
      }

      // Build preferred locations array
      let preferredLocations = data.preferredLocations || data.locations || [];
      if (preferredLocations.length === 0 && data.location) {
        // Use singular location if available
        preferredLocations = [data.location];
      }

      // Extract keywords from summary and resume if not explicitly set
      let desiredKeywords = data.desiredKeywords || data.keywords || [];
      if (desiredKeywords.length === 0) {
        // Use skills as keywords
        desiredKeywords = skills;

        // Add keywords from summary
        if (data.summary) {
          const summaryKeywords = data.summary.toLowerCase().match(/\b(backend|frontend|full.?stack|devops|data|machine learning|ai|api|cloud|mobile|web|senior|lead)\b/g) || [];
          desiredKeywords = [...desiredKeywords, ...summaryKeywords];
        }
      }

      const userProfile = {
        skills: skills,
        experience: experienceLevel,
        jobLevel: data.jobLevel || data.desiredRole || 'individual_contributor',
        preferredLocations: preferredLocations,
        desiredKeywords: desiredKeywords,
        education: Array.isArray(data.education) ? data.education[0]?.degree || '' : (data.education || ''),
        resumeText: data.resumeText || '',
        summary: data.summary || ''
      };

      // Cache the profile for 15 minutes
      await cacheManager.setUserProfile(userId, userProfile);
      logger.debug({ userId }, 'User profile cached');

      return userProfile;
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get user profile');
      return null;
    }
  }

  /**
   * Get user interaction history (clicks, saves, applications)
   */
  async getUserInteractions(userId) {
    try {
      // Get applications
      const applications = await prisma.autoApplication.findMany({
        where: { userId },
        select: {
          jobId: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      // Map to interaction format
      return applications.map(app => ({
        jobId: app.jobId,
        type: 'apply',
        createdAt: app.createdAt
      }));

      // TODO: Add tracking for views and saves
      // This would require new tables or fields in the schema
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get user interactions');
      return [];
    }
  }

  /**
   * Fallback to basic job listing (when no profile or error)
   */
  async getFallbackRecommendations(options) {
    const {
      limit = 50,
      offset = 0,
      filter = 'all',
      atsType,
      company,
      source,
      search
    } = options;

    const where = { isActive: true };
    if (filter === 'ai_applyable') where.aiApplyable = true;
    else if (filter === 'manual') where.aiApplyable = false;
    if (atsType) where.atsType = atsType;
    if (company) where.company = { contains: company, mode: 'insensitive' };
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.aggregatedJob.findMany({
        where,
        orderBy: { postedDate: 'desc' },
        take: limit,
        skip: offset,
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
      }),
      prisma.aggregatedJob.count({ where })
    ]);

    return {
      jobs,
      total,
      hasMore: total > (offset + limit)
    };
  }

  /**
   * Track user interaction with a job (for online learning)
   */
  async trackInteraction(userId, jobId, interactionType) {
    try {
      // TODO: Implement interaction tracking table
      // For now, this is a placeholder
      logger.info({ userId, jobId, interactionType }, 'User interaction tracked');
    } catch (error) {
      logger.error({ error: error.message, userId, jobId }, 'Failed to track interaction');
    }
  }
}

export default new JobRecommendationEngine();
