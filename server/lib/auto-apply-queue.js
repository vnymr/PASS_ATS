/**
 * Auto-Apply Queue Worker
 * Processes queued job applications using AI (primary) or recipe engine (fallback)
 */

import Queue from 'bull';
import recipeEngine from './recipe-engine.js';
import { prisma } from './prisma-client.js';
import logger from './logger.js';
import AIFormFiller from './ai-form-filler.js';

// Use puppeteer-extra with stealth plugin to bypass bot detection
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to hide automation
puppeteer.use(StealthPlugin());

const aiFormFiller = new AIFormFiller();

// Strategy selector: AI first, then recipes
const APPLY_STRATEGY = process.env.APPLY_STRATEGY || 'AI_FIRST'; // AI_FIRST, RECIPE_ONLY, AI_ONLY

const redisUrl = process.env.REDIS_URL || '';

if (!redisUrl && process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL environment variable is required in production. Set REDIS_URL to a reachable Redis instance.');
}

function parseRedisConfig(url) {
  if (!url) {
    return { host: '127.0.0.1', port: 6379 };
  }
  try {
    const parsed = new URL(url);
    const config = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379
    };
    if (parsed.password) {
      config.password = parsed.password;
    }
    if (parsed.protocol === 'rediss:') {
      config.tls = { rejectUnauthorized: false };
    }
    return config;
  } catch (error) {
    logger.error({ error: error.message }, 'Invalid REDIS_URL value');
    throw error;
  }
}

const redisConfig = parseRedisConfig(redisUrl);
if (!redisUrl) {
  logger.warn('REDIS_URL not set; defaulting to redis://127.0.0.1:6379 for auto-apply queue');
} else {
  logger.info({ host: redisConfig.host, port: redisConfig.port }, 'Auto-apply queue using configured Redis');
}

/**
 * Apply to job using AI-powered form filling
 */
async function applyWithAI(jobUrl, user, jobData, resumePath = null) {
  let browser;

  try {
    logger.info('🚀 Launching browser for AI application (stealth mode)...');

    // Use centralized browser launcher with stealth mode
    const { launchStealthBrowser } = await import('./browser-launcher.js');
    browser = await launchStealthBrowser();

    const page = await browser.newPage();

    // Set a realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set user agent to look like a real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Remove webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Add realistic browser properties
    await page.evaluateOnNewDocument(() => {
      window.chrome = {
        runtime: {},
      };
    });

    // Randomize mouse movements
    await page.evaluateOnNewDocument(() => {
      const originalQuery = window.document.querySelector;
      window.document.querySelector = function(selector) {
        const element = originalQuery.call(document, selector);
        if (element) {
          element.addEventListener('click', () => {
            // Simulate human-like delay
            const delay = Math.random() * 100 + 50;
            setTimeout(() => {}, delay);
          });
        }
        return element;
      };
    });

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
      waitUntil: 'networkidle2',
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
        cost: fillResult.cost,
        details: fillResult
      };
    }

    logger.info('✅ AI successfully filled form!');
    logger.info(`   Fields filled: ${fillResult.fieldsFilled}/${fillResult.fieldsExtracted}`);
    logger.info(`   Cost: $${fillResult.cost.toFixed(4)}`);

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

    await browser.close();

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
        cost: fillResult.cost,
        screenshot: screenshot,
        confirmationData: {
          fieldsExtracted: fillResult.fieldsExtracted,
          fieldsFilled: fillResult.fieldsFilled,
          aiCost: fillResult.cost,
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
      cost: fillResult.cost,
      screenshot: screenshot,
      confirmationData: {
        fieldsExtracted: fillResult.fieldsExtracted,
        fieldsFilled: fillResult.fieldsFilled,
        aiCost: fillResult.cost,
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

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: error.message,
      method: 'AI_AUTO',
      cost: 0
    };
  }
}

// Create auto-apply queue
const autoApplyQueue = new Queue('auto-apply', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: false // Keep failed jobs for debugging
  }
});

/**
 * Process an auto-apply job
 * Concurrency limited to 2 to prevent OOM (each browser ~300MB RAM)
 */
autoApplyQueue.process(2, async (job) => {
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

    // Apply using AI-powered application (Puppeteer + GPT-4 Vision)
    // Note: Recipe engine requires BrowserUse which is not currently configured
    logger.info(`Applying with strategy: AI-ONLY (Puppeteer + AI)`);

    // Check if user has uploaded a custom resume (priority)
    const uploadedResume = profileData?.uploadedResume;

    let pdfContent, filename;

    if (uploadedResume?.content) {
      // Use uploaded resume (preferred)
      pdfContent = Buffer.from(uploadedResume.content, 'base64');
      filename = uploadedResume.filename || `resume_${user.id}.pdf`;
      logger.info({ filename }, '📄 Using user-uploaded resume');
    } else {
      // Fall back to most recent AI-generated resume
      const latestResumeJob = await prisma.job.findFirst({
        where: {
          userId: user.id,
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

      if (!latestResumeJob?.artifacts?.[0]) {
        throw new Error('No resume found - please either upload a resume or generate one before applying to jobs');
      }

      const pdfArtifact = latestResumeJob.artifacts[0];
      pdfContent = pdfArtifact.content;
      filename = pdfArtifact.metadata?.filename || `resume_${user.id}.pdf`;
      logger.info({ filename }, '📄 Using AI-generated resume');
    }

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

    // Use AI-powered application with Puppeteer
    logger.info('🤖 Attempting AI-powered application...');
    result = await applyWithAI(jobUrl, user, job.data, resumePath);

    // If AI fails, return error (don't fall back to BrowserUse)
    if (!result.success) {
      logger.error({ error: result.error, details: result }, 'AI application failed');
      // Note: Could fall back to recipe engine if BrowserUse API key is configured
      // But for now, we only support direct AI application
    }

    if (result.success) {
      // Application submitted successfully
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'SUBMITTED',
          method: result.method || 'AI_AUTO',
          submittedAt: new Date(),
          completedAt: new Date(),
          confirmationUrl: result.screenshot,
          confirmationId: result.confirmationId || null,
          confirmationData: result.confirmationData || {},
          cost: result.cost,
          retryCount: job.attemptsMade
        }
      });

      logger.info({
        applicationId,
        method: result.method,
        cost: result.cost
      }, '✅ Application submitted successfully');

      return {
        success: true,
        applicationId,
        cost: result.cost,
        method: result.method
      };

    } else {
      // Application failed
      const errorType = result.needsConfiguration ? 'CONFIGURATION_ERROR' :
                       result.needsInstall ? 'DEPENDENCY_ERROR' :
                       result.needsRecording ? 'NO_RECIPE' :
                       'APPLICATION_ERROR';

      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: {
          status: 'FAILED',
          error: result.error,
          errorType,
          completedAt: new Date(),
          cost: result.cost || 0,
          retryCount: job.attemptsMade
        }
      });

      logger.error({
        applicationId,
        error: result.error,
        errorType
      }, '❌ Application failed');

      throw new Error(result.error || 'Application failed');
    }

  } catch (error) {
    // Update application with error
    await prisma.autoApplication.update({
      where: { id: applicationId },
      data: {
        status: 'FAILED',
        error: error.message,
        errorType: 'PROCESSING_ERROR',
        completedAt: new Date(),
        retryCount: job.attemptsMade
      }
    }).catch(err => {
      logger.error({ error: err.message }, 'Failed to update application status');
    });

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

/**
 * Queue event listeners
 */
autoApplyQueue.on('completed', (job, result) => {
  logger.info({
    jobId: job.id,
    applicationId: job.data.applicationId,
    cost: result.cost
  }, 'Auto-apply job completed');
});

autoApplyQueue.on('failed', (job, error) => {
  logger.error({
    jobId: job.id,
    applicationId: job.data.applicationId,
    error: error.message,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts
  }, 'Auto-apply job failed');
});

autoApplyQueue.on('stalled', (job) => {
  logger.warn({
    jobId: job.id,
    applicationId: job.data.applicationId
  }, 'Auto-apply job stalled');
});

/**
 * Add a job to the queue
 */
export async function queueAutoApply({ applicationId, jobUrl, atsType, userId }) {
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
    jobId: `auto-apply-${applicationId}`, // Unique job ID
    attempts: 3
  });

  logger.info({ jobId: job.id, applicationId }, 'Auto-apply job queued');

  return job;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
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
    total: waiting + active + completed + failed + delayed
  };
}

/**
 * Get job status
 */
export async function getJobStatus(jobId) {
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
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanQueue() {
  const grace = 24 * 60 * 60 * 1000; // 24 hours

  await autoApplyQueue.clean(grace, 'completed');
  await autoApplyQueue.clean(grace, 'failed');

  logger.info('Queue cleaned');
}

export async function checkAutoApplyQueueConnection() {
  // Wait for queue to be ready
  await new Promise((resolve) => {
    if (autoApplyQueue.isReady()) {
      resolve();
    } else {
      autoApplyQueue.on('ready', resolve);
    }
  });
  
  const client = autoApplyQueue.client;
  await client.ping();
}

export default autoApplyQueue;
