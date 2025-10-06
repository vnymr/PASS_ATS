/**
 * Resume Generation Job Processor
 *
 * Handles the core logic of processing resume generation jobs.
 * Extracted from server.js processJobAsyncSimplified() for use in worker process.
 *
 * CONCURRENCY SAFETY:
 * BullMQ provides built-in distributed locking via Redis to prevent duplicate processing.
 * Each job is locked when picked up by a worker, ensuring only one worker processes it.
 * Lock is automatically released on completion, failure, or worker crash.
 */

import OpenAI from 'openai';
import logger, { jobLogger, compileLogger, aiLogger } from './logger.js';
import { prisma } from './prisma-client.js';

/**
 * Process a single resume generation job
 *
 * This function contains the entire resume generation pipeline:
 * 1. Update job status to PROCESSING
 * 2. Check LaTeX cache
 * 3. Generate LaTeX with AI (Gemini or OpenAI)
 * 4. Compile LaTeX to PDF with error recovery
 * 5. Save artifacts (PDF + LaTeX)
 * 6. Update job status to COMPLETED or FAILED
 *
 * @param {Object} jobData - Job data from queue
 * @param {string} jobData.jobId - Database job ID
 * @param {Object} jobData.profileData - User profile data
 * @param {string} jobData.jobDescription - Target job description
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<void>}
 */
export async function processResumeJob(jobData, onProgress = null) {
  const { jobId, profileData, jobDescription } = jobData;

  const MAX_RETRIES = 3;
  let attempt = 0;
  const startTime = Date.now();

  // Detailed timing object
  const timings = {
    statusUpdate: 0,
    dataPreparation: 0,
    cacheCheck: 0,
    latexGeneration: 0,
    latexFixes: 0,
    compilation: 0,
    artifactSaving: 0,
    jobUpdate: 0
  };

  try {
    // Update job status to PROCESSING
    const t1 = Date.now();
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });
    timings.statusUpdate = Date.now() - t1;

    if (onProgress) onProgress(10); // 10% - Job started

    // Prepare data for LLM - pass everything as structured JSON
    const t2 = Date.now();
    const userDataForLLM = JSON.stringify(profileData, null, 2);
    timings.dataPreparation = Date.now() - t2;

    logger.debug({
      jobId,
      profileDataSize: userDataForLLM.length,
      jobDescriptionSize: jobDescription.length,
      hasName: !!profileData.name,
      experienceCount: (profileData.experience || []).length,
      skillsCount: (profileData.skills || []).length
    }, 'Preparing LLM request');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Check cache first
    const t3 = Date.now();
    const { latexCache } = await import('./latex-cache.js');
    let latexCode = latexCache.get(jobDescription, profileData);
    timings.cacheCheck = Date.now() - t3;

    if (latexCode) {
      logger.info({ jobId, cached: true }, 'Using cached LaTeX');
      if (onProgress) onProgress(40); // 40% - Cache hit
    } else {
      // Initial generation
      if (onProgress) onProgress(20); // 20% - Starting generation

      aiLogger.request('gpt-5-mini', 'resume_generation');
      const genStart = Date.now();
      latexCode = await generateLatexWithLLM(openai, userDataForLLM, jobDescription, onProgress);
      timings.latexGeneration = Date.now() - genStart;
      logger.info({ jobId, genTimeMs: timings.latexGeneration, latexSize: latexCode.length }, 'LaTeX generation completed');

      // Cache the result
      latexCache.set(jobDescription, profileData, latexCode);

      if (onProgress) onProgress(40); // 40% - Generation complete
    }

    // Verify the LaTeX contains the user's actual name (if provided)
    if (profileData.name && profileData.name !== 'Candidate' && profileData.name.trim()) {
      if (!latexCode.includes(profileData.name)) {
        logger.warn({ jobId, expectedName: profileData.name }, 'User name not found in generated LaTeX');
      }
    }

    // Try to compile with error feedback loop
    let pdfBuffer = null;
    let totalCompileTime = 0;
    let totalFixTime = 0;

    while (attempt < MAX_RETRIES && !pdfBuffer) {
      attempt++;
      compileLogger.start(jobId, attempt);

      const progressBase = 40 + (attempt - 1) * 20;
      if (onProgress) onProgress(progressBase + 5); // Compiling

      const compileStart = Date.now();
      try {
        pdfBuffer = await compileLatex(latexCode);
        const compileTime = Date.now() - compileStart;
        totalCompileTime += compileTime;

        compileLogger.success(jobId, {
          attempt,
          compileTimeMs: compileTime,
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2)
        });

        if (onProgress) onProgress(80); // 80% - Compilation successful
      } catch (compileError) {
        const compileTime = Date.now() - compileStart;
        totalCompileTime += compileTime;
        compileLogger.failed(jobId, compileError.message, attempt);

        // Check if this is a LaTeX error (fixable) or a code/system error (not fixable)
        const isLatexError = compileError.message.includes('LaTeX') ||
                            compileError.message.includes('Undefined control sequence') ||
                            compileError.message.includes('Missing') ||
                            compileError.message.includes('!') ||
                            compileError.message.includes('error:');

        const isSystemError = compileError.message.includes('not defined') ||
                             compileError.message.includes('ENOENT') ||
                             compileError.message.includes('command not found') ||
                             compileError.message.includes('Permission denied');

        if (isSystemError) {
          // System error - cannot be fixed by LLM, fail immediately
          throw new Error(`System error during compilation: ${compileError.message}`);
        }

        if (attempt < MAX_RETRIES && isLatexError) {
          compileLogger.retry(jobId, attempt + 1);
          const fixStart = Date.now();

          try {
            latexCode = await fixLatexWithLLM(openai, latexCode, compileError.message);
            const fixTime = Date.now() - fixStart;
            totalFixTime += fixTime;
            logger.info({ jobId, fixTimeMs: fixTime }, 'LLM returned fixed LaTeX');

            if (onProgress) onProgress(progressBase + 15); // Fix applied
          } catch (fixError) {
            logger.error({ jobId, error: fixError.message }, 'LLM fix attempt failed');
            throw new Error(`Failed to fix LaTeX: ${fixError.message}. Original error: ${compileError.message}`);
          }
        } else {
          throw new Error(`Failed to compile after ${MAX_RETRIES} attempts. Last error: ${compileError.message}`);
        }
      }
    }

    timings.compilation = totalCompileTime;
    timings.latexFixes = totalFixTime;

    if (onProgress) onProgress(85); // 85% - Saving artifacts

    // Save artifacts
    const t4 = Date.now();
    logger.debug({ jobId }, 'Saving artifacts to database');
    await prisma.artifact.create({
      data: {
        jobId,
        type: 'PDF_OUTPUT',
        content: pdfBuffer,
        metadata: {
          attempts: attempt,
          model: 'gpt-4o-mini',
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2)
        }
      }
    });

    await prisma.artifact.create({
      data: {
        jobId,
        type: 'LATEX_SOURCE',
        content: Buffer.from(latexCode, 'utf-8'),
        metadata: {
          attempts: attempt,
          latexSizeChars: latexCode.length
        }
      }
    });
    timings.artifactSaving = Date.now() - t4;

    if (onProgress) onProgress(95); // 95% - Updating job status

    // Mark job as completed
    const t5 = Date.now();
    const totalTime = Date.now() - startTime;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        diagnostics: {
          completedAt: new Date().toISOString(),
          attempts: attempt,
          model: 'gpt-4o-mini',
          totalTimeSeconds: (totalTime / 1000).toFixed(2),
          totalTimeMs: totalTime,
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2),
          success: true,
          timings: timings
        }
      }
    });
    timings.jobUpdate = Date.now() - t5;

    logger.info({
      jobId,
      totalTimeMs: totalTime,
      timings
    }, 'Job processing complete with detailed timings');

    jobLogger.complete(jobId, {
      totalTimeMs: totalTime,
      attempts: attempt,
      pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2)
    });

    if (onProgress) onProgress(100); // 100% - Complete

  } catch (error) {
    const totalTime = Date.now() - startTime;
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
          attempts: attempt,
          totalTimeSeconds: (totalTime / 1000).toFixed(2),
          totalTimeMs: totalTime,
          success: false,
          timings: timings
        }
      }
    });

    throw error; // Re-throw for BullMQ retry handling
  }
}

/**
 * Generate LaTeX using gpt-4o-mini (fastest model)
 * Uses prompts from fast-prompt-builder.js
 */
async function generateLatexWithLLM(openai, userDataJSON, jobDescription, onProgress = null) {
  // Import prompt builders and Gemini client
  const { buildFastSystemPrompt, buildFastUserPrompt } = await import('./fast-prompt-builder.js');
  const { generateLatexWithGemini, isGeminiAvailable } = await import('./gemini-client.js');

  // Use fast prompts for speed
  const systemPrompt = buildFastSystemPrompt();
  const userPrompt = buildFastUserPrompt(userDataJSON, jobDescription);

  // Try Gemini first if available (33% faster, 37% cheaper)
  if (isGeminiAvailable()) {
    try {
      logger.info('Using Gemini 2.5 Flash for LaTeX generation');

      const result = await generateLatexWithGemini(systemPrompt, userPrompt, onProgress);

      // Log usage for monitoring
      if (result.usage) {
        aiLogger.response('gemini-2.5-flash', {
          prompt_tokens: result.usage.prompt_tokens,
          completion_tokens: result.usage.completion_tokens,
          total_tokens: result.usage.total_tokens,
          generation_time_ms: result.generationTime
        });
      }

      return result.latex;
    } catch (error) {
      logger.warn({ error: error.message }, 'Gemini generation failed, falling back to OpenAI');
      // Fall through to OpenAI
    }
  }

  // Fallback to OpenAI (gpt-5-mini)
  logger.info('Using OpenAI gpt-5-mini for LaTeX generation');

  // Use streaming if progress callback provided
  if (onProgress) {
    const stream = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      stream: true
    });

    let latex = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      latex += content;
      chunkCount++;

      // Report progress every 10 chunks (20-40%)
      if (chunkCount % 10 === 0 && onProgress) {
        onProgress({ type: 'generating', progress: Math.min(40, 20 + chunkCount * 0.5) });
      }
    }

    logger.info(`Streamed LaTeX (${latex.length} chars)`);

    // Clean markdown code blocks
    latex = latex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '').replace(/^```.*$/gm, '');
    return latex;
  }

  // Non-streaming fallback
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ]
  });

  // Log cache usage for monitoring
  if (response.usage) {
    const cached_tokens = response.usage.prompt_tokens_details?.cached_tokens || 0;
    aiLogger.response('gpt-5-mini', {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
      cached_tokens
    });
  }

  let latex = response.choices[0].message.content.trim();

  // Clean markdown code blocks if present
  latex = latex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '').replace(/^```.*$/gm, '');

  return latex;
}

/**
 * Fix LaTeX errors using LLM
 */
async function fixLatexWithLLM(openai, brokenLatex, errorMessage) {
  logger.debug({ error: errorMessage.substring(0, 200) }, 'Requesting LaTeX fix from LLM');

  // Try Gemini first if available
  const { fixLatexWithGemini, isGeminiAvailable } = await import('./gemini-client.js');

  if (isGeminiAvailable()) {
    try {
      logger.info('Using Gemini 2.5 Flash for LaTeX error fixing');
      const fixedLatex = await fixLatexWithGemini(brokenLatex, errorMessage);
      return fixedLatex;
    } catch (error) {
      logger.warn({ error: error.message }, 'Gemini fix failed, falling back to OpenAI');
      // Fall through to OpenAI
    }
  }

  // Fallback to OpenAI
  logger.info('Using OpenAI gpt-5-mini for LaTeX error fixing');
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content: `You are a LaTeX debugging expert. Fix the compilation error by escaping special characters.

CRITICAL: LaTeX has special characters that MUST be escaped in regular text:
  & → \\&  (VERY common mistake in "A & B", "R&D", "marketing & sales")
  % → \\%  (in percentages like "30%")
  $ → \\$  (in dollar amounts)
  # → \\#  (in numbers or tags)
  _ → \\_  (EXTREMELY common in emails, URLs, technical terms)
  { → \\{
  } → \\}
  ~ → \\textasciitilde{} or \\,\\,
  ^ → \\textasciicircum{}

Return ONLY the fixed LaTeX code, no explanations.`
      },
      {
        role: 'user',
        content: `Fix this LaTeX code that caused the following error:

ERROR: ${errorMessage}

LATEX CODE:
${brokenLatex}`
      }
    ]
  });

  let fixedLatex = response.choices[0].message.content.trim();
  fixedLatex = fixedLatex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '').replace(/^```.*$/gm, '');

  return fixedLatex;
}

/**
 * Compile LaTeX to PDF using Tectonic
 */
async function compileLatex(latexCode) {
  const { compileToBuffer } = await import('./latex-compiler.js');
  return await compileToBuffer(latexCode);
}
