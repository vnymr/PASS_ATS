/**
 * Worker API Routes
 * Endpoints for worker-assisted auto-apply system
 *
 * Workers see a queue of applications, AI fills forms, workers click submit
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma-client.js';
import logger from '../lib/logger.js';
import { authenticateWorker, generateWorkerToken, requireWorkerAdmin } from '../lib/worker-auth.js';
import { processForWorkerSubmit, closeBrowserSession, hasActiveBrowser } from '../lib/worker-submit-apply.js';

const router = express.Router();

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

/**
 * POST /api/worker/auth/login
 * Worker login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const worker = await prisma.worker.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!worker) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!worker.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const validPassword = await bcrypt.compare(password, worker.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateWorkerToken(worker);

    // Update last active
    await prisma.worker.update({
      where: { id: worker.id },
      data: { lastActiveAt: new Date() }
    });

    logger.info({ workerId: worker.id }, 'Worker logged in');

    res.json({
      token,
      worker: {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        role: worker.role
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Worker login failed');
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/worker/auth/me
 * Get current worker info
 */
router.get('/auth/me', authenticateWorker, async (req, res) => {
  res.json({
    worker: {
      id: req.worker.id,
      name: req.worker.name,
      email: req.worker.email,
      role: req.worker.role,
      totalCompleted: req.worker.totalCompleted,
      totalFailed: req.worker.totalFailed
    }
  });
});

// ============================================
// QUEUE MANAGEMENT
// ============================================

/**
 * GET /api/worker/queue
 * Get pending applications for workers
 */
router.get('/queue', authenticateWorker, async (req, res) => {
  try {
    const sessions = await prisma.workerSession.findMany({
      where: {
        status: 'QUEUED'
      },
      include: {
        autoApplication: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                company: true,
                location: true,
                applyUrl: true,
                atsType: true
              }
            },
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { queuedAt: 'asc' },
      take: 50
    });

    res.json({
      queue: sessions,
      count: sessions.length
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch queue');
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

/**
 * GET /api/worker/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', authenticateWorker, async (req, res) => {
  try {
    const [queued, processing, readyForSubmit, completedToday, failedToday] = await Promise.all([
      prisma.workerSession.count({ where: { status: 'QUEUED' } }),
      prisma.workerSession.count({ where: { status: 'AI_PROCESSING' } }),
      prisma.workerSession.count({ where: { status: 'READY_FOR_SUBMIT' } }),
      prisma.workerSession.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }),
      prisma.workerSession.count({
        where: {
          status: 'FAILED',
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      })
    ]);

    res.json({
      queued,
      processing,
      readyForSubmit,
      completedToday,
      failedToday,
      total: queued + processing + readyForSubmit
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch queue stats');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// APPLICATION PROCESSING
// ============================================

/**
 * POST /api/worker/start-next
 * Claim and start the next available application
 */
router.post('/start-next', authenticateWorker, async (req, res) => {
  try {
    // Find next queued session
    const session = await prisma.workerSession.findFirst({
      where: { status: 'QUEUED' },
      include: {
        autoApplication: {
          include: {
            job: true,
            user: {
              include: { profile: true }
            }
          }
        }
      },
      orderBy: { queuedAt: 'asc' }
    });

    if (!session) {
      return res.json({ empty: true, message: 'No jobs in queue' });
    }

    // Claim the session atomically
    const claimed = await prisma.workerSession.updateMany({
      where: {
        id: session.id,
        status: 'QUEUED' // Only if still queued
      },
      data: {
        status: 'ASSIGNED',
        workerId: req.worker.id,
        assignedAt: new Date()
      }
    });

    if (claimed.count === 0) {
      return res.status(409).json({ error: 'Session was claimed by another worker' });
    }

    // Get updated session
    const claimedSession = await prisma.workerSession.findUnique({
      where: { id: session.id },
      include: {
        autoApplication: {
          include: {
            job: true,
            user: { include: { profile: true } }
          }
        }
      }
    });

    // Start processing (async - don't await)
    processForWorkerSubmit(claimedSession, req.worker.id).catch(err => {
      logger.error({ sessionId: session.id, error: err.message }, 'Worker processing failed');
    });

    logger.info({
      sessionId: session.id,
      workerId: req.worker.id,
      jobTitle: session.autoApplication.job.title
    }, 'Worker started application');

    res.json({
      session: {
        id: claimedSession.id,
        status: 'ASSIGNED',
        job: {
          title: claimedSession.autoApplication.job.title,
          company: claimedSession.autoApplication.job.company,
          url: claimedSession.autoApplication.job.applyUrl
        }
      },
      message: 'Application started - AI is filling the form'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start next application');
    res.status(500).json({ error: 'Failed to start application' });
  }
});

/**
 * POST /api/worker/session/:id/complete
 * Mark application as successfully submitted
 */
router.post('/session/:id/complete', authenticateWorker, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const session = await prisma.workerSession.findUnique({
      where: { id },
      include: { autoApplication: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.workerId !== req.worker.id) {
      return res.status(403).json({ error: 'Not your session' });
    }

    // Close browser
    await closeBrowserSession(id);

    // Update session
    await prisma.workerSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        submittedAt: new Date(),
        completedAt: new Date(),
        workerNotes: notes
      }
    });

    // Update main application
    await prisma.autoApplication.update({
      where: { id: session.autoApplicationId },
      data: {
        status: 'SUBMITTED',
        method: 'WORKER_SUBMIT',
        submittedAt: new Date(),
        completedAt: new Date()
      }
    });

    // Update worker stats
    await prisma.worker.update({
      where: { id: req.worker.id },
      data: {
        totalCompleted: { increment: 1 },
        lastActiveAt: new Date()
      }
    });

    logger.info({
      sessionId: id,
      workerId: req.worker.id
    }, '✅ Worker completed application');

    res.json({ success: true, message: 'Application marked as completed' });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to complete session');
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

/**
 * POST /api/worker/session/:id/fail
 * Mark application as failed
 */
router.post('/session/:id/fail', authenticateWorker, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    const session = await prisma.workerSession.findUnique({
      where: { id },
      include: { autoApplication: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.workerId !== req.worker.id) {
      return res.status(403).json({ error: 'Not your session' });
    }

    // Close browser
    await closeBrowserSession(id);

    // Update session
    await prisma.workerSession.update({
      where: { id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        failReason: reason,
        workerNotes: notes
      }
    });

    // Update main application
    await prisma.autoApplication.update({
      where: { id: session.autoApplicationId },
      data: {
        status: 'FAILED',
        method: 'WORKER_SUBMIT',
        error: reason || 'Worker marked as failed',
        completedAt: new Date()
      }
    });

    // Update worker stats
    await prisma.worker.update({
      where: { id: req.worker.id },
      data: {
        totalFailed: { increment: 1 },
        lastActiveAt: new Date()
      }
    });

    logger.warn({
      sessionId: id,
      workerId: req.worker.id,
      reason
    }, '❌ Worker marked application as failed');

    res.json({ success: true, message: 'Application marked as failed' });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to mark session as failed');
    res.status(500).json({ error: 'Failed to update session' });
  }
});

/**
 * POST /api/worker/session/:id/skip
 * Skip application (return to queue or mark as skipped)
 */
router.post('/session/:id/skip', authenticateWorker, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, returnToQueue = false } = req.body;

    const session = await prisma.workerSession.findUnique({ where: { id } });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.workerId !== req.worker.id) {
      return res.status(403).json({ error: 'Not your session' });
    }

    // Close browser
    await closeBrowserSession(id);

    if (returnToQueue) {
      // Return to queue for another worker
      await prisma.workerSession.update({
        where: { id },
        data: {
          status: 'QUEUED',
          workerId: null,
          assignedAt: null,
          aiStartedAt: null,
          aiCompletedAt: null,
          skipReason: reason
        }
      });

      res.json({ success: true, message: 'Returned to queue' });
    } else {
      // Mark as skipped
      await prisma.workerSession.update({
        where: { id },
        data: {
          status: 'SKIPPED',
          completedAt: new Date(),
          skipReason: reason
        }
      });

      await prisma.worker.update({
        where: { id: req.worker.id },
        data: {
          totalSkipped: { increment: 1 }
        }
      });

      res.json({ success: true, message: 'Application skipped' });
    }

    logger.info({
      sessionId: id,
      workerId: req.worker.id,
      returnedToQueue: returnToQueue,
      reason
    }, 'Worker skipped application');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to skip session');
    res.status(500).json({ error: 'Failed to skip session' });
  }
});

/**
 * GET /api/worker/session/:id
 * Get session details
 */
router.get('/session/:id', authenticateWorker, async (req, res) => {
  try {
    const session = await prisma.workerSession.findUnique({
      where: { id: req.params.id },
      include: {
        autoApplication: {
          include: {
            job: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      session,
      hasBrowser: hasActiveBrowser(session.id)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ============================================
// WORKER STATS
// ============================================

/**
 * GET /api/worker/stats/me
 * Get current worker's stats
 */
router.get('/stats/me', authenticateWorker, async (req, res) => {
  try {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [todayCompleted, todayFailed, recentSessions] = await Promise.all([
      prisma.workerSession.count({
        where: {
          workerId: req.worker.id,
          status: 'COMPLETED',
          completedAt: { gte: todayStart }
        }
      }),
      prisma.workerSession.count({
        where: {
          workerId: req.worker.id,
          status: 'FAILED',
          completedAt: { gte: todayStart }
        }
      }),
      prisma.workerSession.findMany({
        where: { workerId: req.worker.id },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: {
          autoApplication: {
            include: {
              job: { select: { title: true, company: true } }
            }
          }
        }
      })
    ]);

    res.json({
      today: {
        completed: todayCompleted,
        failed: todayFailed,
        total: todayCompleted + todayFailed
      },
      allTime: {
        completed: req.worker.totalCompleted,
        failed: req.worker.totalFailed,
        skipped: req.worker.totalSkipped
      },
      recentSessions
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/worker/stats/leaderboard
 * Get all workers stats (admin only in future)
 */
router.get('/stats/leaderboard', authenticateWorker, async (req, res) => {
  try {
    const workers = await prisma.worker.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        totalCompleted: true,
        totalFailed: true,
        lastActiveAt: true
      },
      orderBy: { totalCompleted: 'desc' },
      take: 20
    });

    res.json({ leaderboard: workers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /api/worker/admin/create-worker
 * Create a new worker account (admin only)
 */
router.post('/admin/create-worker', authenticateWorker, requireWorkerAdmin, async (req, res) => {
  try {
    const { email, password, name, role = 'OPERATOR' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const worker = await prisma.worker.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role
      }
    });

    logger.info({ workerId: worker.id, createdBy: req.worker.id }, 'New worker created');

    res.json({
      worker: {
        id: worker.id,
        email: worker.email,
        name: worker.name,
        role: worker.role
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Worker with this email already exists' });
    }
    logger.error({ error: error.message }, 'Failed to create worker');
    res.status(500).json({ error: 'Failed to create worker' });
  }
});

/**
 * POST /api/worker/admin/queue-for-worker
 * Add an application to the worker queue
 */
router.post('/admin/queue-for-worker', authenticateWorker, requireWorkerAdmin, async (req, res) => {
  try {
    const { autoApplicationId } = req.body;

    if (!autoApplicationId) {
      return res.status(400).json({ error: 'autoApplicationId required' });
    }

    // Check if application exists
    const application = await prisma.autoApplication.findUnique({
      where: { id: autoApplicationId }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if already has worker session
    const existing = await prisma.workerSession.findUnique({
      where: { autoApplicationId }
    });

    if (existing) {
      return res.status(409).json({ error: 'Application already in worker queue' });
    }

    // Create worker session
    const session = await prisma.workerSession.create({
      data: {
        autoApplicationId,
        status: 'QUEUED'
      }
    });

    logger.info({
      sessionId: session.id,
      autoApplicationId,
      queuedBy: req.worker.id
    }, 'Application added to worker queue');

    res.json({ session });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to queue for worker');
    res.status(500).json({ error: 'Failed to queue application' });
  }
});

export default router;
