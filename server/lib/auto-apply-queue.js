/**
 * Auto-Apply Queue Worker
 * Processes queued job applications using AI-powered form filling
 * MIGRATED FROM PUPPETEER TO PLAYWRIGHT
 *
 * Now with graceful Redis handling - won't crash if Redis is unavailable
 */

import Queue from 'bull';
import { prisma } from './prisma-client.js';
import logger from './logger.js';
import AIFormFiller from './ai-form-filler.js';
import { classifyError, shouldRetryError } from './error-classifier.js';
import { getOrGenerateTailoredResume } from './direct-auto-apply.js';

const aiFormFiller = new AIFormFiller();

// Maximum retry attempts for Redis connection
const MAX_REDIS_RETRIES = 5;
let redisRetryCount = 0;
let queueAvailable = false;

const redisUrl = process.env.REDIS_URL || '';

// Don't throw error - just warn and continue without queue
if (!redisUrl && process.env.NODE_ENV === 'production') {
  logger.warn('REDIS_URL not set in production - auto-apply queue will be disabled');
}

// Check if Redis URL is an internal Railway URL that might not be accessible
function isInternalRedisUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Railway internal URLs use .railway.internal domain
    return parsed.hostname.endsWith('.railway.internal');
  } catch {
    return false;
  }
}

function parseRedisConfig(url) {
  if (!url) {
    // Don't return localhost config in production - just return null to disable queue
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    return { host: '127.0.0.1', port: 6379 };
  }

  // In production, check if the Redis URL is reachable first
  // Internal Railway URLs might not be accessible if Redis service isn't deployed
  if (isInternalRedisUrl(url) && process.env.SKIP_REDIS_ON_INTERNAL_URL === 'true') {
    logger.warn({ url: url.replace(/\/\/.*@/, '//**:**@') }, 'Skipping internal Railway Redis URL - SKIP_REDIS_ON_INTERNAL_URL is set');
    return null;
  }

  try {
    const parsed = new URL(url);
    const config = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      // Add retry settings
      retryStrategy: (times) => {
        redisRetryCount = times;
        if (times > MAX_REDIS_RETRIES) {
          logger.warn({ attempt: times, maxRetries: MAX_REDIS_RETRIES }, 'Auto-apply queue: Redis max retries exceeded');
          // Mark queue as unavailable and stop retrying
          queueAvailable = false;
          return null; // Stop retrying
        }
        const delay = Math.min(times * 500, 3000);
        if (times <= MAX_REDIS_RETRIES) {
          logger.warn({ attempt: times, delay, maxRetries: MAX_REDIS_RETRIES }, 'Auto-apply queue: Redis retry');
        }
        return delay;
      },
      maxRetriesPerRequest: 3, // Limit retries per request
      connectTimeout: 5000, // 5 second timeout
      enableOfflineQueue: false, // Don't queue commands when disconnected
      lazyConnect: true, // Don't connect immediately - wait for first command
    };
    if (parsed.password) {
      config.password = decodeURIComponent(parsed.password);
    }
    if (parsed.username) {
      config.username = decodeURIComponent(parsed.username);
    }
    if (parsed.protocol === 'rediss:') {
      config.tls = { rejectUnauthorized: false };
    }
    return config;
  } catch (error) {
    logger.error({ error: error.message }, 'Invalid REDIS_URL value');
    return null;
  }
}

const redisConfig = parseRedisConfig(redisUrl);
if (!redisUrl) {
  logger.warn('REDIS_URL not set; auto-apply queue disabled');
} else if (!redisConfig) {
  logger.warn('Redis configuration invalid or skipped; auto-apply queue disabled');
} else {
  logger.info({ host: redisConfig.host, port: redisConfig.port }, 'Auto-apply queue using configured Redis');
}

/**
 * Apply to job using AI-powered form filling with Playwright
 */
async function applyWithAI(jobUrl, user, jobData, resumePath = null) {
  let browser;

  try {
    logger.info('🚀 Launching Playwright browser for AI application (stealth mode)...');

    // Use centralized browser launcher with stealth mode (now returns Playwright browser)
    const {
      launchStealthBrowser,
      createStealthContext,
      createStealthContextCamoufox,
      applyStealthToPage,
      proxyRotator
    } = await import('./browser-launcher.js');
    browser = await launchStealthBrowser({ headless: false });

    // Extract job board domain for proxy selection
    const jobBoardDomain = new URL(jobUrl).hostname;

    // Generate application ID for sticky proxy session
    const applicationId = `${jobData.id || 'unknown'}-${user.id || 'user'}-${Date.now()}`;

    // Generate consistent session seed for fingerprint consistency
    const sessionSeed = parseInt(applicationId.replace(/\D/g, '').slice(0, 8) || '12345', 10);

    // Create stealth context with proxy rotation
    // Use Camoufox context if available, otherwise standard context
    const useCamoufox = process.env.USE_CAMOUFOX === 'true';
    const context = useCamoufox
      ? await createStealthContextCamoufox(browser, { applicationId, jobBoardDomain, sessionSeed })
      : await createStealthContext(browser, { applicationId, jobBoardDomain, sessionSeed });

    logger.info({
      applicationId,
      jobBoardDomain,
      proxyEnabled: proxyRotator.isConfigured(),
      useCamoufox,
      sessionSeed
    }, '🔗 Browser context created');

    const page = await context.newPage();

    // IMPORTANT: Skip Chrome stealth injection for Camoufox (Firefox-based)
    // Camoufox handles ALL fingerprinting at C++ level
    if (!useCamoufox) {
      await applyStealthToPage(page, { sessionSeed });
    } else {
      logger.info('🦊 Skipping JS stealth - Camoufox handles fingerprinting at C++ level');
    }

    // Transform Greenhouse URLs to direct application page
    let targetUrl = jobUrl;
    if (jobUrl.includes('gh_jid=')) {
      // Extract job ID and try to find direct Greenhouse board URL
      const jobIdMatch = jobUrl.match(/gh_jid=(\d+)/);
      if (jobIdMatch) {
        const jobId = jobIdMatch[1];
        // Try to navigate to the direct Greenhouse application page
        // Format: https://boards.greenhouse.io/[company]/jobs/[jobId]
        // We'll try to extract the company from the URL
        const urlObj = new URL(jobUrl);
        const hostname = urlObj.hostname;

        // Check if there's a boards.greenhouse.io URL we can construct
        logger.info(`🔍 Detected Greenhouse job ID: ${jobId}`);
        logger.info(`💡 Tip: If this fails, try using the direct Greenhouse boards URL instead`);

        // For now, keep using the original URL but look for iframe after load
        targetUrl = jobUrl;
      }
    }

    // Navigate to job application page
    logger.info(`📄 Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, {
      waitUntil: 'networkidle',  // Playwright uses 'networkidle' not 'networkidle2'
      timeout: 30000
    });

    // Human-like delay before interacting
    const randomDelay = Math.floor(Math.random() * 2000) + 2000; // 2-4 seconds
    logger.info(`⏱️  Waiting ${randomDelay}ms (human-like behavior)...`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Random mouse movement to appear human
    await page.mouse.move(
      Math.random() * 500 + 100,
      Math.random() * 500 + 100
    );

    // Scroll down slowly to the bottom (human behavior) to load all content including forms
    logger.info('📜 Scrolling to bottom to load all content...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          // Scroll ALL the way to the bottom (not just half)
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait a bit for any lazy-loaded content (like forms) to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger.info('✅ Finished scrolling, content should be loaded');

    // DEBUG: Take screenshot to see what's on the page
    logger.info('📸 Taking screenshot for debugging...');
    try {
      // Ensure test-output directory exists
      const fs = await import('fs');
      const path = await import('path');
      const outputDir = './test-output';

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const debugScreenshot = await page.screenshot({
        path: `${outputDir}/debug-${Date.now()}.png`,
        fullPage: true
      });
      logger.info({ outputDir }, '✅ Screenshot saved to test-output directory');
    } catch (screenshotError) {
      logger.warn({ error: screenshotError.message, stack: screenshotError.stack }, '⚠️  Failed to save screenshot');
    }

    // DEBUG: Log page content info
    const pageInfo = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"])');
      const textareas = document.querySelectorAll('textarea');
      const selects = document.querySelectorAll('select');
      const iframes = document.querySelectorAll('iframe');
      const applyLinks = Array.from(document.querySelectorAll('a')).filter(a =>
        a.textContent.toLowerCase().includes('apply')
      );

      return {
        inputs: inputs.length,
        textareas: textareas.length,
        selects: selects.length,
        iframes: iframes.length,
        applyLinks: applyLinks.map(a => ({
          text: a.textContent.trim(),
          href: a.href
        })),
        url: window.location.href,
        title: document.title
      };
    });
    logger.info('📊 Page info:', JSON.stringify(pageInfo, null, 2));

    // Check if we need to click an Apply button or if form is already visible
    logger.info('🔍 Checking for Apply button or inline form...');

    // First check if form fields are already visible on the page
    const hasFormFields = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
      // Filter to only count VISIBLE fields (not just existing ones)
      const visibleInputs = Array.from(inputs).filter(input => {
        // Check if element is visible (has dimensions and offsetParent)
        return input.offsetParent !== null &&
               input.offsetWidth > 0 &&
               input.offsetHeight > 0;
      });
      return visibleInputs.length > 3; // If we have more than 3 VISIBLE inputs, likely a form
    });

    // Always check for application iframes (Greenhouse, Lever, etc.)
    const frames = page.frames();
    logger.info(`📊 Found ${frames.length} frames on page`);

    let applicationFrame = null;
    for (const frame of frames) {
      const frameUrl = frame.url();
      // Look for common ATS iframe patterns
      if (frameUrl.includes('greenhouse') ||
          frameUrl.includes('boards.greenhouse.io') ||
          frameUrl.includes('apply') ||
          frameUrl.includes('lever.co') ||
          frameUrl.includes('workday') ||
          frameUrl.includes('myworkdayjobs.com')) {
        logger.info(`🎯 Found application iframe: ${frameUrl}`);
        applicationFrame = frame;
        break;
      }
    }

    // If we found an iframe, use it regardless of main page form detection
    if (applicationFrame) {
      logger.info('🔄 Using application iframe for form extraction');
      page._applicationFrame = applicationFrame;
    } else if (hasFormFields) {
      logger.info('✅ Form fields already visible on page, skipping Apply button search');
    } else {
      // Try to find and click Apply button
      logger.info('🔍 No form visible, looking for Apply button...');
      const applyButtonClicked = await page.evaluate(() => {
        // Common Apply button patterns for different ATS systems
        const applySelectors = [
          // Greenhouse
          'a[id*="apply"]',
          'a.app-link',
          'a[href*="apply"]',
          // Lever
          '.apply-button',
          'a.template-btn-submit',
        ];

        // Try specific selectors first
        for (const selector of applySelectors) {
          try {
            const button = document.querySelector(selector);
            if (button && button.offsetParent !== null) {
              button.click();
              return true;
            }
          } catch (e) {
            continue;
          }
        }

        // Fallback: find any visible button/link with "apply" text
        const buttons = Array.from(document.querySelectorAll('a, button'));
        const button = buttons.find(btn => {
          const text = btn.textContent.toLowerCase();
          return text.includes('apply') && !text.includes('applied') && btn.offsetParent !== null;
        });
        if (button) {
          button.click();
          return true;
        }

        return false;
      });

      if (applyButtonClicked) {
        logger.info('✅ Apply button clicked, waiting for form to load...');
        // Wait for form to appear (either in iframe or main page)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Re-check for iframes after clicking Apply (may have loaded new iframe)
        if (!page._applicationFrame) {
          const frames = page.frames();
          logger.info(`📊 Re-checking frames after Apply click: ${frames.length} frames`);

          // Look for application iframe
          for (const frame of frames) {
            const frameUrl = frame.url();
            if (frameUrl.includes('greenhouse') ||
                frameUrl.includes('boards.greenhouse.io') ||
                frameUrl.includes('apply') ||
                frameUrl.includes('lever.co') ||
                frameUrl.includes('workday') ||
                frameUrl.includes('myworkdayjobs.com') ||
                frameUrl.includes('job')) {
              logger.info(`🎯 Found application iframe after Apply click: ${frameUrl}`);
              page._applicationFrame = frame;
              break;
            }
          }
        }
      } else {
        logger.warn('⚠️  No Apply button found, form may be embedded on page');
      }
    }

    // Note: CAPTCHA detection and solving is handled by AIFormFiller
    // which has better context about the form and can solve CAPTCHAs in iframes

    // Prepare user profile data (support both old and new profile structures)
    const profileData = user.profile.data;
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
      // Include pre-answered application questions
      applicationQuestions: profileData?.applicationQuestions || {}
    };

    // Use AI to fill the form
    logger.info('🤖 AI analyzing and filling form...');
    // Use iframe if it was detected, otherwise use main page
    const targetPage = page._applicationFrame || page;
    if (page._applicationFrame) {
      logger.info('📄 Using application iframe for form filling');
    } else {
      logger.info('📄 Using main page for form filling');
    }
    const fillResult = await aiFormFiller.fillFormIntelligently(targetPage, userProfile, jobData, resumePath);

    if (!fillResult.success) {
      logger.error({ errors: fillResult.errors, details: fillResult }, '❌ AI form filling failed');
      await browser.close();
      return {
        success: false,
        error: fillResult.errors.join('; '),
        method: 'AI_AUTO',
        details: fillResult
      };
    }

    logger.info('✅ AI successfully filled form!');
    logger.info(`   Fields filled: ${fillResult.fieldsFilled}/${fillResult.fieldsExtracted}`);

    // IMPORTANT: Click the submit button to actually submit the application
    let submitResult = { success: false, error: 'No submit button found' };

    if (fillResult.submitButton) {
      logger.info('📤 Attempting to submit application...');
      try {
        // Pass userProfile for data verification
        submitResult = await aiFormFiller.submitForm(page, fillResult.submitButton, userProfile);

        if (submitResult.success) {
          logger.info({
            successMessages: submitResult.successMessages,
            urlChanged: submitResult.urlChanged,
            currentUrl: submitResult.currentUrl
          }, '✅ Application submitted successfully - verified!');
        } else {
          logger.error({
            error: submitResult.error,
            errorMessages: submitResult.errorMessages,
            formStillVisible: submitResult.formStillVisible
          }, '❌ Application submission failed - verification failed');
        }

        // Wait a bit for any final page updates
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (submitError) {
        logger.error({ error: submitError.message, stack: submitError.stack }, '❌ Failed to submit application');
        submitResult = {
          success: false,
          error: submitError.message
        };
      }
    } else {
      logger.error('⚠️  No submit button found - form filled but cannot submit');
      submitResult = {
        success: false,
        error: 'No submit button found after form filling'
      };
    }

    // Take final screenshot to capture the result
    let screenshot = null;
    try {
      const screenshotBuffer = await page.screenshot({
        encoding: 'base64',
        fullPage: true
      });
      screenshot = `data:image/png;base64,${screenshotBuffer}`;
      logger.info('📸 Final screenshot captured');
    } catch (screenshotError) {
      logger.error({ error: screenshotError.message }, 'Failed to capture final screenshot');
    }

    // Only return success if form was filled AND submitted successfully
    if (!submitResult.success) {
      logger.error({
        fillSuccess: fillResult.success,
        submitSuccess: submitResult.success,
        submitError: submitResult.error
      }, '❌ Application failed: submission verification failed');

      return {
        success: false,
        error: submitResult.error || 'Form submission failed',
        method: 'AI_AUTO',
        screenshot: screenshot,
        confirmationData: {
          fieldsExtracted: fillResult.fieldsExtracted,
          fieldsFilled: fillResult.fieldsFilled,
          complexity: fillResult.complexity,
          learningRecorded: fillResult.learningRecorded,
          submitAttempted: true,
          submitError: submitResult.error,
          submitErrorMessages: submitResult.errorMessages
        }
      };
    }

    return {
      success: true,
      method: 'AI_AUTO',
      screenshot: screenshot,
      confirmationData: {
        fieldsExtracted: fillResult.fieldsExtracted,
        fieldsFilled: fillResult.fieldsFilled,
        complexity: fillResult.complexity,
        learningRecorded: fillResult.learningRecorded,
        submitted: true,
        successMessages: submitResult.successMessages,
        urlChanged: submitResult.urlChanged,
        finalUrl: submitResult.currentUrl
      }
    };

  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '❌ AI application error');

    return {
      success: false,
      error: error.message,
      method: 'AI_AUTO'
    };
  } finally {
    // CRITICAL: Always close browser to prevent memory leaks
    if (browser) {
      try {
        logger.debug('Closing browser');
        await browser.close();
        logger.debug('Browser closed successfully');
      } catch (closeError) {
        logger.error({
          error: closeError.message,
          stack: closeError.stack
        }, 'Failed to close browser - potential memory leak');

        // Try to force kill browser process if close fails
        try {
          await browser.close({ reason: 'force' });
        } catch (forceCloseError) {
          logger.error({ error: forceCloseError.message }, 'Failed to force close browser');
        }
      }
    }
  }
}

// Create auto-apply queue (only if Redis config is valid)
let autoApplyQueue = null;

// Global handler for unhandled Redis rejections to prevent crashes
function setupRedisErrorHandlers(client, name) {
  if (!client) return;

  client.on('error', (error) => {
    if (redisRetryCount <= MAX_REDIS_RETRIES) {
      logger.error({ error: error.message, client: name }, 'Redis client error');
    }
    // Don't rethrow - let retry strategy handle it
  });

  client.on('end', () => {
    queueAvailable = false;
    logger.warn({ client: name }, 'Redis client connection ended');
  });
}

if (redisConfig) {
  try {
    autoApplyQueue = new Queue('auto-apply', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: false
      }
    });

    // Track queue availability
    autoApplyQueue.on('ready', () => {
      queueAvailable = true;
      redisRetryCount = 0;
      logger.info('Auto-apply queue connected to Redis');
    });

    autoApplyQueue.on('error', (error) => {
      // Mark queue as unavailable on any error
      queueAvailable = false;
      if (redisRetryCount <= MAX_REDIS_RETRIES) {
        logger.error({ error: error.message }, 'Auto-apply queue error');
      }
      // Don't rethrow - prevent unhandled rejection
    });

    // Setup error handlers for all Redis clients used by Bull
    // Bull uses multiple Redis connections: client, subscriber, bclient
    setupRedisErrorHandlers(autoApplyQueue.client, 'queue-client');

    // Subscriber client is created lazily, wait for it
    autoApplyQueue.on('waiting', () => {
      if (autoApplyQueue.eclient && !autoApplyQueue.eclient._eventsHandled) {
        setupRedisErrorHandlers(autoApplyQueue.eclient, 'queue-subscriber');
        autoApplyQueue.eclient._eventsHandled = true;
      }
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create auto-apply queue');
    autoApplyQueue = null;
  }
} else {
  logger.warn('Auto-apply queue disabled - no valid Redis configuration');
}

/**
 * Process an auto-apply job
 * Concurrency set to 10 for better throughput (each browser ~300MB RAM)
 * Can handle 10 concurrent applications = ~3GB RAM total
 */
if (autoApplyQueue) {
  autoApplyQueue.process(10, async (job) => {
  const { applicationId, jobUrl, atsType, userId } = job.data;

  // Declare at function scope so finally block can access it
  let resumePath = null;
  let result;

  logger.info({
    applicationId,
    jobUrl,
    atsType,
    userId
  }, 'Processing auto-apply job');

  try {
    // Update status to APPLYING
    await prisma.autoApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPLYING',
        startedAt: new Date()
      }
    });

    // Get user data from profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user || !user.profile) {
      throw new Error('User or profile not found');
    }

    // Check if user has required profile data (support both structures)
    const profileData = user.profile.data;
    const applicationData = profileData?.applicationData;

    // Check for either new applicationData structure or old profile structure
    const hasNewStructure = applicationData && applicationData.personalInfo;
    const hasOldStructure = profileData && (profileData.name || profileData.email || profileData.experiences);

    if (!hasNewStructure && !hasOldStructure) {
      throw new Error('User profile missing required data. Please complete profile setup.');
    }

    // Apply using AI-powered application (Playwright + GPT-4 Vision)
    logger.info(`Applying with strategy: AI-ONLY (Playwright + AI)`);

    // Fetch the aggregated job to get job details for tailored resume generation
    const autoApplication = await prisma.autoApplication.findUnique({
      where: { id: applicationId },
      include: { job: true }
    });

    if (!autoApplication?.job) {
      throw new Error('Job details not found for this application');
    }

    const aggregatedJob = autoApplication.job;

    // Smart resume selection: find relevant existing resume or generate new tailored one
    logger.info({
      applicationId,
      company: aggregatedJob.company,
      title: aggregatedJob.title
    }, '🔍 Getting tailored resume for job');

    const resumeResult = await getOrGenerateTailoredResume(user.id, aggregatedJob, profileData);

    if (!resumeResult) {
      throw new Error('No resume found - please upload a resume or complete your profile to generate one');
    }

    const { pdfContent, filename, source: resumeSource } = resumeResult;
    logger.info({
      applicationId,
      filename,
      resumeSource
    }, '📄 Resume ready for application');

    // Create temporary directory if it doesn't exist
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const tempDir = path.join(os.tmpdir(), 'resume-auto-apply');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save PDF to temp file
    resumePath = path.join(tempDir, filename);
    fs.writeFileSync(resumePath, pdfContent);

    logger.info({ resumePath, filename }, '📄 Resume file ready for upload');

    // Use AI-powered application with Playwright
    logger.info('🤖 Attempting AI-powered application...');
    result = await applyWithAI(jobUrl, user, job.data, resumePath);

    // If AI fails, return error (don't fall back to BrowserUse)
    if (!result.success) {
      logger.error({ error: result.error, details: result }, 'AI application failed');
      // Direct AI application is the only supported method
    }

    if (result.success) {
      // Application submitted successfully - use transaction for atomic update
      await prisma.$transaction(async (tx) => {
        // Update application status
        await tx.autoApplication.update({
          where: { id: applicationId },
          data: {
            status: 'SUBMITTED',
            method: result.method || 'AI_AUTO',
            submittedAt: new Date(),
            completedAt: new Date(),
            confirmationUrl: result.screenshot,
            confirmationId: result.confirmationData?.confirmationId || null,
            confirmationData: result.confirmationData || {},
            retryCount: job.attemptsMade,
            cost: result.cost || 0.05 // Track cost per application
          }
        });

        // If using a recipe, record execution success
        if (result.recipeId) {
          await tx.recipeExecution.create({
            data: {
              recipeId: result.recipeId,
              success: true,
              method: result.method,
              duration: result.duration || null,
              cost: result.cost || 0.05,
              jobUrl: jobUrl,
              executedAt: new Date()
            }
          });

          // Update recipe statistics
          await tx.applicationRecipe.update({
            where: { id: result.recipeId },
            data: {
              timesUsed: { increment: 1 },
              lastUsed: new Date(),
              // Update success rate incrementally
              successRate: {
                // (oldSuccessRate * oldTimesUsed + 1) / (oldTimesUsed + 1)
                // Prisma doesn't support this directly, so we'll update in a raw query
              },
              totalSaved: { increment: result.savedCost || 0 }
            }
          });
        }
      }, {
        maxWait: 5000, // Max 5s to acquire transaction lock
        timeout: 10000, // Max 10s for transaction to complete
        isolationLevel: 'ReadCommitted' // Prevent dirty reads
      });

      logger.info({
        applicationId,
        method: result.method,
        cost: result.cost || 0.05
      }, '✅ Application submitted successfully');

      return {
        success: true,
        applicationId,
        method: result.method
      };

    } else {
      // Application failed - use transaction for atomic update
      const errorType = result.needsConfiguration ? 'CONFIGURATION_ERROR' :
                       result.needsInstall ? 'DEPENDENCY_ERROR' :
                       'APPLICATION_ERROR';

      await prisma.$transaction(async (tx) => {
        // Update application status
        await tx.autoApplication.update({
          where: { id: applicationId },
          data: {
            status: 'FAILED',
            error: result.error,
            errorType,
            completedAt: new Date(),
            retryCount: job.attemptsMade,
            cost: result.cost || 0 // Track cost even on failure
          }
        });

        // If using a recipe, record execution failure
        if (result.recipeId) {
          await tx.recipeExecution.create({
            data: {
              recipeId: result.recipeId,
              success: false,
              method: result.method,
              error: result.error,
              errorType: errorType,
              cost: result.cost || 0,
              jobUrl: jobUrl,
              executedAt: new Date()
            }
          });

          // Update recipe failure count
          await tx.applicationRecipe.update({
            where: { id: result.recipeId },
            data: {
              failureCount: { increment: 1 },
              lastFailure: new Date()
            }
          });
        }
      }, {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: 'ReadCommitted'
      });

      logger.error({
        applicationId,
        error: result.error,
        errorType
      }, '❌ Application failed');

      throw new Error(result.error || 'Application failed');
    }

  } catch (error) {
    // Update application with error - use transaction for consistency
    try {
      await prisma.$transaction(async (tx) => {
        await tx.autoApplication.update({
          where: { id: applicationId },
          data: {
            status: 'FAILED',
            error: error.message,
            errorType: 'PROCESSING_ERROR',
            completedAt: new Date(),
            retryCount: job.attemptsMade
          }
        });
      }, {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: 'ReadCommitted'
      });
    } catch (dbError) {
      logger.error({
        error: dbError.message,
        originalError: error.message
      }, 'Failed to update application status in database');
    }

    logger.error({
      applicationId,
      error: error.message,
      stack: error.stack
    }, '❌ Job processing failed');

    throw error;
  } finally {
    // Cleanup temporary resume file
    if (resumePath) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(resumePath)) {
          fs.unlinkSync(resumePath);
          logger.debug({ resumePath }, 'Cleaned up temporary resume file');
        }
      } catch (cleanupError) {
        logger.warn({ error: cleanupError.message }, 'Failed to cleanup temporary resume file');
      }
    }
  }
});
} // End if (autoApplyQueue) for process

/**
 * Queue event listeners
 */
if (autoApplyQueue) {
  autoApplyQueue.on('completed', (job, result) => {
  logger.info({
    jobId: job.id,
    applicationId: job.data.applicationId
  }, 'Auto-apply job completed');
});

autoApplyQueue.on('failed', async (job, error) => {
  const { applicationId } = job.data;

  // Classify the error
  const classification = classifyError(error);
  const retryDecision = shouldRetryError(error, job.attemptsMade);

  logger.error({
    jobId: job.id,
    applicationId,
    error: error.message,
    errorType: classification.type,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    willRetry: retryDecision.shouldRetry,
    retryReason: retryDecision.reason
  }, 'Auto-apply job failed');

  // Update application with classified error information
  try {
    await prisma.autoApplication.update({
      where: { id: applicationId },
      data: {
        errorType: classification.type,
        error: classification.userMessage
      }
    });
  } catch (dbError) {
    logger.error({
      applicationId,
      error: dbError.message
    }, 'Failed to update application error type');
  }
});

  autoApplyQueue.on('stalled', (job) => {
    logger.warn({
      jobId: job.id,
      applicationId: job.data.applicationId
    }, 'Auto-apply job stalled');
  });
} // End if (autoApplyQueue) for event listeners

/**
 * Add a job to the queue
 */
export async function queueAutoApply({ applicationId, jobUrl, atsType, userId }) {
  if (!autoApplyQueue || !queueAvailable) {
    logger.warn({ applicationId }, 'Auto-apply queue not available, cannot queue job');
    throw new Error('Auto-apply queue not available. Please try again later or check Redis configuration.');
  }

  logger.info({
    applicationId,
    jobUrl,
    atsType,
    userId
  }, 'Queueing auto-apply job');

  const job = await autoApplyQueue.add({
    applicationId,
    jobUrl,
    atsType,
    userId
  }, {
    jobId: `auto-apply-${applicationId}`,
    attempts: 3
  });

  logger.info({ jobId: job.id, applicationId }, 'Auto-apply job queued');

  return job;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  if (!autoApplyQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0, available: false };
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      autoApplyQueue.getWaitingCount(),
      autoApplyQueue.getActiveCount(),
      autoApplyQueue.getCompletedCount(),
      autoApplyQueue.getFailedCount(),
      autoApplyQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
      available: queueAvailable
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get queue stats');
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0, available: false };
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId) {
  if (!autoApplyQueue) {
    return { status: 'QUEUE_UNAVAILABLE' };
  }

  try {
    const job = await autoApplyQueue.getJob(jobId);

    if (!job) {
      return { status: 'NOT_FOUND' };
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id,
      state,
      progress,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue
    };
  } catch (error) {
    logger.error({ jobId, error: error.message }, 'Failed to get job status');
    return { status: 'ERROR', error: error.message };
  }
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanQueue() {
  if (!autoApplyQueue) {
    logger.warn('Cannot clean queue - queue not available');
    return;
  }

  const grace = 24 * 60 * 60 * 1000; // 24 hours

  await autoApplyQueue.clean(grace, 'completed');
  await autoApplyQueue.clean(grace, 'failed');

  logger.info('Queue cleaned');
}

export async function checkAutoApplyQueueConnection() {
  if (!autoApplyQueue) {
    return { connected: false, message: 'Queue not initialized' };
  }

  try {
    // Wait for queue to be ready with timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Queue ready timeout'));
      }, 5000);

      if (autoApplyQueue.isReady()) {
        clearTimeout(timeout);
        resolve();
      } else {
        autoApplyQueue.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        autoApplyQueue.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    });

    const client = autoApplyQueue.client;
    await client.ping();
    return { connected: true };
  } catch (error) {
    return { connected: false, message: error.message };
  }
}

export function isQueueAvailable() {
  return queueAvailable && autoApplyQueue !== null;
}

export default autoApplyQueue;
