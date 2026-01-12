/**
 * Template Filler - Generates HTML from structured content and templates
 *
 * This is a wrapper around html-templates.js for backward compatibility.
 * Takes structured content and produces valid HTML.
 */

import { generateHTML, TEMPLATES } from './html-templates.js';
import logger from './logger.js';

/**
 * Validate content before filling template
 */
function validateContent(content) {
  const warnings = [];

  if (!content) {
    warnings.push('Content is null or undefined');
    return { valid: false, warnings };
  }

  if (!content.name && !content.header?.name) {
    warnings.push('Missing name - will use empty string');
  }

  if (!content.experience || content.experience.length === 0) {
    warnings.push('No experience entries - section will be empty');
  }

  if (!content.education || content.education.length === 0) {
    warnings.push('No education entries - section will be empty');
  }

  if (!content.skills || Object.keys(content.skills).length === 0) {
    warnings.push('No skills - section will be empty');
  }

  if (warnings.length > 0) {
    logger.warn({ warnings }, 'Content validation warnings');
  }

  return { valid: true, warnings };
}

/**
 * Normalize content from old format to new format
 */
function normalizeContent(content) {
  // If content has header object (old format), extract to top level
  if (content.header) {
    return {
      name: content.header.name || '',
      email: content.header.email || '',
      phone: content.header.phone || '',
      location: content.header.location || '',
      linkedin: content.header.linkedin || '',
      github: content.header.github || content.header.website || '',
      portfolio: content.header.portfolio || '',
      summary: content.summary || '',
      experience: normalizeExperience(content.experience || []),
      education: normalizeEducation(content.education || []),
      skills: content.skills || {},
      projects: content.projects || [],
      certifications: content.certifications || [],
      publications: content.publications || []
    };
  }

  // Already in new format or close to it
  return {
    name: content.name || content.fullName || '',
    email: content.email || '',
    phone: content.phone || '',
    location: content.location || '',
    linkedin: content.linkedin || '',
    github: content.github || '',
    portfolio: content.portfolio || content.website || '',
    summary: content.summary || content.objective || '',
    experience: normalizeExperience(content.experience || content.workExperience || []),
    education: normalizeEducation(content.education || []),
    skills: content.skills || {},
    projects: content.projects || [],
    certifications: content.certifications || [],
    publications: content.publications || []
  };
}

/**
 * Normalize experience entries
 */
function normalizeExperience(experience) {
  return experience.map(exp => ({
    title: exp.title || exp.position || exp.role || '',
    company: exp.company || exp.organization || '',
    location: exp.location || '',
    startDate: exp.startDate || exp.start || '',
    endDate: exp.endDate || exp.end || '',
    highlights: exp.highlights || exp.bullets || exp.responsibilities || []
  }));
}

/**
 * Normalize education entries
 */
function normalizeEducation(education) {
  return education.map(edu => ({
    institution: edu.institution || edu.school || edu.university || '',
    degree: edu.degree || '',
    field: edu.field || edu.major || '',
    location: edu.location || '',
    startDate: edu.startDate || '',
    endDate: edu.endDate || edu.graduationDate || edu.dates || '',
    gpa: edu.gpa || '',
    highlights: edu.highlights || edu.coursework || []
  }));
}

/**
 * Fill a template with content
 *
 * @param {string} templateIdOrHtml - Template ID or HTML template string
 * @param {Object} content - Structured content
 * @returns {string} Complete HTML document
 */
export function fillTemplate(templateIdOrHtml, content) {
  // Validate content first
  validateContent(content);

  // Normalize content to expected format
  const normalizedContent = normalizeContent(content);

  // Determine template ID
  let templateId = 'modern_dense';

  if (typeof templateIdOrHtml === 'string') {
    // Check if it's a template ID
    if (TEMPLATES[templateIdOrHtml]) {
      templateId = templateIdOrHtml;
    } else if (templateIdOrHtml.startsWith('default_')) {
      // Handle "default_xxx" format
      const id = templateIdOrHtml.replace('default_', '');
      if (TEMPLATES[id]) {
        templateId = id;
      }
    }
    // If it looks like HTML, we ignore it and use default template
    // (old LaTeX templates are no longer supported)
  }

  // Generate HTML using the template system
  const html = generateHTML(normalizedContent, templateId);

  return html;
}

/**
 * Validate that the filled template is complete
 */
export function validateFilledTemplate(html) {
  const errors = [];

  // Check for required HTML structure
  if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
    errors.push('Missing HTML doctype or html tag');
  }
  if (!html.includes('<body')) {
    errors.push('Missing body tag');
  }

  // Check for empty content
  if (!html.includes('class="header"') && !html.includes('header-name')) {
    errors.push('Missing header section');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get list of available templates
 */
export function getAvailableTemplates() {
  return Object.entries(TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description,
    bestFor: template.bestFor
  }));
}

export default {
  fillTemplate,
  validateFilledTemplate,
  getAvailableTemplates
};
