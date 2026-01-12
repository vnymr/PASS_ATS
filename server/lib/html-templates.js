/**
 * HTML/CSS Resume Templates
 *
 * ATS-Optimized, Single-Column, Clean Templates
 * Uses standard web fonts and simple structure for maximum compatibility
 */

/**
 * Base CSS shared by all templates
 * Ensures ATS compatibility and clean rendering
 */
const BASE_CSS = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-size: 11pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
  }

  .resume {
    max-width: 8.5in;
    margin: 0 auto;
    padding: 0.5in 0.6in;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  ul {
    list-style-position: outside;
    margin-left: 1.2em;
  }

  li {
    margin-bottom: 3px;
  }

  .section {
    margin-bottom: 12px;
  }

  .section-title {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #000;
    padding-bottom: 3px;
    margin-bottom: 8px;
  }

  .entry {
    margin-bottom: 10px;
  }

  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
  }

  .entry-title {
    font-weight: bold;
  }

  .entry-subtitle {
    font-style: italic;
  }

  .entry-date {
    font-size: 10pt;
    color: #333;
  }

  .entry-location {
    font-size: 10pt;
    color: #333;
  }

  .skills-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
  }

  .skill-category {
    margin-bottom: 4px;
  }

  .skill-category strong {
    font-weight: 600;
  }

  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .resume {
      padding: 0;
    }
  }
`;

/**
 * Template Definitions
 */
export const TEMPLATES = {
  /**
   * Classic Professional
   * Best for: Finance, Legal, Healthcare, Government, Senior Executives
   */
  classic_professional: {
    id: 'classic_professional',
    name: 'Classic Professional',
    description: 'Traditional format with centered header, conservative spacing',
    bestFor: ['finance', 'consulting', 'legal', 'healthcare', 'government', 'senior executives'],
    previewImage: '/templates/classic.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: Georgia, 'Times New Roman', serif;
      }

      .header {
        text-align: center;
        margin-bottom: 16px;
      }

      .header-name {
        font-size: 20pt;
        font-weight: bold;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .header-contact {
        font-size: 10pt;
        color: #333;
      }

      .header-contact span {
        margin: 0 8px;
      }

      .header-contact span:not(:last-child)::after {
        content: '|';
        margin-left: 16px;
        color: #666;
      }

      .section-title {
        text-align: center;
        border-bottom: 2px solid #000;
      }

      .summary {
        text-align: justify;
        font-size: 10.5pt;
        line-height: 1.5;
      }
    `
  },

  /**
   * Modern Dense
   * Best for: Tech, Startups, Engineering, Data Science
   */
  modern_dense: {
    id: 'modern_dense',
    name: 'Modern Dense',
    description: 'Compact layout maximizing content, modern clean look',
    bestFor: ['tech', 'startups', 'engineering', 'data science', 'AI/ML', 'product'],
    previewImage: '/templates/modern.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10.5pt;
        line-height: 1.35;
      }

      .resume {
        padding: 0.4in 0.5in;
      }

      .header {
        margin-bottom: 12px;
      }

      .header-name {
        font-size: 18pt;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .header-contact {
        font-size: 9.5pt;
        color: #333;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
      }

      .header-contact a {
        color: #0066cc;
      }

      .section {
        margin-bottom: 10px;
      }

      .section-title {
        font-size: 11pt;
        border-bottom-width: 1.5px;
        margin-bottom: 6px;
      }

      .entry {
        margin-bottom: 8px;
      }

      li {
        margin-bottom: 2px;
        font-size: 10pt;
      }

      .skills-inline {
        font-size: 10pt;
      }
    `
  },

  /**
   * Jake's Resume (Classic Tech)
   * Best for: Software Engineering, Tech roles, Internships
   */
  jakes_resume: {
    id: 'jakes_resume',
    name: "Jake's Resume",
    description: 'Popular proven format, clean and ATS-optimized',
    bestFor: ['software engineering', 'tech', 'internships', 'new grads'],
    previewImage: '/templates/jakes.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 10.5pt;
      }

      .resume {
        padding: 0.5in 0.55in;
      }

      .header {
        text-align: center;
        margin-bottom: 10px;
      }

      .header-name {
        font-size: 22pt;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .header-contact {
        font-size: 10pt;
      }

      .header-contact span {
        margin: 0 4px;
      }

      .header-contact a {
        color: #0066cc;
      }

      .section-title {
        font-size: 11pt;
        letter-spacing: 1px;
        border-bottom: 1px solid #000;
        padding-bottom: 2px;
        margin-bottom: 6px;
      }

      .entry {
        margin-bottom: 8px;
      }

      .entry-header {
        margin-bottom: 2px;
      }

      .entry-title {
        font-size: 10.5pt;
      }

      .entry-subtitle {
        font-size: 10pt;
      }

      li {
        font-size: 10pt;
        margin-bottom: 1px;
      }
    `
  },

  /**
   * Minimal Centered
   * Best for: AI/ML, Senior roles, Product, Design
   */
  minimal_centered: {
    id: 'minimal_centered',
    name: 'Minimal Centered',
    description: 'Clean modern design with balanced whitespace',
    bestFor: ['AI/ML', 'senior roles', 'product', 'design', 'modern companies'],
    previewImage: '/templates/minimal.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Segoe UI', Roboto, Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.45;
      }

      .resume {
        padding: 0.55in 0.65in;
      }

      .header {
        text-align: center;
        margin-bottom: 18px;
        padding-bottom: 12px;
        border-bottom: 2px solid #333;
      }

      .header-name {
        font-size: 24pt;
        font-weight: 300;
        letter-spacing: 2px;
        margin-bottom: 8px;
        text-transform: uppercase;
      }

      .header-contact {
        font-size: 10pt;
        color: #444;
        letter-spacing: 0.5px;
      }

      .header-contact span {
        margin: 0 10px;
      }

      .section {
        margin-bottom: 14px;
      }

      .section-title {
        font-size: 10pt;
        font-weight: 600;
        letter-spacing: 2px;
        border-bottom: 1px solid #999;
        padding-bottom: 4px;
        margin-bottom: 10px;
        color: #333;
      }

      .summary {
        font-size: 10.5pt;
        color: #333;
        line-height: 1.6;
      }

      .entry {
        margin-bottom: 12px;
      }
    `
  },

  /**
   * Academic Research
   * Best for: PhD, Research, Academia, Publications
   */
  academic_research: {
    id: 'academic_research',
    name: 'Academic Research',
    description: 'Traditional academic format with publications section',
    bestFor: ['academia', 'research', 'PhD', 'postdoc', 'scientific'],
    previewImage: '/templates/academic.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Times New Roman', Georgia, serif;
        font-size: 11pt;
        line-height: 1.4;
      }

      .resume {
        padding: 0.5in 0.6in;
      }

      .header {
        text-align: center;
        margin-bottom: 14px;
      }

      .header-name {
        font-size: 18pt;
        font-weight: bold;
        margin-bottom: 6px;
      }

      .header-contact {
        font-size: 10pt;
      }

      .header-contact span {
        margin: 0 6px;
      }

      .section-title {
        font-size: 12pt;
        font-variant: small-caps;
        letter-spacing: 1px;
        border-bottom: 1px solid #000;
        margin-bottom: 8px;
      }

      .entry {
        margin-bottom: 10px;
      }

      .publication {
        margin-bottom: 6px;
        padding-left: 20px;
        text-indent: -20px;
      }

      .publication-authors {
        font-style: normal;
      }

      .publication-title {
        font-style: italic;
      }

      .publication-venue {
        font-style: normal;
      }
    `
  }
};

/**
 * Generate HTML resume from structured data
 * @param {Object} data - Resume data
 * @param {string} templateId - Template to use
 * @returns {string} - Complete HTML document
 */
export function generateHTML(data, templateId = 'modern_dense') {
  const template = TEMPLATES[templateId] || TEMPLATES.modern_dense;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.name || 'Resume')}</title>
  <style>${template.css}</style>
</head>
<body>
  <div class="resume">
    ${renderHeader(data)}
    ${data.summary ? renderSummary(data.summary) : ''}
    ${data.experience?.length ? renderExperience(data.experience) : ''}
    ${data.education?.length ? renderEducation(data.education) : ''}
    ${data.skills ? renderSkills(data.skills) : ''}
    ${data.projects?.length ? renderProjects(data.projects) : ''}
    ${data.certifications?.length ? renderCertifications(data.certifications) : ''}
    ${data.publications?.length ? renderPublications(data.publications) : ''}
  </div>
</body>
</html>`;

  return html;
}

/**
 * Render header section
 */
function renderHeader(data) {
  const contactParts = [];

  if (data.email) contactParts.push(`<a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a>`);
  if (data.phone) contactParts.push(`<span>${escapeHtml(data.phone)}</span>`);
  if (data.location) contactParts.push(`<span>${escapeHtml(data.location)}</span>`);
  if (data.linkedin) contactParts.push(`<a href="${escapeHtml(data.linkedin)}" target="_blank">LinkedIn</a>`);
  if (data.github) contactParts.push(`<a href="${escapeHtml(data.github)}" target="_blank">GitHub</a>`);
  if (data.portfolio) contactParts.push(`<a href="${escapeHtml(data.portfolio)}" target="_blank">Portfolio</a>`);

  return `
    <header class="header">
      <h1 class="header-name">${escapeHtml(data.name || '')}</h1>
      <div class="header-contact">
        ${contactParts.join(' ')}
      </div>
    </header>
  `;
}

/**
 * Render summary section
 */
function renderSummary(summary) {
  return `
    <section class="section">
      <h2 class="section-title">Professional Summary</h2>
      <p class="summary">${escapeHtml(summary)}</p>
    </section>
  `;
}

/**
 * Render experience section
 */
function renderExperience(experience) {
  const entries = experience.map(exp => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <span class="entry-title">${escapeHtml(exp.title || exp.position || '')}</span>
          ${exp.company ? ` - <span class="entry-subtitle">${escapeHtml(exp.company)}</span>` : ''}
        </div>
        <div>
          <span class="entry-date">${escapeHtml(formatDateRange(exp.startDate, exp.endDate))}</span>
          ${exp.location ? ` | <span class="entry-location">${escapeHtml(exp.location)}</span>` : ''}
        </div>
      </div>
      ${exp.highlights?.length || exp.bullets?.length ? `
        <ul>
          ${(exp.highlights || exp.bullets || []).map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');

  return `
    <section class="section">
      <h2 class="section-title">Experience</h2>
      ${entries}
    </section>
  `;
}

/**
 * Render education section
 */
function renderEducation(education) {
  const entries = education.map(edu => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <span class="entry-title">${escapeHtml(edu.institution || edu.school || '')}</span>
        </div>
        <div>
          <span class="entry-date">${escapeHtml(formatDateRange(edu.startDate, edu.endDate))}</span>
          ${edu.location ? ` | <span class="entry-location">${escapeHtml(edu.location)}</span>` : ''}
        </div>
      </div>
      <div class="entry-subtitle">
        ${escapeHtml(edu.degree || '')}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}
        ${edu.gpa ? ` | GPA: ${escapeHtml(edu.gpa)}` : ''}
      </div>
      ${edu.highlights?.length ? `
        <ul>
          ${edu.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');

  return `
    <section class="section">
      <h2 class="section-title">Education</h2>
      ${entries}
    </section>
  `;
}

/**
 * Render skills section
 */
function renderSkills(skills) {
  // Handle different skill formats
  if (typeof skills === 'string') {
    return `
      <section class="section">
        <h2 class="section-title">Skills</h2>
        <p class="skills-inline">${escapeHtml(skills)}</p>
      </section>
    `;
  }

  if (Array.isArray(skills)) {
    // Simple array of skills
    if (typeof skills[0] === 'string') {
      return `
        <section class="section">
          <h2 class="section-title">Skills</h2>
          <p class="skills-inline">${skills.map(s => escapeHtml(s)).join(', ')}</p>
        </section>
      `;
    }

    // Array of {category, items} objects
    const categories = skills.map(cat => `
      <div class="skill-category">
        <strong>${escapeHtml(cat.category || cat.name || 'Skills')}:</strong>
        ${(cat.items || cat.skills || []).map(s => escapeHtml(s)).join(', ')}
      </div>
    `).join('');

    return `
      <section class="section">
        <h2 class="section-title">Technical Skills</h2>
        ${categories}
      </section>
    `;
  }

  // Object with category keys
  if (typeof skills === 'object') {
    const categories = Object.entries(skills).map(([category, items]) => `
      <div class="skill-category">
        <strong>${escapeHtml(category)}:</strong>
        ${Array.isArray(items) ? items.map(s => escapeHtml(s)).join(', ') : escapeHtml(items)}
      </div>
    `).join('');

    return `
      <section class="section">
        <h2 class="section-title">Technical Skills</h2>
        ${categories}
      </section>
    `;
  }

  return '';
}

/**
 * Render projects section
 */
function renderProjects(projects) {
  const entries = projects.map(proj => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <span class="entry-title">${escapeHtml(proj.name || proj.title || '')}</span>
          ${proj.technologies ? ` | <span class="entry-subtitle">${escapeHtml(Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies)}</span>` : ''}
        </div>
        ${proj.date || proj.dates ? `<span class="entry-date">${escapeHtml(proj.date || proj.dates)}</span>` : ''}
      </div>
      ${proj.description ? `<p>${escapeHtml(proj.description)}</p>` : ''}
      ${proj.highlights?.length || proj.bullets?.length ? `
        <ul>
          ${(proj.highlights || proj.bullets || []).map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      ` : ''}
      ${proj.link ? `<p><a href="${escapeHtml(proj.link)}" target="_blank">${escapeHtml(proj.link)}</a></p>` : ''}
    </div>
  `).join('');

  return `
    <section class="section">
      <h2 class="section-title">Projects</h2>
      ${entries}
    </section>
  `;
}

/**
 * Render certifications section
 */
function renderCertifications(certifications) {
  const entries = certifications.map(cert => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${escapeHtml(cert.name || cert.title || '')}</span>
        ${cert.date || cert.year ? `<span class="entry-date">${escapeHtml(cert.date || cert.year)}</span>` : ''}
      </div>
      ${cert.issuer ? `<div class="entry-subtitle">${escapeHtml(cert.issuer)}</div>` : ''}
    </div>
  `).join('');

  return `
    <section class="section">
      <h2 class="section-title">Certifications</h2>
      ${entries}
    </section>
  `;
}

/**
 * Render publications section (for academic template)
 */
function renderPublications(publications) {
  const entries = publications.map(pub => `
    <div class="publication">
      <span class="publication-authors">${escapeHtml(pub.authors || '')}</span>
      ${pub.title ? ` "<span class="publication-title">${escapeHtml(pub.title)}</span>"` : ''}
      ${pub.venue ? ` <span class="publication-venue">${escapeHtml(pub.venue)}</span>` : ''}
      ${pub.year ? ` (${escapeHtml(pub.year)})` : ''}
      ${pub.link ? ` <a href="${escapeHtml(pub.link)}" target="_blank">[Link]</a>` : ''}
    </div>
  `).join('');

  return `
    <section class="section">
      <h2 class="section-title">Publications</h2>
      ${entries}
    </section>
  `;
}

/**
 * Format date range
 */
function formatDateRange(start, end) {
  if (!start && !end) return '';
  if (!end || end.toLowerCase() === 'present' || end.toLowerCase() === 'current') {
    return `${start || ''} - Present`;
  }
  if (!start) return end;
  return `${start} - ${end}`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get all available templates
 */
export function getAllTemplates() {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    bestFor: t.bestFor,
    previewImage: t.previewImage
  }));
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId) {
  return TEMPLATES[templateId] || null;
}

/**
 * Get template recommendation based on context
 */
export function getTemplateRecommendation(context) {
  const { industry, role, experienceYears, careerStage, hasPublications, companyType } = context || {};

  if (hasPublications || industry === 'academia' || role?.toLowerCase().includes('research')) {
    return {
      recommended: 'academic_research',
      reason: 'Academic/research role detected, publications-friendly format',
      template: TEMPLATES.academic_research
    };
  }

  if (['tech', 'startup', 'engineering', 'software'].some(k => industry?.toLowerCase().includes(k)) || companyType === 'startup') {
    return {
      recommended: 'modern_dense',
      reason: 'Tech/startup environment, modern dense format maximizes content',
      template: TEMPLATES.modern_dense
    };
  }

  if (careerStage === 'executive' || experienceYears > 15 || ['finance', 'consulting', 'legal', 'healthcare'].includes(industry?.toLowerCase())) {
    return {
      recommended: 'classic_professional',
      reason: 'Traditional industry or senior role, conservative format preferred',
      template: TEMPLATES.classic_professional
    };
  }

  return {
    recommended: 'modern_dense',
    reason: 'Default modern format, good balance of density and readability',
    template: TEMPLATES.modern_dense
  };
}

export default {
  TEMPLATES,
  generateHTML,
  getAllTemplates,
  getTemplateById,
  getTemplateRecommendation
};
