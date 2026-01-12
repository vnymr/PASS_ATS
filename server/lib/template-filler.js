/**
 * Template Filler - Injects structured content into LaTeX templates
 *
 * Takes a template with placeholders and content JSON, produces valid LaTeX.
 * Handles:
 * - Simple placeholders: {{PLACEHOLDER}}
 * - Conditional sections: {{#SECTION}}...{{/SECTION}}
 */

import logger from './logger.js';

/**
 * Validate content before filling template
 * Logs warnings but doesn't throw - we handle missing data gracefully
 */
function validateContent(content) {
  const warnings = [];

  if (!content) {
    warnings.push('Content is null or undefined');
    return { valid: false, warnings };
  }

  if (!content.header?.name) {
    warnings.push('Missing header.name - will use empty string');
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
 * Fill a template with content
 *
 * This is a simple copy-paste operation. The template has fixed LaTeX structure,
 * we just inject plain text content into placeholders. This guarantees valid LaTeX
 * because the template is always valid, and we escape all content properly.
 *
 * @param {string} templateLatex - LaTeX template with placeholders
 * @param {Object} content - Structured content from content-generator (plain text only)
 * @returns {string} Complete LaTeX document
 */
export function fillTemplate(templateLatex, content) {
  // Validate content first (logs warnings but doesn't throw)
  validateContent(content);

  // Ensure content object exists with defaults
  const safeContent = {
    header: content?.header || {},
    summary: content?.summary || '',
    experience: content?.experience || [],
    education: content?.education || [],
    skills: content?.skills || {},
    projects: content?.projects || [],
    certifications: content?.certifications || [],
    publications: content?.publications || []
  };

  let latex = templateLatex;

  // Process conditional sections first (removes sections with no content)
  latex = processConditionalSections(latex, safeContent);

  // Fill in each placeholder with escaped content
  // The escape function handles ALL LaTeX special characters
  latex = latex.replace(/\{\{HEADER\}\}/g, renderHeader(safeContent.header));
  latex = latex.replace(/\{\{SUMMARY\}\}/g, escapeLatex(safeContent.summary));
  latex = latex.replace(/\{\{EXPERIENCE\}\}/g, renderExperience(safeContent.experience));
  latex = latex.replace(/\{\{EDUCATION\}\}/g, renderEducation(safeContent.education));
  latex = latex.replace(/\{\{SKILLS\}\}/g, renderSkills(safeContent.skills));
  latex = latex.replace(/\{\{PROJECTS\}\}/g, renderProjects(safeContent.projects));
  latex = latex.replace(/\{\{CERTIFICATIONS\}\}/g, renderCertifications(safeContent.certifications));
  latex = latex.replace(/\{\{PUBLICATIONS\}\}/g, renderPublications(safeContent.publications));

  // Final safety check: remove any remaining placeholders
  latex = latex.replace(/\{\{[A-Z_]+\}\}/g, '');

  return latex;
}

/**
 * Process conditional sections {{#SECTION}}...{{/SECTION}}
 * Removes entire section if content is empty
 */
function processConditionalSections(latex, content) {
  // Define which sections are conditional and their content keys
  const conditionalSections = {
    'SUMMARY': content.summary,
    'PROJECTS': content.projects?.length > 0 ? content.projects : null,
    'CERTIFICATIONS': content.certifications?.length > 0 ? content.certifications : null,
    'PUBLICATIONS': content.publications?.length > 0 ? content.publications : null
  };

  for (const [section, hasContent] of Object.entries(conditionalSections)) {
    const regex = new RegExp(`\\{\\{#${section}\\}\\}([\\s\\S]*?)\\{\\{/${section}\\}\\}`, 'g');

    if (hasContent) {
      // Keep the content between markers, remove the markers themselves
      latex = latex.replace(regex, '$1');
    } else {
      // Remove the entire section including markers
      latex = latex.replace(regex, '');
    }
  }

  return latex;
}

/**
 * Render header section
 */
function renderHeader(header) {
  if (!header) return '';

  const { name, email, phone, location, linkedin, website, github } = header;

  // Detect if template uses fontawesome (by checking for faPhone, faEnvelope, etc.)
  // This is a simple centered header format that works with most templates
  let latex = `\\begin{center}
    {\\Huge \\scshape ${escapeLatex(name)}} \\\\ \\vspace{1pt}
    \\small`;

  const contactParts = [];

  if (location) contactParts.push(escapeLatex(location));
  if (phone) contactParts.push(escapeLatex(phone));
  if (email) contactParts.push(`\\href{mailto:${email}}{${escapeLatex(email)}}`);
  if (linkedin) {
    const linkedinDisplay = linkedin.replace(/https?:\/\/(www\.)?/g, '').replace(/\/$/, '');
    contactParts.push(`\\href{${linkedin}}{${escapeLatex(linkedinDisplay)}}`);
  }
  if (website) {
    const websiteDisplay = website.replace(/https?:\/\/(www\.)?/g, '').replace(/\/$/, '');
    contactParts.push(`\\href{${website}}{${escapeLatex(websiteDisplay)}}`);
  }
  if (github) {
    const githubDisplay = github.replace(/https?:\/\/(www\.)?/g, '').replace(/\/$/, '');
    contactParts.push(`\\href{${github}}{${escapeLatex(githubDisplay)}}`);
  }

  latex += ' ' + contactParts.join(' $|$ ');
  latex += `
\\end{center}`;

  return latex;
}

/**
 * Render experience section
 */
function renderExperience(experience) {
  if (!experience || !Array.isArray(experience) || experience.length === 0) return '';

  return experience.map(exp => {
    // Safely extract fields with defaults
    const title = escapeLatex(exp?.title || 'Position');
    const dates = escapeLatex(exp?.dates || '');
    const company = escapeLatex(exp?.company || 'Company');
    const location = escapeLatex(exp?.location || '');

    let latex = `  \\resumeSubheading
      {${title}}{${dates}}
      {${company}}{${location}}`;

    // Render bullets if present
    const bullets = exp?.bullets || [];
    if (Array.isArray(bullets) && bullets.length > 0) {
      latex += `
    \\resumeItemListStart`;
      for (const bullet of bullets) {
        if (bullet && typeof bullet === 'string' && bullet.trim()) {
          latex += `
      \\resumeItem{${escapeLatex(bullet)}}`;
        }
      }
      latex += `
    \\resumeItemListEnd`;
    }

    return latex;
  }).join('\n');
}

/**
 * Render education section
 */
function renderEducation(education) {
  if (!education || !Array.isArray(education) || education.length === 0) return '';

  return education.map(edu => {
    // Safely extract fields
    const school = escapeLatex(edu?.school || 'University');
    const dates = escapeLatex(edu?.dates || '');
    const location = escapeLatex(edu?.location || '');

    let subtitle = escapeLatex(edu?.degree || 'Degree');
    if (edu?.gpa) {
      subtitle += ` -- GPA: ${escapeLatex(edu.gpa)}`;
    }
    if (edu?.honors) {
      subtitle += `, ${escapeLatex(edu.honors)}`;
    }

    return `  \\resumeSubheading
      {${school}}{${dates}}
      {${subtitle}}{${location}}`;
  }).join('\n');
}

/**
 * Render skills section
 */
function renderSkills(skills) {
  if (!skills || typeof skills !== 'object' || Object.keys(skills).length === 0) return '';

  const lines = [];
  lines.push('\\begin{itemize}[leftmargin=0.15in, label={}]');
  lines.push('  \\small{\\item{');

  const skillLines = [];
  for (const [category, items] of Object.entries(skills)) {
    // Ensure items is an array and has content
    if (Array.isArray(items) && items.length > 0) {
      // Filter out empty/null items and escape each
      const validItems = items
        .filter(item => item && typeof item === 'string' && item.trim())
        .map(item => escapeLatex(item));

      if (validItems.length > 0) {
        skillLines.push(`    \\textbf{${escapeLatex(category)}}{: ${validItems.join(', ')}} \\\\`);
      }
    }
  }

  // Remove trailing \\\\ from last line
  if (skillLines.length > 0) {
    skillLines[skillLines.length - 1] = skillLines[skillLines.length - 1].replace(/ \\\\$/, '');
  }

  lines.push(skillLines.join('\n'));
  lines.push('  }}');
  lines.push('\\end{itemize}');

  return lines.join('\n');
}

/**
 * Render projects section
 */
function renderProjects(projects) {
  if (!projects || projects.length === 0) return '';

  return projects.map(proj => {
    let latex = `  \\resumeSubheading
      {${escapeLatex(proj.name)}}{${escapeLatex(proj.dates || '')}}
      {${escapeLatex(proj.technologies || '')}}{${escapeLatex(proj.link || '')}}`;

    if (proj.description) {
      latex += `
    \\resumeItemListStart
      \\resumeItem{${escapeLatex(proj.description)}}`;
    }

    if (proj.bullets && proj.bullets.length > 0) {
      if (!proj.description) {
        latex += `
    \\resumeItemListStart`;
      }
      for (const bullet of proj.bullets) {
        latex += `
      \\resumeItem{${escapeLatex(bullet)}}`;
      }
    }

    if (proj.description || (proj.bullets && proj.bullets.length > 0)) {
      latex += `
    \\resumeItemListEnd`;
    }

    return latex;
  }).join('\n');
}

/**
 * Render certifications section
 */
function renderCertifications(certifications) {
  if (!certifications || certifications.length === 0) return '';

  const lines = ['\\begin{itemize}[leftmargin=0.15in, label={}]'];
  lines.push('  \\small{\\item{');

  const certLines = certifications.map(cert => {
    let line = `\\textbf{${escapeLatex(cert.name)}}`;
    if (cert.issuer) line += ` -- ${escapeLatex(cert.issuer)}`;
    if (cert.date) line += ` (${escapeLatex(cert.date)})`;
    return `    ${line}`;
  });

  lines.push(certLines.join(' \\\\\n'));
  lines.push('  }}');
  lines.push('\\end{itemize}');

  return lines.join('\n');
}

/**
 * Render publications section (for academic template)
 */
function renderPublications(publications) {
  if (!publications || publications.length === 0) return '';

  return publications.map(pub => {
    let citation = '';
    if (pub.authors) citation += escapeLatex(pub.authors) + '. ';
    citation += `"${escapeLatex(pub.title)}." `;
    if (pub.venue) citation += `\\textit{${escapeLatex(pub.venue)}}`;
    if (pub.year) citation += `, ${escapeLatex(pub.year)}`;
    citation += '.';

    return `  \\resumePublicationItem{${citation}}`;
  }).join('\n');
}

/**
 * Escape special LaTeX characters
 *
 * This is the ONLY place where LaTeX escaping should happen.
 * The AI generates plain text, and we escape it here before injecting into templates.
 */
function escapeLatex(text) {
  if (!text || typeof text !== 'string') return '';

  // First, normalize any existing backslash-escaped characters that might have
  // been accidentally added by the AI (undo them so we can re-escape properly)
  let normalized = text
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\textasciitilde\{\}/g, '~')
    .replace(/\\textasciicircum\{\}/g, '^');

  // Also handle unicode characters that can cause issues
  normalized = normalized
    .replace(/•/g, '-')           // Bullet point
    .replace(/→/g, ' to ')        // Arrow
    .replace(/—/g, '--')          // Em dash
    .replace(/–/g, '--')          // En dash
    .replace(/"/g, "''")          // Smart quotes
    .replace(/"/g, "``")          // Smart quotes
    .replace(/'/g, "'")           // Smart apostrophe
    .replace(/'/g, "'")           // Smart apostrophe
    .replace(/…/g, '...')         // Ellipsis
    .replace(/©/g, '\\textcopyright{}')
    .replace(/®/g, '\\textregistered{}')
    .replace(/™/g, '\\texttrademark{}')
    .replace(/°/g, '\\textdegree{}')
    .replace(/±/g, '$\\pm$')
    .replace(/×/g, '$\\times$')
    .replace(/÷/g, '$\\div$')
    .replace(/≤/g, '$\\leq$')
    .replace(/≥/g, '$\\geq$')
    .replace(/≠/g, '$\\neq$')
    .replace(/≈/g, '$\\approx$');

  // Now escape LaTeX special characters
  // Order matters - we must be careful not to double-escape
  return normalized
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    // Handle curly braces carefully - only escape if not part of LaTeX commands
    .replace(/\{(?![a-zA-Z])/g, '\\{')
    .replace(/(?<![a-zA-Z\\])\}/g, '\\}');
}

/**
 * Validate that the filled template is complete
 */
export function validateFilledTemplate(latex) {
  const errors = [];

  // Check for required LaTeX structure
  if (!latex.includes('\\documentclass')) {
    errors.push('Missing \\documentclass');
  }
  if (!latex.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }
  if (!latex.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }

  // Check for unfilled placeholders
  const unfilledPlaceholders = latex.match(/\{\{[A-Z_]+\}\}/g);
  if (unfilledPlaceholders) {
    errors.push(`Unfilled placeholders: ${unfilledPlaceholders.join(', ')}`);
  }

  // Check for malformed conditional sections
  const openConditionals = latex.match(/\{\{#[A-Z_]+\}\}/g);
  const closeConditionals = latex.match(/\{\{\/[A-Z_]+\}\}/g);
  if (openConditionals || closeConditionals) {
    errors.push('Malformed conditional sections remaining');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  fillTemplate,
  validateFilledTemplate
};
