/**
 * Professional Resume Templates
 *
 * Based on industry-leading templates:
 * - Jake's Resume (famous LaTeX template)
 * - Harvard Resume Format
 * - Modern Executive styles
 *
 * These templates are designed to look like professional Word/DOCX resumes,
 * not basic HTML pages.
 */

/**
 * Base CSS - Professional document styling
 */
const BASE_CSS = `
  @page {
    size: letter;
    margin: 0;
  }

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
    font-size: 10pt;
    line-height: 1.15;
    color: #000;
    background: #fff;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .resume {
    max-width: 8.5in;
    min-height: 11in;
    margin: 0 auto;
    padding: 0.5in 0.5in;
  }

  a {
    color: #000;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  p {
    margin: 0;
  }

  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .resume {
      padding: 0.5in;
      min-height: auto;
    }
  }
`;

/**
 * Template Definitions
 */
export const TEMPLATES = {
  /**
   * Jake's Resume
   * The famous LaTeX template used by thousands of software engineers
   * Source: https://github.com/jakegut/resume
   */
  jakes_resume: {
    id: 'jakes_resume',
    name: "Jake's Resume",
    description: 'The famous LaTeX template - clean, ATS-optimized, industry standard',
    bestFor: ['software engineering', 'tech', 'startups', 'new grads', 'internships'],
    previewImage: '/templates/jakes.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 10pt;
        line-height: 1.2;
      }

      .resume {
        padding: 0.3in 0.4in;
      }

      /* Header - Centered name with contact info */
      .header {
        text-align: center;
        margin-bottom: 4px;
      }

      .header-name {
        font-size: 24pt;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .header-contact {
        font-size: 9pt;
        line-height: 1.4;
      }

      .header-contact a {
        color: #0066cc;
      }

      .header-contact .separator {
        margin: 0 4px;
        color: #000;
      }

      /* Sections */
      .section {
        margin-bottom: 8px;
      }

      .section-title {
        font-size: 10pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        border-bottom: 1px solid #000;
        padding-bottom: 1px;
        margin-bottom: 6px;
      }

      /* Entry items */
      .entry {
        margin-bottom: 6px;
      }

      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        margin-bottom: 2px;
      }

      .entry-left {
        display: flex;
        align-items: baseline;
        gap: 6px;
        flex-wrap: wrap;
      }

      .entry-title {
        font-weight: 700;
        font-size: 10pt;
      }

      .entry-subtitle {
        font-style: italic;
        font-size: 10pt;
      }

      .entry-right {
        text-align: right;
      }

      .entry-date {
        font-size: 9pt;
        font-style: italic;
      }

      .entry-location {
        font-size: 9pt;
        font-style: italic;
      }

      /* Second row for company/school */
      .entry-row-2 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 2px;
      }

      /* Bullet points - tight and professional */
      .bullets {
        margin-left: 12px;
        margin-top: 2px;
      }

      .bullets li {
        position: relative;
        padding-left: 10px;
        margin-bottom: 1px;
        font-size: 9.5pt;
        line-height: 1.25;
        text-align: left;
      }

      .bullets li::before {
        content: "•";
        position: absolute;
        left: 0;
        color: #000;
      }

      /* Skills section */
      .skills-grid {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .skill-row {
        font-size: 9.5pt;
        line-height: 1.3;
      }

      .skill-category {
        font-weight: 700;
      }

      /* Summary */
      .summary {
        font-size: 9.5pt;
        line-height: 1.35;
        text-align: justify;
      }

      /* Projects inline tech stack */
      .tech-stack {
        font-style: italic;
        font-size: 9pt;
      }
    `
  },

  /**
   * Harvard Classic
   * Based on Harvard Office of Career Services template
   * Education-first, conservative, professional
   */
  harvard_classic: {
    id: 'harvard_classic',
    name: 'Harvard Classic',
    description: 'Traditional Harvard format - education-first, conservative, professional',
    bestFor: ['finance', 'consulting', 'law', 'MBA', 'new grads', 'academia'],
    previewImage: '/templates/harvard.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Times New Roman', Times, Georgia, serif;
        font-size: 10.5pt;
        line-height: 1.2;
      }

      .resume {
        padding: 0.5in 0.6in;
      }

      /* Header - Classic centered */
      .header {
        text-align: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #000;
      }

      .header-name {
        font-size: 18pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 4px;
      }

      .header-contact {
        font-size: 10pt;
        line-height: 1.5;
      }

      .header-contact .separator {
        margin: 0 8px;
        color: #666;
      }

      .header-contact a {
        color: #000;
      }

      /* Sections */
      .section {
        margin-bottom: 10px;
      }

      .section-title {
        font-size: 11pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        border-bottom: 1.5px solid #000;
        padding-bottom: 2px;
        margin-bottom: 8px;
      }

      /* Entry items */
      .entry {
        margin-bottom: 10px;
      }

      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2px;
      }

      .entry-left {
        flex: 1;
      }

      .entry-title {
        font-weight: 700;
        font-size: 10.5pt;
      }

      .entry-subtitle {
        font-style: italic;
        font-size: 10.5pt;
      }

      .entry-right {
        text-align: right;
        white-space: nowrap;
      }

      .entry-date {
        font-size: 10pt;
      }

      .entry-location {
        font-size: 10pt;
      }

      .entry-row-2 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-style: italic;
        margin-bottom: 3px;
      }

      /* Bullet points */
      .bullets {
        margin-left: 16px;
        margin-top: 3px;
      }

      .bullets li {
        position: relative;
        padding-left: 12px;
        margin-bottom: 2px;
        font-size: 10pt;
        line-height: 1.3;
      }

      .bullets li::before {
        content: "•";
        position: absolute;
        left: 0;
      }

      /* Skills */
      .skills-grid {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .skill-row {
        font-size: 10pt;
        line-height: 1.4;
      }

      .skill-category {
        font-weight: 700;
      }

      /* Summary */
      .summary {
        font-size: 10pt;
        line-height: 1.4;
        text-align: justify;
      }

      .tech-stack {
        font-style: italic;
        font-size: 9.5pt;
      }
    `
  },

  /**
   * Modern Executive
   * Clean, sophisticated design for senior professionals
   */
  modern_executive: {
    id: 'modern_executive',
    name: 'Modern Executive',
    description: 'Sophisticated design for senior roles and executives',
    bestFor: ['executives', 'directors', 'senior managers', 'VP', 'C-level'],
    previewImage: '/templates/executive.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Garamond', 'Georgia', 'Times New Roman', serif;
        font-size: 10.5pt;
        line-height: 1.25;
      }

      .resume {
        padding: 0.5in 0.55in;
      }

      /* Header - Elegant centered */
      .header {
        text-align: center;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 2px solid #2c3e50;
      }

      .header-name {
        font-size: 22pt;
        font-weight: 400;
        letter-spacing: 3px;
        text-transform: uppercase;
        margin-bottom: 6px;
        color: #2c3e50;
      }

      .header-contact {
        font-size: 9.5pt;
        color: #444;
        letter-spacing: 0.5px;
      }

      .header-contact .separator {
        margin: 0 10px;
        color: #999;
      }

      .header-contact a {
        color: #2c3e50;
      }

      /* Sections */
      .section {
        margin-bottom: 12px;
      }

      .section-title {
        font-size: 10pt;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #2c3e50;
        border-bottom: 1px solid #bdc3c7;
        padding-bottom: 3px;
        margin-bottom: 8px;
      }

      /* Entry items */
      .entry {
        margin-bottom: 10px;
      }

      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 2px;
      }

      .entry-left {
        flex: 1;
      }

      .entry-title {
        font-weight: 700;
        font-size: 10.5pt;
        color: #2c3e50;
      }

      .entry-subtitle {
        font-style: italic;
        font-size: 10pt;
        color: #555;
      }

      .entry-right {
        text-align: right;
      }

      .entry-date {
        font-size: 9.5pt;
        color: #666;
      }

      .entry-location {
        font-size: 9.5pt;
        color: #666;
      }

      .entry-row-2 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 3px;
      }

      /* Bullet points */
      .bullets {
        margin-left: 14px;
        margin-top: 3px;
      }

      .bullets li {
        position: relative;
        padding-left: 12px;
        margin-bottom: 2px;
        font-size: 10pt;
        line-height: 1.35;
      }

      .bullets li::before {
        content: "▪";
        position: absolute;
        left: 0;
        color: #2c3e50;
        font-size: 8pt;
      }

      /* Skills */
      .skills-grid {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .skill-row {
        font-size: 10pt;
        line-height: 1.35;
      }

      .skill-category {
        font-weight: 600;
        color: #2c3e50;
      }

      /* Summary */
      .summary {
        font-size: 10pt;
        line-height: 1.45;
        color: #333;
      }

      .tech-stack {
        font-style: italic;
        font-size: 9.5pt;
        color: #666;
      }
    `
  },

  /**
   * Minimal Tech
   * Dense, ATS-optimized for maximum content
   */
  minimal_tech: {
    id: 'minimal_tech',
    name: 'Minimal Tech',
    description: 'Dense layout - maximizes content for tech roles',
    bestFor: ['software engineering', 'data science', 'AI/ML', 'DevOps', 'tech'],
    previewImage: '/templates/minimal.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Roboto', 'Segoe UI', 'Arial', sans-serif;
        font-size: 9.5pt;
        line-height: 1.15;
      }

      .resume {
        padding: 0.3in 0.4in;
      }

      /* Header - Compact left-aligned */
      .header {
        margin-bottom: 6px;
        padding-bottom: 6px;
        border-bottom: 1.5px solid #333;
      }

      .header-name {
        font-size: 20pt;
        font-weight: 700;
        margin-bottom: 2px;
      }

      .header-contact {
        font-size: 9pt;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
      }

      .header-contact a {
        color: #0066cc;
      }

      .header-contact .separator {
        display: none;
      }

      /* Sections */
      .section {
        margin-bottom: 6px;
      }

      .section-title {
        font-size: 9.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        background: #f5f5f5;
        padding: 2px 4px;
        margin-bottom: 4px;
        border-left: 3px solid #333;
      }

      /* Entry items */
      .entry {
        margin-bottom: 5px;
      }

      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 1px;
      }

      .entry-left {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }

      .entry-title {
        font-weight: 700;
        font-size: 9.5pt;
      }

      .entry-subtitle {
        font-size: 9pt;
        color: #555;
      }

      .entry-right {
        text-align: right;
      }

      .entry-date {
        font-size: 8.5pt;
        color: #666;
      }

      .entry-location {
        font-size: 8.5pt;
        color: #666;
      }

      .entry-row-2 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 1px;
        font-size: 9pt;
      }

      /* Bullet points - very tight */
      .bullets {
        margin-left: 10px;
        margin-top: 1px;
      }

      .bullets li {
        position: relative;
        padding-left: 8px;
        margin-bottom: 0;
        font-size: 9pt;
        line-height: 1.2;
      }

      .bullets li::before {
        content: "–";
        position: absolute;
        left: 0;
        color: #666;
      }

      /* Skills - inline style */
      .skills-grid {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .skill-row {
        font-size: 9pt;
        line-height: 1.25;
      }

      .skill-category {
        font-weight: 700;
      }

      /* Summary */
      .summary {
        font-size: 9pt;
        line-height: 1.3;
      }

      .tech-stack {
        font-size: 8.5pt;
        color: #666;
      }
    `
  },

  /**
   * Academic CV
   * Traditional academic format with publications support
   */
  academic_cv: {
    id: 'academic_cv',
    name: 'Academic CV',
    description: 'Traditional academic format with publications section',
    bestFor: ['academia', 'research', 'PhD', 'postdoc', 'professors', 'scientists'],
    previewImage: '/templates/academic.png',
    css: `
      ${BASE_CSS}

      body {
        font-family: 'Times New Roman', 'Times', Georgia, serif;
        font-size: 11pt;
        line-height: 1.25;
      }

      .resume {
        padding: 0.6in 0.75in;
      }

      /* Header - Traditional academic */
      .header {
        text-align: center;
        margin-bottom: 16px;
      }

      .header-name {
        font-size: 16pt;
        font-weight: 700;
        margin-bottom: 6px;
      }

      .header-contact {
        font-size: 10pt;
        line-height: 1.6;
      }

      .header-contact .separator {
        margin: 0 6px;
        color: #666;
      }

      .header-contact a {
        color: #000;
      }

      /* Sections */
      .section {
        margin-bottom: 14px;
      }

      .section-title {
        font-size: 11pt;
        font-weight: 700;
        font-variant: small-caps;
        letter-spacing: 1px;
        border-bottom: 1px solid #000;
        padding-bottom: 2px;
        margin-bottom: 8px;
      }

      /* Entry items */
      .entry {
        margin-bottom: 10px;
      }

      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2px;
      }

      .entry-left {
        flex: 1;
      }

      .entry-title {
        font-weight: 700;
        font-size: 11pt;
      }

      .entry-subtitle {
        font-style: italic;
        font-size: 10.5pt;
      }

      .entry-right {
        text-align: right;
      }

      .entry-date {
        font-size: 10pt;
      }

      .entry-location {
        font-size: 10pt;
      }

      .entry-row-2 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-style: italic;
        margin-bottom: 3px;
      }

      /* Bullet points */
      .bullets {
        margin-left: 18px;
        margin-top: 4px;
      }

      .bullets li {
        position: relative;
        padding-left: 12px;
        margin-bottom: 3px;
        font-size: 10.5pt;
        line-height: 1.35;
      }

      .bullets li::before {
        content: "•";
        position: absolute;
        left: 0;
      }

      /* Publications - special styling */
      .publication {
        margin-bottom: 8px;
        padding-left: 20px;
        text-indent: -20px;
        font-size: 10.5pt;
        line-height: 1.4;
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

      /* Skills */
      .skills-grid {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .skill-row {
        font-size: 10.5pt;
        line-height: 1.4;
      }

      .skill-category {
        font-weight: 700;
      }

      /* Summary */
      .summary {
        font-size: 10.5pt;
        line-height: 1.45;
        text-align: justify;
      }

      .tech-stack {
        font-style: italic;
        font-size: 10pt;
      }
    `
  }
};

// Legacy aliases for backward compatibility
TEMPLATES.modern_dense = TEMPLATES.minimal_tech;
TEMPLATES.classic_professional = TEMPLATES.harvard_classic;
TEMPLATES.minimal_centered = TEMPLATES.modern_executive;
TEMPLATES.academic_research = TEMPLATES.academic_cv;

/**
 * Generate HTML resume from structured data
 * @param {Object} data - Resume data
 * @param {string} templateId - Template to use
 * @returns {string} - Complete HTML document
 */
export function generateHTML(data, templateId = 'jakes_resume') {
  // Handle legacy template IDs
  let resolvedTemplateId = templateId;
  if (templateId === 'modern_dense') resolvedTemplateId = 'minimal_tech';
  if (templateId === 'classic_professional') resolvedTemplateId = 'harvard_classic';
  if (templateId === 'minimal_centered') resolvedTemplateId = 'modern_executive';
  if (templateId === 'academic_research') resolvedTemplateId = 'academic_cv';

  const template = TEMPLATES[resolvedTemplateId] || TEMPLATES.jakes_resume;

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

  // Build contact items
  if (data.phone) contactParts.push(`<span>${escapeHtml(data.phone)}</span>`);
  if (data.email) contactParts.push(`<a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a>`);
  if (data.location) contactParts.push(`<span>${escapeHtml(data.location)}</span>`);
  if (data.linkedin) {
    const linkedinDisplay = data.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, 'linkedin.com/in/');
    contactParts.push(`<a href="${escapeHtml(data.linkedin)}">${escapeHtml(linkedinDisplay)}</a>`);
  }
  if (data.github) {
    const githubDisplay = data.github.replace(/^https?:\/\/(www\.)?github\.com\//i, 'github.com/');
    contactParts.push(`<a href="${escapeHtml(data.github)}">${escapeHtml(githubDisplay)}</a>`);
  }
  if (data.portfolio) {
    const portfolioDisplay = data.portfolio.replace(/^https?:\/\/(www\.)?/i, '');
    contactParts.push(`<a href="${escapeHtml(data.portfolio)}">${escapeHtml(portfolioDisplay)}</a>`);
  }

  // Join with separators
  const contactHtml = contactParts.join('<span class="separator"> | </span>');

  return `
    <header class="header">
      <h1 class="header-name">${escapeHtml(data.name || '')}</h1>
      <div class="header-contact">
        ${contactHtml}
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
      <h2 class="section-title">Summary</h2>
      <p class="summary">${escapeHtml(summary)}</p>
    </section>
  `;
}

/**
 * Render experience section
 */
function renderExperience(experience) {
  const entries = experience.map(exp => {
    const title = exp.title || exp.position || '';
    const company = exp.company || '';
    const location = exp.location || '';
    const dateRange = formatDateRange(exp.startDate, exp.endDate);
    const bullets = exp.highlights || exp.bullets || [];

    return `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-left">
          <span class="entry-title">${escapeHtml(title)}</span>
        </div>
        <div class="entry-right">
          <span class="entry-date">${escapeHtml(dateRange)}</span>
        </div>
      </div>
      <div class="entry-row-2">
        <span class="entry-subtitle">${escapeHtml(company)}</span>
        <span class="entry-location">${escapeHtml(location)}</span>
      </div>
      ${bullets.length ? `
        <ul class="bullets">
          ${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
  }).join('');

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
  const entries = education.map(edu => {
    const institution = edu.institution || edu.school || edu.university || '';
    const degree = edu.degree || '';
    const field = edu.field || edu.major || '';
    const location = edu.location || '';
    const dateRange = formatDateRange(edu.startDate, edu.endDate);
    const gpa = edu.gpa || '';
    const highlights = edu.highlights || [];

    const degreeText = field ? `${degree} in ${field}` : degree;

    return `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-left">
          <span class="entry-title">${escapeHtml(institution)}</span>
        </div>
        <div class="entry-right">
          <span class="entry-date">${escapeHtml(dateRange)}</span>
        </div>
      </div>
      <div class="entry-row-2">
        <span class="entry-subtitle">${escapeHtml(degreeText)}${gpa ? ` | GPA: ${escapeHtml(gpa)}` : ''}</span>
        <span class="entry-location">${escapeHtml(location)}</span>
      </div>
      ${highlights.length ? `
        <ul class="bullets">
          ${highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
  }).join('');

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
  // Handle string format
  if (typeof skills === 'string') {
    return `
      <section class="section">
        <h2 class="section-title">Technical Skills</h2>
        <div class="skills-grid">
          <div class="skill-row">${escapeHtml(skills)}</div>
        </div>
      </section>
    `;
  }

  // Handle simple array
  if (Array.isArray(skills) && typeof skills[0] === 'string') {
    return `
      <section class="section">
        <h2 class="section-title">Technical Skills</h2>
        <div class="skills-grid">
          <div class="skill-row">${skills.map(s => escapeHtml(s)).join(', ')}</div>
        </div>
      </section>
    `;
  }

  // Handle array of {category, items} objects
  if (Array.isArray(skills)) {
    const rows = skills.map(cat => {
      const categoryName = cat.category || cat.name || 'Skills';
      const items = cat.items || cat.skills || [];
      return `
        <div class="skill-row">
          <span class="skill-category">${escapeHtml(categoryName)}:</span> ${items.map(s => escapeHtml(s)).join(', ')}
        </div>
      `;
    }).join('');

    return `
      <section class="section">
        <h2 class="section-title">Technical Skills</h2>
        <div class="skills-grid">
          ${rows}
        </div>
      </section>
    `;
  }

  // Handle object with category keys
  if (typeof skills === 'object') {
    const rows = Object.entries(skills).map(([category, items]) => {
      const itemsStr = Array.isArray(items) ? items.map(s => escapeHtml(s)).join(', ') : escapeHtml(items);
      return `
        <div class="skill-row">
          <span class="skill-category">${escapeHtml(category)}:</span> ${itemsStr}
        </div>
      `;
    }).join('');

    return `
      <section class="section">
        <h2 class="section-title">Technical Skills</h2>
        <div class="skills-grid">
          ${rows}
        </div>
      </section>
    `;
  }

  return '';
}

/**
 * Render projects section
 */
function renderProjects(projects) {
  const entries = projects.map(proj => {
    const name = proj.name || proj.title || '';
    const technologies = proj.technologies || proj.tech || [];
    const techStr = Array.isArray(technologies) ? technologies.join(', ') : technologies;
    const date = proj.date || proj.dates || '';
    const description = proj.description || '';
    const bullets = proj.highlights || proj.bullets || [];
    const link = proj.link || proj.url || '';

    return `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-left">
          <span class="entry-title">${escapeHtml(name)}</span>
          ${techStr ? `<span class="tech-stack">| ${escapeHtml(techStr)}</span>` : ''}
        </div>
        ${date ? `<div class="entry-right"><span class="entry-date">${escapeHtml(date)}</span></div>` : ''}
      </div>
      ${description ? `<p style="font-size: 9.5pt; margin-bottom: 2px;">${escapeHtml(description)}</p>` : ''}
      ${bullets.length ? `
        <ul class="bullets">
          ${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      ` : ''}
      ${link ? `<p style="font-size: 9pt;"><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` : ''}
    </div>
  `;
  }).join('');

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
  const entries = certifications.map(cert => {
    const name = cert.name || cert.title || '';
    const issuer = cert.issuer || cert.organization || '';
    const date = cert.date || cert.year || '';

    return `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-left">
          <span class="entry-title">${escapeHtml(name)}</span>
          ${issuer ? `<span class="entry-subtitle">- ${escapeHtml(issuer)}</span>` : ''}
        </div>
        ${date ? `<div class="entry-right"><span class="entry-date">${escapeHtml(date)}</span></div>` : ''}
      </div>
    </div>
  `;
  }).join('');

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
  const entries = publications.map(pub => {
    const authors = pub.authors || '';
    const title = pub.title || '';
    const venue = pub.venue || pub.journal || pub.conference || '';
    const year = pub.year || '';
    const link = pub.link || pub.url || '';

    return `
    <div class="publication">
      <span class="publication-authors">${escapeHtml(authors)}</span>
      ${title ? ` "<span class="publication-title">${escapeHtml(title)}</span>"` : ''}
      ${venue ? ` <span class="publication-venue">${escapeHtml(venue)}</span>` : ''}
      ${year ? ` (${escapeHtml(year)})` : ''}
      ${link ? ` <a href="${escapeHtml(link)}">[Link]</a>` : ''}
    </div>
  `;
  }).join('');

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
    return `${start || ''} – Present`;
  }
  if (!start) return end;
  return `${start} – ${end}`;
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
  // Only return main templates, not aliases
  const mainTemplates = ['jakes_resume', 'harvard_classic', 'modern_executive', 'minimal_tech', 'academic_cv'];
  return mainTemplates.map(id => {
    const t = TEMPLATES[id];
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      bestFor: t.bestFor,
      previewImage: t.previewImage
    };
  });
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

  // Academic/Research
  if (hasPublications || industry === 'academia' || role?.toLowerCase().includes('research') || role?.toLowerCase().includes('professor')) {
    return {
      recommended: 'academic_cv',
      reason: 'Academic/research role - includes publications section',
      template: TEMPLATES.academic_cv
    };
  }

  // Executive/Senior
  if (careerStage === 'executive' || experienceYears > 15 || role?.toLowerCase().includes('director') || role?.toLowerCase().includes('vp') || role?.toLowerCase().includes('chief')) {
    return {
      recommended: 'modern_executive',
      reason: 'Senior/executive role - sophisticated professional design',
      template: TEMPLATES.modern_executive
    };
  }

  // Finance/Consulting/Traditional
  if (['finance', 'consulting', 'law', 'legal', 'banking', 'healthcare'].includes(industry?.toLowerCase())) {
    return {
      recommended: 'harvard_classic',
      reason: 'Traditional industry - conservative Harvard format',
      template: TEMPLATES.harvard_classic
    };
  }

  // Tech/Startup with lots of content
  if (companyType === 'startup' || ['data science', 'machine learning', 'AI', 'devops'].some(k => role?.toLowerCase().includes(k))) {
    return {
      recommended: 'minimal_tech',
      reason: 'Tech role with dense content needs - maximizes space',
      template: TEMPLATES.minimal_tech
    };
  }

  // Default - Jake's Resume (the industry standard for tech)
  return {
    recommended: 'jakes_resume',
    reason: "Industry-standard Jake's Resume template - clean, ATS-optimized",
    template: TEMPLATES.jakes_resume
  };
}

export default {
  TEMPLATES,
  generateHTML,
  getAllTemplates,
  getTemplateById,
  getTemplateRecommendation
};
