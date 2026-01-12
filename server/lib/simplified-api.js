/**
 * Simplified API endpoints using the AI Resume Generator
 * HTML-based PDF generation - NO LATEX
 */

import logger from './logger.js';
import AIResumeGenerator from './ai-resume-generator.js';

/**
 * Main generation endpoint
 */
async function generateResumeEndpoint(req, res) {
  try {
    const { jobDescription, userData, outputFormat = 'pdf', templateId } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    // Get user data from profile if not provided
    let resumeData = userData;
    if (!userData && req.user) {
      const { prisma } = await import('./prisma-client.js');
      const profile = await prisma.profile.findUnique({
        where: { userId: req.user.id }
      });

      if (!profile?.data) {
        return res.status(400).json({ error: 'No profile data found' });
      }

      resumeData = profile.data;
    }

    if (!resumeData) {
      return res.status(400).json({ error: 'User data is required' });
    }

    // Initialize generator (uses Gemini API)
    const generator = new AIResumeGenerator(process.env.GEMINI_API_KEY);

    // Generate resume
    const options = {
      templateId: templateId || 'modern_dense',
      enableSearch: true
    };

    if (outputFormat === 'html') {
      const { html, metadata } = await generator.generateResume(resumeData, jobDescription, options);
      res.json({ success: true, html, metadata });
    } else if (outputFormat === 'pdf') {
      const { html, pdf } = await generator.generateAndCompile(resumeData, jobDescription, options);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.send(pdf);
    } else {
      const { html, pdf } = await generator.generateAndCompile(resumeData, jobDescription, options);
      res.json({
        success: true,
        html,
        pdf: pdf.toString('base64'),
        metadata: { generatedAt: new Date().toISOString() }
      });
    }
  } catch (error) {
    logger.error('Resume generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Check system status (replaces compiler check)
 */
async function checkCompilersEndpoint(req, res) {
  try {
    // Since we use Playwright for PDF generation, no external compiler needed
    res.json({
      success: true,
      compilers: ['playwright'],
      recommended: 'playwright',
      message: 'Using HTML/CSS to PDF generation (no LaTeX required)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export {
  generateResumeEndpoint,
  checkCompilersEndpoint
};
