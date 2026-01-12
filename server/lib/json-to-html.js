/**
 * JSON to HTML Resume Converter
 *
 * Converts structured resume JSON data to HTML
 * Uses the html-templates.js for styling
 */

import { generateHTML, TEMPLATES } from './html-templates.js';

/**
 * Convert profile/resume JSON to HTML
 *
 * @param {Object} resumeJson - Resume data in JSON format
 * @param {string} templateId - Template ID to use
 * @returns {string} - Complete HTML document
 */
export function jsonToHtml(resumeJson, templateId = 'modern_dense') {
  // Normalize the data structure
  const normalizedData = normalizeResumeData(resumeJson);

  // Generate HTML using the template system
  return generateHTML(normalizedData, templateId);
}

/**
 * Normalize resume data from various formats to a consistent structure
 */
function normalizeResumeData(data) {
  // Handle different input formats
  const personalInfo = data.personalInfo || data.personal || data.contact || {};
  const experience = data.experience || data.workExperience || data.work || [];
  const education = data.education || [];
  const skills = data.skills || {};
  const projects = data.projects || [];
  const certifications = data.certifications || data.certificates || [];
  const publications = data.publications || [];
  const summary = data.summary || data.objective || data.profile || '';

  return {
    // Personal info
    name: personalInfo.name || personalInfo.fullName || data.name || '',
    email: personalInfo.email || data.email || '',
    phone: personalInfo.phone || personalInfo.mobile || data.phone || '',
    location: personalInfo.location || personalInfo.address || personalInfo.city || data.location || '',
    linkedin: normalizeUrl(personalInfo.linkedin || personalInfo.linkedIn || data.linkedin || ''),
    github: normalizeUrl(personalInfo.github || personalInfo.gitHub || data.github || ''),
    portfolio: normalizeUrl(personalInfo.portfolio || personalInfo.website || personalInfo.site || data.website || ''),

    // Summary
    summary: summary,

    // Experience - normalize to consistent format
    experience: normalizeExperience(experience),

    // Education - normalize to consistent format
    education: normalizeEducation(education),

    // Skills - normalize to consistent format
    skills: normalizeSkills(skills),

    // Projects - normalize to consistent format
    projects: normalizeProjects(projects),

    // Certifications
    certifications: normalizeCertifications(certifications),

    // Publications
    publications: normalizePublications(publications)
  };
}

/**
 * Normalize experience entries
 */
function normalizeExperience(experience) {
  if (!Array.isArray(experience)) return [];

  return experience
    .filter(exp => exp && (exp.company || exp.organization || exp.employer))
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 6)
    .map(exp => ({
      title: exp.position || exp.title || exp.role || exp.jobTitle || '',
      company: exp.company || exp.organization || exp.employer || '',
      location: exp.location || exp.city || '',
      startDate: formatDate(exp.startDate || exp.start || exp.from || ''),
      endDate: formatDate(exp.endDate || exp.end || exp.to || ''),
      highlights: normalizeHighlights(exp.bullets || exp.highlights || exp.responsibilities || exp.achievements || exp.description || [])
    }));
}

/**
 * Normalize education entries
 */
function normalizeEducation(education) {
  if (!Array.isArray(education)) return [];

  return education
    .filter(edu => edu && (edu.school || edu.institution || edu.university))
    .map(edu => {
      const highlights = [];

      // Add GPA if exists
      if (edu.gpa) {
        highlights.push(`GPA: ${edu.gpa}`);
      }

      // Add coursework if exists
      if (edu.coursework?.length) {
        highlights.push(`Relevant Coursework: ${edu.coursework.join(', ')}`);
      }

      // Add honors if exists
      if (edu.honors?.length) {
        highlights.push(`Honors: ${edu.honors.join(', ')}`);
      }

      return {
        institution: edu.school || edu.institution || edu.university || '',
        location: edu.location || edu.city || '',
        degree: edu.degree || edu.qualification || '',
        field: edu.field || edu.major || edu.fieldOfStudy || edu.program || '',
        startDate: formatDate(edu.startDate || edu.start || ''),
        endDate: formatDate(edu.endDate || edu.graduationDate || edu.graduation || edu.end || ''),
        gpa: edu.gpa || '',
        highlights
      };
    });
}

/**
 * Normalize skills to categorized format
 */
function normalizeSkills(skills) {
  // If already in categorized format
  if (skills.technical || skills.categories) {
    const categories = [];

    // Handle technical skills by category
    if (skills.technical) {
      const groups = {};

      for (const skill of skills.technical) {
        const category = skill.category || 'other';
        if (!groups[category]) groups[category] = [];
        groups[category].push(skill.name || skill);
      }

      // Map categories to readable names
      const categoryNames = {
        programming: 'Languages',
        language: 'Languages',
        languages: 'Languages',
        framework: 'Frameworks',
        frameworks: 'Frameworks',
        database: 'Databases',
        databases: 'Databases',
        cloud: 'Cloud & DevOps',
        devops: 'Cloud & DevOps',
        tool: 'Tools',
        tools: 'Tools',
        other: 'Other'
      };

      for (const [cat, items] of Object.entries(groups)) {
        if (items.length > 0) {
          categories.push({
            category: categoryNames[cat] || cat,
            items
          });
        }
      }
    }

    // Handle soft skills
    if (skills.soft?.length) {
      categories.push({
        category: 'Soft Skills',
        items: skills.soft
      });
    }

    return categories;
  }

  // If it's an array of strings
  if (Array.isArray(skills)) {
    return skills;
  }

  // If it's an object with category keys
  if (typeof skills === 'object') {
    return Object.entries(skills)
      .filter(([, items]) => items && (Array.isArray(items) ? items.length > 0 : true))
      .map(([category, items]) => ({
        category,
        items: Array.isArray(items) ? items : [items]
      }));
  }

  // If it's a string
  if (typeof skills === 'string') {
    return skills;
  }

  return [];
}

/**
 * Normalize projects
 */
function normalizeProjects(projects) {
  if (!Array.isArray(projects)) return [];

  return projects
    .filter(proj => proj && (proj.name || proj.title))
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 4)
    .map(proj => ({
      name: proj.name || proj.title || '',
      date: proj.dates || proj.date || proj.year || '',
      technologies: proj.technologies || proj.tech || proj.stack || [],
      description: proj.description || proj.summary || '',
      highlights: normalizeHighlights(proj.bullets || proj.highlights || proj.features || []),
      link: normalizeUrl(proj.link || proj.url || proj.github || '')
    }));
}

/**
 * Normalize certifications
 */
function normalizeCertifications(certifications) {
  if (!Array.isArray(certifications)) return [];

  return certifications
    .filter(cert => cert && (cert.name || cert.title))
    .map(cert => ({
      name: cert.name || cert.title || '',
      issuer: cert.issuer || cert.organization || cert.provider || '',
      date: cert.date || cert.year || cert.issued || ''
    }));
}

/**
 * Normalize publications
 */
function normalizePublications(publications) {
  if (!Array.isArray(publications)) return [];

  return publications
    .filter(pub => pub && (pub.title || pub.name))
    .map(pub => ({
      title: pub.title || pub.name || '',
      authors: pub.authors || pub.author || '',
      venue: pub.venue || pub.journal || pub.conference || pub.publication || '',
      year: pub.year || pub.date || '',
      link: normalizeUrl(pub.link || pub.url || pub.doi || '')
    }));
}

/**
 * Normalize highlights/bullets to array of strings
 */
function normalizeHighlights(highlights) {
  if (!highlights) return [];

  // If it's a string, split by newlines or periods
  if (typeof highlights === 'string') {
    return highlights
      .split(/[\n•]/)
      .map(h => h.trim())
      .filter(h => h.length > 0);
  }

  // If it's an array
  if (Array.isArray(highlights)) {
    return highlights
      .map(h => (typeof h === 'string' ? h : h.text || h.description || String(h)))
      .map(h => h.trim())
      .filter(h => h.length > 0);
  }

  return [];
}

/**
 * Format date to display format
 */
function formatDate(date) {
  if (!date) return '';

  // If it's already a formatted string
  if (typeof date === 'string') {
    // Check if it's a standard date format
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      // Format as "Mon YYYY"
      return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    // Return as-is if not parseable
    return date;
  }

  return String(date);
}

/**
 * Normalize URL
 */
function normalizeUrl(url) {
  if (!url) return '';

  // Clean up the URL
  let normalized = url.trim();

  // Remove leading/trailing slashes
  normalized = normalized.replace(/^\/+|\/+$/g, '');

  // Add https if missing
  if (normalized && !normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    // Don't add protocol if it's just a path
    if (normalized.includes('.') || normalized.includes('/')) {
      normalized = 'https://' + normalized;
    }
  }

  return normalized;
}

/**
 * Get HTML with custom CSS overrides
 */
export function jsonToHtmlWithCustomCss(resumeJson, templateId, customCss = '') {
  const html = jsonToHtml(resumeJson, templateId);

  if (!customCss) return html;

  // Inject custom CSS
  return html.replace('</style>', `\n/* Custom overrides */\n${customCss}\n</style>`);
}

/**
 * Convert profile data (from your app's format) to resume JSON
 */
export function profileToResumeJson(profile) {
  return {
    personalInfo: {
      name: profile.fullName || profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      linkedin: profile.linkedin || '',
      github: profile.github || '',
      portfolio: profile.portfolio || profile.website || ''
    },
    summary: profile.summary || profile.bio || '',
    experience: profile.experience || profile.workExperience || [],
    education: profile.education || [],
    skills: profile.skills || {},
    projects: profile.projects || [],
    certifications: profile.certifications || [],
    publications: profile.publications || []
  };
}

export default {
  jsonToHtml,
  jsonToHtmlWithCustomCss,
  profileToResumeJson,
  normalizeResumeData
};
