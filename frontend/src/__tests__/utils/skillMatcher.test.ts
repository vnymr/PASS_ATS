import { describe, it, expect } from 'vitest';
import {
  calculateSkillMatch,
  getMatchCategory,
  extractUserSkills
} from '../../utils/skillMatcher';

describe('calculateSkillMatch', () => {
  it('should return 100% match when all skills match', () => {
    const userSkills = ['JavaScript', 'React', 'Node.js'];
    const jobSkills = ['JavaScript', 'React', 'Node.js'];

    const result = calculateSkillMatch(userSkills, jobSkills);

    expect(result.matchPercentage).toBe(100);
    expect(result.matchedSkills).toEqual(jobSkills);
    expect(result.missingSkills).toHaveLength(0);
    expect(result.totalRequiredSkills).toBe(3);
  });

  it('should calculate partial match correctly', () => {
    const userSkills = ['JavaScript', 'React'];
    const jobSkills = ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python'];

    const result = calculateSkillMatch(userSkills, jobSkills);

    expect(result.matchPercentage).toBe(40); // 2 out of 5 = 40%
    expect(result.matchedSkills).toContain('JavaScript');
    expect(result.matchedSkills).toContain('React');
    expect(result.missingSkills.length).toBe(3);
  });

  it('should handle case-insensitive matching', () => {
    const userSkills = ['javascript', 'REACT', 'TypeScript'];
    const jobSkills = ['JavaScript', 'React', 'typescript'];

    const result = calculateSkillMatch(userSkills, jobSkills);

    expect(result.matchPercentage).toBe(100);
  });

  it('should handle empty job skills', () => {
    const result = calculateSkillMatch(['JavaScript'], []);

    expect(result.matchPercentage).toBe(0);
    expect(result.totalRequiredSkills).toBe(0);
    expect(result.matchedSkills).toHaveLength(0);
    expect(result.missingSkills).toHaveLength(0);
  });

  it('should handle empty user skills', () => {
    const result = calculateSkillMatch([], ['JavaScript', 'React']);

    expect(result.matchPercentage).toBe(0);
    expect(result.matchedSkills).toHaveLength(0);
    expect(result.missingSkills).toEqual(['JavaScript', 'React']);
  });

  it('should match abbreviations (JS = JavaScript)', () => {
    const userSkills = ['JS', 'Node'];
    const jobSkills = ['JavaScript', 'Node.js'];

    const result = calculateSkillMatch(userSkills, jobSkills);

    expect(result.matchPercentage).toBeGreaterThanOrEqual(50);
    expect(result.matchedSkills.length).toBeGreaterThan(0);
  });

  it('should handle partial string matches', () => {
    const userSkills = ['PostgreSQL', 'MongoDB'];
    const jobSkills = ['Postgres', 'Mongo', 'Redis'];

    const result = calculateSkillMatch(userSkills, jobSkills);

    // Should match PostgreSQL/Postgres and MongoDB/Mongo
    expect(result.matchPercentage).toBeGreaterThanOrEqual(60);
  });

  it('should trim whitespace from skills', () => {
    const userSkills = ['  JavaScript  ', '  React  '];
    const jobSkills = ['JavaScript', 'React'];

    const result = calculateSkillMatch(userSkills, jobSkills);

    expect(result.matchPercentage).toBe(100);
  });

  it('should not match short strings (less than 3 chars)', () => {
    const userSkills = ['JS', 'TS'];
    const jobSkills = ['JS', 'TS', 'Python'];

    // Should still match if exact match, but not partial for <3 chars
    const result = calculateSkillMatch(userSkills, jobSkills);

    expect(result.matchPercentage).toBeGreaterThan(0);
  });
});

describe('getMatchCategory', () => {
  it('should return "Excellent Match" for 80%+', () => {
    const category = getMatchCategory(95);

    expect(category.label).toBe('Excellent Match');
    expect(category.color).toBe('var(--primary)');
  });

  it('should return "Good Match" for 60-79%', () => {
    const category = getMatchCategory(75);

    expect(category.label).toBe('Good Match');
    expect(category.color).toBe('var(--secondary)');
  });

  it('should return "Moderate Match" for 40-59%', () => {
    const category = getMatchCategory(50);

    expect(category.label).toBe('Moderate Match');
    expect(category.color).toBe('#f59e0b');
  });

  it('should return "Low Match" for <40%', () => {
    const category = getMatchCategory(30);

    expect(category.label).toBe('Low Match');
    expect(category.color).toBe('#9ca3af');
  });

  it('should handle boundary cases', () => {
    expect(getMatchCategory(80).label).toBe('Excellent Match');
    expect(getMatchCategory(79).label).toBe('Good Match');
    expect(getMatchCategory(60).label).toBe('Good Match');
    expect(getMatchCategory(59).label).toBe('Moderate Match');
    expect(getMatchCategory(40).label).toBe('Moderate Match');
    expect(getMatchCategory(39).label).toBe('Low Match');
  });
});

describe('extractUserSkills', () => {
  it('should extract skills from skills array', () => {
    const profileData = {
      skills: ['JavaScript', 'React', 'Node.js']
    };

    const result = extractUserSkills(profileData);

    expect(result).toContain('JavaScript');
    expect(result).toContain('React');
    expect(result).toContain('Node.js');
  });

  it('should extract skills from experience technologies', () => {
    const profileData = {
      experience: [
        {
          technologies: ['PostgreSQL', 'Redis'],
          keywords: ['AWS', 'Docker']
        }
      ]
    };

    const result = extractUserSkills(profileData);

    expect(result).toContain('PostgreSQL');
    expect(result).toContain('Redis');
    expect(result).toContain('AWS');
    expect(result).toContain('Docker');
  });

  it('should extract skills from project technologies', () => {
    const profileData = {
      projects: [
        {
          technologies: ['TypeScript', 'Next.js']
        }
      ]
    };

    const result = extractUserSkills(profileData);

    expect(result).toContain('TypeScript');
    expect(result).toContain('Next.js');
  });

  it('should combine skills from all sources', () => {
    const profileData = {
      skills: ['JavaScript'],
      experience: [
        {
          technologies: ['React'],
          keywords: ['AWS']
        }
      ],
      projects: [
        {
          technologies: ['Node.js']
        }
      ]
    };

    const result = extractUserSkills(profileData);

    expect(result).toContain('JavaScript');
    expect(result).toContain('React');
    expect(result).toContain('AWS');
    expect(result).toContain('Node.js');
  });

  it('should deduplicate skills', () => {
    const profileData = {
      skills: ['JavaScript'],
      experience: [
        {
          technologies: ['JavaScript']
        }
      ]
    };

    const result = extractUserSkills(profileData);

    const jsCount = result.filter(s => s === 'JavaScript').length;
    expect(jsCount).toBe(1);
  });

  it('should handle empty profile data', () => {
    expect(extractUserSkills(null)).toEqual([]);
    expect(extractUserSkills(undefined)).toEqual([]);
    expect(extractUserSkills({})).toEqual([]);
  });

  it('should trim and filter empty skills', () => {
    const profileData = {
      skills: ['JavaScript', '  ', '', 'React', null, undefined]
    };

    const result = extractUserSkills(profileData);

    expect(result).toContain('JavaScript');
    expect(result).toContain('React');
    expect(result.every(s => s && s.trim().length > 0)).toBe(true);
  });
});




