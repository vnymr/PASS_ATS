/**
 * Job-Profile Matcher
 *
 * Analyzes how well a user's profile matches a specific job description
 * Provides detailed breakdown of compatibility
 */

import { prisma } from './prisma-client.js';
import logger from './logger.js';
import { generateSimpleJsonWithGemini } from './gemini-client.js';

class JobProfileMatcher {
  /**
   * Analyze how well a user's profile matches a job
   * Returns detailed breakdown with scores and explanations
   */
  async analyzeMatch(userId, jobId) {
    try {
      // 1. Get user profile
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        return {
          error: 'User profile not found. Please complete your profile first.',
          overallScore: 0
        };
      }

      // 2. Get job details
      const job = await prisma.aggregatedJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          salary: true,
          description: true,
          requirements: true,
          extractedSkills: true,
          extractedExperience: true,
          extractedEducation: true,
          extractedJobLevel: true,
          extractedKeywords: true,
          extractedBenefits: true
        }
      });

      if (!job) {
        return { error: 'Job not found', overallScore: 0 };
      }

      // 3. Calculate detailed matching scores
      const analysis = await this.performDetailedAnalysis(profile, job);

      return analysis;

    } catch (error) {
      logger.error({ error: error.message, userId, jobId }, 'Failed to analyze job match');
      return {
        error: 'Failed to analyze match',
        overallScore: 0
      };
    }
  }

  /**
   * Perform detailed analysis using both algorithmic and LLM approaches
   */
  async performDetailedAnalysis(profile, job) {
    // Calculate algorithmic scores
    const skillsAnalysis = this.analyzeSkills(profile.skills, job.extractedSkills, job.description);
    const experienceAnalysis = this.analyzeExperience(profile, job);
    const educationAnalysis = this.analyzeEducation(profile.education, job.extractedEducation);
    const locationAnalysis = this.analyzeLocation(profile.location, job.location);
    const cultureAnalysis = await this.analyzeCultureFit(profile, job);

    // Calculate overall score (weighted average)
    const overallScore = (
      (skillsAnalysis.score * 0.40) +      // Skills most important (40%)
      (experienceAnalysis.score * 0.25) +  // Experience (25%)
      (educationAnalysis.score * 0.15) +   // Education (15%)
      (locationAnalysis.score * 0.10) +    // Location (10%)
      (cultureAnalysis.score * 0.10)       // Culture fit (10%)
    );

    // Generate AI-powered insights
    const insights = await this.generateInsights(profile, job, {
      skills: skillsAnalysis,
      experience: experienceAnalysis,
      education: educationAnalysis,
      location: locationAnalysis,
      culture: cultureAnalysis
    });

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      overallRating: this.getScoreRating(overallScore),
      breakdown: {
        skills: skillsAnalysis,
        experience: experienceAnalysis,
        education: educationAnalysis,
        location: locationAnalysis,
        cultureFit: cultureAnalysis
      },
      insights,
      jobInfo: {
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary
      }
    };
  }

  /**
   * Analyze skills match
   */
  analyzeSkills(userSkills = [], jobSkills = [], jobDescription = '') {
    if (!userSkills.length && !jobSkills.length) {
      return {
        score: 0.5,
        matchedSkills: [],
        missingSkills: [],
        extraSkills: [],
        details: 'Unable to analyze - skills data unavailable'
      };
    }

    const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());
    const normalizedJobSkills = jobSkills.map(s => s.toLowerCase().trim());

    // Find matches
    const matchedSkills = normalizedUserSkills.filter(skill =>
      normalizedJobSkills.some(jobSkill =>
        jobSkill.includes(skill) || skill.includes(jobSkill)
      )
    );

    // Find missing skills (required but user doesn't have)
    const missingSkills = normalizedJobSkills.filter(jobSkill =>
      !normalizedUserSkills.some(userSkill =>
        jobSkill.includes(userSkill) || userSkill.includes(jobSkill)
      )
    );

    // Find extra skills (user has but not required)
    const extraSkills = normalizedUserSkills.filter(userSkill =>
      !normalizedJobSkills.some(jobSkill =>
        jobSkill.includes(userSkill) || userSkill.includes(jobSkill)
      )
    );

    // Calculate score based on coverage
    const requiredCoverage = jobSkills.length > 0
      ? matchedSkills.length / jobSkills.length
      : 0;

    const userCoverage = userSkills.length > 0
      ? matchedSkills.length / userSkills.length
      : 0;

    // Weighted score: 70% required coverage, 30% user coverage
    const score = (requiredCoverage * 0.7) + (userCoverage * 0.3);

    return {
      score,
      matchedSkills: userSkills.filter(s =>
        matchedSkills.includes(s.toLowerCase().trim())
      ),
      missingSkills: jobSkills.filter(s =>
        missingSkills.includes(s.toLowerCase().trim())
      ),
      extraSkills: userSkills.filter(s =>
        extraSkills.includes(s.toLowerCase().trim())
      ),
      details: this.getSkillsDetails(matchedSkills.length, jobSkills.length, missingSkills.length)
    };
  }

  getSkillsDetails(matched, total, missing) {
    if (total === 0) return 'No specific skills listed for this job';

    const percentage = Math.round((matched / total) * 100);

    if (percentage >= 80) {
      return `Excellent match! You have ${matched} of ${total} required skills.`;
    } else if (percentage >= 60) {
      return `Good match! You have ${matched} of ${total} required skills. Consider learning: ${missing} missing skill${missing === 1 ? '' : 's'}.`;
    } else if (percentage >= 40) {
      return `Moderate match. You have ${matched} of ${total} required skills. Gap: ${missing} skill${missing === 1 ? '' : 's'} to learn.`;
    } else {
      return `Limited match. You have ${matched} of ${total} required skills. Significant upskilling needed (${missing} missing skills).`;
    }
  }

  /**
   * Analyze experience match
   */
  analyzeExperience(profile, job) {
    const userExperiences = profile.experiences || [];
    const jobExperience = job.extractedExperience || '';
    const jobLevel = job.extractedJobLevel || '';
    const jobDescription = job.description || '';
    const jobTitle = job.title || '';

    // Count years of experience
    const totalYears = userExperiences.length * 2; // Rough estimate: 2 years per job

    // Parse required years from job - try multiple sources
    let requiredYears = this.extractYearsFromText(jobExperience);

    // If no years found in extracted experience, try the full description
    if (requiredYears === 0) {
      requiredYears = this.extractYearsFromText(jobDescription);
    }

    // If still no years, try to infer from job title and level
    if (requiredYears === 0) {
      requiredYears = this.inferYearsFromTitleAndLevel(jobTitle, jobLevel);
    }

    let score = 0.5; // Default neutral
    let details = '';

    if (requiredYears > 0) {
      if (totalYears >= requiredYears) {
        score = Math.min(1.0, totalYears / (requiredYears * 1.5)); // Cap at 1.0
        details = `You have ${totalYears}+ years of experience, meeting the ${requiredYears} years requirement.`;
      } else {
        score = totalYears / requiredYears;
        details = `You have ${totalYears}+ years of experience. Job requires ${requiredYears} years. You're ${Math.round((score) * 100)}% of the way there.`;
      }
    } else {
      // Use qualitative matching (entry, mid, senior)
      const userLevel = this.inferExperienceLevel(totalYears);
      const jobLevelNormalized = jobLevel.toLowerCase();
      const jobTitleNormalized = jobTitle.toLowerCase();

      // Check job title for level indicators
      if (userLevel === 'senior' && (jobLevelNormalized.includes('senior') || jobTitleNormalized.includes('senior') || jobTitleNormalized.includes('staff') || jobTitleNormalized.includes('lead'))) {
        score = 1.0;
        details = 'Your senior-level experience aligns perfectly with this senior role.';
      } else if (userLevel === 'mid' && (jobLevelNormalized.includes('mid') || jobLevelNormalized.includes('intermediate') || (!jobTitleNormalized.includes('senior') && !jobTitleNormalized.includes('junior') && !jobTitleNormalized.includes('entry')))) {
        score = 1.0;
        details = 'Your mid-level experience matches this mid-level position.';
      } else if (userLevel === 'entry' && (jobLevelNormalized.includes('entry') || jobLevelNormalized.includes('junior') || jobTitleNormalized.includes('junior') || jobTitleNormalized.includes('entry'))) {
        score = 1.0;
        details = 'Your entry-level experience is appropriate for this junior role.';
      } else if (jobLevelNormalized === '' && jobTitleNormalized !== '') {
        // No explicit level, give moderate score
        score = 0.7;
        details = `Experience level not specified. Your ${userLevel}-level background should be suitable.`;
      } else {
        score = 0.6;
        details = `Experience level mismatch. You're ${userLevel}, job appears to be ${jobLevel || 'different level'}.`;
      }
    }

    return {
      score,
      userYears: totalYears,
      requiredYears,
      userLevel: this.inferExperienceLevel(totalYears),
      jobLevel: jobLevel || jobExperience,
      details,
      experiences: userExperiences.map(exp => ({
        company: exp.company,
        role: exp.role,
        dates: exp.dates
      }))
    };
  }

  /**
   * Extract years from text with multiple patterns
   * Order matters - check more specific patterns first!
   */
  extractYearsFromText(text) {
    if (!text) return 0;

    // Pattern 1: "5-7 years" or "3 to 5 years" (take minimum)
    let matches = text.match(/(\d+)\s*(?:-|to)\s*\d+\s*(?:years?|yrs?)/i);
    if (matches) return parseInt(matches[1]);

    // Pattern 2: "minimum of 5 years", "at least 5 years"
    matches = text.match(/(?:minimum|least|minimum of|at least)\s*(?:of\s*)?(\d+)\s*(?:years?|yrs?)/i);
    if (matches) return parseInt(matches[1]);

    // Pattern 3: Look for experience phrases in context
    matches = text.match(/(?:require|requires|requiring|need|needs|must have|should have)\s+(?:\w+\s+){0,5}?(\d+)\+?\s*(?:years?|yrs?)/i);
    if (matches) return parseInt(matches[1]);

    // Pattern 4: "5+ years of experience"
    matches = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i);
    if (matches) return parseInt(matches[1]);

    // Pattern 5: "5+ years", "5 years", "5 yrs" (most general, check last)
    matches = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
    if (matches) return parseInt(matches[1]);

    return 0;
  }

  /**
   * Infer required years from job title and level when not explicitly stated
   */
  inferYearsFromTitleAndLevel(title, level) {
    const titleLower = title.toLowerCase();
    const levelLower = level.toLowerCase();

    // Check for explicit level indicators in title or level
    if (titleLower.includes('intern') || levelLower.includes('intern')) return 0;
    if (titleLower.includes('entry') || titleLower.includes('junior') || levelLower.includes('entry') || levelLower.includes('junior')) return 1;
    if (titleLower.includes('associate') && !titleLower.includes('senior')) return 2;
    if (titleLower.includes('senior') || levelLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('sr ')) return 5;
    if (titleLower.includes('staff') || titleLower.includes('principal') || levelLower.includes('staff') || levelLower.includes('principal')) return 7;
    if (titleLower.includes('lead') || titleLower.includes('architect') || levelLower.includes('lead')) return 6;
    if (titleLower.includes('director') || titleLower.includes('vp') || levelLower.includes('director')) return 10;

    // If no clear indicator, return 0 (will use qualitative matching)
    return 0;
  }

  inferExperienceLevel(years) {
    if (years === 0) return 'entry';
    if (years <= 2) return 'junior';
    if (years <= 5) return 'mid';
    return 'senior';
  }

  /**
   * Analyze education match
   */
  analyzeEducation(userEducation, jobEducation) {
    if (!jobEducation) {
      return {
        score: 0.7, // Neutral if no education required
        details: 'No specific education requirements listed'
      };
    }

    const hasRelevantDegree = userEducation && (
      userEducation.toLowerCase().includes('computer') ||
      userEducation.toLowerCase().includes('engineering') ||
      userEducation.toLowerCase().includes('science')
    );

    const jobRequiresDegree = jobEducation.toLowerCase().includes('bachelor') ||
                              jobEducation.toLowerCase().includes('degree') ||
                              jobEducation.toLowerCase().includes('bs') ||
                              jobEducation.toLowerCase().includes('ba');

    let score = 0.5;
    let details = '';

    if (jobRequiresDegree && hasRelevantDegree) {
      score = 1.0;
      details = 'Your degree meets the educational requirements.';
    } else if (jobRequiresDegree && !hasRelevantDegree) {
      score = 0.4;
      details = 'Job requires a degree. Consider adding your education to your profile.';
    } else {
      score = 0.7;
      details = 'Education requirements are flexible for this role.';
    }

    return { score, details };
  }

  /**
   * Analyze location match
   */
  analyzeLocation(userLocation, jobLocation) {
    if (!jobLocation) {
      return { score: 0.5, details: 'Location not specified' };
    }

    const jobLocationLower = jobLocation.toLowerCase();
    const userLocationLower = (userLocation || '').toLowerCase();

    // Remote is always a perfect match
    if (jobLocationLower.includes('remote') || jobLocationLower.includes('anywhere')) {
      return {
        score: 1.0,
        details: 'This is a remote position - perfect for any location!'
      };
    }

    // Check if locations match
    if (userLocationLower && jobLocationLower.includes(userLocationLower)) {
      return {
        score: 1.0,
        details: `Perfect! The job is in ${jobLocation}, matching your location.`
      };
    }

    // Partial match (same state or region)
    const userState = this.extractState(userLocationLower);
    const jobState = this.extractState(jobLocationLower);

    if (userState && jobState && userState === jobState) {
      return {
        score: 0.7,
        details: `Job is in ${jobLocation}, same state as your location.`
      };
    }

    return {
      score: 0.3,
      details: `Job is in ${jobLocation}. Relocation or remote work may be needed.`
    };
  }

  extractState(location) {
    const states = ['ca', 'ny', 'tx', 'fl', 'wa', 'il', 'ma', 'ga', 'nc', 'pa'];
    return states.find(state => location.includes(state));
  }

  /**
   * Analyze culture fit using AI
   */
  async analyzeCultureFit(profile, job) {
    try {
      const userSummary = profile.summary || '';
      const jobDescription = job.description || '';

      if (!userSummary) {
        return {
          score: 0.5,
          details: 'Add a summary to your profile for culture fit analysis'
        };
      }

      // Use simple keyword matching for now (can be enhanced with LLM)
      const userKeywords = userSummary.toLowerCase();
      const jobKeywords = jobDescription.toLowerCase();

      const culturalFitIndicators = [
        'collaborative', 'team', 'fast-paced', 'startup', 'innovative',
        'remote', 'flexible', 'growth', 'learning', 'impact'
      ];

      let matches = 0;
      culturalFitIndicators.forEach(indicator => {
        if (userKeywords.includes(indicator) && jobKeywords.includes(indicator)) {
          matches++;
        }
      });

      const score = Math.min(1.0, matches / 5); // Cap at 1.0

      return {
        score,
        details: score >= 0.6
          ? 'Your values and the company culture appear well-aligned.'
          : 'Consider researching the company culture to assess fit.'
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to analyze culture fit');
      return {
        score: 0.5,
        details: 'Unable to analyze culture fit'
      };
    }
  }

  /**
   * Generate AI-powered insights
   */
  async generateInsights(profile, job, analysis) {
    try {
      const prompt = `Analyze this job match and provide 3-5 concise insights in JSON format.

User Profile:
- Skills: ${profile.skills.join(', ')}
- Experience: ${profile.experiences.map(e => `${e.role} at ${e.company}`).join('; ')}
- Summary: ${profile.summary || 'N/A'}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Required Skills: ${job.extractedSkills.join(', ')}
- Experience: ${job.extractedExperience}

Analysis:
- Skills Match: ${Math.round(analysis.skills.score * 100)}%
- Experience Match: ${Math.round(analysis.experience.score * 100)}%
- Overall Score: ${Math.round(((analysis.skills.score * 0.4) + (analysis.experience.score * 0.25)) * 100)}%

Return JSON with structure:
{
  "insights": [
    { "type": "strength", "emoji": "✅", "text": "Brief explanation" },
    { "type": "gap", "emoji": "⚠️", "text": "Brief explanation" },
    { "type": "recommendation", "emoji": "💡", "text": "Brief actionable advice" }
  ]
}

Keep each insight to 1-2 sentences. Focus on the most important points.`;

      const jsonResponse = await generateSimpleJsonWithGemini(prompt);
      const data = JSON.parse(jsonResponse);

      // Format insights as text for display
      const aiInsights = data.insights
        .map(insight => `${insight.emoji} ${insight.text}`)
        .join('\n\n');

      return aiInsights;

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to generate AI insights');
      return 'Insights temporarily unavailable';
    }
  }

  /**
   * Get score rating
   */
  getScoreRating(score) {
    if (score >= 0.8) return 'Excellent Match';
    if (score >= 0.6) return 'Good Match';
    if (score >= 0.4) return 'Fair Match';
    return 'Poor Match';
  }

  /**
   * Get user profile from database
   */
  async getUserProfile(userId) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId }
      });

      if (!profile || !profile.data) {
        return null;
      }

      const data = profile.data;

      return {
        skills: data.skills || [],
        experiences: data.experiences || [],
        education: Array.isArray(data.education) ? data.education[0]?.degree : data.education,
        location: data.location || '',
        summary: data.summary || '',
        resumeText: data.resumeText || ''
      };

    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get user profile');
      return null;
    }
  }
}

export default new JobProfileMatcher();
