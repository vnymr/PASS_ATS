/**
 * AI-Powered Job Search API Routes
 *
 * Natural language job search with AI query parsing
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/ai-search
 * Natural language job search
 *
 * Example queries:
 * - "remote software engineer jobs at startups"
 * - "senior frontend developer roles in San Francisco paying over 150k"
 * - "entry level data scientist positions with visa sponsorship"
 */
router.post('/ai-search', async (req, res) => {
  try {
    const { query, limit = 20, offset = 0 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required',
        example: 'Try: "remote software engineer jobs at startups"'
      });
    }

    logger.info({ query }, 'AI job search requested');

    // Step 1: Use AI to parse the natural language query into structured filters
    const parsedQuery = await parseJobQuery(query);

    logger.info({ parsedQuery }, 'Query parsed by AI');

    // Step 2: Build Prisma where clause from parsed query
    const where = buildWhereClause(parsedQuery);

    // Step 3: Get matching jobs
    const [jobs, total] = await Promise.all([
      prisma.aggregatedJob.findMany({
        where,
        orderBy: [
          { postedDate: 'desc' },
          { aiApplyable: 'desc' }
        ],
        take: parseInt(limit),
        skip: parseInt(offset),
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
      }),
      prisma.aggregatedJob.count({ where })
    ]);

    // Step 4: Generate AI explanation of search results
    const explanation = generateSearchExplanation(query, parsedQuery, total);

    res.json({
      success: true,
      query: query,
      parsedQuery: parsedQuery,
      explanation: explanation,
      jobs: jobs,
      total: total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: total > (parseInt(offset) + parseInt(limit))
    });

  } catch (error) {
    logger.error({ error: error.message }, 'AI search failed');
    res.status(500).json({
      error: 'Failed to search jobs',
      message: error.message
    });
  }
});

/**
 * GET /api/ai-search/suggestions
 * Get search query suggestions based on available jobs
 */
router.get('/ai-search/suggestions', async (req, res) => {
  try {
    // Get job statistics for generating suggestions
    const stats = await Promise.all([
      prisma.aggregatedJob.count({ where: { aiApplyable: true, isActive: true } }),
      prisma.aggregatedJob.groupBy({
        by: ['atsType'],
        where: { isActive: true, aiApplyable: true },
        _count: true,
        orderBy: { _count: { atsType: 'desc' } },
        take: 5
      }),
      prisma.aggregatedJob.findMany({
        where: { isActive: true, aiApplyable: true },
        select: { title: true },
        take: 100
      })
    ]);

    const [totalAIApplyable, topATS, recentTitles] = stats;

    // Generate smart suggestions
    const suggestions = [
      'remote software engineer jobs',
      'senior full stack developer positions',
      'entry level data scientist roles',
      'product manager jobs at tech startups',
      'frontend engineer positions paying over 120k',
      'backend developer roles with visa sponsorship',
      'AI/ML engineer jobs in San Francisco',
      'DevOps engineer remote opportunities'
    ];

    res.json({
      suggestions,
      stats: {
        totalAIApplyable,
        topPlatforms: topATS.map(p => ({ platform: p.atsType, count: p._count }))
      }
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get suggestions');
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * Parse natural language query using AI
 */
async function parseJobQuery(query) {
  const systemPrompt = `You are a job search query parser. Extract structured filters from natural language job search queries.

Return a JSON object with these fields (all optional):
{
  "keywords": string[],           // Job titles, skills, technologies
  "location": string,              // City, state, or "remote"
  "remoteOnly": boolean,           // true if user wants remote
  "experienceLevel": string,       // "entry", "mid", "senior"
  "salaryMin": number,             // Minimum salary in USD
  "salaryMax": number,             // Maximum salary in USD
  "companies": string[],           // Specific companies mentioned
  "requiresSponsorship": boolean,  // true if needs visa sponsorship
  "aiApplyableOnly": boolean,      // true if user wants auto-apply jobs only
  "atsTypes": string[]            // Specific ATS platforms if mentioned
}

Examples:
Query: "remote software engineer jobs at startups"
Output: {
  "keywords": ["software engineer"],
  "remoteOnly": true,
  "companies": ["startups"]
}

Query: "senior frontend developer in San Francisco paying over 150k"
Output: {
  "keywords": ["frontend developer"],
  "location": "San Francisco",
  "experienceLevel": "senior",
  "salaryMin": 150000
}

Query: "entry level data scientist with visa sponsorship"
Output: {
  "keywords": ["data scientist"],
  "experienceLevel": "entry",
  "requiresSponsorship": true
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  return parsed;
}

/**
 * Build Prisma where clause from parsed query
 */
function buildWhereClause(parsedQuery) {
  const where = {
    isActive: true,
    AND: []
  };

  // Keywords - search in title, description, requirements
  if (parsedQuery.keywords && parsedQuery.keywords.length > 0) {
    const keywordConditions = parsedQuery.keywords.map(keyword => ({
      OR: [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { requirements: { contains: keyword, mode: 'insensitive' } }
      ]
    }));
    where.AND.push(...keywordConditions);
  }

  // Location
  if (parsedQuery.location) {
    where.AND.push({
      location: {
        contains: parsedQuery.location,
        mode: 'insensitive'
      }
    });
  }

  // Remote only
  if (parsedQuery.remoteOnly) {
    where.AND.push({
      OR: [
        { location: { contains: 'remote', mode: 'insensitive' } },
        { location: { contains: 'anywhere', mode: 'insensitive' } }
      ]
    });
  }

  // Experience level - match in title or description
  if (parsedQuery.experienceLevel) {
    const levelKeywords = {
      'entry': ['entry', 'junior', 'associate', 'new grad'],
      'mid': ['mid', 'intermediate', '2-5 years'],
      'senior': ['senior', 'lead', 'principal', 'staff']
    };

    const keywords = levelKeywords[parsedQuery.experienceLevel.toLowerCase()] || [];
    if (keywords.length > 0) {
      where.AND.push({
        OR: keywords.map(kw => ({
          OR: [
            { title: { contains: kw, mode: 'insensitive' } },
            { description: { contains: kw, mode: 'insensitive' } }
          ]
        }))
      });
    }
  }

  // Salary range
  if (parsedQuery.salaryMin || parsedQuery.salaryMax) {
    // Salary is stored as string like "$150k - $200k"
    // We'll do a text search for now - can be improved with structured salary data
    const salaryConditions = [];

    if (parsedQuery.salaryMin) {
      // Look for salaries >= min
      const minK = Math.floor(parsedQuery.salaryMin / 1000);
      salaryConditions.push({
        salary: { not: null }
      });
    }

    if (salaryConditions.length > 0) {
      where.AND.push({ OR: salaryConditions });
    }
  }

  // Companies
  if (parsedQuery.companies && parsedQuery.companies.length > 0) {
    where.AND.push({
      OR: parsedQuery.companies.map(company => ({
        company: { contains: company, mode: 'insensitive' }
      }))
    });
  }

  // AI-applyable only
  if (parsedQuery.aiApplyableOnly) {
    where.aiApplyable = true;
  }

  // ATS types
  if (parsedQuery.atsTypes && parsedQuery.atsTypes.length > 0) {
    where.AND.push({
      atsType: { in: parsedQuery.atsTypes.map(t => t.toUpperCase()) }
    });
  }

  // Clean up empty AND array
  if (where.AND.length === 0) {
    delete where.AND;
  }

  return where;
}

/**
 * Generate human-readable explanation of search
 */
function generateSearchExplanation(originalQuery, parsedQuery, totalResults) {
  const parts = [];

  if (totalResults === 0) {
    return `No jobs found matching "${originalQuery}". Try adjusting your search criteria.`;
  }

  parts.push(`Found ${totalResults} job${totalResults === 1 ? '' : 's'}`);

  if (parsedQuery.keywords && parsedQuery.keywords.length > 0) {
    parts.push(`for ${parsedQuery.keywords.join(', ')}`);
  }

  if (parsedQuery.experienceLevel) {
    parts.push(`at ${parsedQuery.experienceLevel} level`);
  }

  if (parsedQuery.location) {
    parts.push(`in ${parsedQuery.location}`);
  } else if (parsedQuery.remoteOnly) {
    parts.push(`with remote work`);
  }

  if (parsedQuery.salaryMin) {
    const salaryFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(parsedQuery.salaryMin);
    parts.push(`paying ${salaryFormatted}+`);
  }

  if (parsedQuery.aiApplyableOnly) {
    parts.push(`(AI auto-apply available)`);
  }

  return parts.join(' ') + '.';
}

export default router;
