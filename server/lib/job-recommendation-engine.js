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
import { extractAllSkillsFromProfile } from './profile-skill-extractor.js';

class JobRecommendationEngine {
  constructor() {
    // Weight factors for ranking (ATS best practices + LinkedIn/Indeed research 2024-2025)
    // 99.7% of recruiters use keyword filters, LinkedIn uses GBDT with contextual features
    this.weights = {
      keywordMatch: 0.25,           // Primary factor (99.7% of recruiters use this)
      requiredSkillsMatch: 0.20,    // Must-haves are critical (Boolean logic)
      preferredSkillsMatch: 0.08,   // Nice-to-haves boost score
      experienceMatch: 0.25,        // Experience level + years - CRITICAL for matching
      descriptionSimilarity: 0.05,  // Contextual similarity
      locationMatch: 0.08,          // Location preference
      recencyBoost: 0.04,           // Newer jobs preferred
      userInteractions: 0.05        // Engagement signals (clicks, saves, applications)
    };

    // User interaction decay (interactions lose weight over time)
    this.interactionDecayDays = 30;

    // Skill synonyms for semantic matching (expanding over time)
    this.skillSynonyms = {
      'react': ['react.js', 'reactjs', 'react native'],
      'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
      'typescript': ['ts'],
      'node': ['node.js', 'nodejs'],
      'python': ['py'],
      'backend': ['server-side', 'api', 'backend development'],
      'frontend': ['front-end', 'client-side', 'ui development'],
      'fullstack': ['full-stack', 'full stack'],
      'devops': ['dev-ops', 'site reliability'],
      'kubernetes': ['k8s'],
      'docker': ['containerization', 'containers'],
      'aws': ['amazon web services'],
      'gcp': ['google cloud platform'],
      'azure': ['microsoft azure'],
      'sql': ['mysql', 'postgresql', 'postgres', 'database'],
      'nosql': ['mongodb', 'dynamodb', 'cassandra'],
      'ci/cd': ['continuous integration', 'continuous deployment'],
      'agile': ['scrum', 'kanban'],
      'machine learning': ['ml', 'artificial intelligence', 'ai'],
      'data science': ['data analysis', 'analytics']
    };
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
      search,
      // New filters (ATS best practices 2024-2025)
      experienceLevel,        // ['entry', 'junior', 'mid', 'senior', 'lead']
      minYearsExperience,
      maxYearsExperience,
      minSalary,
      maxSalary,
      locations,              // Array of location strings
      workType,               // ['remote', 'hybrid', 'onsite']
      jobType,                // ['full-time', 'part-time', 'contract', 'internship']
      postedWithin,           // '24h', '7d', '14d', '30d'
      requiredSkills,         // Array - Must have ALL (Boolean AND)
      preferredSkills,        // Array - Nice to have (boost score)
      excludeSkills,          // Array - Must NOT have (Boolean NOT)
      companySize,            // ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
      industries,             // Array of industry strings
      benefits,               // Array of benefits
      aiApplyable,            // Boolean filter
      applicationComplexity   // ['easy', 'medium', 'hard']
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

      // 3. Build advanced filter query (ATS best practices)
      const where = { isActive: true };
      const AND = [];

      // CRITICAL: Pre-filter jobs by user's career domain
      // This prevents showing Sales jobs to Engineers and vice versa
      const userCareerDomain = this.detectCareerDomain(userProfile);
      if (userCareerDomain && userCareerDomain.keywords.length > 0) {
        // Build domain filter - job title should contain at least one domain keyword
        const domainFilters = userCareerDomain.keywords.map(keyword => ({
          OR: [
            { title: { contains: keyword, mode: 'insensitive' } },
            { extractedJobLevel: { contains: keyword, mode: 'insensitive' } }
          ]
        }));

        // Job must match at least one domain keyword
        AND.push({ OR: domainFilters });

        logger.debug({
          userId,
          domain: userCareerDomain.name,
          keywords: userCareerDomain.keywords
        }, 'Filtering jobs by user career domain');
      }

      // Basic filters
      if (filter === 'ai_applyable' || aiApplyable === true) {
        where.aiApplyable = true;
      } else if (filter === 'manual' || aiApplyable === false) {
        where.aiApplyable = false;
      }
      if (atsType) where.atsType = atsType;
      if (company) where.company = { contains: company, mode: 'insensitive' };
      if (source) where.source = source;

      // Salary range filter (critical for job seekers)
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
            { salary: { contains: String(minSalary || ''), mode: 'insensitive' } }
          ]
        });
      }

      // Location filter (includes remote, hybrid, onsite)
      if (locations && locations.length > 0) {
        const locationFilters = locations.map(loc => ({
          location: { contains: loc, mode: 'insensitive' }
        }));
        AND.push({ OR: locationFilters });
      }

      // Work type filter
      if (workType && workType.length > 0) {
        const workTypeFilters = workType.map(type => ({
          location: { contains: type, mode: 'insensitive' }
        }));
        AND.push({ OR: workTypeFilters });
      }

      // Posted within filter (recency)
      if (postedWithin) {
        const now = new Date();
        const daysMap = { '24h': 1, '7d': 7, '14d': 14, '30d': 30 };
        const days = daysMap[postedWithin] || 30;
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        where.postedDate = { gte: cutoffDate };
      }

      // Required skills filter (Boolean AND - must have ALL)
      // This is a KNOCKOUT filter - jobs without ALL required skills are excluded
      if (requiredSkills && requiredSkills.length > 0) {
        const requiredSkillFilters = requiredSkills.map(skill => {
          const synonyms = this.getSkillSynonyms(skill);
          const skillPatterns = [skill, ...synonyms].map(s => ({
            OR: [
              { extractedSkills: { has: s } },
              { description: { contains: s, mode: 'insensitive' } },
              { requirements: { contains: s, mode: 'insensitive' } },
              { title: { contains: s, mode: 'insensitive' } }
            ]
          }));
          return { OR: skillPatterns };
        });
        // Must have ALL required skills (AND logic)
        AND.push(...requiredSkillFilters);
      }

      // Exclude skills filter (Boolean NOT - must NOT have ANY)
      if (excludeSkills && excludeSkills.length > 0) {
        excludeSkills.forEach(skill => {
          const synonyms = this.getSkillSynonyms(skill);
          const excludePatterns = [skill, ...synonyms];
          excludePatterns.forEach(s => {
            AND.push({
              AND: [
                { NOT: { extractedSkills: { has: s } } },
                { NOT: { description: { contains: s, mode: 'insensitive' } } },
                { NOT: { requirements: { contains: s, mode: 'insensitive' } } },
                { NOT: { title: { contains: s, mode: 'insensitive' } } }
              ]
            });
          });
        });
      }

      // Experience level filter
      if (experienceLevel && experienceLevel.length > 0) {
        const expFilters = experienceLevel.map(level => ({
          OR: [
            { extractedJobLevel: { contains: level, mode: 'insensitive' } },
            { title: { contains: level, mode: 'insensitive' } },
            { extractedExperience: { contains: level, mode: 'insensitive' } }
          ]
        }));
        AND.push({ OR: expFilters });
      }

      // Application complexity filter
      if (applicationComplexity && applicationComplexity.length > 0) {
        AND.push({ atsComplexity: { in: applicationComplexity } });
      }

      // Search query (keyword search across multiple fields)
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
          { extractedSkills: { has: search } }
        ];
      }

      // Apply all AND conditions
      if (AND.length > 0) {
        where.AND = AND;
      }

      // PERFORMANCE FIX: Only fetch a reasonable batch to score
      // Fetch more jobs to find good matches after scoring/filtering
      // This prevents loading thousands of jobs into memory
      const batchSize = Math.min(limit * 20, 2000); // Increased to 2000 for better matches

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

      // 4. Calculate relevance scores for each job with contextual boosting
      const scoredJobs = jobs.map(job => {
        const baseScore = this.calculateRelevanceScore(job, userProfile, userInteractions, {
          requiredSkills,
          preferredSkills,
          excludeSkills
        });

        // Apply contextual boosting (LinkedIn GBDT approach)
        const contextualBoost = this.calculateContextualBoost(job, userProfile, {
          minSalary,
          maxSalary,
          locations,
          industries
        });

        const finalScore = Math.min(baseScore + contextualBoost, 1.0);

        return {
          ...job,
          relevanceScore: finalScore,
          scoreBreakdown: this.getScoreBreakdown(job, userProfile, userInteractions, {
            requiredSkills,
            preferredSkills,
            excludeSkills
          })
        };
      });

      // 5. Sort by relevance score (highest first)
      scoredJobs.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // 6. Apply minimum relevance threshold
      // Only show jobs that are actually relevant to the user
      const MIN_RELEVANCE_THRESHOLD = 0.45; // 45% minimum match (raised from 40%)
      const GOOD_RELEVANCE_THRESHOLD = 0.60; // 60% is considered "good"

      // Filter to only show relevant jobs
      let relevantJobs = scoredJobs.filter(job => job.relevanceScore >= MIN_RELEVANCE_THRESHOLD);

      // If we have very few relevant jobs, lower the threshold but show what we have
      // This ensures users always see some results
      if (relevantJobs.length < 10) {
        // Show all scored jobs to enable proper pagination
        // Don't limit here - let pagination handle the slicing
        relevantJobs = scoredJobs;
        logger.info({
          userId,
          relevantCount: relevantJobs.length,
          threshold: MIN_RELEVANCE_THRESHOLD,
          topScore: scoredJobs[0]?.relevanceScore
        }, 'Few relevant jobs found, showing all matches');
      }

      // Log matching stats for debugging
      const goodMatchCount = scoredJobs.filter(j => j.relevanceScore >= GOOD_RELEVANCE_THRESHOLD).length;
      logger.debug({
        userId,
        totalScored: scoredJobs.length,
        aboveThreshold: relevantJobs.length,
        goodMatches: goodMatchCount,
        topScore: scoredJobs[0]?.relevanceScore,
        bottomScore: scoredJobs[scoredJobs.length - 1]?.relevanceScore
      }, 'Job relevance distribution');

      // 7. Apply pagination to relevant jobs only
      const paginatedJobs = relevantJobs.slice(offset, offset + limit);

      return {
        jobs: paginatedJobs,
        total: relevantJobs.length,
        hasMore: relevantJobs.length > (offset + limit)
      };

    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get job recommendations');
      return this.getFallbackRecommendations(options);
    }
  }

  /**
   * Calculate overall relevance score for a job (ATS best practices 2024-2025)
   * Uses keyword matching (99.7% of recruiters use this) + Boolean skill logic
   * Enhanced with comprehensive skill extraction from user profile
   */
  calculateRelevanceScore(job, userProfile, userInteractions, filterOptions = {}) {
    const { requiredSkills = [], preferredSkills = [], excludeSkills = [] } = filterOptions;

    // 1. Keyword match (primary factor - 99.7% of recruiters use this)
    // Now uses ALL skills from comprehensive profile analysis
    const keywordScore = this.calculateKeywordMatch(job, userProfile);

    // 2. Required skills match - check if user has what job needs
    // Use all user skills (comprehensive extraction) instead of just explicit skills
    const userSkillsToMatch = userProfile.allSkills || userProfile.skills || [];
    const requiredSkillsScore = this.calculateRequiredSkillsMatch(job, userSkillsToMatch);

    // 3. Preferred skills (nice to have - boosts score)
    const preferredSkillsScore = preferredSkills.length > 0
      ? this.calculatePreferredSkillsMatch(job, preferredSkills)
      : 0.5; // Neutral if no preferred skills

    // 4. Experience matching - enhanced with total years
    // Combine extractedExperience with job description/requirements for better extraction
    const jobExperienceText = job.extractedExperience ||
      `${job.description || ''} ${job.requirements || ''}`;
    const experienceScore = this.calculateExperienceMatchEnhanced(
      jobExperienceText,
      userProfile.experience,
      userProfile.totalYears || 0
    );

    // 5. Description similarity (contextual)
    const descriptionScore = this.calculateDescriptionSimilarity(job, userProfile);

    // 6. Location match
    const locationScore = this.calculateLocationMatch(job.location, userProfile.preferredLocations);

    // 7. Recency boost (newer jobs preferred)
    const recencyScore = this.calculateRecencyBoost(job.postedDate);

    // 8. User interaction score (engagement signals)
    const interactionScore = this.calculateInteractionScore(job.id, userInteractions);

    // 9. Domain/Role match bonus
    const domainBonus = this.calculateDomainMatch(job, userProfile);

    // Calculate weighted total using ATS-backed weights
    const totalScore =
      (keywordScore * this.weights.keywordMatch) +
      (requiredSkillsScore * this.weights.requiredSkillsMatch) +
      (preferredSkillsScore * this.weights.preferredSkillsMatch) +
      (experienceScore * this.weights.experienceMatch) +
      (descriptionScore * this.weights.descriptionSimilarity) +
      (locationScore * this.weights.locationMatch) +
      (recencyScore * this.weights.recencyBoost) +
      (interactionScore * this.weights.userInteractions) +
      domainBonus; // Additional bonus for domain match

    return Math.min(totalScore, 1.0);
  }

  /**
   * Detect user's career domain from their profile
   * Returns domain name and relevant job title keywords
   */
  detectCareerDomain(userProfile) {
    const experiences = userProfile.experiences || [];
    const skills = (userProfile.allSkills || userProfile.skills || []).map(s => s.toLowerCase());
    const domains = (userProfile.domains || []).map(d => d.toLowerCase());

    // Extract role titles from experiences
    const roleTitles = experiences
      .map(e => (e.role || '').toLowerCase())
      .filter(Boolean);

    // Career domain definitions with associated keywords
    const careerDomains = {
      engineering: {
        indicators: ['engineer', 'developer', 'programmer', 'software', 'backend', 'frontend', 'fullstack', 'full-stack', 'devops', 'sre', 'platform'],
        skills: ['javascript', 'python', 'java', 'react', 'node', 'aws', 'docker', 'kubernetes', 'typescript', 'golang', 'rust', 'c++', 'sql'],
        keywords: ['engineer', 'developer', 'software', 'backend', 'frontend', 'full stack', 'fullstack', 'devops', 'sre', 'platform', 'architect']
      },
      data: {
        indicators: ['data', 'analyst', 'scientist', 'analytics', 'machine learning', 'ml', 'ai'],
        skills: ['python', 'sql', 'tableau', 'spark', 'pandas', 'tensorflow', 'pytorch', 'r', 'statistics'],
        keywords: ['data', 'analyst', 'scientist', 'analytics', 'machine learning', 'ml', 'ai', 'business intelligence']
      },
      design: {
        indicators: ['designer', 'ux', 'ui', 'product design', 'graphic', 'visual'],
        skills: ['figma', 'sketch', 'adobe', 'photoshop', 'illustrator', 'ux', 'ui'],
        keywords: ['designer', 'design', 'ux', 'ui', 'product design', 'graphic', 'visual', 'creative']
      },
      product: {
        indicators: ['product manager', 'product owner', 'pm', 'product lead'],
        skills: ['roadmap', 'agile', 'scrum', 'jira', 'product strategy'],
        keywords: ['product manager', 'product owner', 'product lead', 'product']
      },
      marketing: {
        indicators: ['marketing', 'growth', 'seo', 'content', 'brand'],
        skills: ['google analytics', 'seo', 'sem', 'content marketing', 'social media'],
        keywords: ['marketing', 'growth', 'seo', 'content', 'brand', 'digital marketing']
      },
      sales: {
        indicators: ['sales', 'account executive', 'business development', 'sdr', 'ae'],
        skills: ['salesforce', 'crm', 'negotiation', 'prospecting'],
        keywords: ['sales', 'account executive', 'business development', 'sdr', 'account manager']
      },
      operations: {
        indicators: ['operations', 'ops', 'supply chain', 'logistics'],
        skills: ['process improvement', 'six sigma', 'lean', 'supply chain'],
        keywords: ['operations', 'ops', 'supply chain', 'logistics', 'coordinator']
      },
      finance: {
        indicators: ['finance', 'accounting', 'financial', 'cfo', 'controller'],
        skills: ['excel', 'financial modeling', 'accounting', 'budgeting'],
        keywords: ['finance', 'financial', 'accounting', 'controller', 'analyst']
      },
      hr: {
        indicators: ['hr', 'human resources', 'recruiter', 'talent', 'people ops'],
        skills: ['recruiting', 'onboarding', 'hris', 'compensation'],
        keywords: ['hr', 'human resources', 'recruiter', 'talent', 'people']
      }
    };

    // Score each domain
    let bestDomain = null;
    let bestScore = 0;

    for (const [domainName, domain] of Object.entries(careerDomains)) {
      let score = 0;

      // Check role titles (highest weight)
      domain.indicators.forEach(indicator => {
        if (roleTitles.some(title => title.includes(indicator))) {
          score += 10;
        }
      });

      // Check skills
      domain.skills.forEach(skill => {
        if (skills.includes(skill)) {
          score += 2;
        }
      });

      // Check domains from profile
      domain.indicators.forEach(indicator => {
        if (domains.includes(indicator)) {
          score += 5;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestDomain = { name: domainName, keywords: domain.keywords, score };
      }
    }

    // Only return domain if we have reasonable confidence (score >= 5)
    if (bestDomain && bestScore >= 5) {
      return bestDomain;
    }

    return null;
  }

  /**
   * Calculate domain/role match bonus
   * Gives significant boost when job title/role matches user's experience domain
   */
  calculateDomainMatch(job, userProfile) {
    const jobTitle = (job.title || '').toLowerCase();
    const jobDesc = (job.description || '').toLowerCase();

    // Get user's domains and experience keywords
    const userDomains = (userProfile.domains || []).map(d => d.toLowerCase());
    const userExperiences = (userProfile.experiences || [])
      .map(e => ((e.role || '') + ' ' + (e.company || '')).toLowerCase());

    let bonus = 0;

    // Check for domain/industry match
    userDomains.forEach(domain => {
      if (jobTitle.includes(domain) || jobDesc.includes(domain)) {
        bonus += 0.10; // 10% bonus per domain match
      }
    });

    // Check for role similarity (e.g., if user was "Software Engineer", boost "Software" jobs)
    const roleKeywords = ['engineer', 'developer', 'architect', 'manager', 'analyst', 'designer', 'scientist', 'lead', 'director'];
    userExperiences.forEach(exp => {
      roleKeywords.forEach(roleKey => {
        if (exp.includes(roleKey) && jobTitle.includes(roleKey)) {
          bonus += 0.15; // 15% bonus for role type match
        }
      });
    });

    // Cap the bonus at 25%
    return Math.min(bonus, 0.25);
  }

  /**
   * Get detailed score breakdown (for debugging/transparency)
   */
  getScoreBreakdown(job, userProfile, userInteractions, filterOptions = {}) {
    const { requiredSkills = [], preferredSkills = [] } = filterOptions;
    const userSkillsToMatch = userProfile.allSkills || userProfile.skills || [];

    return {
      keywordMatch: this.calculateKeywordMatch(job, userProfile),
      requiredSkillsMatch: this.calculateRequiredSkillsMatch(job, userSkillsToMatch),
      preferredSkillsMatch: preferredSkills.length > 0
        ? this.calculatePreferredSkillsMatch(job, preferredSkills)
        : 0.5,
      experienceMatch: this.calculateExperienceMatchEnhanced(
        job.extractedExperience || `${job.description || ''} ${job.requirements || ''}`,
        userProfile.experience,
        userProfile.totalYears || 0
      ),
      descriptionSimilarity: this.calculateDescriptionSimilarity(job, userProfile),
      locationMatch: this.calculateLocationMatch(job.location, userProfile.preferredLocations),
      recencyBoost: this.calculateRecencyBoost(job.postedDate),
      interactionScore: this.calculateInteractionScore(job.id, userInteractions)
    };
  }

  /**
   * Calculate keyword match (primary ATS factor)
   * Uses ALL skills from comprehensive profile analysis
   * Keywords in title > description > requirements
   */
  calculateKeywordMatch(job, userProfile) {
    const jobText = `${job.title || ''} ${job.description || ''} ${job.requirements || ''}`.toLowerCase();
    const jobTitle = (job.title || '').toLowerCase();

    // Use ALL skills from comprehensive analysis
    const userSkills = userProfile.allSkills || userProfile.skills || [];
    const userKeywords = [
      ...userSkills,
      ...(userProfile.desiredKeywords || []),
      ...(userProfile.domains || [])
    ].map(k => k.toLowerCase());

    if (userKeywords.length === 0) {
      return 0.5;
    }

    let matchCount = 0;
    let titleMatchCount = 0;
    let weightedScore = 0;

    // Track unique matches to avoid double counting
    const matchedSkills = new Set();

    userKeywords.forEach(keyword => {
      const synonyms = this.getSkillSynonyms(keyword);
      const allVariants = [keyword, ...synonyms];

      let keywordMatched = false;
      allVariants.forEach(variant => {
        if (jobText.includes(variant) && !matchedSkills.has(variant)) {
          matchedSkills.add(variant);
          keywordMatched = true;

          // Weight matches by skill experience
          const yearsExp = userProfile.skillsWithExperience?.[keyword] || 0;
          const experienceWeight = Math.min(yearsExp / 5, 1.0); // Max weight at 5+ years

          // Title matches are weighted MUCH higher (3x)
          if (jobTitle.includes(variant)) {
            titleMatchCount++;
            weightedScore += 3.0 * (1 + experienceWeight);
          } else {
            weightedScore += 1.0 * (1 + experienceWeight);
          }
        }
      });

      if (keywordMatched) {
        matchCount++;
      }
    });

    // Calculate base score with weighted matches
    const baseScore = Math.min(matchCount / Math.max(userKeywords.length, 1), 1.0);
    const weightedMatchScore = Math.min(weightedScore / (userKeywords.length * 2), 1.0);

    // Combine base score with weighted score
    const finalScore = (baseScore * 0.4) + (weightedMatchScore * 0.6);

    return Math.min(finalScore, 1.0);
  }

  /**
   * Calculate required skills match (Boolean AND logic)
   * Checks if user skills appear in job requirements
   * Uses comprehensive skill extraction from user profile
   *
   * NEW: When jobs don't have pre-extracted skills (most cases),
   * we scan the job description for user skills instead.
   */
  calculateRequiredSkillsMatch(job, userSkills) {
    if (!userSkills || userSkills.length === 0) {
      return 0.5; // Neutral if no user skills provided
    }

    const jobText = `${job.title || ''} ${job.description || ''} ${job.requirements || ''}`.toLowerCase();
    const jobSkills = (job.extractedSkills || []).map(s => s.toLowerCase());
    const jobKeywords = (job.extractedKeywords || []).map(k => k.toLowerCase());

    // Combine all job skill indicators
    const allJobSkills = [...jobSkills, ...jobKeywords];

    // If job has pre-extracted skills, use the original approach
    if (allJobSkills.length > 0) {
      let matchCount = 0;
      let totalJobSkills = allJobSkills.length;

      // For each job skill, check if user has it
      allJobSkills.forEach(jobSkill => {
        const synonyms = this.getSkillSynonyms(jobSkill);
        const allVariants = [jobSkill, ...synonyms];

        // Check if user has this skill (with variations)
        const userHasSkill = userSkills.some(userSkill => {
          const userSkillLower = userSkill.toLowerCase();
          const userSynonyms = this.getSkillSynonyms(userSkillLower);

          return allVariants.some(variant =>
            userSkillLower === variant ||
            userSynonyms.includes(variant) ||
            variant.includes(userSkillLower) ||
            userSkillLower.includes(variant)
          );
        });

        if (userHasSkill) {
          matchCount++;
        }
      });

      const matchRatio = matchCount / totalJobSkills;
      if (matchRatio > 0.7) {
        return Math.min(matchRatio + 0.2, 1.0);
      }
      return matchRatio;
    }

    // FALLBACK: Job has no pre-extracted skills
    // Scan job description for user skills instead
    let matchCount = 0;
    let checkedSkills = 0;
    const matchedSkills = [];

    userSkills.forEach(userSkill => {
      const skillLower = userSkill.toLowerCase();
      const synonyms = this.getSkillSynonyms(skillLower);
      const allVariants = [skillLower, ...synonyms];

      // Check if any variant of this skill appears in job text
      const skillFound = allVariants.some(variant => {
        // Use word boundary matching for short skills to avoid false positives
        if (variant.length <= 3) {
          // For short skills like "sql", "aws", use stricter matching
          const regex = new RegExp(`\\b${variant}\\b`, 'i');
          return regex.test(jobText);
        }
        return jobText.includes(variant);
      });

      if (skillFound) {
        matchCount++;
        matchedSkills.push(userSkill);
      }
      checkedSkills++;
    });

    // Calculate score based on how many user skills appear in job
    // We want a good differentiation between jobs
    const matchRatio = matchCount / Math.max(checkedSkills, 1);

    // Apply scoring tiers for better differentiation
    if (matchCount >= 8) {
      return Math.min(0.95, matchRatio + 0.3); // Excellent match (8+ skills)
    } else if (matchCount >= 5) {
      return Math.min(0.85, matchRatio + 0.2); // Good match (5-7 skills)
    } else if (matchCount >= 3) {
      return Math.min(0.70, matchRatio + 0.1); // Decent match (3-4 skills)
    } else if (matchCount >= 1) {
      return Math.min(0.50, matchRatio); // Some match (1-2 skills)
    }

    return 0.1; // No skill match at all
  }

  /**
   * Calculate preferred skills match (nice to have - boosts score)
   */
  calculatePreferredSkillsMatch(job, preferredSkills) {
    if (!preferredSkills || preferredSkills.length === 0) {
      return 0.5;
    }

    const jobText = `${job.title || ''} ${job.description || ''} ${job.requirements || ''}`.toLowerCase();
    const jobSkills = (job.extractedSkills || []).map(s => s.toLowerCase());

    let matchCount = 0;

    preferredSkills.forEach(skill => {
      const synonyms = this.getSkillSynonyms(skill.toLowerCase());
      const allVariants = [skill.toLowerCase(), ...synonyms];

      const hasSkill = allVariants.some(variant =>
        jobSkills.includes(variant) || jobText.includes(variant)
      );

      if (hasSkill) {
        matchCount++;
      }
    });

    // Lenient scoring: any matches are bonus
    return Math.min((matchCount / preferredSkills.length) + 0.3, 1.0);
  }

  /**
   * Calculate contextual boost based on user preferences (LinkedIn GBDT approach)
   */
  calculateContextualBoost(job, userProfile, filterOptions = {}) {
    const { minSalary, maxSalary, locations, industries } = filterOptions;
    let boost = 0;

    // Salary match boost (+10%)
    if (minSalary || maxSalary) {
      const jobSalary = this.extractSalaryFromString(job.salary);
      if (jobSalary) {
        const inRange = (!minSalary || jobSalary >= minSalary) &&
                       (!maxSalary || jobSalary <= maxSalary);
        if (inRange) {
          boost += 0.10;
        }
      }
    }

    // Location match boost (+12%)
    if (locations && locations.length > 0) {
      const jobLoc = (job.location || '').toLowerCase();
      const matchesLocation = locations.some(loc =>
        jobLoc.includes(loc.toLowerCase())
      );
      if (matchesLocation) {
        boost += 0.12;
      }
    }

    // Industry match boost (+8%)
    // TODO: Need to add industry field to job schema
    // For now, check description for industry keywords
    if (industries && industries.length > 0) {
      const jobText = `${job.description || ''} ${job.company || ''}`.toLowerCase();
      const matchesIndustry = industries.some(ind =>
        jobText.includes(ind.toLowerCase())
      );
      if (matchesIndustry) {
        boost += 0.08;
      }
    }

    return boost;
  }

  /**
   * Get skill synonyms for semantic matching
   */
  getSkillSynonyms(skill) {
    const normalized = skill.toLowerCase().trim();
    return this.skillSynonyms[normalized] || [];
  }

  /**
   * Extract numeric salary from string (handles various formats)
   */
  extractSalaryFromString(salaryStr) {
    if (!salaryStr) return null;

    // Remove currency symbols and commas
    const cleaned = salaryStr.replace(/[$,]/g, '');

    // Extract numbers
    const matches = cleaned.match(/\d+/g);
    if (!matches) return null;

    // Handle "80k-120k" format
    if (salaryStr.toLowerCase().includes('k')) {
      return parseInt(matches[0]) * 1000;
    }

    // Handle "80000-120000" format
    return parseInt(matches[0]);
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

  /**
   * Enhanced experience matching that considers both level and years
   */
  calculateExperienceMatchEnhanced(jobExperience, userExperience, userTotalYears) {
    // Extract years from job - try multiple patterns
    let jobMinYears = 0;
    const jobExpText = (jobExperience || '').toLowerCase();

    // Pattern: "10+ years", "10 years", "10-15 years"
    const patterns = [
      /(\d+)\s*\+\s*years?/i,
      /(\d+)\s*-\s*\d+\s*years?/i,
      /(\d+)\s*years?/i,
      /minimum\s*(\d+)\s*years?/i,
      /at\s*least\s*(\d+)\s*years?/i
    ];

    for (const pattern of patterns) {
      const match = jobExpText.match(pattern);
      if (match) {
        jobMinYears = parseInt(match[1]);
        break;
      }
    }

    // If no years requirement found, use neutral score
    if (jobMinYears === 0) {
      return 0.6; // Slightly positive if no experience requirement
    }

    // If user has no experience data, be conservative
    if (!userTotalYears || userTotalYears === 0) {
      // Assume entry-level (1-2 years) if no data
      userTotalYears = 1;
    }

    // Calculate experience gap
    const experienceRatio = userTotalYears / jobMinYears;
    let yearsScore;

    if (experienceRatio >= 1.0) {
      // User meets or exceeds requirement
      yearsScore = 1.0;
      // Slight penalty for being WAY overqualified (might get rejected)
      if (experienceRatio > 2.0) {
        yearsScore = 0.85;
      }
    } else if (experienceRatio >= 0.75) {
      // User has 75%+ of required experience - reasonable stretch
      yearsScore = 0.80;
    } else if (experienceRatio >= 0.5) {
      // User has 50-75% of required experience - significant stretch
      yearsScore = 0.50;
    } else if (experienceRatio >= 0.3) {
      // User has 30-50% of required experience - unlikely match
      yearsScore = 0.25;
    } else {
      // User has <30% of required experience - very poor match
      // 2 years user for 10 year job = 0.2 ratio = 0.10 score
      yearsScore = 0.10;
    }

    // Also factor in seniority level matching if available
    let levelScore = 0.5;
    if (userExperience) {
      levelScore = this.calculateExperienceMatch(jobExperience, userExperience);
    }

    // Weight years score more heavily (70%) since it's more concrete
    return (yearsScore * 0.70) + (levelScore * 0.30);
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
   * Get user profile with comprehensive skill extraction
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

      const data = profile.data;

      // COMPREHENSIVE SKILL EXTRACTION using LLM
      // This analyzes ALL parts of the profile: experiences, education, projects, etc.
      const skillAnalysis = await extractAllSkillsFromProfile(data);

      // Build preferred locations array
      let preferredLocations = data.preferredLocations || data.locations || [];
      if (preferredLocations.length === 0 && data.location) {
        preferredLocations = [data.location];
      }

      // Use comprehensive skill list as keywords
      const desiredKeywords = data.desiredKeywords || data.keywords || skillAnalysis.allSkills;

      const userProfile = {
        // Core technical skills (high confidence)
        skills: skillAnalysis.coreSkills,
        // ALL skills including soft skills
        allSkills: skillAnalysis.allSkills,
        // Skills with years of experience
        skillsWithExperience: skillAnalysis.skillsWithExperience,
        // Domain expertise
        domains: skillAnalysis.domains,
        // Soft skills
        softSkills: skillAnalysis.softSkills,
        // Experience level (from comprehensive analysis)
        experience: skillAnalysis.seniorityLevel,
        // Total years of experience
        totalYears: skillAnalysis.totalYearsExperience,
        jobLevel: data.jobLevel || data.desiredRole || 'individual_contributor',
        preferredLocations: preferredLocations,
        desiredKeywords: desiredKeywords,
        education: Array.isArray(data.education) ? data.education[0]?.degree || '' : (data.education || ''),
        resumeText: data.resumeText || '',
        summary: data.summary || '',
        // Store raw experiences for context
        experiences: data.experiences || []
      };

      // Cache the profile for 15 minutes
      await cacheManager.setUserProfile(userId, userProfile);
      logger.debug({
        userId,
        skillsCount: skillAnalysis.allSkills.length,
        coreSkillsCount: skillAnalysis.coreSkills.length
      }, 'User profile with comprehensive skills cached');

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
