/**
 * Simplified API endpoints using the new AI Resume Generator
 */

import AIResumeGenerator from './ai-resume-generator.js';

/**
 * Main generation endpoint
 */
async function generateResumeEndpoint(req, res) {
  try {
    const {
      jobDescription,
      userData,
      style,
      outputFormat = 'pdf'
    } = req.body;

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

      if (!profile || !profile.data) {
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
      style: style || 'auto', // auto, technical, professional, creative
      model: process.env.AI_MODEL || 'gpt-4',
      preferences: req.body.preferences
    };

    if (outputFormat === 'latex') {
      // Return just LaTeX code
      const { latex, metadata } = await generator.generateResume(
        resumeData,
        jobDescription,
        options
      );

      res.json({
        success: true,
        latex,
        metadata
      });
    } else if (outputFormat === 'pdf') {
      // Generate and compile to PDF
      const { latex, pdf } = await generator.generateAndCompile(
        resumeData,
        jobDescription,
        options
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.send(pdf);
    } else {
      // Return both LaTeX and PDF
      const { latex, pdf } = await generator.generateAndCompile(
        resumeData,
        jobDescription,
        options
      );

      // Convert PDF buffer to base64 for JSON response
      const pdfBase64 = pdf.toString('base64');

      res.json({
        success: true,
        latex,
        pdf: pdfBase64,
        metadata: {
          generatedAt: new Date().toISOString(),
          style: options.style
        }
      });
    }
  } catch (error) {
    console.error('Resume generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Regenerate a specific section
 */
async function regenerateSectionEndpoint(req, res) {
  try {
    const {
      currentLatex,
      section,
      userData,
      jobDescription
    } = req.body;

    if (!currentLatex || !section) {
      return res.status(400).json({
        error: 'Current LaTeX and section name are required'
      });
    }

    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

    const newSection = await generator.regenerateSection(
      currentLatex,
      section,
      userData,
      jobDescription
    );

    res.json({
      success: true,
      section: newSection
    });
  } catch (error) {
    console.error('Section regeneration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
  regenerateSectionEndpoint,
  checkCompilersEndpoint
};