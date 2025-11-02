import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateProfileData,
  sanitizeProfileData,
  mergeWithDefaults,
  hasMinimumData,
  hassufficientStructuredData,
  dedupeSkills,
  dedupeExperiences,
  dedupeProjects,
  dedupeCertifications,
  mergeArraysWithDedupe,
  validateJdDigest
} from '../../../lib/utils/dataValidator.js';

describe('validateProfileData', () => {
  it('should return valid for complete profile', () => {
    const profile = {
      name: 'John Doe',
      email: 'john@example.com',
      skills: ['JavaScript', 'React'],
      experiences: [
        {
          title: 'Software Engineer',
          company: 'Tech Corp',
          bullets: ['Built features', 'Managed team']
        }
      ]
    };

    const result = validateProfileData(profile);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return invalid for missing required fields', () => {
    const profile = {
      name: 'John Doe',
      // Missing email, experiences, skills
    };

    const result = validateProfileData(profile);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('email'))).toBe(true);
    expect(result.errors.some(e => e.includes('experiences'))).toBe(true);
    expect(result.errors.some(e => e.includes('skills'))).toBe(true);
  });

  it('should warn for missing experience details', () => {
    const profile = {
      name: 'John Doe',
      email: 'john@example.com',
      skills: ['JavaScript'],
      experiences: [
        {
          title: 'Engineer',
          // Missing company
        }
      ]
    };

    const result = validateProfileData(profile);

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('missing title or company'))).toBe(true);
  });

  it('should validate that experiences is an array', () => {
    const profile = {
      name: 'John Doe',
      email: 'john@example.com',
      skills: ['JavaScript'],
      experiences: 'not an array'
    };

    const result = validateProfileData(profile);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('array'))).toBe(true);
  });

  it('should warn for empty skills array', () => {
    const profile = {
      name: 'John Doe',
      email: 'john@example.com',
      skills: [],
      experiences: []
    };

    const result = validateProfileData(profile);

    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('No skills'))).toBe(true);
  });
});

describe('sanitizeProfileData', () => {
  it('should trim string fields', () => {
    const profile = {
      name: '  John Doe  ',
      email: '  john@example.com  ',
      phone: '  123-456-7890  ',
      skills: ['JavaScript']
    };

    const result = sanitizeProfileData(profile);

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
    expect(result.phone).toBe('123-456-7890');
  });

  it('should ensure arrays exist', () => {
    const profile = {
      name: 'John Doe'
    };

    const result = sanitizeProfileData(profile);

    expect(Array.isArray(result.experiences)).toBe(true);
    expect(Array.isArray(result.skills)).toBe(true);
    expect(Array.isArray(result.education)).toBe(true);
    expect(Array.isArray(result.projects)).toBe(true);
  });

  it('should remove duplicate skills', () => {
    const profile = {
      name: 'John Doe',
      skills: ['JavaScript', 'React', 'JavaScript', 'react', 'Node.js']
    };

    const result = sanitizeProfileData(profile);

    expect(result.skills.length).toBeLessThanOrEqual(3);
    expect(result.skills.filter(s => s.toLowerCase() === 'javascript').length).toBe(1);
  });

  it('should sanitize experience bullets', () => {
    const profile = {
      name: 'John Doe',
      experiences: [
        {
          title: 'Engineer',
          company: 'Tech Corp',
          bullets: ['  Feature 1  ', '', 'Feature 2', null, undefined]
        }
      ]
    };

    const result = sanitizeProfileData(profile);

    expect(result.experiences[0].bullets.length).toBe(2);
    expect(result.experiences[0].bullets.every(b => b.trim() === b)).toBe(true);
  });
});

describe('mergeWithDefaults', () => {
  it('should merge provided data with defaults', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    const result = mergeWithDefaults(data);

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
    expect(Array.isArray(result.experiences)).toBe(true);
    expect(Array.isArray(result.skills)).toBe(true);
  });

  it('should preserve guardrails defaults', () => {
    const data = {
      name: 'John Doe'
    };

    const result = mergeWithDefaults(data);

    expect(result.guardrails.noFakeNumbers).toBe(true);
    expect(Array.isArray(result.guardrails.doNotClaim)).toBe(true);
  });

  it('should merge nested guardrails', () => {
    const data = {
      name: 'John Doe',
      guardrails: {
        doNotClaim: ['CPA']
      }
    };

    const result = mergeWithDefaults(data);

    expect(result.guardrails.noFakeNumbers).toBe(true);
    expect(result.guardrails.doNotClaim).toContain('CPA');
  });
});

describe('hasMinimumData', () => {
  it('should return true for profile with name and email', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      skills: ['JavaScript']
    };

    expect(hasMinimumData(data)).toBe(true);
  });

  it('should return true for profile with name and phone', () => {
    const data = {
      name: 'John Doe',
      phone: '123-456-7890',
      experiences: [{ title: 'Engineer', company: 'Tech' }]
    };

    expect(hasMinimumData(data)).toBe(true);
  });

  it('should return false if missing name', () => {
    const data = {
      email: 'john@example.com',
      skills: ['JavaScript']
    };

    expect(hasMinimumData(data)).toBe(false);
  });

  it('should return false if missing both email and phone', () => {
    const data = {
      name: 'John Doe',
      skills: ['JavaScript']
    };

    expect(hasMinimumData(data)).toBe(false);
  });

  it('should return false if no content (experiences, skills, etc.)', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    expect(hasMinimumData(data)).toBe(false);
  });
});

describe('hassufficientStructuredData', () => {
  it('should return true with experiences', () => {
    const data = {
      experiences: [{ title: 'Engineer', company: 'Tech' }],
      skills: []
    };

    expect(hassufficientStructuredData(data)).toBe(true);
  });

  it('should return true with 5+ skills', () => {
    const data = {
      experiences: [],
      skills: ['JS', 'React', 'Node', 'Python', 'Django']
    };

    expect(hassufficientStructuredData(data)).toBe(true);
  });

  it('should return false with less than 5 skills and no experiences', () => {
    const data = {
      experiences: [],
      skills: ['JS', 'React']
    };

    expect(hassufficientStructuredData(data)).toBe(false);
  });

  it('should return true with education', () => {
    const data = {
      experiences: [],
      skills: [],
      education: [{ school: 'University' }]
    };

    expect(hassufficientStructuredData(data)).toBe(true);
  });
});

describe('dedupeSkills', () => {
  it('should remove duplicate skills (case-insensitive)', () => {
    const skills = ['JavaScript', 'React', 'javascript', 'REACT', 'Node.js'];

    const result = dedupeSkills(skills);

    expect(result.length).toBe(3);
    expect(result.map(s => s.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).length).toBe(3);
  });

  it('should handle empty array', () => {
    expect(dedupeSkills([])).toEqual([]);
  });

  it('should handle null/undefined values', () => {
    const skills = ['JavaScript', null, 'React', undefined, ''];

    const result = dedupeSkills(skills);

    expect(result.every(s => s && s.length > 0)).toBe(true);
  });

  it('should trim skills', () => {
    const skills = ['  JavaScript  ', '  React  '];

    const result = dedupeSkills(skills);

    expect(result.every(s => s.trim() === s)).toBe(true);
  });
});

describe('dedupeExperiences', () => {
  it('should remove duplicate experiences by title, company, and year', () => {
    const experiences = [
      { title: 'Engineer', company: 'Tech Corp', start: '2020' },
      { title: 'Engineer', company: 'Tech Corp', start: '2020' },
      { title: 'Engineer', company: 'Tech Corp', start: '2021' }
    ];

    const result = dedupeExperiences(experiences);

    expect(result.length).toBe(2);
  });

  it('should handle empty array', () => {
    expect(dedupeExperiences([])).toEqual([]);
  });

  it('should handle null values', () => {
    const experiences = [
      { title: 'Engineer', company: 'Tech', start: '2020' },
      null,
      undefined
    ];

    const result = dedupeExperiences(experiences);

    expect(result.length).toBe(1);
  });
});

describe('dedupeProjects', () => {
  it('should remove duplicate projects by name and year', () => {
    const projects = [
      { name: 'Project A', year: '2020' },
      { name: 'Project A', year: '2020' },
      { name: 'Project B', year: '2021' }
    ];

    const result = dedupeProjects(projects);

    expect(result.length).toBe(2);
  });

  it('should handle date field instead of year', () => {
    const projects = [
      { name: 'Project A', date: '2020-01-01' },
      { name: 'Project A', date: '2020-06-01' }
    ];

    const result = dedupeProjects(projects);

    expect(result.length).toBe(1); // Same year
  });
});

describe('dedupeCertifications', () => {
  it('should remove duplicate certifications', () => {
    const certs = [
      { name: 'AWS Certified', year: '2020' },
      { name: 'AWS Certified', year: '2020' },
      { title: 'AWS Certified', year: '2020' }
    ];

    const result = dedupeCertifications(certs);

    expect(result.length).toBe(1);
  });
});

describe('mergeArraysWithDedupe', () => {
  it('should merge and deduplicate arrays', () => {
    const existing = ['JavaScript', 'React'];
    const incoming = ['React', 'Node.js'];

    const result = mergeArraysWithDedupe(existing, incoming, dedupeSkills);

    expect(result).toContain('JavaScript');
    expect(result).toContain('React');
    expect(result).toContain('Node.js');
    expect(result.length).toBe(3);
  });
});

describe('validateJdDigest', () => {
  it('should return valid for complete digest', () => {
    const digest = {
      roleFamily: 'Software Engineering',
      keywords: ['JavaScript', 'React'],
      skills: {
        required: ['JavaScript'],
        preferred: ['TypeScript']
      }
    };

    const result = validateJdDigest(digest);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn for missing role family', () => {
    const digest = {
      keywords: ['JavaScript'],
      skills: { required: ['JavaScript'] }
    };

    const result = validateJdDigest(digest);

    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('role family'))).toBe(true);
  });

  it('should warn for no keywords', () => {
    const digest = {
      roleFamily: 'Engineering',
      skills: { required: ['JavaScript'] }
    };

    const result = validateJdDigest(digest);

    expect(result.warnings.some(w => w.includes('keywords'))).toBe(true);
  });
});

