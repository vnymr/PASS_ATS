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
 * Extract job information from description using LLM
 * @param {string} jobDescription - Job description text
 * @returns {Promise<{company: string, role: string, location: string|null}>}
 */
async function extractJobInfo(jobDescription) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `Extract the following information from this job posting. Return ONLY valid JSON with no markdown formatting:

{
  "company": "company name",
  "role": "job title/position",
  "location": "location if mentioned"
}

Job posting:
${jobDescription.substring(0, 3000)}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    const parsed = JSON.parse(content);

    return {
      company: parsed.company || 'Unknown Company',
      role: parsed.role || 'Position',
      location: parsed.location || null
    };
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to extract job info with LLM, using fallback');

    // Fallback: basic extraction
    const lines = jobDescription.split('\n').slice(0, 10);
    let company = 'Unknown Company';
    let role = 'Position';

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!role || role === 'Position') {
        const roleMatch = cleanLine.match(/^(.+?)\s*(?:Developer|Engineer|Manager|Designer|Analyst|Architect|Lead|Senior|Junior)/i);
        if (roleMatch) role = roleMatch[0].trim();
      }
      if (company === 'Unknown Company') {
        const companyMatch = cleanLine.match(/^(?:Company|At)\s+(.+?)(?:\s|,|\.)/i);
        if (companyMatch) company = companyMatch[1].trim();
      }
    }

    return { company, role, location: null };
  }
}

/**
 * Extract ATS keywords from job description using LLM
 * @param {string} jobDescription - Job description text
 * @returns {Promise<{criticalKeywords: string[], importantKeywords: string[], technicalTerms: string[]}>}
 */
async function extractKeywordsFromJD(jobDescription) {
  const prompt = `Extract ATS keywords from this job description. Return ONLY a JSON object with the most important keywords (skills, tools, certifications, frameworks, product names).

EXTRACTION RULES:
1. Extract exact phrases as they appear (case-sensitive)
2. Include product names, tools, frameworks, certifications exactly as written
3. Include multi-word terms (e.g., "Microsoft Purview", "Zero Trust", "Data Loss Prevention")
4. Separate critical (must-have) vs important (nice-to-have) vs technical terms

Job Description:
${jobDescription}

Return format (valid JSON):
{
  "criticalKeywords": ["keyword1", "keyword2"],
  "importantKeywords": ["keyword3", "keyword4"],
  "technicalTerms": ["term1", "term2"]
}`;

  // Try Gemini first
  const { generateSimpleJsonWithGemini, isGeminiAvailable } = await import('./gemini-client.js');

  if (isGeminiAvailable()) {
    try {
      logger.info('Using Gemini 2.5 Flash for keyword extraction');
      const result = await generateSimpleJsonWithGemini(prompt);
      const parsed = JSON.parse(result);

      return {
        criticalKeywords: parsed.criticalKeywords || [],
        importantKeywords: parsed.importantKeywords || [],
        technicalTerms: parsed.technicalTerms || []
      };
    } catch (error) {
      logger.warn({ error: error.message }, 'Gemini keyword extraction failed, falling back to OpenAI');
    }
  }

  // Fallback to OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    logger.info('Using OpenAI gpt-4o-mini for keyword extraction');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 500
    });

    const content = response.choices[0].message.content.trim();
    const parsed = JSON.parse(content);

    return {
      criticalKeywords: parsed.criticalKeywords || [],
      importantKeywords: parsed.importantKeywords || [],
      technicalTerms: parsed.technicalTerms || []
    };
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to extract keywords, using empty arrays');
    return {
      criticalKeywords: [],
      importantKeywords: [],
      technicalTerms: []
    };
  }
}

/**
 * Analyze keyword coverage in generated LaTeX
 * @param {string} latexContent - Generated LaTeX content
 * @param {Object} keywords - Extracted keywords object
 * @returns {Object} Coverage statistics
 */
function analyzeKeywordCoverage(latexContent, keywords) {
  const stats = {
    criticalMatched: 0,
    criticalTotal: keywords.criticalKeywords.length,
    importantMatched: 0,
    importantTotal: keywords.importantKeywords.length,
    technicalMatched: 0,
    technicalTotal: keywords.technicalTerms.length,
    missedCritical: [],
    missedImportant: []
  };

  // Check critical keywords
  keywords.criticalKeywords.forEach(kw => {
    if (latexContent.includes(kw)) {
      stats.criticalMatched++;
    } else {
      stats.missedCritical.push(kw);
    }
  });

  // Check important keywords
  keywords.importantKeywords.forEach(kw => {
    if (latexContent.includes(kw)) {
      stats.importantMatched++;
    } else {
      stats.missedImportant.push(kw);
    }
  });

  // Check technical terms
  keywords.technicalTerms.forEach(kw => {
    if (latexContent.includes(kw)) {
      stats.technicalMatched++;
    }
  });

  // Calculate overall coverage percentage
  const totalMatched = stats.criticalMatched + stats.importantMatched + stats.technicalMatched;
  const totalKeywords = stats.criticalTotal + stats.importantTotal + stats.technicalTotal;
  stats.coveragePercent = totalKeywords > 0 ? Math.round((totalMatched / totalKeywords) * 100) : 0;

  // Calculate critical coverage (most important metric)
  stats.criticalCoveragePercent = stats.criticalTotal > 0
    ? Math.round((stats.criticalMatched / stats.criticalTotal) * 100)
    : 100;

  return stats;
}

/**
 * Generate clean, short resume filename
 * Format: FirstName_Company_Role.pdf
 * Max length: 50 characters total
 * @param {string} userName - User's full name
 * @param {string} company - Company name
 * @param {string} role - Job role/title
 * @returns {string} Clean filename like "Vinay_Microsoft_CloudArchitect.pdf"
 */
function generateResumeFilename(userName, company, role) {
  // Extract first name only (if userName is "Vinay Muthareddy" → "Vinay")
  const firstName = (userName || 'Resume')
    .split(' ')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 15);

  // Clean company name - keep it SHORT
  const cleanCompany = (company || 'Company')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20);

  // Clean role - keep it SHORT
  const cleanRole = (role || 'Role')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20);

  // Format: FirstName_Company_Role.pdf
  // Example: Vinay_Microsoft_CloudArchitect.pdf
  return `${firstName}_${cleanCompany}_${cleanRole}.pdf`;
}

/**
 * Process a single resume generation job
 *
 * This function contains the entire resume generation pipeline:
 * 1. Update job status to PROCESSING
 * 2. Extract job info (company, role) from description
 * 3. Check LaTeX cache
 * 4. Generate LaTeX with AI (Gemini or OpenAI)
 * 5. Compile LaTeX to PDF with error recovery
 * 6. Save artifacts (PDF + LaTeX) with clean filenames
 * 7. Update job status to COMPLETED or FAILED
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

    if (onProgress) onProgress(5); // 5% - Job started

    // Extract job info (company, role) from description
    logger.info({ jobId }, 'Extracting job information from description');
    const jobInfo = await extractJobInfo(jobDescription);
    logger.info({ jobId, company: jobInfo.company, role: jobInfo.role }, 'Job info extracted');

    // Extract ATS keywords from job description
    logger.info({ jobId }, 'Extracting ATS keywords from job description');
    const keywords = await extractKeywordsFromJD(jobDescription);
    logger.info({
      jobId,
      criticalCount: keywords.criticalKeywords.length,
      importantCount: keywords.importantKeywords.length,
      technicalCount: keywords.technicalTerms.length,
      criticalKeywords: keywords.criticalKeywords.slice(0, 5) // Log first 5 for debugging
    }, 'ATS keywords extracted');

    // Update the job record with extracted info
    await prisma.job.update({
      where: { id: jobId },
      data: {
        company: jobInfo.company,
        role: jobInfo.role
        // Note: location not stored in Job table, only extracted for potential future use
      }
    });

    if (onProgress) onProgress(10); // 10% - Job info extracted

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
      latexCode = await generateLatexWithLLM(openai, userDataForLLM, jobDescription, keywords, onProgress);
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

    // Validate and auto-fix LaTeX before compilation
    latexCode = validateAndFixLatex(latexCode, jobId);

    // Analyze ATS keyword coverage in generated LaTeX
    const keywordStats = analyzeKeywordCoverage(latexCode, keywords);
    logger.info({
      jobId,
      coveragePercent: keywordStats.coveragePercent,
      criticalCoveragePercent: keywordStats.criticalCoveragePercent,
      criticalMatched: `${keywordStats.criticalMatched}/${keywordStats.criticalTotal}`,
      importantMatched: `${keywordStats.importantMatched}/${keywordStats.importantTotal}`,
      missedCritical: keywordStats.missedCritical
    }, 'ATS keyword coverage analysis');

    // Warn if keyword coverage is low
    if (keywordStats.coveragePercent < 70) {
      logger.warn({
        jobId,
        coverage: keywordStats.coveragePercent,
        missedCritical: keywordStats.missedCritical.slice(0, 5),
        message: 'LOW ATS SCORE - Keywords not integrated properly'
      }, 'Poor keyword coverage detected');
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

    // Save artifacts with clean filename
    const t4 = Date.now();
    logger.debug({ jobId }, 'Saving artifacts to database');

    // Get the job to retrieve company and role for filename
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { company: true, role: true }
    });

    // Extract user name from profile data
    const userName = profileData?.name ||
                     profileData?.personalInfo?.name ||
                     profileData?.personalInfo?.fullName ||
                     'Resume';

    const filename = generateResumeFilename(
      userName,
      job?.company || 'Company',
      job?.role || 'Role'
    );

    await prisma.artifact.create({
      data: {
        jobId,
        type: 'PDF_OUTPUT',
        content: pdfBuffer,
        metadata: {
          attempts: attempt,
          model: 'gpt-4o-mini',
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2),
          filename: filename
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
          timings: timings,
          atsOptimization: {
            keywordCoverage: keywordStats.coveragePercent,
            criticalCoverage: keywordStats.criticalCoveragePercent,
            criticalMatched: keywordStats.criticalMatched,
            criticalTotal: keywordStats.criticalTotal,
            importantMatched: keywordStats.importantMatched,
            importantTotal: keywordStats.importantTotal,
            missedCritical: keywordStats.missedCritical,
            extractedKeywords: {
              critical: keywords.criticalKeywords,
              important: keywords.importantKeywords,
              technical: keywords.technicalTerms
            }
          }
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
 * Validate and auto-fix common LaTeX errors before compilation
 * @param {string} latex - Generated LaTeX code
 * @param {string} jobId - Job ID for logging
 * @returns {string} Fixed LaTeX code
 */
function validateAndFixLatex(latex, jobId) {
  logger.debug({ jobId }, 'Validating LaTeX before compilation');

  let fixed = latex;
  let issues = [];

  // Fix 1: Remove stray & characters outside tables
  const lines = fixed.split('\n');
  let inTable = false;
  const fixedLines = lines.map((line, i) => {
    if (line.includes('\\begin{tabular}')) inTable = true;
    if (line.includes('\\end{tabular}')) inTable = false;

    if (!inTable && line.includes('&') && !line.includes('\\&')) {
      issues.push(`Line ${i+1}: Removed stray & character`);
      return line.replace(/&/g, ',');
    }
    return line;
  });
  fixed = fixedLines.join('\n');

  // Fix 2: Check balanced braces
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    issues.push(`Unbalanced braces: ${openBraces} open vs ${closeBraces} close`);
  }

  // Fix 3: Ensure \end{document}
  if (!fixed.includes('\\end{document}')) {
    issues.push('Added missing \\end{document}');
    fixed += '\n\\end{document}\n';
  }

  // Fix 4: Remove any ** markdown that snuck in
  if (fixed.includes('**')) {
    issues.push('Removed markdown ** syntax');
    fixed = fixed.replace(/\*\*/g, '');
  }

  if (issues.length > 0) {
    logger.info({ jobId, issues }, 'Auto-fixed LaTeX issues');
  }

  return fixed;
}

/**
 * Generate LaTeX using gpt-4o-mini (fastest model)
 * Uses prompts from fast-prompt-builder.js
 */
async function generateLatexWithLLM(openai, userDataJSON, jobDescription, keywords = null, onProgress = null) {
  // Import prompt builders and Gemini client
  const { buildFastSystemPrompt, buildFastUserPrompt } = await import('./fast-prompt-builder.js');
  const { generateLatexWithGemini, isGeminiAvailable } = await import('./gemini-client.js');

  // Use fast prompts for speed
  const systemPrompt = buildFastSystemPrompt();
  const userPrompt = buildFastUserPrompt(userDataJSON, jobDescription, keywords);

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
  const { compileLatex: compileLatexFn } = await import('./latex-compiler.js');
  return await compileLatexFn(latexCode);
}
