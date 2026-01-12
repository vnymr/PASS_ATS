/**
 * Resume Generation Job Processor
 *
 * Uses simple basic LaTeX generation:
 * 1. AI generates clean LaTeX using basic commands only
 * 2. No custom macros or templates - just article, geometry, enumitem, hyperref
 * 3. Compiles to PDF with tectonic
 *
 * CONCURRENCY SAFETY:
 * BullMQ provides built-in distributed locking via Redis to prevent duplicate processing.
 */

import AIResumeGenerator from './ai-resume-generator.js';
import { prisma } from './prisma-client.js';
import logger, { jobLogger } from './logger.js';
import { extractCompanyName, extractJobTitle } from './resume-prompts.js';

/**
 * Process a single resume generation job
 *
 * Simplified pipeline using AIResumeGenerator:
 * 1. Update job status to PROCESSING
 * 2. Generate resume using AIResumeGenerator (Gemini + Spotlight Strategy)
 * 3. Save artifacts (PDF + LaTeX)
 * 4. Update job status to COMPLETED or FAILED
 *
 * @param {Object} jobData - Job data from queue
 * @param {string} jobData.jobId - Database job ID
 * @param {Object} jobData.profileData - User profile data
 * @param {string} jobData.jobDescription - Target job description
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<void>}
 */
export async function processResumeJob(jobData, onProgress = null) {
  const { jobId, profileData, jobDescription, userId, templateId, customization } = jobData;
  const startTime = Date.now();

  try {
    // Step 1: Update job status to PROCESSING
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    if (onProgress) onProgress(5);
    logger.info({ jobId }, '🚀 Starting template-based resume generation');

    // Extract company and role for job record
    const company = extractCompanyName(jobDescription) || 'Unknown Company';
    const role = extractJobTitle(jobDescription) || 'Position';

    await prisma.job.update({
      where: { id: jobId },
      data: { company, role }
    });

    if (onProgress) onProgress(15);

    // Step 3: Generate resume using AI + HTML templates
    const generator = new AIResumeGenerator();

    if (onProgress) onProgress(20);

    // Use provided template or default to jakes_resume
    const effectiveTemplateId = templateId || 'jakes_resume';
    logger.info({ jobId, templateId: effectiveTemplateId }, '📝 Using template for resume generation');

    const { latex, pdf, metadata } = await generator.generateAndCompile(
      profileData,
      jobDescription,
      {
        enableSearch: true,
        templateId: effectiveTemplateId,
        customization: customization || null
      }
    );

    if (onProgress) onProgress(80);
    logger.info({
      jobId,
      generationTime: metadata.generationTime,
      model: metadata.model,
      usedCompanyResearch: metadata.usedCompanyResearch
    }, '✅ Resume generated');

    // Step 3: Save artifacts
    const userName = profileData?.name ||
                     profileData?.personalInfo?.name ||
                     'Resume';

    const filename = generateFilename(userName, company, role);

    await prisma.artifact.create({
      data: {
        jobId,
        type: 'PDF_OUTPUT',
        content: pdf,
        metadata: {
          model: metadata.model,
          pdfSizeKB: (pdf.length / 1024).toFixed(2),
          filename,
          approach: metadata.approach
        }
      }
    });

    await prisma.artifact.create({
      data: {
        jobId,
        type: 'LATEX_SOURCE',
        content: Buffer.from(latex, 'utf-8'),
        metadata: { latexSizeChars: latex.length }
      }
    });

    if (onProgress) onProgress(95);

    // Step 4: Mark job as completed
    const totalTime = Date.now() - startTime;

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        diagnostics: {
          completedAt: new Date().toISOString(),
          model: metadata.model,
          approach: metadata.approach,
          totalTimeMs: totalTime,
          totalTimeSeconds: (totalTime / 1000).toFixed(2),
          pdfSizeKB: (pdf.length / 1024).toFixed(2),
          usedCompanyResearch: metadata.usedCompanyResearch,
          success: true
        }
      }
    });

    if (onProgress) onProgress(100);

    jobLogger.complete(jobId, {
      totalTimeMs: totalTime,
      pdfSizeKB: (pdf.length / 1024).toFixed(2),
      model: metadata.model
    });

    logger.info({
      jobId,
      totalTimeMs: totalTime,
      pdfSizeKB: (pdf.length / 1024).toFixed(2)
    }, `✅ Job completed in ${(totalTime / 1000).toFixed(2)}s`);

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error({
      jobId,
      error: error.message,
      totalTimeMs: totalTime
    }, '❌ Job processing failed');

    jobLogger.failed(jobId, error);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date(),
        diagnostics: {
          failedAt: new Date().toISOString(),
          error: error.message,
          totalTimeMs: totalTime,
          success: false
        }
      }
    });

    throw error; // Re-throw for BullMQ retry handling
  }
}

/**
 * Generate clean filename for resume
 */
function generateFilename(userName, company, role) {
  const firstName = (userName || 'Resume')
    .split(' ')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 15);

  const cleanCompany = (company || 'Company')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20);

  const cleanRole = (role || 'Role')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20);

  return `${firstName}_${cleanCompany}_${cleanRole}.pdf`;
}

export default { processResumeJob };
