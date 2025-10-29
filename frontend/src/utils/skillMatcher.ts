/**
 * Skill Matching Utilities
 * Calculate match percentage between user skills and job requirements
 */

export interface SkillMatch {
  matchPercentage: number; // 0-100
  matchedSkills: string[];
  missingSkills: string[];
  totalRequiredSkills: number;
}

/**
 * Calculate skill match between user skills and job requirements
 * @param userSkills - Skills from user's profile
 * @param jobSkills - Skills required by the job
 * @returns SkillMatch object with match percentage and details
 */
export function calculateSkillMatch(
  userSkills: string[],
  jobSkills: string[]
): SkillMatch {
  if (!jobSkills || jobSkills.length === 0) {
    return {
      matchPercentage: 0,
      matchedSkills: [],
      missingSkills: [],
      totalRequiredSkills: 0
    };
  }

  // Normalize skills for comparison (lowercase, trim)
  const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());
  const normalizedJobSkills = jobSkills.map(s => s.toLowerCase().trim());

  // Find matched skills
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const jobSkill of jobSkills) {
    const normalized = jobSkill.toLowerCase().trim();

    // Check for exact match or partial match (e.g., "JavaScript" matches "JS")
    const isMatch = normalizedUserSkills.some(userSkill => {
      // Exact match
      if (userSkill === normalized) return true;

      // Partial match (one contains the other)
      if (userSkill.includes(normalized) || normalized.includes(userSkill)) {
        // But only if it's a meaningful match (at least 3 chars)
        if (Math.min(userSkill.length, normalized.length) >= 3) {
          return true;
        }
      }

      // Handle common abbreviations
      const abbreviations: Record<string, string[]> = {
        'javascript': ['js', 'node'],
        'typescript': ['ts'],
        'python': ['py'],
        'postgresql': ['postgres', 'psql'],
        'mongodb': ['mongo'],
        'docker': ['containerization'],
        'kubernetes': ['k8s'],
        'aws': ['amazon web services'],
        'gcp': ['google cloud'],
        'azure': ['microsoft azure']
      };

      for (const [full, abbrevs] of Object.entries(abbreviations)) {
        if ((userSkill === full && abbrevs.includes(normalized)) ||
            (normalized === full && abbrevs.includes(userSkill))) {
          return true;
        }
      }

      return false;
    });

    if (isMatch) {
      matchedSkills.push(jobSkill);
    } else {
      missingSkills.push(jobSkill);
    }
  }

  // Calculate match percentage
  const matchPercentage = Math.round((matchedSkills.length / jobSkills.length) * 100);

  return {
    matchPercentage,
    matchedSkills,
    missingSkills,
    totalRequiredSkills: jobSkills.length
  };
}

/**
 * Get match category based on percentage
 */
export function getMatchCategory(percentage: number): {
  label: string;
  color: string;
  description: string;
} {
  if (percentage >= 80) {
    return {
      label: 'Excellent Match',
      color: 'var(--primary)',
      description: 'You meet most of the requirements for this role'
    };
  } else if (percentage >= 60) {
    return {
      label: 'Good Match',
      color: 'var(--secondary)',
      description: 'You have many of the required skills'
    };
  } else if (percentage >= 40) {
    return {
      label: 'Moderate Match',
      color: '#f59e0b', // amber
      description: 'You meet some of the requirements'
    };
  } else {
    return {
      label: 'Low Match',
      color: '#9ca3af', // gray
      description: 'Consider developing more skills for this role'
    };
  }
}

/**
 * Extract skills from user profile
 * Assumes profile.data follows the resume structure
 */
export function extractUserSkills(profileData: any): string[] {
  if (!profileData) return [];

  const skills: string[] = [];

  // Extract from skills array
  if (profileData.skills && Array.isArray(profileData.skills)) {
    skills.push(...profileData.skills);
  }

  // Extract from experience (technologies used)
  if (profileData.experience && Array.isArray(profileData.experience)) {
    for (const exp of profileData.experience) {
      if (exp.technologies && Array.isArray(exp.technologies)) {
        skills.push(...exp.technologies);
      }
      if (exp.keywords && Array.isArray(exp.keywords)) {
        skills.push(...exp.keywords);
      }
    }
  }

  // Extract from projects (technologies used)
  if (profileData.projects && Array.isArray(profileData.projects)) {
    for (const project of profileData.projects) {
      if (project.technologies && Array.isArray(project.technologies)) {
        skills.push(...project.technologies);
      }
    }
  }

  // Deduplicate and normalize
  return Array.from(new Set(skills.map(s => s.trim()))).filter(s => s.length > 0);
}
