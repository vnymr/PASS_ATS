/**
 * Resume Template Management API
 * Endpoints for managing user resume templates
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import { TEMPLATES, getAllTemplates } from '../lib/resume-templates.js';
import { compileLatex, validateLatex } from '../lib/latex-compiler.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * Sample data for template preview
 */
const SAMPLE_DATA = {
  header: `\\begin{center}
    \\textbf{\\Huge John Smith} \\\\[3pt]
    \\small San Francisco, CA $|$ john.smith@email.com $|$ (555) 123-4567 $|$ linkedin.com/in/johnsmith
\\end{center}`,
  summary: `Results-driven software engineer with 5+ years of experience building scalable web applications. Expert in React, Node.js, and cloud infrastructure. Passionate about clean code and user experience.`,
  experience: `\\resumeSubheading
  {Senior Software Engineer}{Jan 2022 -- Present}
  {Tech Company Inc.}{San Francisco, CA}
  \\resumeItemListStart
    \\resumeItem{Led development of microservices architecture serving 1M+ daily active users}
    \\resumeItem{Reduced API response times by 40\\% through optimization and caching strategies}
    \\resumeItem{Mentored 3 junior engineers and conducted 50+ technical interviews}
  \\resumeItemListEnd

\\resumeSubheading
  {Software Engineer}{Jun 2019 -- Dec 2021}
  {Startup Co.}{New York, NY}
  \\resumeItemListStart
    \\resumeItem{Built real-time collaboration features using WebSocket and Redis}
    \\resumeItem{Implemented CI/CD pipeline reducing deployment time by 60\\%}
  \\resumeItemListEnd`,
  projects: `\\resumeProjectHeading
  {\\textbf{Open Source Project} $|$ \\emph{TypeScript, React, GraphQL}}{2023}
  \\resumeItemListStart
    \\resumeItem{Created developer tool with 500+ GitHub stars}
    \\resumeItem{Published on npm with 10K+ weekly downloads}
  \\resumeItemListEnd`,
  skills: `\\begin{itemize}[leftmargin=0.15in, label={}]
  \\small{\\item{
   \\textbf{Languages}{: JavaScript, TypeScript, Python, Go, SQL} \\\\
   \\textbf{Frameworks}{: React, Node.js, Next.js, Express, FastAPI} \\\\
   \\textbf{Tools}{: Git, Docker, Kubernetes, AWS, PostgreSQL, Redis}
  }}
\\end{itemize}`,
  education: `\\resumeSubheading
  {University of California, Berkeley}{2015 -- 2019}
  {Bachelor of Science in Computer Science}{Berkeley, CA}`
};

/**
 * Fill template placeholders with sample data for preview
 */
function fillTemplateForPreview(latex) {
  let filled = latex;

  // Replace main placeholders
  filled = filled.replace(/\{\{HEADER\}\}/g, SAMPLE_DATA.header);
  filled = filled.replace(/\{\{EXPERIENCE\}\}/g, SAMPLE_DATA.experience);
  filled = filled.replace(/\{\{SKILLS\}\}/g, SAMPLE_DATA.skills);
  filled = filled.replace(/\{\{EDUCATION\}\}/g, SAMPLE_DATA.education);

  // Handle conditional sections - include them with sample data
  filled = filled.replace(/\{\{#SUMMARY\}\}([\s\S]*?)\{\{\/SUMMARY\}\}/g, (match, content) => {
    return content.replace(/\{\{SUMMARY\}\}/g, SAMPLE_DATA.summary);
  });

  filled = filled.replace(/\{\{#PROJECTS\}\}([\s\S]*?)\{\{\/PROJECTS\}\}/g, (match, content) => {
    return content.replace(/\{\{PROJECTS\}\}/g, SAMPLE_DATA.projects);
  });

  // Remove any remaining conditional blocks that weren't matched
  filled = filled.replace(/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/g, '');

  // Remove any remaining unfilled placeholders
  filled = filled.replace(/\{\{\w+\}\}/g, '');

  return filled;
}

/**
 * GET /api/templates
 * List user's templates + default templates
 */
router.get('/templates', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user's custom templates
    const userTemplates = await prisma.resumeTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Get default templates (from resume-templates.js)
    const defaultTemplates = Object.keys(TEMPLATES).map(key => ({
      id: `default_${key}`,
      name: TEMPLATES[key].name,
      isDefault: false,
      isSystemDefault: true,
      fillPercentage: TEMPLATES[key].fillPercentage,
      bestFor: TEMPLATES[key].bestFor,
      characteristics: TEMPLATES[key].characteristics,
      usage: TEMPLATES[key].usage
    }));

    res.json({
      success: true,
      templates: {
        user: userTemplates,
        defaults: defaultTemplates
      }
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to list templates');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates'
    });
  }
});

/**
 * GET /api/templates/:id
 * Get specific template (user template or default)
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Check if it's a default template
    if (id.startsWith('default_')) {
      const templateKey = id.replace('default_', '');
      const template = TEMPLATES[templateKey];

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Default template not found'
        });
      }

      return res.json({
        success: true,
        template: {
          id,
          name: template.name,
          latex: template.latexTemplate,
          isSystemDefault: true,
          fillPercentage: template.fillPercentage,
          bestFor: template.bestFor,
          characteristics: template.characteristics,
          usage: template.usage
        }
      });
    }

    // Get user's custom template
    const template = await prisma.resumeTemplate.findFirst({
      where: { id, userId }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error({ error: error.message, templateId: req.params.id }, 'Failed to get template');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve template'
    });
  }
});

/**
 * POST /api/templates
 * Save new template
 * Body: { name: string, latex: string, isDefault?: boolean }
 */
router.post('/templates', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { name, latex, isDefault } = req.body;

    if (!name || !latex) {
      return res.status(400).json({
        success: false,
        error: 'Name and latex are required'
      });
    }

    // Validate LaTeX structure
    const validation = await validateLatex(latex);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid LaTeX: ${validation.error}`
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.resumeTemplate.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const template = await prisma.resumeTemplate.create({
      data: {
        userId,
        name,
        latex,
        isDefault: isDefault || false
      }
    });

    logger.info({ userId, templateId: template.id, name }, 'Template created');

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to create template');
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
});

/**
 * PUT /api/templates/:id
 * Update template
 * Body: { name?: string, latex?: string, isDefault?: boolean }
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Cannot update default templates
    if (id.startsWith('default_')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update default templates. Create a copy instead.'
      });
    }

    // Verify ownership
    const existing = await prisma.resumeTemplate.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const { name, latex, isDefault } = req.body;
    const updateData = {};

    if (name) updateData.name = name;

    if (latex) {
      // Validate LaTeX structure
      const validation = await validateLatex(latex);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: `Invalid LaTeX: ${validation.error}`
        });
      }
      updateData.latex = latex;
    }

    if (typeof isDefault === 'boolean') {
      if (isDefault) {
        // Unset other defaults
        await prisma.resumeTemplate.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false }
        });
      }
      updateData.isDefault = isDefault;
    }

    const template = await prisma.resumeTemplate.update({
      where: { id },
      data: updateData
    });

    logger.info({ userId, templateId: id }, 'Template updated');

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error({ error: error.message, templateId: req.params.id }, 'Failed to update template');
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete template
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Cannot delete default templates
    if (id.startsWith('default_')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default templates'
      });
    }

    // Verify ownership
    const existing = await prisma.resumeTemplate.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    await prisma.resumeTemplate.delete({
      where: { id }
    });

    logger.info({ userId, templateId: id }, 'Template deleted');

    res.json({
      success: true,
      message: 'Template deleted'
    });

  } catch (error) {
    logger.error({ error: error.message, templateId: req.params.id }, 'Failed to delete template');
    res.status(500).json({
      success: false,
      error: 'Failed to delete template'
    });
  }
});

/**
 * POST /api/templates/preview
 * Generate preview PDF from LaTeX
 * Body: { latex: string }
 */
router.post('/templates/preview', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { latex } = req.body;

    if (!latex) {
      return res.status(400).json({
        success: false,
        error: 'LaTeX content is required'
      });
    }

    // Fill template placeholders with sample data for preview
    const filledLatex = fillTemplateForPreview(latex);

    // Validate the filled template
    try {
      validateLatex(filledLatex);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: `Invalid LaTeX: ${validationError.message}`
      });
    }

    // Compile to PDF
    const pdfBuffer = await compileLatex(filledLatex);

    // Return as base64 for easy frontend consumption
    const pdfBase64 = pdfBuffer.toString('base64');

    res.json({
      success: true,
      pdf: pdfBase64,
      mimeType: 'application/pdf'
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to generate template preview');
    res.status(500).json({
      success: false,
      error: 'Failed to compile PDF: ' + error.message
    });
  }
});

/**
 * POST /api/templates/copy
 * Copy a default template to user's templates
 * Body: { sourceId: string, name: string }
 */
router.post('/templates/copy', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { sourceId, name } = req.body;

    if (!sourceId || !name) {
      return res.status(400).json({
        success: false,
        error: 'sourceId and name are required'
      });
    }

    let latex;

    // Check if source is a default template
    if (sourceId.startsWith('default_')) {
      const templateKey = sourceId.replace('default_', '');
      const template = TEMPLATES[templateKey];

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Source template not found'
        });
      }

      latex = template.latexTemplate;
    } else {
      // Copy from existing user template
      const source = await prisma.resumeTemplate.findFirst({
        where: { id: sourceId, userId }
      });

      if (!source) {
        return res.status(404).json({
          success: false,
          error: 'Source template not found'
        });
      }

      latex = source.latex;
    }

    // Create the copy
    const template = await prisma.resumeTemplate.create({
      data: {
        userId,
        name,
        latex,
        isDefault: false
      }
    });

    logger.info({ userId, templateId: template.id, sourceId, name }, 'Template copied');

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to copy template');
    res.status(500).json({
      success: false,
      error: 'Failed to copy template'
    });
  }
});

/**
 * POST /api/templates/chat
 * AI modifies template based on user message
 * Body: { templateId: string, message: string, currentLatex?: string }
 *
 * Note: The actual AI logic will be implemented in template-chat.js
 * For now, this is a placeholder that will be connected to the AI service
 */
router.post('/templates/chat', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { templateId, message, currentLatex } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get the current latex if not provided
    let latex = currentLatex;

    if (!latex && templateId) {
      if (templateId.startsWith('default_')) {
        const templateKey = templateId.replace('default_', '');
        const template = TEMPLATES[templateKey];
        if (template) {
          latex = template.latexTemplate;
        }
      } else {
        const template = await prisma.resumeTemplate.findFirst({
          where: { id: templateId, userId }
        });
        if (template) {
          latex = template.latex;
        }
      }
    }

    if (!latex) {
      return res.status(400).json({
        success: false,
        error: 'Template not found or currentLatex not provided'
      });
    }

    // Import and use template chat AI
    // This will be implemented in the next phase
    const { modifyTemplateWithAI } = await import('../lib/template-chat.js');

    const result = await modifyTemplateWithAI({
      currentLatex: latex,
      userMessage: message,
      userId
    });

    res.json({
      success: true,
      latex: result.latex,
      explanation: result.explanation,
      changes: result.changes
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to process template chat');
    res.status(500).json({
      success: false,
      error: 'Failed to modify template: ' + error.message
    });
  }
});

/**
 * Preview cache for default templates
 * Stores pre-compiled PDF base64 data
 */
const previewCache = new Map();

/**
 * POST /api/templates/warm-cache
 * Pre-generate previews for all default templates (call on server startup)
 */
router.post('/templates/warm-cache', async (req, res) => {
  try {
    const results = [];

    for (const [key, template] of Object.entries(TEMPLATES)) {
      const id = `default_${key}`;

      if (previewCache.has(id)) {
        results.push({ id, status: 'already cached' });
        continue;
      }

      try {
        const filledLatex = fillTemplateForPreview(template.latexTemplate);
        const pdfBuffer = await compileLatex(filledLatex);
        const pdfBase64 = pdfBuffer.toString('base64');
        previewCache.set(id, pdfBase64);
        results.push({ id, status: 'cached' });
        logger.info(`Warmed cache for ${id}`);
      } catch (err) {
        results.push({ id, status: 'failed', error: err.message });
        logger.error({ error: err.message, templateId: id }, 'Failed to warm cache');
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/templates/default
 * Get user's default template (or first available)
 */
router.get('/templates/default', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // First try to get user's marked default
    let template = await prisma.resumeTemplate.findFirst({
      where: { userId, isDefault: true }
    });

    // If no default set, get the most recently updated template
    if (!template) {
      template = await prisma.resumeTemplate.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });
    }

    // If no user templates, return the modern_dense default
    if (!template) {
      const defaultTemplate = TEMPLATES.modern_dense;
      return res.json({
        success: true,
        template: {
          id: 'default_modern_dense',
          name: defaultTemplate.name,
          latex: defaultTemplate.latexTemplate,
          isSystemDefault: true
        }
      });
    }

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error({ error: error.message, userId: req.userId }, 'Failed to get default template');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve default template'
    });
  }
});

export default router;
