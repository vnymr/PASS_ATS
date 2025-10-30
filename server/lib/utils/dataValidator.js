/**
 * Data validation and sanitization utilities for the resume pipeline
 */

import logger from '../logger.js';

/**
 * Validate profile data structure
 */
export function validateProfileData(data) {
  const errors = [];
  const warnings = [];

  // Check required top-level fields
  const requiredFields = ['name', 'email', 'experiences', 'skills'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate experiences
  if (data.experiences) {
    if (!Array.isArray(data.experiences)) {
      errors.push('Experiences must be an array');
    } else {
      data.experiences.forEach((exp, index) => {
        if (!exp.title || !exp.company) {
          warnings.push(`Experience ${index + 1} is missing title or company`);
        }
        if (!Array.isArray(exp.bullets)) {
          warnings.push(`Experience ${index + 1} bullets should be an array`);
        }
      });
    }
  }

  // Validate skills
  if (data.skills) {
    if (!Array.isArray(data.skills)) {
      errors.push('Skills must be an array');
    } else if (data.skills.length === 0) {
      warnings.push('No skills found in profile');
    }
  }

  // Validate education
  if (data.education && !Array.isArray(data.education)) {
    errors.push('Education must be an array');
  }

  // Validate projects
  if (data.projects && !Array.isArray(data.projects)) {
    errors.push('Projects must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize profile data
 */
export function sanitizeProfileData(data) {
  const sanitized = { ...data };

  // Ensure arrays exist
  sanitized.experiences = sanitized.experiences || [];
  sanitized.skills = sanitized.skills || [];
  sanitized.education = sanitized.education || [];
  sanitized.projects = sanitized.projects || [];
  sanitized.certifications = sanitized.certifications || [];

  // Clean string fields
  const stringFields = ['name', 'email', 'phone', 'location', 'linkedin', 'website'];
  stringFields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitized[field].trim();
    }
  });

  // Sanitize experiences
  sanitized.experiences = sanitized.experiences.map(exp => ({
    title: exp.title?.trim() || '',
    company: exp.company?.trim() || '',
    location: exp.location?.trim() || '',
    start: exp.start?.trim() || '',
    end: exp.end?.trim() || '',
    bullets: Array.isArray(exp.bullets)
      ? exp.bullets.map(b => b?.trim()).filter(b => b && b.length > 0)
      : []
  }));

  // Remove duplicate skills
  sanitized.skills = [...new Set(sanitized.skills.map(s => s?.trim()).filter(s => s))];

  // Sanitize education
  sanitized.education = sanitized.education.map(edu => ({
    school: edu.school?.trim() || '',
    degree: edu.degree?.trim() || '',
    field: edu.field?.trim() || '',
    graduationDate: edu.graduationDate?.trim() || '',
    gpa: edu.gpa?.trim() || null
  }));

  // Sanitize projects
  sanitized.projects = sanitized.projects.map(proj => ({
    name: proj.name?.trim() || '',
    description: proj.description?.trim() || '',
    technologies: Array.isArray(proj.technologies)
      ? proj.technologies.map(t => t?.trim()).filter(t => t)
      : [],
    link: proj.link?.trim() || null
  }));

  return sanitized;
}

/**
 * Merge profile data with defaults
 */
export function mergeWithDefaults(data) {
  const defaults = {
    name: null,
    location: null,
    phone: null,
    email: null,
    linkedin: null,
    website: null,
    experiences: [],
    skills: [],
    education: [],
    projects: [],
    certifications: [],
    additionalInfo: '',
    processedAdditionalInfo: {},
    guardrails: { noFakeNumbers: true, doNotClaim: [] }
  };

  return {
    ...defaults,
    ...data,
    guardrails: {
      ...defaults.guardrails,
      ...(data.guardrails || {})
    }
  };
}

/**
 * Check if profile has minimum data for resume generation
 */
export function hasMinimumData(data) {
  const hasBasicInfo = data.name && (data.email || data.phone);
  const hasContent = (
    (data.experiences && data.experiences.length > 0) ||
    (data.skills && data.skills.length > 0) ||
    (data.education && data.education.length > 0) ||
    (data.projects && data.projects.length > 0)
  );

  return hasBasicInfo && hasContent;
}

/**
 * Check if structured data is sufficient (not requiring fallback to raw text)
 */
export function hassufficientStructuredData(data) {
  // Consider structured "insufficient" if:
  // - experiences length == 0 AND skills length < 5
  // - OR no structured arrays at all
  const hasExperiences = data.experiences && data.experiences.length > 0;
  const hasEnoughSkills = data.skills && data.skills.length >= 5;
  const hasEducation = data.education && data.education.length > 0;
  const hasProjects = data.projects && data.projects.length > 0;

  // Has sufficient if has experiences OR enough skills OR education/projects
  if (hasExperiences || hasEnoughSkills || hasEducation || hasProjects) {
    return true;
  }

  return false;
}

/**
 * Deduplicate skills array (case-insensitive, trimmed)
 */
export function dedupeSkills(skills) {
  if (!Array.isArray(skills)) return [];

  const seen = new Set();
  return skills
    .map(s => s?.trim())
    .filter(s => {
      if (!s) return false;
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Deduplicate experiences by title/role, company, and start year
 */
export function dedupeExperiences(experiences) {
  if (!Array.isArray(experiences)) return [];

  const seen = new Set();
  return experiences.filter(exp => {
    if (!exp) return false;

    // Create a key from title/role, company, and start year
    const title = (exp.title || exp.role || '').toLowerCase().trim();
    const company = (exp.company || '').toLowerCase().trim();
    const start = (exp.start || '').toLowerCase().trim();

    // Extract year from start if present
    const yearMatch = start.match(/\d{4}/);
    const startYear = yearMatch ? yearMatch[0] : '';

    const key = `${title}|${company}|${startYear}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Deduplicate projects by name and year
 */
export function dedupeProjects(projects) {
  if (!Array.isArray(projects)) return [];

  const seen = new Set();
  return projects.filter(proj => {
    if (!proj) return false;

    const name = (proj.name || '').toLowerCase().trim();
    const date = (proj.date || proj.year || '').toString();
    const yearMatch = date.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : '';

    const key = `${name}|${year}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Deduplicate certifications by name/title and year
 */
export function dedupeCertifications(certs) {
  if (!Array.isArray(certs)) return [];

  const seen = new Set();
  return certs.filter(cert => {
    if (!cert) return false;

    const name = (cert.name || cert.title || '').toLowerCase().trim();
    const date = (cert.date || cert.year || '').toString();
    const yearMatch = date.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : '';

    const key = `${name}|${year}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Merge arrays with deduplication
 */
export function mergeArraysWithDedupe(existing, incoming, dedupeFunc) {
  if (!Array.isArray(existing)) existing = [];
  if (!Array.isArray(incoming)) incoming = [];

  const combined = [...existing, ...incoming];
  return dedupeFunc(combined);
}

/**
 * Log data quality metrics
 */
export function logDataQuality(data, jobId) {
  const metrics = {
    hasName: !!data.name,
    hasEmail: !!data.email,
    hasPhone: !!data.phone,
    experienceCount: data.experiences?.length || 0,
    totalBullets: data.experiences?.reduce((sum, exp) => sum + (exp.bullets?.length || 0), 0) || 0,
    skillCount: data.skills?.length || 0,
    educationCount: data.education?.length || 0,
    projectCount: data.projects?.length || 0,
    hasAdditionalInfo: !!data.additionalInfo,
    hasProcessedAdditionalInfo: !!data.processedAdditionalInfo?.newSkills?.length
  };

  logger.info(`[Data Quality ${jobId}] Profile Metrics:`, JSON.stringify(metrics, null, 2));

  // Quality score (0-100)
  let score = 0;
  if (metrics.hasName) score += 10;
  if (metrics.hasEmail) score += 10;
  if (metrics.hasPhone) score += 5;
  if (metrics.experienceCount > 0) score += 20;
  if (metrics.totalBullets > 5) score += 15;
  if (metrics.skillCount > 5) score += 15;
  if (metrics.educationCount > 0) score += 10;
  if (metrics.projectCount > 0) score += 10;
  if (metrics.hasAdditionalInfo) score += 5;

  logger.info(`[Data Quality ${jobId}] Quality Score: ${score}/100`);

  return { metrics, score };
}

/**
 * Validate job description digest
 */
export function validateJdDigest(digest) {
  const errors = [];
  const warnings = [];

  if (!digest.roleFamily) {
    warnings.push('Missing role family in JD digest');
  }

  if (!digest.keywords || digest.keywords.length === 0) {
    warnings.push('No keywords extracted from job description');
  }

  if (!digest.skills || (!digest.skills.required?.length && !digest.skills.preferred?.length)) {
    warnings.push('No skills extracted from job description');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export default {
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
  logDataQuality,
  validateJdDigest
};