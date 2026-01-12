/**
 * Resume Template Management API
 * Endpoints for managing user resume templates
 * HTML-based - NO LATEX
 */

import express from 'express';
import { prisma } from '../lib/prisma-client.js';
import { TEMPLATES, getAllTemplates, generateHTML } from '../lib/html-templates.js';
import { generatePDFWithRetry, generatePreviewImage } from '../lib/html-pdf-generator.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * Sample data for template preview
 */
const SAMPLE_DATA = {
  name: 'John Smith',
  email: 'john.smith@email.com',
  phone: '(555) 123-4567',
  location: 'San Francisco, CA',
  linkedin: 'https://linkedin.com/in/johnsmith',
  github: 'https://github.com/johnsmith',
  summary: 'Results-driven software engineer with 5+ years of experience building scalable web applications. Expert in React, Node.js, and cloud infrastructure. Passionate about clean code and user experience.',
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Company Inc.',
      location: 'San Francisco, CA',
      startDate: 'Jan 2022',
      endDate: 'Present',
      highlights: [
        'Led development of microservices architecture serving 1M+ daily active users',
        'Reduced API response times by 40% through optimization and caching strategies',
        'Mentored 3 junior engineers and conducted 50+ technical interviews'
      ]
    },
    {
      title: 'Software Engineer',
      company: 'Startup Co.',
      location: 'New York, NY',
      startDate: 'Jun 2019',
      endDate: 'Dec 2021',
      highlights: [
        'Built real-time collaboration features using WebSocket and Redis',
        'Implemented CI/CD pipeline reducing deployment time by 60%'
      ]
    }
  ],
  education: [
    {
      institution: 'University of California, Berkeley',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      location: 'Berkeley, CA',
      endDate: '2019'
    }
  ],
  skills: [
    { category: 'Languages', items: ['JavaScript', 'TypeScript', 'Python', 'Go', 'SQL'] },
    { category: 'Frameworks', items: ['React', 'Node.js', 'Next.js', 'Express', 'FastAPI'] },
    { category: 'Tools', items: ['Git', 'Docker', 'Kubernetes', 'AWS', 'PostgreSQL', 'Redis'] }
  ],
  projects: [
    {
      name: 'Open Source Project',
      technologies: ['TypeScript', 'React', 'GraphQL'],
      highlights: [
        'Created developer tool with 500+ GitHub stars',
        'Published on npm with 10K+ weekly downloads'
      ]
    }
  ]
};

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
    let userTemplates = [];
    try {
      userTemplates = await prisma.resumeTemplate.findMany({
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
    } catch (dbError) {
      logger.warn({ error: dbError.message }, 'Could not fetch user templates');
    }

    // Get default templates
    const defaultTemplates = Object.keys(TEMPLATES).map(key => ({
      id: `default_${key}`,
      name: TEMPLATES[key].name,
      isDefault: false,
      isSystemDefault: true,
      description: TEMPLATES[key].description,
      bestFor: TEMPLATES[key].bestFor
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

      // Generate full HTML with sample data for preview
      const previewHtml = generateHTML(SAMPLE_DATA, templateKey);

      return res.json({
        success: true,
        template: {
          id,
          name: template.name,
          css: template.css,
          latex: previewHtml, // Full HTML for preview (using 'latex' field for backward compatibility)
          isSystemDefault: true,
          description: template.description,
          bestFor: template.bestFor
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
 * Body: { name: string, css?: string, isDefault?: boolean }
 */
router.post('/templates', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { name, css, html, isDefault } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
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
        // Store HTML/CSS in the 'latex' field for backward compatibility
        latex: css || html || '',
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

    const { name, css, html, isDefault } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (css || html) updateData.latex = css || html;

    if (typeof isDefault === 'boolean') {
      if (isDefault) {
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
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    if (id.startsWith('default_')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default templates'
      });
    }

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
 * Generate preview PDF from template
 * Body: { templateId: string } or { html: string }
 */
router.post('/templates/preview', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { templateId, html: customHtml } = req.body;

    let html;

    if (customHtml) {
      html = customHtml;
    } else if (templateId) {
      // Generate HTML using sample data
      const id = templateId.replace('default_', '');
      html = generateHTML(SAMPLE_DATA, id);
    } else {
      // Use default template
      html = generateHTML(SAMPLE_DATA, 'modern_dense');
    }

    // Generate PDF
    const pdfBuffer = await generatePDFWithRetry(html);

    // Return as base64
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
      error: 'Failed to generate preview: ' + error.message
    });
  }
});

/**
 * POST /api/templates/preview-image
 * Generate preview image (PNG) from template
 */
router.post('/templates/preview-image', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { templateId } = req.body;
    const id = (templateId || 'modern_dense').replace('default_', '');

    // Generate HTML using sample data
    const html = generateHTML(SAMPLE_DATA, id);

    // Generate preview image
    const imageBuffer = await generatePreviewImage(html);

    // Return as base64
    const imageBase64 = imageBuffer.toString('base64');

    res.json({
      success: true,
      image: imageBase64,
      mimeType: 'image/png'
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to generate preview image');
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview image: ' + error.message
    });
  }
});

/**
 * POST /api/templates/copy
 * Copy a default template to user's templates
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

    let css = '';

    if (sourceId.startsWith('default_')) {
      const templateKey = sourceId.replace('default_', '');
      const template = TEMPLATES[templateKey];

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Source template not found'
        });
      }

      css = template.css;
    } else {
      // Copy from user's template
      const sourceTemplate = await prisma.resumeTemplate.findFirst({
        where: { id: sourceId, userId }
      });

      if (!sourceTemplate) {
        return res.status(404).json({
          success: false,
          error: 'Source template not found'
        });
      }

      css = sourceTemplate.latex; // 'latex' field stores CSS now
    }

    const template = await prisma.resumeTemplate.create({
      data: {
        userId,
        name,
        latex: css,
        isDefault: false
      }
    });

    logger.info({ userId, templateId: template.id, sourceId }, 'Template copied');

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to copy template');
    res.status(500).json({
      success: false,
      error: 'Failed to copy template'
    });
  }
});

/**
 * GET /api/templates/default
 * Get user's default template or recommend one
 */
router.get('/templates/default', async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Check for user's default template
    const userDefault = await prisma.resumeTemplate.findFirst({
      where: { userId, isDefault: true }
    });

    if (userDefault) {
      return res.json({
        success: true,
        template: userDefault,
        source: 'user'
      });
    }

    // Return system default
    const defaultTemplate = TEMPLATES.modern_dense;

    res.json({
      success: true,
      template: {
        id: 'default_modern_dense',
        name: defaultTemplate.name,
        css: defaultTemplate.css,
        isSystemDefault: true
      },
      source: 'system'
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get default template');
    res.status(500).json({
      success: false,
      error: 'Failed to get default template'
    });
  }
});

/**
 * GET /api/templates/list
 * Simple list of all available templates
 */
router.get('/templates/list', async (req, res) => {
  try {
    const templates = getAllTemplates();
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list templates'
    });
  }
});

export default router;
