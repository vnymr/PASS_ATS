/**
 * Direct Auto-Apply Processor
 * Processes job applications directly without Redis queue
 * Uses centralized browser-launcher for consistent browser management
 */

import { prisma } from './prisma-client.js';
import logger from './logger.js';
import AIFormFiller from './ai-form-filler.js';
import {
  launchStealthBrowser,
  createStealthContext,
  createStealthContextCamoufox,
  applyStealthToPage,
  proxyRotator,
  simulateHumanBrowsing
} from './browser-launcher.js';
import { processResumeJob } from './job-processor.js';
import {
  pollForVerification,
  hasActiveGmailConnection
} from './email-verification-checker.js';

// Use FAST MODE - fills forms in <10 seconds (no fake cursor movements, minimal delays)
const aiFormFiller = new AIFormFiller({ fastMode: true });

/**
 * Find or generate a tailored resume for the job
 * Strategy:
 * 1. Check for existing resume generated for this exact job
 * 2. Check for recent resume for same company (within 7 days)
 * 3. Generate new tailored resume if nothing relevant exists
 * 4. Fall back to uploaded resume or latest resume if generation fails
 */
async function getOrGenerateTailoredResume(userId, aggregatedJob, profileData) {
  const { id: jobId, company, title, description, requirements } = aggregatedJob;

  // Combine description and requirements for full job context
  const fullJobDescription = [description, requirements].filter(Boolean).join('\n\n');

  logger.info({
    userId,
    jobId,
    company,
    title
  }, '🔍 Finding or generating tailored resume');

  // Strategy 1: Check if we already generated a resume for this exact job
  const existingForJob = await prisma.job.findFirst({
    where: {
      userId,
      status: 'COMPLETED',
      metadata: {
        path: ['aggregatedJobId'],
        equals: jobId
      }
    },
    include: {
      artifacts: {
        where: { type: 'PDF_OUTPUT' },
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  if (existingForJob?.artifacts?.[0]) {
    logger.info({ jobId, resumeJobId: existingForJob.id }, '✅ Found existing resume for this exact job');
    return {
      pdfContent: existingForJob.artifacts[0].content,
      filename: existingForJob.artifacts[0].metadata?.filename || `resume_${userId}.pdf`,
      source: 'EXISTING_FOR_JOB'
    };
  }

  // Strategy 2: Check for recent resume for same company (reuse within 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentForCompany = await prisma.job.findFirst({
    where: {
      userId,
      status: 'COMPLETED',
      createdAt: { gte: sevenDaysAgo },
      metadata: {
        path: ['company'],
        string_contains: company
      }
    },
    include: {
      artifacts: {
        where: { type: 'PDF_OUTPUT' },
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  if (recentForCompany?.artifacts?.[0]) {
    logger.info({
      jobId,
      company,
      resumeJobId: recentForCompany.id
    }, '✅ Found recent resume for same company (within 7 days)');
    return {
      pdfContent: recentForCompany.artifacts[0].content,
      filename: recentForCompany.artifacts[0].metadata?.filename || `resume_${userId}.pdf`,
      source: 'RECENT_SAME_COMPANY'
    };
  }

  // Strategy 3: Generate new tailored resume for this job
  logger.info({ jobId, company, title }, '🔄 Generating new tailored resume for job');

  try {
    // Create a new resume generation job
    const newResumeJob = await prisma.job.create({
      data: {
        userId,
        status: 'PENDING',
        jobDescription: fullJobDescription,
        resumeText: '',
        aiMode: 'gpt-5-mini',
        metadata: {
          aggregatedJobId: jobId,
          company,
          title,
          autoApplyGenerated: true
        }
      }
    });

    // Process the resume generation (synchronously for auto-apply)
    await processResumeJob({
      jobId: newResumeJob.id,
      profileData,
      jobDescription: fullJobDescription
    });

    // Fetch the generated artifact
    const generatedArtifact = await prisma.artifact.findFirst({
      where: {
        jobId: newResumeJob.id,
        type: 'PDF_OUTPUT'
      },
      orderBy: { version: 'desc' }
    });

    if (generatedArtifact) {
      logger.info({
        jobId,
        newResumeJobId: newResumeJob.id
      }, '✅ Generated new tailored resume for job');
      return {
        pdfContent: generatedArtifact.content,
        filename: generatedArtifact.metadata?.filename || `resume_${userId}_${company.replace(/\s+/g, '_')}.pdf`,
        source: 'NEWLY_GENERATED'
      };
    }
  } catch (error) {
    logger.warn({
      error: error.message,
      jobId
    }, '⚠️ Resume generation failed, falling back to existing resume');
  }

  // Strategy 4: Fall back to uploaded resume
  const uploadedResume = profileData?.uploadedResume;
  if (uploadedResume?.content) {
    logger.info({ userId }, '📄 Falling back to uploaded resume');
    return {
      pdfContent: Buffer.from(uploadedResume.content, 'base64'),
      filename: uploadedResume.filename || `resume_${userId}.pdf`,
      source: 'UPLOADED_FALLBACK'
    };
  }

  // Strategy 5: Fall back to latest generated resume
  const latestResume = await prisma.job.findFirst({
    where: {
      userId,
      status: 'COMPLETED'
    },
    orderBy: { createdAt: 'desc' },
    include: {
      artifacts: {
        where: { type: 'PDF_OUTPUT' },
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  if (latestResume?.artifacts?.[0]) {
    logger.info({ userId, resumeJobId: latestResume.id }, '📄 Falling back to latest generated resume');
    return {
      pdfContent: latestResume.artifacts[0].content,
      filename: latestResume.artifacts[0].metadata?.filename || `resume_${userId}.pdf`,
      source: 'LATEST_FALLBACK'
    };
  }

  // No resume available
  return null;
}

/**
 * Process auto-apply directly without queue
 * @param {Object} params - Application parameters
 */
export async function processAutoApplyDirect({ applicationId, jobUrl, atsType, userId, user }) {
  let browser = null;
  let resumePath = null;

  logger.info({
    applicationId,
    jobUrl,
    atsType,
    userId
  }, 'Processing auto-apply directly (no queue)');

  try {
    // Update status to APPLYING
    await prisma.autoApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPLYING',
        startedAt: new Date()
      }
    });

    // Get user data if not provided
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true }
      });
    }

    if (!user || !user.profile) {
      throw new Error('User or profile not found');
    }

    // Check profile data
    const profileData = user.profile.data;
    const applicationData = profileData?.applicationData;

    const hasNewStructure = applicationData && applicationData.personalInfo;
    const hasOldStructure = profileData && (profileData.name || profileData.email || profileData.experiences);

    if (!hasNewStructure && !hasOldStructure) {
      throw new Error('User profile missing required data. Please complete profile setup.');
    }

    // Fetch the aggregated job to get job details for tailored resume generation
    const autoApplication = await prisma.autoApplication.findUnique({
      where: { id: applicationId },
      include: { job: true }
    });

    if (!autoApplication?.job) {
      throw new Error('Job details not found for this application');
    }

    const aggregatedJob = autoApplication.job;

    // Import fs modules early
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    // Extract job board domain for proxy selection
    const jobBoardDomain = new URL(jobUrl).hostname;

    // Generate consistent session seed for fingerprint consistency
    const sessionSeed = applicationId
      ? parseInt(applicationId.replace(/\D/g, '').slice(0, 8) || '12345', 10)
      : Math.floor(Math.random() * 1000000);

    const useCamoufox = process.env.USE_CAMOUFOX === 'true';

    // ============================================================
    // PARALLEL EXECUTION: Resume generation + Browser launch/navigate
    // This saves ~30 seconds by not waiting for resume before browser
    // ============================================================
    logger.info({
      applicationId,
      company: aggregatedJob.company,
      title: aggregatedJob.title
    }, '🚀 Starting parallel: resume generation + browser launch');

    // Task 1: Resume generation (can take 30s)
    const resumePromise = (async () => {
      logger.info('🔍 [PARALLEL] Getting tailored resume for job...');
      const result = await getOrGenerateTailoredResume(user.id, aggregatedJob, profileData);
      if (!result) {
        throw new Error('No resume found - please upload a resume or complete your profile to generate one');
      }
      logger.info({ source: result.source }, '✅ [PARALLEL] Resume ready');
      return result;
    })();

    // Task 2: Browser launch + navigate to job page (with proxy/Camoufox fallback)
    const browserPromise = (async () => {
      let launchedBrowser = null;
      let currentUseCamoufox = useCamoufox;  // May change on retry
      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info({ attempt, useCamoufox: currentUseCamoufox }, '🚀 [PARALLEL] Launching stealth browser...');

          // On retry after proxy error, use local Playwright (no proxy)
          if (attempt > 1 && !currentUseCamoufox) {
            // Force local Playwright browser without proxy
            const originalCamoufox = process.env.USE_CAMOUFOX;
            process.env.USE_CAMOUFOX = 'false';
            launchedBrowser = await launchStealthBrowser({ headless: false });
            process.env.USE_CAMOUFOX = originalCamoufox;
            logger.info('✅ [PARALLEL] Local browser launched (no proxy)');
          } else {
            launchedBrowser = await launchStealthBrowser({ headless: false });
            logger.info('✅ [PARALLEL] Browser launched');
          }

          // Create context - use appropriate method based on browser type
          const contextOptions = {
            applicationId,
            jobBoardDomain,
            sessionSeed,
            skipProxy: attempt > 1  // Skip proxy on retry
          };

          const context = currentUseCamoufox
            ? await createStealthContextCamoufox(launchedBrowser, contextOptions)
            : await createStealthContext(launchedBrowser, contextOptions);

          logger.info({
            jobBoardDomain,
            useCamoufox: currentUseCamoufox,
            sessionSeed,
            attempt
          }, '🔗 [PARALLEL] Browser context created');

          const newPage = await context.newPage();

          // IMPORTANT: Skip Chrome stealth injection for Camoufox (Firefox-based)
          // Camoufox handles ALL fingerprinting at C++ level
          // Injecting Chrome-specific JS (window.chrome, etc) would cause inconsistencies
          // See: https://camoufox.com/stealth/ - "does not support injecting Chromium fingerprints"
          if (!currentUseCamoufox) {
            await applyStealthToPage(newPage, { sessionSeed });
          } else {
            logger.info('🦊 Skipping JS stealth injection - Camoufox handles fingerprinting at C++ level');
          }

          // Navigate to job page (80 second timeout as requested)
          logger.info(`📄 [PARALLEL] Navigating to ${jobUrl}...`);
          await newPage.goto(jobUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 80000  // 1 minute 20 seconds
          });

          // Wait for page to be visually ready
          try {
            await newPage.waitForLoadState('load', { timeout: 20000 });
          } catch (e) {
            logger.debug('Load state timeout - continuing anyway');
          }

          // Wait for dynamic content
          await new Promise(resolve => setTimeout(resolve, 2000));

          logger.info({ usedCamoufox: currentUseCamoufox, attempt }, '✅ [PARALLEL] Page loaded and ready');
          return { browser: launchedBrowser, page: newPage, context, usedCamoufox: currentUseCamoufox };

        } catch (error) {
          const isProxyError = error.message?.includes('NS_ERROR_PROXY') ||
                               error.message?.includes('PROXY_FORBIDDEN') ||
                               error.message?.includes('ERR_PROXY') ||
                               error.message?.includes('ERR_TUNNEL');

          logger.warn({
            error: error.message,
            attempt,
            isProxyError,
            useCamoufox: currentUseCamoufox
          }, '⚠️ [PARALLEL] Navigation failed');

          // Close browser before retry
          if (launchedBrowser) {
            try {
              await launchedBrowser.close();
            } catch (e) {
              // Ignore close errors
            }
            launchedBrowser = null;
          }

          // If proxy error, retry with local Playwright (no Camoufox = no proxy)
          if (isProxyError && currentUseCamoufox && attempt < maxRetries) {
            logger.info('🔄 Proxy blocked by site - retrying with LOCAL browser (no proxy)...');
            currentUseCamoufox = false;  // Switch to local Playwright
            continue;
          }

          // If not a proxy error or already tried local, throw
          throw error;
        }
      }
    })();

    // Wait for both tasks to complete
    const [resumeResult, browserResult] = await Promise.all([resumePromise, browserPromise]);

    // Extract results
    const { pdfContent, filename, source: resumeSource } = resumeResult;
    browser = browserResult.browser;
    const page = browserResult.page;

    logger.info({
      applicationId,
      filename,
      resumeSource,
      useCamoufox
    }, '✅ Parallel tasks complete - resume + browser ready');

    // Save PDF to temp file
    const tempDir = path.join(os.tmpdir(), 'resume-auto-apply');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    resumePath = path.join(tempDir, filename);
    fs.writeFileSync(resumePath, pdfContent);
    logger.info({ resumePath }, '📄 Resume file saved');

    // Simulate human browsing behavior - SKIP for Camoufox (remote Firefox has mouse issues)
    // See: https://github.com/microsoft/playwright/issues/9354
    if (!useCamoufox) {
      logger.info('🤖 Simulating human browsing behavior...');
      try {
        await simulateHumanBrowsing(page, { timeout: 8000 });
      } catch (e) {
        logger.debug({ error: e.message }, 'Human browsing simulation failed, continuing...');
      }
    } else {
      // For Camoufox, just do a simple scroll with page.evaluate (more reliable)
      logger.info('🦊 Camoufox: Using simple scroll instead of mouse simulation');
      try {
        await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        logger.debug({ error: e.message }, 'Simple scroll failed, continuing...');
      }
    }

    // Additional human-like delay
    const randomDelay = Math.floor(Math.random() * 1500) + 1500;
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Prepare user profile for form filling
    const appData = profileData?.applicationData;
    const userProfile = {
      fullName: appData?.personalInfo?.fullName ||
                profileData?.name ||
                `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim(),
      email: appData?.personalInfo?.email || profileData?.email || user.email,
      phone: appData?.personalInfo?.phone || profileData?.phone || '',
      location: appData?.personalInfo?.location || profileData?.location || '',
      linkedIn: appData?.personalInfo?.linkedin || profileData?.linkedin || '',
      portfolio: appData?.personalInfo?.website || profileData?.website || '',
      experience: appData?.experience || profileData?.experiences || [],
      education: appData?.education || profileData?.education || [],
      skills: appData?.skills || profileData?.skills || [],
      applicationQuestions: profileData?.applicationQuestions || {}
    };

    // Use AI to fill the form
    logger.info('🤖 AI analyzing and filling form...');
    const fillResult = await aiFormFiller.fillFormIntelligently(page, userProfile, { jobUrl, atsType }, resumePath);

    if (!fillResult.success) {
      throw new Error(fillResult.errors?.join('; ') || 'Form filling failed');
    }

    logger.info({
      fieldsFilled: fillResult.fieldsFilled,
      fieldsExtracted: fillResult.fieldsExtracted,
      usedIframe: fillResult.usedIframe || false,
      iframeAtsType: fillResult.iframeAtsType
    }, '✅ Form filled');

    // Use the working page from fillResult (may be an iframe)
    // This ensures submit/validation happen in the correct context
    const workingPage = fillResult._workingPage || page;
    const usedIframe = fillResult._usedIframe || false;

    // Submit the form with retry logic
    let submitResult = { success: false, error: 'No submit button found' };
    let validationResult = null;
    const MAX_SUBMIT_RETRIES = 2;
    let submitAttempts = 0;

    if (fillResult.submitButton) {
      while (submitAttempts < MAX_SUBMIT_RETRIES) {
        submitAttempts++;
        logger.info({ attempt: submitAttempts, maxRetries: MAX_SUBMIT_RETRIES, usedIframe }, '📤 Submitting application...');

        // Submit using workingPage (may be iframe context)
        submitResult = await aiFormFiller.submitForm(workingPage, fillResult.submitButton, userProfile);

        // Wait for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Run comprehensive validation (use main page for URL checks, workingPage for form checks)
        logger.info('🔍 Running post-submission validation...');
        validationResult = await aiFormFiller.validateApplicationSubmission(page, fillResult, submitResult);

        if (validationResult.isValid && validationResult.confidence >= 50) {
          logger.info({
            confidence: validationResult.confidence,
            recommendation: validationResult.recommendation
          }, '✅ Application validation passed');
          submitResult.success = true;
          submitResult.validation = validationResult;
          break;
        }

        // If validation failed but we have retries left
        if (submitAttempts < MAX_SUBMIT_RETRIES) {
          logger.warn({
            attempt: submitAttempts,
            confidence: validationResult.confidence,
            issues: validationResult.issues
          }, '⚠️ Validation failed, attempting retry...');

          // Try to fix issues before retry (use workingPage for iframe context)
          if (validationResult.issues.length > 0) {
            // Re-extract and fill any empty required fields
            const extraction = await aiFormFiller.extractor.extractComplete(workingPage);
            if (extraction.fields.length > 0) {
              const retryFillResult = await aiFormFiller.fillFields(workingPage, extraction.fields, {});
              logger.info({ retryFilled: retryFillResult.filled }, 'Retry fill attempt completed');
            }
          }

          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // If all retries failed, check if we should mark as MANUAL_REQUIRED
      if (!submitResult.success && validationResult) {
        submitResult.validation = validationResult;

        // Determine if this should be MANUAL_REQUIRED vs FAILED
        if (validationResult.confidence >= 25 && validationResult.recommendation === 'UNCERTAIN') {
          submitResult.requiresManual = true;
          submitResult.manualReason = validationResult.issues.join('; ');
          logger.warn({
            applicationId,
            confidence: validationResult.confidence,
            issues: validationResult.issues
          }, '⚠️ Application uncertain - marking for manual review');
        }
      }
    }

    // Check if page is asking for email verification
    let verificationResult = null;
    let pageNeedsVerification = false;

    try {
      // First, detect if the page is actually asking for verification
      // Look for verification input fields
      const verificationInput = await page.$([
        'input[name*="code"]',
        'input[name*="verification"]',
        'input[name*="otp"]',
        'input[name*="pin"]',
        'input[placeholder*="code"]',
        'input[placeholder*="verification"]',
        'input[placeholder*="enter"]',
        'input[aria-label*="code"]',
        'input[aria-label*="verification"]',
        'input[type="tel"][maxlength="6"]',
        'input[type="text"][maxlength="6"]',
        'input[type="number"][maxlength="6"]'
      ].join(', '));

      // Also check for verification-related text on the page
      const pageText = await page.textContent('body').catch(() => '');
      const verificationKeywords = [
        'verify your email',
        'verification code',
        'enter the code',
        'check your email',
        'sent you a code',
        'confirmation code',
        'enter code',
        'verify email',
        'email verification',
        'one-time code',
        'otp'
      ];

      const hasVerificationText = verificationKeywords.some(keyword =>
        pageText.toLowerCase().includes(keyword)
      );

      pageNeedsVerification = !!(verificationInput || hasVerificationText);

      if (pageNeedsVerification) {
        logger.info('🔐 Page is asking for email verification');

        // Check if user has Gmail connected
        const hasGmail = await hasActiveGmailConnection(userId);

        if (hasGmail) {
          logger.info('📧 Polling Gmail for verification code...');

          // Poll for verification email (extended timeout for slow email delivery)
          verificationResult = await pollForVerification(userId, {
            maxWaitMs: 180000, // 3 minutes max (extended from 1.5 min)
            pollIntervalMs: 10000, // Every 10 seconds
            companyName: aggregatedJob.company,
            retryOnError: true // Retry on temporary Gmail API errors
          });

          if (verificationResult.found && verificationResult.code) {
            logger.info({ code: verificationResult.code }, '✅ Found verification code in email');

            // Re-find the input (page might have updated)
            const codeInput = await page.$([
              'input[name*="code"]',
              'input[name*="verification"]',
              'input[name*="otp"]',
              'input[name*="pin"]',
              'input[placeholder*="code"]',
              'input[placeholder*="verification"]',
              'input[type="tel"][maxlength="6"]',
              'input[type="text"][maxlength="6"]'
            ].join(', '));

            if (codeInput) {
              await codeInput.click();
              await codeInput.fill('');
              await codeInput.type(verificationResult.code, { delay: 50 });
              logger.info('📝 Entered verification code');

              // Small delay before clicking submit
              await new Promise(resolve => setTimeout(resolve, 500));

              // Try to submit verification
              const verifyButton = await page.$([
                'button:has-text("verify")',
                'button:has-text("confirm")',
                'button:has-text("submit")',
                'button:has-text("continue")',
                'input[type="submit"]',
                'button[type="submit"]'
              ].join(', '));

              if (verifyButton) {
                await verifyButton.click();
                await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                logger.info('✅ Verification code submitted');
              }
            } else {
              logger.warn('Could not find verification input to enter code');
            }
          } else if (verificationResult.found && verificationResult.links?.length > 0) {
            // Handle verification links
            const verifyLink = verificationResult.links[0];
            logger.info({ link: verifyLink }, '🔗 Following verification link');
            await page.goto(verifyLink, { waitUntil: 'networkidle', timeout: 15000 });
            logger.info('✅ Verification link visited');
          } else {
            logger.warn('Verification needed but no code/link found in email');
          }
        } else {
          logger.warn('⚠️ Verification needed but Gmail not connected - cannot auto-verify');
        }
      } else {
        logger.debug('No verification requested on this page');
      }
    } catch (verifyError) {
      logger.warn({ error: verifyError.message }, 'Error during verification check');
    }

    // Take screenshot
    let screenshot = null;
    try {
      const screenshotBuffer = await page.screenshot({ encoding: 'base64', fullPage: true });
      screenshot = `data:image/png;base64,${screenshotBuffer}`;
    } catch (e) {
      logger.warn({ error: e.message }, 'Failed to capture screenshot');
    }

    // Sanitize strings to remove null bytes that PostgreSQL can't handle
    const sanitize = (str) => typeof str === 'string' ? str.replace(/\x00/g, '') : str;

    // Update application status based on validation results
    if (submitResult.success) {
      const sanitizedMessages = submitResult.successMessages?.map(sanitize) || [];
      const validation = submitResult.validation || validationResult;

      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'SUBMITTED',
          method: 'AI_DIRECT',
          submittedAt: new Date(),
          completedAt: new Date(),
          confirmationUrl: sanitize(screenshot),
          confirmationData: {
            fieldsExtracted: fillResult.fieldsExtracted,
            fieldsFilled: fillResult.fieldsFilled,
            successMessages: sanitizedMessages,
            finalUrl: sanitize(submitResult.currentUrl),
            validation: validation ? {
              confidence: validation.confidence,
              recommendation: validation.recommendation,
              checks: validation.checks,
              warnings: validation.warnings
            } : null,
            verification: verificationResult ? {
              found: verificationResult.found,
              codeUsed: !!verificationResult.code,
              linkFollowed: !!verificationResult.links?.length && !verificationResult.code,
              attempts: verificationResult.attempts,
              duration: verificationResult.duration
            } : null,
            submitAttempts
          }
        }
      });

      logger.info({
        applicationId,
        confidence: validation?.confidence,
        attempts: submitAttempts
      }, '✅ Application submitted successfully');

    } else if (submitResult.requiresManual) {
      // Mark for manual application when automation is uncertain
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'MANUAL_REQUIRED',
          method: 'AI_DIRECT',
          error: sanitize(submitResult.manualReason || 'Application requires manual review'),
          completedAt: new Date(),
          confirmationUrl: sanitize(screenshot),
          confirmationData: {
            fieldsExtracted: fillResult.fieldsExtracted,
            fieldsFilled: fillResult.fieldsFilled,
            validation: validationResult ? {
              confidence: validationResult.confidence,
              recommendation: validationResult.recommendation,
              issues: validationResult.issues,
              warnings: validationResult.warnings
            } : null,
            applyUrl: jobUrl, // Show user where to apply manually
            submitAttempts
          }
        }
      });

      logger.warn({
        applicationId,
        confidence: validationResult?.confidence,
        reason: submitResult.manualReason
      }, '⚠️ Application marked for manual completion');

    } else {
      // Complete failure
      const validation = submitResult.validation || validationResult;

      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'FAILED',
          method: 'AI_DIRECT',
          error: sanitize(submitResult.error || 'Form submission failed'),
          errorType: 'SUBMISSION_FAILED',
          completedAt: new Date(),
          confirmationUrl: sanitize(screenshot),
          confirmationData: {
            fieldsExtracted: fillResult.fieldsExtracted,
            fieldsFilled: fillResult.fieldsFilled,
            validation: validation ? {
              confidence: validation.confidence,
              recommendation: validation.recommendation,
              issues: validation.issues
            } : null,
            applyUrl: jobUrl, // Show user where to apply manually
            submitAttempts
          }
        }
      });

      logger.error({
        applicationId,
        error: submitResult.error,
        confidence: validation?.confidence,
        attempts: submitAttempts
      }, '❌ Application submission failed');
    }

    return {
      success: submitResult.success,
      applicationId,
      method: 'AI_DIRECT'
    };

  } catch (error) {
    logger.error({
      applicationId,
      error: error.message,
      stack: error.stack
    }, '❌ Direct auto-apply failed');

    // Update application as failed
    try {
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'FAILED',
          error: error.message,
          errorType: 'PROCESSING_ERROR',
          completedAt: new Date()
        }
      });
    } catch (dbError) {
      logger.error({ error: dbError.message }, 'Failed to update application status');
    }

    throw error;

  } finally {
    // Cleanup
    if (browser) {
      try {
        await browser.close();
        logger.debug('Browser closed');
      } catch (e) {
        logger.warn({ error: e.message }, 'Failed to close browser');
      }
    }

    if (resumePath) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(resumePath)) {
          fs.unlinkSync(resumePath);
        }
      } catch (e) {
        logger.warn({ error: e.message }, 'Failed to cleanup resume file');
      }
    }
  }
}

export { getOrGenerateTailoredResume };
export default { processAutoApplyDirect, getOrGenerateTailoredResume };
