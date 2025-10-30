/**
 * Simplified API endpoints using the AI Resume Generator
 */

import logger from './logger.js';
import AIResumeGenerator from './ai-resume-generator.js';

/**
 * Main generation endpoint
 */
async function generateResumeEndpoint(req, res) {
  try {
    const { jobDescription, userData, outputFormat = 'pdf' } = req.body;

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

    // Initialize generator
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

    // Generate resume
    const options = {
      model: process.env.AI_MODEL || 'gpt-4'
    };

    if (outputFormat === 'latex') {
      const { latex, metadata } = await generator.generateResume(resumeData, jobDescription, options);
      res.json({ success: true, latex, metadata });
    } else if (outputFormat === 'pdf') {
      const { latex, pdf } = await generator.generateAndCompile(resumeData, jobDescription, options);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.send(pdf);
    } else {
      const { latex, pdf } = await generator.generateAndCompile(resumeData, jobDescription, options);
      res.json({
        success: true,
        latex,
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
 * Check available LaTeX compilers
 */
async function checkCompilersEndpoint(req, res) {
  try {
    const { getAvailableCompilers } = await import('./latex-compiler.js');
    const compilers = await getAvailableCompilers();

    res.json({
      success: true,
      compilers,
      recommended: compilers.includes('tectonic') ? 'tectonic' :
                   compilers.includes('pdflatex') ? 'pdflatex' :
                   compilers[0] || 'none'
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