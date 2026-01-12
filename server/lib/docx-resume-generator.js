/**
 * DOCX Resume Generator
 *
 * Creates professional Word documents using the `docx` package.
 * Supports multiple templates styled like real professional resumes.
 *
 * Templates:
 * - jakes_resume: The famous LaTeX template style (clean, ATS-optimized)
 * - harvard_classic: Traditional Harvard format (conservative, professional)
 * - modern_executive: Sophisticated design for senior roles
 * - minimal_tech: Dense layout for tech roles
 * - academic_cv: Traditional academic format
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TabStopPosition,
  TabStopType,
  convertInchesToTwip,
  ExternalHyperlink,
  UnderlineType
} from 'docx';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import logger from './logger.js';

const execAsync = promisify(exec);

/**
 * Template configurations
 */
export const TEMPLATES = {
  jakes_resume: {
    name: "Jake's Resume",
    description: "The famous LaTeX template - clean, ATS-optimized, industry standard",
    bestFor: ['software engineering', 'tech', 'startups', 'new grads'],
    fonts: {
      name: 'Calibri',
      heading: 'Calibri',
    },
    sizes: {
      name: 28,
      sectionTitle: 22,
      body: 20,
      small: 18,
    },
    margins: {
      top: convertInchesToTwip(0.4),
      bottom: convertInchesToTwip(0.4),
      left: convertInchesToTwip(0.5),
      right: convertInchesToTwip(0.5),
    },
    spacing: {
      section: 120,
      entry: 80,
      line: 240,
    }
  },
  harvard_classic: {
    name: 'Harvard Classic',
    description: "Traditional Harvard format - education-first, conservative, professional",
    bestFor: ['finance', 'consulting', 'law', 'MBA', 'new grads'],
    fonts: {
      name: 'Times New Roman',
      heading: 'Times New Roman',
    },
    sizes: {
      name: 28,
      sectionTitle: 22,
      body: 21,
      small: 19,
    },
    margins: {
      top: convertInchesToTwip(0.5),
      bottom: convertInchesToTwip(0.5),
      left: convertInchesToTwip(0.6),
      right: convertInchesToTwip(0.6),
    },
    spacing: {
      section: 160,
      entry: 100,
      line: 260,
    }
  },
  modern_executive: {
    name: 'Modern Executive',
    description: "Sophisticated design for senior roles and executives",
    bestFor: ['executives', 'directors', 'senior managers', 'VP', 'C-level'],
    fonts: {
      name: 'Garamond',
      heading: 'Garamond',
    },
    sizes: {
      name: 32,
      sectionTitle: 22,
      body: 21,
      small: 19,
    },
    margins: {
      top: convertInchesToTwip(0.5),
      bottom: convertInchesToTwip(0.5),
      left: convertInchesToTwip(0.55),
      right: convertInchesToTwip(0.55),
    },
    spacing: {
      section: 180,
      entry: 100,
      line: 260,
    }
  },
  minimal_tech: {
    name: 'Minimal Tech',
    description: "Dense layout - maximizes content for tech roles",
    bestFor: ['software engineering', 'data science', 'AI/ML', 'DevOps'],
    fonts: {
      name: 'Arial',
      heading: 'Arial',
    },
    sizes: {
      name: 26,
      sectionTitle: 20,
      body: 19,
      small: 17,
    },
    margins: {
      top: convertInchesToTwip(0.35),
      bottom: convertInchesToTwip(0.35),
      left: convertInchesToTwip(0.4),
      right: convertInchesToTwip(0.4),
    },
    spacing: {
      section: 100,
      entry: 60,
      line: 220,
    }
  },
  academic_cv: {
    name: 'Academic CV',
    description: "Traditional academic format with publications section",
    bestFor: ['academia', 'research', 'PhD', 'postdoc', 'professors'],
    fonts: {
      name: 'Times New Roman',
      heading: 'Times New Roman',
    },
    sizes: {
      name: 26,
      sectionTitle: 22,
      body: 22,
      small: 20,
    },
    margins: {
      top: convertInchesToTwip(0.6),
      bottom: convertInchesToTwip(0.6),
      left: convertInchesToTwip(0.75),
      right: convertInchesToTwip(0.75),
    },
    spacing: {
      section: 200,
      entry: 120,
      line: 280,
    }
  }
};

// Legacy aliases
TEMPLATES.modern_dense = TEMPLATES.minimal_tech;
TEMPLATES.classic_professional = TEMPLATES.harvard_classic;
TEMPLATES.minimal_centered = TEMPLATES.modern_executive;
TEMPLATES.academic_research = TEMPLATES.academic_cv;

/**
 * Customization options
 */
export const DEFAULT_CUSTOMIZATION = {
  fontFamily: 'default',    // 'default', 'serif', 'sans-serif', 'modern'
  fontSize: 'medium',       // 'small', 'medium', 'large'
  margins: 'normal',        // 'narrow', 'normal', 'wide'
  lineSpacing: 'normal',    // 'compact', 'normal', 'relaxed'
};

/**
 * Font presets
 */
const FONT_PRESETS = {
  default: null,
  serif: { name: 'Times New Roman', heading: 'Times New Roman' },
  'sans-serif': { name: 'Arial', heading: 'Arial' },
  modern: { name: 'Calibri', heading: 'Calibri Light' },
};

/**
 * Font size multipliers
 */
const FONT_SIZE_MULTIPLIERS = {
  small: 0.9,
  medium: 1.0,
  large: 1.1,
};

/**
 * Margin presets (in inches)
 */
const MARGIN_PRESETS = {
  narrow: { top: 0.3, bottom: 0.3, left: 0.4, right: 0.4 },
  normal: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
  wide: { top: 0.6, bottom: 0.6, left: 0.75, right: 0.75 },
};

/**
 * Line spacing multipliers
 */
const LINE_SPACING_MULTIPLIERS = {
  compact: 0.9,
  normal: 1.0,
  relaxed: 1.15,
};

/**
 * Apply customization to template settings
 */
export function applyCustomization(template, customization = {}) {
  if (!customization || Object.keys(customization).length === 0) {
    return template;
  }

  const opts = { ...DEFAULT_CUSTOMIZATION, ...customization };
  const customized = JSON.parse(JSON.stringify(template)); // Deep clone

  // Apply font family
  if (opts.fontFamily && opts.fontFamily !== 'default' && FONT_PRESETS[opts.fontFamily]) {
    customized.fonts = FONT_PRESETS[opts.fontFamily];
  }

  // Apply font size
  if (opts.fontSize && FONT_SIZE_MULTIPLIERS[opts.fontSize]) {
    const multiplier = FONT_SIZE_MULTIPLIERS[opts.fontSize];
    customized.sizes = {
      name: Math.round(customized.sizes.name * multiplier),
      sectionTitle: Math.round(customized.sizes.sectionTitle * multiplier),
      body: Math.round(customized.sizes.body * multiplier),
      small: Math.round(customized.sizes.small * multiplier),
    };
  }

  // Apply margins
  if (opts.margins && MARGIN_PRESETS[opts.margins]) {
    const m = MARGIN_PRESETS[opts.margins];
    customized.margins = {
      top: convertInchesToTwip(m.top),
      bottom: convertInchesToTwip(m.bottom),
      left: convertInchesToTwip(m.left),
      right: convertInchesToTwip(m.right),
    };
  }

  // Apply line spacing
  if (opts.lineSpacing && LINE_SPACING_MULTIPLIERS[opts.lineSpacing]) {
    const multiplier = LINE_SPACING_MULTIPLIERS[opts.lineSpacing];
    customized.spacing = {
      section: Math.round(customized.spacing.section * multiplier),
      entry: Math.round(customized.spacing.entry * multiplier),
      line: Math.round(customized.spacing.line * multiplier),
    };
  }

  return customized;
}

/**
 * Get available customization options
 */
export function getCustomizationOptions() {
  return {
    fontFamily: {
      label: 'Font Style',
      type: 'select',
      default: 'default',
      options: [
        { value: 'default', label: 'Template Default' },
        { value: 'serif', label: 'Classic (Times New Roman)' },
        { value: 'sans-serif', label: 'Clean (Arial)' },
        { value: 'modern', label: 'Modern (Calibri)' },
      ],
    },
    fontSize: {
      label: 'Font Size',
      type: 'select',
      default: 'medium',
      options: [
        { value: 'small', label: 'Small (more content)' },
        { value: 'medium', label: 'Medium (balanced)' },
        { value: 'large', label: 'Large (easier to read)' },
      ],
    },
    margins: {
      label: 'Margins',
      type: 'select',
      default: 'normal',
      options: [
        { value: 'narrow', label: 'Narrow (more content)' },
        { value: 'normal', label: 'Normal' },
        { value: 'wide', label: 'Wide (more whitespace)' },
      ],
    },
    lineSpacing: {
      label: 'Line Spacing',
      type: 'select',
      default: 'normal',
      options: [
        { value: 'compact', label: 'Compact' },
        { value: 'normal', label: 'Normal' },
        { value: 'relaxed', label: 'Relaxed' },
      ],
    },
  };
}

/**
 * Generate a professional DOCX resume
 *
 * @param {Object} data - Resume data
 * @param {string} templateId - Template to use
 * @param {Object} customization - Customization options
 * @returns {Promise<Buffer>} - DOCX buffer
 */
export async function generateDOCX(data, templateId = 'jakes_resume', customization = null) {
  let template = TEMPLATES[templateId] || TEMPLATES.jakes_resume;

  // Apply customization if provided
  if (customization) {
    template = applyCustomization(template, customization);
    logger.info({ customization }, 'Applied DOCX customization');
  }

  const { fonts, sizes, margins, spacing } = template;

  logger.info({ templateId, templateName: template.name }, 'Generating DOCX resume');

  const children = [];

  // Header - Name
  if (data.name) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: data.name,
            font: fonts.name,
            size: sizes.name,
            bold: true,
          }),
        ],
      })
    );
  }

  // Contact Info
  const contactParts = [];
  if (data.phone) contactParts.push(data.phone);
  if (data.email) contactParts.push(data.email);
  if (data.location) contactParts.push(data.location);
  if (data.linkedin) contactParts.push(cleanUrl(data.linkedin));
  if (data.github) contactParts.push(cleanUrl(data.github));
  if (data.portfolio) contactParts.push(cleanUrl(data.portfolio));

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: spacing.section },
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            font: fonts.name,
            size: sizes.small,
          }),
        ],
      })
    );
  }

  // Summary
  if (data.summary) {
    children.push(createSectionTitle('SUMMARY', template));
    children.push(
      new Paragraph({
        spacing: { after: spacing.section, line: spacing.line },
        children: [
          new TextRun({
            text: data.summary,
            font: fonts.name,
            size: sizes.body,
          }),
        ],
      })
    );
  }

  // Experience
  if (data.experience?.length > 0) {
    children.push(createSectionTitle('EXPERIENCE', template));

    for (const exp of data.experience) {
      // Title and Date row
      children.push(
        new Paragraph({
          spacing: { before: spacing.entry, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({
              text: exp.title || exp.position || '',
              font: fonts.name,
              size: sizes.body,
              bold: true,
            }),
            new TextRun({
              text: '\t',
            }),
            new TextRun({
              text: formatDateRange(exp.startDate, exp.endDate),
              font: fonts.name,
              size: sizes.small,
              italics: true,
            }),
          ],
        })
      );

      // Company and Location row
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({
              text: exp.company || '',
              font: fonts.name,
              size: sizes.body,
              italics: true,
            }),
            new TextRun({
              text: '\t',
            }),
            new TextRun({
              text: exp.location || '',
              font: fonts.name,
              size: sizes.small,
              italics: true,
            }),
          ],
        })
      );

      // Bullet points
      const bullets = exp.highlights || exp.bullets || [];
      for (const bullet of bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 20, line: spacing.line },
            indent: { left: convertInchesToTwip(0.25) },
            children: [
              new TextRun({
                text: bullet,
                font: fonts.name,
                size: sizes.body,
              }),
            ],
          })
        );
      }
    }

    // Add spacing after section
    children.push(new Paragraph({ spacing: { after: spacing.section - spacing.entry } }));
  }

  // Education
  if (data.education?.length > 0) {
    children.push(createSectionTitle('EDUCATION', template));

    for (const edu of data.education) {
      const institution = edu.institution || edu.school || edu.university || '';
      const degree = edu.degree || '';
      const field = edu.field || edu.major || '';
      const degreeText = field ? `${degree} in ${field}` : degree;

      // Institution and Date
      children.push(
        new Paragraph({
          spacing: { before: spacing.entry, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({
              text: institution,
              font: fonts.name,
              size: sizes.body,
              bold: true,
            }),
            new TextRun({
              text: '\t',
            }),
            new TextRun({
              text: formatDateRange(edu.startDate, edu.endDate),
              font: fonts.name,
              size: sizes.small,
              italics: true,
            }),
          ],
        })
      );

      // Degree and Location
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({
              text: degreeText + (edu.gpa ? ` | GPA: ${edu.gpa}` : ''),
              font: fonts.name,
              size: sizes.body,
              italics: true,
            }),
            new TextRun({
              text: '\t',
            }),
            new TextRun({
              text: edu.location || '',
              font: fonts.name,
              size: sizes.small,
              italics: true,
            }),
          ],
        })
      );

      // Highlights
      const highlights = edu.highlights || [];
      for (const highlight of highlights) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 20, line: spacing.line },
            indent: { left: convertInchesToTwip(0.25) },
            children: [
              new TextRun({
                text: highlight,
                font: fonts.name,
                size: sizes.body,
              }),
            ],
          })
        );
      }
    }

    children.push(new Paragraph({ spacing: { after: spacing.section - spacing.entry } }));
  }

  // Skills
  if (data.skills) {
    children.push(createSectionTitle('TECHNICAL SKILLS', template));

    const skillsContent = formatSkills(data.skills);
    for (const skillLine of skillsContent) {
      children.push(
        new Paragraph({
          spacing: { after: 40, line: spacing.line },
          children: [
            new TextRun({
              text: skillLine.category + ': ',
              font: fonts.name,
              size: sizes.body,
              bold: true,
            }),
            new TextRun({
              text: skillLine.items,
              font: fonts.name,
              size: sizes.body,
            }),
          ],
        })
      );
    }

    children.push(new Paragraph({ spacing: { after: spacing.section } }));
  }

  // Projects
  if (data.projects?.length > 0) {
    children.push(createSectionTitle('PROJECTS', template));

    for (const proj of data.projects) {
      const name = proj.name || proj.title || '';
      const tech = proj.technologies || proj.tech || [];
      const techStr = Array.isArray(tech) ? tech.join(', ') : tech;

      // Project name and tech
      children.push(
        new Paragraph({
          spacing: { before: spacing.entry, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({
              text: name,
              font: fonts.name,
              size: sizes.body,
              bold: true,
            }),
            techStr ? new TextRun({
              text: ` | ${techStr}`,
              font: fonts.name,
              size: sizes.small,
              italics: true,
            }) : new TextRun({ text: '' }),
            proj.date ? new TextRun({
              text: '\t' + proj.date,
              font: fonts.name,
              size: sizes.small,
              italics: true,
            }) : new TextRun({ text: '' }),
          ],
        })
      );

      // Description
      if (proj.description) {
        children.push(
          new Paragraph({
            spacing: { after: 20, line: spacing.line },
            children: [
              new TextRun({
                text: proj.description,
                font: fonts.name,
                size: sizes.body,
              }),
            ],
          })
        );
      }

      // Bullets
      const bullets = proj.highlights || proj.bullets || [];
      for (const bullet of bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 20, line: spacing.line },
            indent: { left: convertInchesToTwip(0.25) },
            children: [
              new TextRun({
                text: bullet,
                font: fonts.name,
                size: sizes.body,
              }),
            ],
          })
        );
      }
    }

    children.push(new Paragraph({ spacing: { after: spacing.section - spacing.entry } }));
  }

  // Certifications
  if (data.certifications?.length > 0) {
    children.push(createSectionTitle('CERTIFICATIONS', template));

    for (const cert of data.certifications) {
      const name = cert.name || cert.title || '';
      const issuer = cert.issuer || cert.organization || '';
      const date = cert.date || cert.year || '';

      children.push(
        new Paragraph({
          spacing: { after: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({
              text: name,
              font: fonts.name,
              size: sizes.body,
              bold: true,
            }),
            issuer ? new TextRun({
              text: ` - ${issuer}`,
              font: fonts.name,
              size: sizes.body,
              italics: true,
            }) : new TextRun({ text: '' }),
            date ? new TextRun({
              text: '\t' + date,
              font: fonts.name,
              size: sizes.small,
              italics: true,
            }) : new TextRun({ text: '' }),
          ],
        })
      );
    }

    children.push(new Paragraph({ spacing: { after: spacing.section } }));
  }

  // Publications (for academic CV)
  if (data.publications?.length > 0) {
    children.push(createSectionTitle('PUBLICATIONS', template));

    for (const pub of data.publications) {
      const authors = pub.authors || '';
      const title = pub.title || '';
      const venue = pub.venue || pub.journal || pub.conference || '';
      const year = pub.year || '';

      children.push(
        new Paragraph({
          spacing: { after: 60, line: spacing.line },
          indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
          children: [
            new TextRun({
              text: authors,
              font: fonts.name,
              size: sizes.body,
            }),
            title ? new TextRun({
              text: ` "${title}"`,
              font: fonts.name,
              size: sizes.body,
              italics: true,
            }) : new TextRun({ text: '' }),
            venue ? new TextRun({
              text: ` ${venue}`,
              font: fonts.name,
              size: sizes.body,
            }) : new TextRun({ text: '' }),
            year ? new TextRun({
              text: ` (${year})`,
              font: fonts.name,
              size: sizes.body,
            }) : new TextRun({ text: '' }),
          ],
        })
      );
    }
  }

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: margins,
        },
      },
      children,
    }],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  logger.info({ size: buffer.length, templateId }, 'DOCX generated successfully');

  return buffer;
}

/**
 * Create a section title with underline
 */
function createSectionTitle(title, template) {
  const { fonts, sizes, spacing } = template;

  return new Paragraph({
    spacing: { before: spacing.entry, after: 60 },
    border: {
      bottom: {
        color: '000000',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    children: [
      new TextRun({
        text: title,
        font: fonts.heading,
        size: sizes.sectionTitle,
        bold: true,
        allCaps: true,
      }),
    ],
  });
}

/**
 * Format skills into category/items pairs
 */
function formatSkills(skills) {
  if (typeof skills === 'string') {
    return [{ category: 'Skills', items: skills }];
  }

  if (Array.isArray(skills)) {
    if (typeof skills[0] === 'string') {
      return [{ category: 'Skills', items: skills.join(', ') }];
    }
    return skills.map(cat => ({
      category: cat.category || cat.name || 'Skills',
      items: (cat.items || cat.skills || []).join(', '),
    }));
  }

  if (typeof skills === 'object') {
    return Object.entries(skills).map(([category, items]) => ({
      category,
      items: Array.isArray(items) ? items.join(', ') : items,
    }));
  }

  return [];
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
 * Clean URL for display (remove https://)
 */
function cleanUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\/(www\.)?/i, '');
}

/**
 * Convert DOCX to PDF using LibreOffice
 *
 * @param {Buffer} docxBuffer - DOCX content
 * @param {string} outputPath - Optional output path
 * @returns {Promise<Buffer>} - PDF buffer
 */
export async function convertDocxToPdf(docxBuffer, outputPath = null) {
  const tempDir = path.join(os.tmpdir(), 'resume-docx-' + Date.now());
  const docxPath = path.join(tempDir, 'resume.docx');
  const pdfPath = path.join(tempDir, 'resume.pdf');

  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Write DOCX to temp file
    fs.writeFileSync(docxPath, docxBuffer);

    // Find LibreOffice executable
    const libreOfficePath = await findLibreOffice();

    if (!libreOfficePath) {
      throw new Error('LibreOffice not found. Please install it: brew install --cask libreoffice');
    }

    logger.info({ libreOfficePath }, 'Converting DOCX to PDF with LibreOffice');

    // Convert to PDF
    await execAsync(
      `"${libreOfficePath}" --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`,
      { timeout: 60000 }
    );

    // Read PDF
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF conversion failed - output file not created');
    }

    const pdfBuffer = fs.readFileSync(pdfPath);

    // Validate PDF
    if (pdfBuffer.length < 1000) {
      throw new Error('Generated PDF is too small - conversion may have failed');
    }

    logger.info({ pdfSize: pdfBuffer.length }, 'PDF conversion successful');

    // Save to output path if specified
    if (outputPath) {
      fs.writeFileSync(outputPath, pdfBuffer);
    }

    return pdfBuffer;

  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch (e) {
      logger.debug({ error: e.message }, 'Cleanup warning');
    }
  }
}

/**
 * Find LibreOffice executable
 */
async function findLibreOffice() {
  const possiblePaths = [
    // macOS
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/local/bin/soffice',
    '/usr/local/bin/libreoffice',
    // Linux
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/snap/bin/libreoffice',
    // Windows
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ];

  // Check environment variable first
  if (process.env.LIBREOFFICE_PATH) {
    if (fs.existsSync(process.env.LIBREOFFICE_PATH)) {
      return process.env.LIBREOFFICE_PATH;
    }
  }

  // Check common paths
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Try which command
  try {
    const { stdout } = await execAsync('which soffice || which libreoffice');
    const foundPath = stdout.trim();
    if (foundPath && fs.existsSync(foundPath)) {
      return foundPath;
    }
  } catch (e) {
    // which command failed, continue
  }

  return null;
}

/**
 * Generate DOCX and convert to PDF in one step
 *
 * @param {Object} data - Resume data
 * @param {string} templateId - Template to use
 * @returns {Promise<{docx: Buffer, pdf: Buffer}>}
 */
export async function generateDocxAndPdf(data, templateId = 'jakes_resume') {
  const docx = await generateDOCX(data, templateId);
  const pdf = await convertDocxToPdf(docx);

  return { docx, pdf };
}

/**
 * Get all available templates
 */
export function getAllTemplates() {
  const mainTemplates = ['jakes_resume', 'harvard_classic', 'modern_executive', 'minimal_tech', 'academic_cv'];
  return mainTemplates.map(id => ({
    id,
    name: TEMPLATES[id].name,
    fonts: TEMPLATES[id].fonts,
  }));
}

/**
 * Check if LibreOffice is available
 */
export async function isLibreOfficeAvailable() {
  const path = await findLibreOffice();
  return !!path;
}

export default {
  generateDOCX,
  convertDocxToPdf,
  generateDocxAndPdf,
  getAllTemplates,
  isLibreOfficeAvailable,
  applyCustomization,
  getCustomizationOptions,
  TEMPLATES,
  DEFAULT_CUSTOMIZATION,
};
