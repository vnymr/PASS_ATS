/**
 * Worker-Assisted Auto-Apply Processor
 *
 * AI fills the form completely, then PAUSES for worker to click submit.
 * Worker sees the browser via noVNC and clicks the actual submit button.
 *
 * KEY DIFFERENCES FROM direct-auto-apply.js:
 * 1. Browser runs in HEADED mode (visible)
 * 2. Does NOT auto-submit - waits for worker
 * 3. Emits real-time status via WebSocket
 * 4. Browser stays open until worker completes
 */

import { prisma } from './prisma-client.js';
import logger from './logger.js';
import AIFormFiller from './ai-form-filler.js';
import {
  launchStealthBrowser,
  createStealthContext,
  createStealthContextCamoufox,
  applyStealthToPage,
  simulateHumanBrowsing
} from './browser-launcher.js';
import { getOrGenerateTailoredResume } from './direct-auto-apply.js';
import { workerWebSocket } from './worker-websocket.js';

const aiFormFiller = new AIFormFiller();

// Track active browser sessions (sessionId -> { browser, page, context })
const activeBrowserSessions = new Map();

/**
 * Process application for worker-assisted submit
 * AI fills everything, worker clicks submit
 */
export async function processForWorkerSubmit(session, workerId) {
  const { id: sessionId, autoApplication } = session;
  const { job, user } = autoApplication;

  let browser = null;
  let page = null;
  let resumePath = null;

  logger.info({
    sessionId,
    workerId,
    jobTitle: job.title,
    company: job.company
  }, '🚀 Starting worker-assisted auto-apply');

  try {
    // Update session status
    await prisma.workerSession.update({
      where: { id: sessionId },
      data: {
        status: 'AI_PROCESSING',
        aiStartedAt: new Date()
      }
    });

    // Notify worker: Starting
    workerWebSocket.notifyAiStarted(workerId, sessionId, {
      title: job.title,
      company: job.company,
      url: job.applyUrl
    });

    // ============================================
    // STEP 1: Launch VISIBLE browser
    // ============================================
    workerWebSocket.notifyAiProgress(workerId, sessionId, 'Launching browser...');

    const useCamoufox = process.env.USE_CAMOUFOX === 'true';

    browser = await launchStealthBrowser({
      headless: false,  // VISIBLE browser for worker
      slowMo: 50        // Slightly slower for human visibility
    });

    const sessionSeed = parseInt(sessionId.replace(/\D/g, '').slice(0, 8) || '12345', 10);

    const context = useCamoufox
      ? await createStealthContextCamoufox(browser, { applicationId: sessionId, sessionSeed, skipProxy: true })
      : await createStealthContext(browser, { applicationId: sessionId, sessionSeed, skipProxy: true });

    page = await context.newPage();
    await applyStealthToPage(page, { sessionSeed });

    // Store browser session for later cleanup
    activeBrowserSessions.set(sessionId, { browser, page, context });

    // Update session with browser info
    await prisma.workerSession.update({
      where: { id: sessionId },
      data: { browserSessionId: sessionId }
    });

    // ============================================
    // STEP 2: Navigate to job page
    // ============================================
    workerWebSocket.notifyAiProgress(workerId, sessionId, `Opening ${job.company} job page...`);

    await page.goto(job.applyUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for page to stabilize
    try {
      await page.waitForLoadState('load', { timeout: 20000 });
    } catch (e) {
      logger.debug('Load state timeout - continuing');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ============================================
    // STEP 3: Get/generate tailored resume
    // ============================================
    workerWebSocket.notifyAiProgress(workerId, sessionId, 'Preparing tailored resume...');

    const profileData = user.profile?.data || {};
    const resumeResult = await getOrGenerateTailoredResume(user.id, job, profileData);

    if (resumeResult) {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tempDir = path.join(os.tmpdir(), 'worker-auto-apply');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      resumePath = path.join(tempDir, resumeResult.filename);
      fs.writeFileSync(resumePath, resumeResult.pdfContent);
      logger.info({ resumePath, source: resumeResult.source }, 'Resume saved');
    }

    // ============================================
    // STEP 4: Simulate human browsing
    // ============================================
    workerWebSocket.notifyAiProgress(workerId, sessionId, 'Simulating human behavior...');

    if (!useCamoufox) {
      try {
        await simulateHumanBrowsing(page, { timeout: 5000 });
      } catch (e) {
        logger.debug('Human browsing simulation failed, continuing');
      }
    } else {
      // Simple scroll for Camoufox
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await new Promise(r => setTimeout(r, 1000));
    }

    // ============================================
    // STEP 5: Prepare user profile data
    // ============================================
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

    // ============================================
    // STEP 6: AI fills the form
    // ============================================
    workerWebSocket.notifyAiProgress(workerId, sessionId, 'AI analyzing and filling form...', { phase: 'filling' });

    const fillResult = await aiFormFiller.fillFormIntelligently(
      page,
      userProfile,
      { jobUrl: job.applyUrl, atsType: job.atsType },
      resumePath
    );

    logger.info({
      sessionId,
      fieldsFilled: fillResult.fieldsFilled,
      fieldsExtracted: fillResult.fieldsExtracted,
      hasCaptcha: fillResult.hasCaptcha
    }, 'Form filling complete');

    // ============================================
    // STEP 7: Handle CAPTCHA if present
    // ============================================
    if (fillResult.hasCaptcha) {
      workerWebSocket.notifyAiProgress(workerId, sessionId, 'Solving CAPTCHA...');
      try {
        await aiFormFiller.solveCaptcha(page);
        logger.info({ sessionId }, 'CAPTCHA solved');
      } catch (e) {
        logger.warn({ sessionId, error: e.message }, 'CAPTCHA solving failed - worker will handle');
      }
    }

    // ============================================
    // STEP 8: Scroll submit button into view
    // ============================================
    if (fillResult.submitButton) {
      try {
        await page.evaluate((selector) => {
          const btn = document.querySelector(selector);
          if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, fillResult.submitButton);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        logger.debug('Could not scroll to submit button');
      }
    }

    // ============================================
    // STEP 9: Take screenshot of filled form
    // ============================================
    let screenshot = null;
    try {
      const screenshotBuffer = await page.screenshot({ encoding: 'base64', fullPage: true });
      screenshot = `data:image/png;base64,${screenshotBuffer}`;
    } catch (e) {
      logger.warn('Failed to capture screenshot');
    }

    // ============================================
    // STEP 10: Mark as READY FOR SUBMIT
    // ============================================
    await prisma.workerSession.update({
      where: { id: sessionId },
      data: {
        status: 'READY_FOR_SUBMIT',
        aiCompletedAt: new Date(),
        formData: {
          fieldsFilled: fillResult.fieldsFilled,
          fieldsExtracted: fillResult.fieldsExtracted,
          submitButtonFound: !!fillResult.submitButton,
          submitButtonSelector: fillResult.submitButton,
          hasCaptcha: fillResult.hasCaptcha
        },
        screenshotUrl: screenshot
      }
    });

    // Notify worker: READY FOR SUBMIT
    workerWebSocket.notifyReadyForSubmit(workerId, sessionId, {
      fieldsFilled: fillResult.fieldsFilled,
      fieldsExtracted: fillResult.fieldsExtracted,
      submitButtonFound: !!fillResult.submitButton,
      screenshot
    });

    logger.info({
      sessionId,
      workerId,
      fieldsFilled: fillResult.fieldsFilled
    }, '✅ Form ready for worker submit');

    // ============================================
    // BROWSER STAYS OPEN
    // Worker will click submit in the browser
    // Browser closes when worker calls complete/fail
    // ============================================

    return {
      success: true,
      sessionId,
      status: 'READY_FOR_SUBMIT',
      fieldsFilled: fillResult.fieldsFilled
    };

  } catch (error) {
    logger.error({
      sessionId,
      error: error.message,
      stack: error.stack
    }, '❌ Worker auto-apply failed');

    // Even on error, try to keep browser open so worker can salvage
    if (browser && page) {
      // Take error screenshot
      let errorScreenshot = null;
      try {
        const buf = await page.screenshot({ encoding: 'base64', fullPage: true });
        errorScreenshot = `data:image/png;base64,${buf}`;
      } catch (e) {}

      await prisma.workerSession.update({
        where: { id: sessionId },
        data: {
          status: 'READY_FOR_SUBMIT', // Still let worker try manually
          aiCompletedAt: new Date(),
          screenshotUrl: errorScreenshot,
          formData: { error: error.message }
        }
      });

      workerWebSocket.notifyAiError(workerId, sessionId, error.message);

      return {
        success: false,
        sessionId,
        status: 'READY_FOR_SUBMIT',
        error: error.message
      };
    }

    // If browser failed to launch, mark as failed
    await prisma.workerSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        failReason: error.message
      }
    });

    throw error;
  }
}

/**
 * Close browser session when worker completes/fails
 */
export async function closeBrowserSession(sessionId) {
  const session = activeBrowserSessions.get(sessionId);
  if (session?.browser) {
    try {
      await session.browser.close();
      logger.info({ sessionId }, 'Browser session closed');
    } catch (e) {
      logger.warn({ sessionId, error: e.message }, 'Error closing browser');
    }
    activeBrowserSessions.delete(sessionId);
  }

  // Cleanup temp resume file if exists
  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const tempDir = path.join(os.tmpdir(), 'worker-auto-apply');
    // Cleanup old files (older than 1 hour)
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Get active browser page for session (for VNC/control)
 */
export function getActivePage(sessionId) {
  const session = activeBrowserSessions.get(sessionId);
  return session?.page || null;
}

/**
 * Check if session has active browser
 */
export function hasActiveBrowser(sessionId) {
  return activeBrowserSessions.has(sessionId);
}

/**
 * Get count of active browser sessions
 */
export function getActiveBrowserCount() {
  return activeBrowserSessions.size;
}

export default {
  processForWorkerSubmit,
  closeBrowserSession,
  getActivePage,
  hasActiveBrowser,
  getActiveBrowserCount
};
