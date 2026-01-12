// Global error handlers - MUST be first to catch all errors
// Prevents process crash from unhandled Redis/queue errors
process.on('unhandledRejection', (reason, promise) => {
  // Check if this is a Redis-related error that we can safely ignore
  const errorMessage = reason?.message || String(reason);
  const isRedisError = errorMessage.includes('ENOTFOUND') ||
                       errorMessage.includes('ECONNREFUSED') ||
                       errorMessage.includes('Redis') ||
                       errorMessage.includes('redis') ||
                       errorMessage.includes('enableOfflineQueue');

  if (isRedisError) {
    console.warn('[Redis] Non-fatal unhandled rejection (Redis unavailable):', errorMessage);
    // Don't crash - Redis is optional
    return;
  }

  // Log other unhandled rejections but don't crash immediately
  console.error('[CRITICAL] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  // Check if this is a Redis-related error
  const errorMessage = error?.message || String(error);
  const isRedisError = errorMessage.includes('ENOTFOUND') ||
                       errorMessage.includes('ECONNREFUSED') ||
                       errorMessage.includes('Redis') ||
                       errorMessage.includes('redis');

  if (isRedisError) {
    console.warn('[Redis] Non-fatal uncaught exception (Redis unavailable):', errorMessage);
    // Don't crash - Redis is optional
    return;
  }

  // For other errors, log and exit gracefully
  console.error('[CRITICAL] Uncaught exception:', error);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from './lib/prisma-client.js';
import dotenv from 'dotenv';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { fileURLToPath } from 'url';
import path from 'path';
import multer from 'multer';
import {
  exchangeCodeForTokens as gmailExchangeCodeForTokens,
  getGmailAddress as gmailGetGmailAddress,
  saveGmailConnection as gmailSaveGmailConnection
} from './lib/gmail-oauth.js';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import { apiRateLimit, apiLimiters, getApiRateLimiterHealth } from './lib/api-rate-limiter.js';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Import parse libraries
import mammoth from 'mammoth';
import fs from 'fs';
// Import AI Resume Generator
import AIResumeGenerator from './lib/ai-resume-generator.js';
// Import Gemini Resume Generator (AI-native approach)
import { GeminiResumeGenerator, generateAndCompile as geminiGenerateAndCompile, isAvailable as isGeminiAvailable } from './lib/gemini-resume-generator.js';

// Lazy load PDF.js to avoid initialization issues
let pdfjs = null;
async function getPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjs;
}

/**
 * Extract text from PDF buffer using PDF.js
 */
async function extractPdfText(buffer) {
  const pdfjsLib = await getPdfJs();
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}
import { config, getOpenAIModel } from './lib/config.js';
import { startRoutineExecutor, stopRoutineExecutor } from './lib/routine-executor.js';
import dataValidator from './lib/utils/dataValidator.js';
import ResumeParser from './lib/resume-parser.js';
// Import job sync services for automated job discovery
import jobSyncService from './lib/job-sync-service.js';
import smartJobSync from './lib/smart-job-sync.js';
// Import HTML PDF generator (replaces LaTeX compiler)
import { generatePDFWithRetry as compileHtml } from './lib/html-pdf-generator.js';
import { generateHTML } from './lib/html-templates.js';
// Import production logger
import logger, { authLogger, jobLogger, requestLogger, compileLogger, aiLogger } from './lib/logger.js';
// Import input validator
import { validateJobDescription, validateEmail, validatePassword, sanitizeProfileData } from './lib/input-validator.js';
// Import file validator
import { validateUploadedFile } from './lib/file-validator.js';
// Import resume queue for concurrent processing
import { queueResumeForParsing, getResumeParsingStatus } from './lib/resume-queue.js';

// Load environment variables - .env first, then .env.local to override
// Note: Prisma client loads dotenv internally, but we load it here for other parts of the code
dotenv.config();
dotenv.config({ path: '.env.local' });

// Override for production if needed
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  dotenv.config();
}

// Initialize Clerk if keys are available
let clerkClient = null;
logger.info({
  clerkConfigured: !!(process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY !== 'YOUR_CLERK_SECRET_KEY')
}, 'Checking Clerk configuration');

if (process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY !== 'YOUR_CLERK_SECRET_KEY') {
  clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  logger.info('Clerk authentication enabled');
} else {
  logger.warn('Clerk authentication not configured, using legacy JWT auth');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy - required for Railway/production deployments behind reverse proxy
app.set('trust proxy', 1);

const upload = multer({ storage: multer.memoryStorage() });

// Rate limiting configuration - optimized for 1000+ concurrent users
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 for high traffic
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Increased from 10 to 20 for legitimate retries
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const jobProcessingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Increased from 20 to 50 for paid users
  message: 'Too many resume generation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many resume generation requests, please try again later'
    });
  }
});

// Environment validation
function validateEnvironment() {
  // Redis is now optional - app will work without it (queue features disabled)
  const required = ['JWT_SECRET', 'OPENAI_API_KEY', 'DATABASE_URL', 'STRIPE_SECRET_KEY'];
  const optional = ['REDIS_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }

  logger.info('🚀 Environment validated successfully');
  logger.info('   - Node Environment:', process.env.NODE_ENV || 'development');
  logger.info('   - Port:', process.env.PORT || '3000');
  logger.info('   - OpenAI API Key:', '✅ Present');
  logger.info('   - Database URL:', '✅ Present');
  logger.info('   - Redis URL:', process.env.REDIS_URL ? '✅ Present' : '⚠️ Not configured (queue features disabled)');
  logger.info('   - Stripe Secret:', '✅ Present');
}

validateEnvironment();

// Middleware - CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all chrome-extension:// origins
    if (origin && origin.startsWith('chrome-extension://')) {
      requestLogger.cors(origin, true);
      return callback(null, true);
    }

    const allowed = config.server.allowedOrigins.indexOf(origin) !== -1;
    requestLogger.cors(origin, allowed);

    callback(null, allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Enable pre-flight for all routes
app.options('*', cors(corsOptions));

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Stripe webhook - MUST come before express.json() middleware
app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error({ error: err.message }, 'Stripe webhook signature verification failed');
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.client_reference_id);
      const tier = session.metadata.tier;

      try {
        await prisma.subscription.create({
          data: {
            userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            tier,
            status: 'ACTIVE'
          }
        });
        logger.info({ userId, tier }, 'Subscription created from webhook');
      } catch (error) {
        logger.error({ error: error.message }, 'Failed to create subscription from webhook');
      }
    }

    res.json({ received: true });
  }
);

// Request size limits to prevent DoS attacks
// 100kb is generous for chat messages while preventing payload bombs
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Security: Block access to sensitive files and directories
app.use((req, res, next) => {
  const blockedPaths = [
    /^\/\.git/,
    /^\/\.env/,
    /^\/\.claude/,
    /\/\.git\//,
    /\/\.env/,
    /\/node_modules\//,
    /\/\.DS_Store/,
  ];

  if (blockedPaths.some(pattern => pattern.test(req.path))) {
    logger.warn({ path: req.path, ip: req.ip }, 'Blocked access to sensitive path');
    return res.status(404).send('Not Found');
  }

  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Basic health check without database dependency
    const rateLimiterHealth = getApiRateLimiterHealth();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        server: 'running',
        rateLimiter: rateLimiterHealth.type // 'redis' or 'memory'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Public stats endpoint - no auth required
app.get('/api/stats/resumes', async (req, res) => {
  try {
    const count = await prisma.artifact.count({
      where: { type: 'PDF_OUTPUT' }
    });

    res.json({
      totalResumes: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch resume count');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Public template preview endpoint - no auth required for default templates
// Cache for compiled PDF previews
const templatePreviewCache = new Map();

app.get('/api/templates/:id/preview-image', async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow default templates without auth
    if (!id.startsWith('default_')) {
      return res.status(401).json({ error: 'Authentication required for custom templates' });
    }

    // Check cache first
    if (templatePreviewCache.has(id)) {
      logger.debug(`Preview cache hit for ${id}`);
      return res.json({
        success: true,
        pdf: templatePreviewCache.get(id),
        mimeType: 'application/pdf',
        cached: true
      });
    }

    // Get template from html-templates
    const { TEMPLATES } = await import('./lib/html-templates.js');
    const templateKey = id.replace('default_', '');
    const template = TEMPLATES[templateKey];

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    // Sample data for preview (HTML format)
    const SAMPLE_DATA = {
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '(555) 123-4567',
      location: 'San Francisco, CA',
      linkedin: 'https://linkedin.com/in/johnsmith',
      summary: 'Results-driven software engineer with 5+ years of experience building scalable web applications.',
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Company Inc.',
          location: 'San Francisco, CA',
          startDate: 'Jan 2022',
          endDate: 'Present',
          highlights: [
            'Led development of microservices architecture serving 1M+ daily active users',
            'Reduced API response times by 40% through optimization and caching strategies'
          ]
        },
        {
          title: 'Software Engineer',
          company: 'Startup Co.',
          location: 'New York, NY',
          startDate: 'Jun 2019',
          endDate: 'Dec 2021',
          highlights: [
            'Built real-time collaboration features using WebSocket and Redis'
          ]
        }
      ],
      education: [
        {
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science',
          field: 'Computer Science',
          location: 'Berkeley, CA',
          endDate: '2019'
        }
      ],
      skills: [
        { category: 'Languages', items: ['JavaScript', 'TypeScript', 'Python', 'Go'] },
        { category: 'Frameworks', items: ['React', 'Node.js', 'Next.js', 'Express'] }
      ],
      projects: [
        {
          name: 'Open Source Project',
          technologies: ['TypeScript', 'React'],
          highlights: ['Created developer tool with 500+ GitHub stars']
        }
      ]
    };

    // Generate HTML and compile to PDF
    const html = generateHTML(SAMPLE_DATA, templateKey);
    const pdfBuffer = await compileHtml(html);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Cache the result
    templatePreviewCache.set(id, pdfBase64);
    logger.info(`Cached preview for ${id}`);

    res.json({
      success: true,
      pdf: pdfBase64,
      mimeType: 'application/pdf',
      cached: false
    });

  } catch (error) {
    logger.error({ error: error.message, templateId: req.params.id }, 'Failed to generate preview image');
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview: ' + error.message
    });
  }
});

// Database health check (separate endpoint)
app.get('/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Authentication middleware
// Enhanced authentication middleware that supports both Clerk and legacy JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  authLogger.attempt({
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    hasClerkClient: !!clerkClient
  });

  if (!token) {
    authLogger.failure('No token provided', 'none');
    return res.status(401).json({ error: 'Access token required' });
  }

  // Try Clerk authentication first if available
  if (clerkClient) {
    try {
      // Verify the Clerk session token with options to handle expiration
      const sessionClaims = await clerkClient.verifyToken(token, {
        // Allow some clock skew (5 minutes) to handle minor time sync issues
        clockSkewInMs: 300000
      });

      // Get or create user in our database with error handling
      let user;
      try {
        user = await prisma.user.findUnique({
          where: { clerkId: sessionClaims.sub }
        });

        if (!user) {
          // Create user if doesn't exist
          try {
            user = await prisma.user.create({
              data: {
                clerkId: sessionClaims.sub,
                email: sessionClaims.email || `${sessionClaims.sub}@clerk.user`,
                password: 'clerk-managed' // Placeholder since Clerk manages auth
              }
            });
          } catch (createError) {
            // If create fails (maybe concurrent request created user), try to fetch again
            if (createError.code === 'P2002') { // Unique constraint violation
              user = await prisma.user.findUnique({
                where: { clerkId: sessionClaims.sub }
              });
            } else {
              throw createError;
            }
          }
        }
      } catch (dbError) {
        // Don't fall through to JWT if database error - return 503 to prevent cascade
        authLogger.failure(`Database error: ${dbError.message}`, 'clerk');
        return res.status(503).json({
          error: 'Database temporarily unavailable',
          code: 'DATABASE_ERROR',
          message: 'Please try again in a moment.'
        });
      }

      req.user = { id: user.id, email: user.email, clerkId: user.clerkId };
      req.userId = user.id;
      authLogger.success(user.id, 'clerk');
      return next();
    } catch (clerkError) {
      // If token is expired, return 401 with specific error for client to refresh
      if (clerkError.message && clerkError.message.includes('expired')) {
        authLogger.tokenExpired(clerkError.message);
        return res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please refresh the page.'
        });
      }

      // If it's a database error, don't fall through - return error directly
      if (clerkError.code && (clerkError.code.startsWith('P') || clerkError.message?.includes('database') || clerkError.message?.includes('Can\'t reach database'))) {
        authLogger.failure(`Database error: ${clerkError.message}`, 'clerk');
        return res.status(503).json({
          error: 'Database temporarily unavailable',
          code: 'DATABASE_ERROR',
          message: 'Please try again in a moment.'
        });
      }

      authLogger.failure(clerkError.message, 'clerk');
      // For other Clerk errors (not database), fall through to legacy JWT auth
    }
  }

  // Legacy JWT authentication
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      authLogger.failure(err.message, 'jwt');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // For legacy tokens, ensure user exists with error handling
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!user) {
        authLogger.failure('User not found', 'jwt');
        return res.status(403).json({ error: 'User not found' });
      }

      req.user = decoded;
      req.userId = decoded.id;
      authLogger.success(decoded.id, 'jwt');
      next();
    } catch (dbError) {
      // Handle database errors in JWT path too
      authLogger.failure(`Database error: ${dbError.message}`, 'jwt');
      return res.status(503).json({
        error: 'Database temporarily unavailable',
        code: 'DATABASE_ERROR',
        message: 'Please try again in a moment.'
      });
    }
  });
};


// Auth endpoints
app.post('/api/register', authLimiter, async (req, res) => {
  logger.info({ email: req.body.email?.substring(0, 3) + '***' }, 'Registration request received');
  try {
    const { email, password } = req.body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.errors[0] });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.errors.join(', ') });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: emailValidation.sanitized }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Use 12 rounds for better security (up from 10)
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: emailValidation.sanitized,
        password: hashedPassword
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info({ userId: user.id }, 'User registered successfully');
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Registration error');
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * Merge processedAdditionalInfo and fullData into top-level arrays with deduplication
 */
function mergeIntoTopLevel(profileData) {
  // Ensure arrays exist at the top level
  profileData.experiences = profileData.experiences || [];
  profileData.skills = profileData.skills || [];
  profileData.education = profileData.education || [];
  profileData.projects = profileData.projects || [];
  profileData.certifications = profileData.certifications || [];

  // Merge from processedAdditionalInfo if present
  if (profileData.processedAdditionalInfo) {
    const processed = profileData.processedAdditionalInfo;

    if (processed.newSkills) {
      profileData.skills = dataValidator.mergeArraysWithDedupe(
        profileData.skills,
        processed.newSkills,
        dataValidator.dedupeSkills
      );
    }

    if (processed.newExperiences) {
      profileData.experiences = dataValidator.mergeArraysWithDedupe(
        profileData.experiences,
        processed.newExperiences,
        dataValidator.dedupeExperiences
      );
    }

    if (processed.newProjects) {
      profileData.projects = dataValidator.mergeArraysWithDedupe(
        profileData.projects,
        processed.newProjects,
        dataValidator.dedupeProjects
      );
    }

    if (processed.newCertifications) {
      profileData.certifications = dataValidator.mergeArraysWithDedupe(
        profileData.certifications,
        processed.newCertifications,
        dataValidator.dedupeCertifications
      );
    }
  }

  // Merge from fullData if present
  if (profileData.fullData) {
    const full = profileData.fullData;

    if (full.skills) {
      profileData.skills = dataValidator.mergeArraysWithDedupe(
        profileData.skills,
        full.skills,
        dataValidator.dedupeSkills
      );
    }

    if (full.experiences) {
      profileData.experiences = dataValidator.mergeArraysWithDedupe(
        profileData.experiences,
        full.experiences,
        dataValidator.dedupeExperiences
      );
    }

    if (full.education && !profileData.education.length) {
      // For education, only add if top-level is empty (no dedupe logic implemented)
      profileData.education = full.education;
    }

    if (full.projects) {
      profileData.projects = dataValidator.mergeArraysWithDedupe(
        profileData.projects,
        full.projects,
        dataValidator.dedupeProjects
      );
    }

    if (full.certifications) {
      profileData.certifications = dataValidator.mergeArraysWithDedupe(
        profileData.certifications,
        full.certifications,
        dataValidator.dedupeCertifications
      );
    }
  }

  // Keep resumeText and additionalInfo as raw fields for traceability
  // They are already in profileData, so we don't need to modify them

  return profileData;
}

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = await prisma.user.findUnique({
      where: { email: emailValidation.sanitized }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info({ userId: user.id }, 'User logged in');
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
});

// Profile endpoints
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Add download URL if resume is saved
    const profileData = { ...profile.data };
    if (profileData.savedResumeBuffer) {
      profileData.savedResumeUrl = `/api/profile/resume-download`;
    }

    // Check if profile is complete (has minimum required data)
    const hasExperience = (profileData.experiences || profileData.experience || []).length > 0;
    const hasEducation = (profileData.education || []).length > 0;
    const hasResumeText = profileData.resumeText && profileData.resumeText.trim().length > 100;
    profileData.isComplete = hasExperience || hasEducation || hasResumeText;

    // Return the profile data directly, not wrapped in a profile object
    logger.debug({ userId, profileSize: JSON.stringify(profileData).length, isComplete: profileData.isComplete }, 'Returning profile data');
    res.json(profileData);
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    logger.info('📝 Profile update request for user:', req.user.email);

    // Clean and sanitize the data - remove null characters and undefined values
    const cleanData = (obj) => {
      if (typeof obj === 'string') {
        return obj.replace(/\u0000/g, '').trim();
      }
      if (Array.isArray(obj)) {
        return obj.map(cleanData).filter(item => item !== null && item !== undefined);
      }
      if (obj && typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== null && value !== undefined) {
            cleaned[key] = cleanData(value);
          }
        }
        return cleaned;
      }
      return obj;
    };

    const cleanedBody = cleanData(req.body);
    logger.debug({ userId, dataSize: JSON.stringify(cleanedBody).length }, 'Cleaned profile data');

    // Process additional information if present
    let processedData = cleanedBody;
    if (cleanedBody.additionalInfo && typeof cleanedBody.additionalInfo === 'string' && cleanedBody.additionalInfo.trim().length > 0) {
      try {
        logger.info('🤖 Processing additional information...');
        logger.info(`   - Additional info length: ${cleanedBody.additionalInfo.length} characters`);
        // processedData = await processAdditionalInformation(cleanedBody);
        // For now, just pass through the data as-is
        processedData = cleanedBody;
        logger.info('✅ Additional information stored');

        // Log what was extracted
        if (processedData.processedAdditionalInfo) {
          const { newSkills, newExperiences, newProjects, newCertifications } = processedData.processedAdditionalInfo;
          logger.info(`   - Extracted: ${newSkills?.length || 0} skills, ${newExperiences?.length || 0} experiences, ${newProjects?.length || 0} projects, ${newCertifications?.length || 0} certifications`);
        }
      } catch (aiError) {
        logger.error('⚠️ Failed to process additional information:', aiError.message);
        // Keep the cleaned data even if AI processing fails
        processedData = cleanedBody;
        processedData._processingError = aiError.message;
      }
    }

    // Validate the profile structure
    // processedData = validateProfileStructure(processedData);
    // Skip validation for now - just use the data as-is

    // Merge processedAdditionalInfo and fullData into top-level arrays
    processedData = mergeIntoTopLevel(processedData);

    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        data: processedData,
        updatedAt: new Date()
      },
      create: {
        userId,
        data: processedData
      }
    });

    logger.info('✅ Profile updated successfully with processed data');
    res.json(profile);
  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload resume PDF for auto-apply
app.post('/api/profile/upload-resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported for auto-apply' });
    }

    const userId = req.userId;
    const filename = req.file.originalname;
    const fileSize = req.file.size;

    // Convert buffer to base64 for storage
    const base64Content = req.file.buffer.toString('base64');

    logger.info({ userId, filename, fileSize }, '📄 Saving uploaded resume to profile');

    // Get existing profile
    const existingProfile = await prisma.profile.findUnique({
      where: { userId }
    });

    if (!existingProfile) {
      return res.status(404).json({ error: 'Profile not found. Please create a profile first.' });
    }

    // Add uploaded resume to profile data
    const profileData = existingProfile.data;
    profileData.uploadedResume = {
      content: base64Content,
      filename,
      uploadedAt: new Date().toISOString(),
      size: fileSize
    };

    // Update profile with uploaded resume
    await prisma.profile.update({
      where: { userId },
      data: {
        data: profileData,
        updatedAt: new Date()
      }
    });

    logger.info({ userId, filename }, '✅ Resume uploaded and saved to profile');

    res.json({
      success: true,
      message: 'Resume uploaded successfully',
      filename,
      size: fileSize
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Resume upload error');
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

// Parse resume endpoint - extract information from uploaded resume
// Now supports both sync (immediate) and async (queued) parsing
app.post('/api/parse-resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const useQueue = req.query.async === 'true' || req.body.async === 'true';

    logger.info('📄 Parsing resume:', req.file.originalname, useQueue ? '(queued)' : '(immediate)');

    if (useQueue) {
      // Queue for async processing (recommended for high concurrency)
      const { jobId, status } = await queueResumeForParsing(
        req.userId,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        false // Don't merge with profile, just parse
      );

      logger.info('✅ Resume queued for parsing:', jobId);
      res.json({
        jobId,
        status,
        message: 'Resume queued for parsing. Use /api/resume-status/:jobId to check progress.'
      });
    } else {
      // Immediate parsing (legacy, for small files)
      const parser = new ResumeParser();
      const { text, extractedData } = await parser.parseResume(req.file.buffer, req.file.mimetype);

      logger.info('✅ Resume parsed successfully');
      res.json({
        resumeText: text,
        extractedData
      });
    }
  } catch (error) {
    logger.error('Resume parse error:', error);
    res.status(500).json({ error: 'Failed to parse resume' });
  }
});

// Get resume parsing job status
app.get('/api/resume-status/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await getResumeParsingStatus(jobId);

    res.json(status);
  } catch (error) {
    logger.error('Job status error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Save profile with resume endpoint
// Now supports async resume processing for better concurrency
app.post('/api/profile/with-resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    const profileData = JSON.parse(req.body.profile);
    const useQueue = req.query.async === 'true' || req.body.async === 'true';
    let resumeBuffer = null;

    if (req.file) {
      logger.info('📎 Saving resume file:', req.file.originalname);
      resumeBuffer = req.file.buffer;

      if (useQueue) {
        // Queue resume for async parsing and merging with profile
        const { jobId, status } = await queueResumeForParsing(
          req.userId,
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname,
          true // Merge with existing profile
        );

        logger.info('✅ Resume queued for parsing and profile merge:', jobId);

        // Return job ID for status tracking
        return res.json({
          jobId,
          status,
          message: 'Resume queued for processing. Your profile will be updated when parsing completes.',
          profileData: profileData // Return the non-resume data immediately
        });
      } else {
        // Immediate parsing (legacy/small files)
        if (!profileData.resumeText) {
          const parser = new ResumeParser();
          const { text } = await parser.parseResume(resumeBuffer, req.file.mimetype);
          profileData.resumeText = text;
        }
      }
    }

    // Clean and validate profile data
    const cleanedData = {
      ...profileData,
      savedResumeBuffer: resumeBuffer ? resumeBuffer.toString('base64') : null,
      savedResumeMimeType: req.file ? req.file.mimetype : null,
      savedResumeFilename: req.file ? req.file.originalname : null
    };

    // Save profile (merge with existing data using upsert)
    const profile = await prisma.profile.upsert({
      where: { userId: req.userId },
      update: {
        data: cleanedData,
        updatedAt: new Date()
      },
      create: {
        userId: req.userId,
        data: cleanedData
      }
    });

    logger.info('✅ Profile saved with resume');
    res.json(profile);
  } catch (error) {
    logger.error('Profile save error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Get saved resume endpoint
app.get('/api/profile/resume-download', authenticateToken, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile || !profile.data?.savedResumeBuffer) {
      return res.status(404).json({ error: 'No saved resume found' });
    }

    const resumeBuffer = Buffer.from(profile.data.savedResumeBuffer, 'base64');
    const mimeType = profile.data.savedResumeMimeType || 'application/octet-stream';
    const filename = profile.data.savedResumeFilename || 'resume.pdf';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(resumeBuffer);
  } catch (error) {
    logger.error('Resume download error:', error);
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

// Configure multer for resume file upload
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOC, and DOCX are allowed.'));
    }
  }
});

// File upload and parse endpoint
app.post('/api/upload/resume', authenticateToken, resumeUpload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file with magic number checking
    const fileValidation = validateUploadedFile(req.file);
    if (!fileValidation.valid) {
      logger.warn({
        userId: req.userId,
        filename: req.file.originalname,
        errors: fileValidation.errors
      }, 'File upload validation failed');
      return res.status(400).json({
        error: 'File validation failed',
        details: fileValidation.errors
      });
    }

    logger.info({
      userId: req.userId,
      filename: fileValidation.sanitizedFilename,
      detectedType: fileValidation.detectedType
    }, 'Processing uploaded file');
    let extractedText = '';

    // Extract text based on file type
    if (req.file.mimetype === 'application/pdf') {
      // Parse PDF
      try {
        extractedText = await extractPdfText(req.file.buffer);
        logger.info('✅ PDF parsed, extracted', extractedText.length, 'characters');
      } catch (err) {
        logger.error('PDF parse error:', err);
        return res.status(400).json({
          error: 'Failed to parse PDF. Please try uploading as TXT or DOCX.'
        });
      }
    }
    else if (req.file.mimetype === 'text/plain') {
      // Plain text
      extractedText = req.file.buffer.toString('utf-8');
      logger.info('✅ Text file read, extracted', extractedText.length, 'characters');
    }
    else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Parse DOCX
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = result.value;
      logger.info('✅ DOCX parsed, extracted', extractedText.length, 'characters');
    }
    else if (req.file.mimetype === 'application/msword') {
      // For old .doc files, try mammoth (it might work) or return error
      try {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
        logger.info('✅ DOC parsed, extracted', extractedText.length, 'characters');
      } catch (e) {
        return res.status(400).json({
          error: 'Cannot parse old .doc format. Please save as .docx or .pdf'
        });
      }
    }

    // Clean up the text
    extractedText = extractedText
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double newline
      .trim();

    if (!extractedText || extractedText.length < 50) {
      return res.status(400).json({
        error: 'Could not extract meaningful text from the file'
      });
    }

    res.json({
      success: true,
      text: extractedText,
      filename: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process file'
    });
  }
});

// Resume analysis endpoint (for onboarding)
app.post('/api/analyze/public', async (req, res) => {
  try {
    const { resumeText } = req.body;

    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: 'Resume text is required' });
    }

    logger.info('🔍 Analyzing resume text (public)...');

    // Import candidateDigestPrompt for structured extraction
    const { candidateDigestPrompt } = await import('./lib/prompts/candidateDigestPrompt.js');

    try {
      // Get structured data using the same prompt used in pipeline
      const structuredData = await candidateDigestPrompt(resumeText);

      logger.info('✅ Resume analysis complete with structured data');
      logger.info(`   - Extracted ${structuredData.skills?.length || 0} skills`);
      logger.info(`   - Extracted ${structuredData.experiences?.length || 0} experiences`);
      logger.info(`   - Extracted ${structuredData.education?.length || 0} education entries`);
      logger.info(`   - Extracted ${structuredData.projects?.length || 0} projects`);

      // Create a summary from the structured data
      let summary = '';
      if (structuredData.experiences && structuredData.experiences.length > 0) {
        const currentExp = structuredData.experiences[0];
        const totalExperiences = structuredData.experiences.length;
        summary = `${currentExp.title} at ${currentExp.company}`;
        if (totalExperiences > 1) {
          summary += ` with experience across ${totalExperiences} organizations`;
        }
        if (structuredData.skills && structuredData.skills.length > 3) {
          const topSkills = structuredData.skills.slice(0, 3).join(', ');
          summary += `. Skilled in ${topSkills} and more.`;
        }
      } else if (structuredData.education && structuredData.education.length > 0) {
        const edu = structuredData.education[0];
        summary = `${edu.degree} in ${edu.field} from ${edu.school}`;
        if (structuredData.skills && structuredData.skills.length > 3) {
          const topSkills = structuredData.skills.slice(0, 3).join(', ');
          summary += `. Skilled in ${topSkills}.`;
        }
      } else {
        summary = 'Professional with diverse experience and technical skills';
      }

      // Return structured data compatible with frontend expectations
      res.json({
        structured: {
          // Basic fields for immediate display
          name: structuredData.name || '',
          email: structuredData.email || '',
          phone: structuredData.phone || '',
          location: structuredData.location || '',
          summary: summary,
          skills: structuredData.skills || [],
          resumeText,
          isComplete: true,

          // Full structured data for profile storage
          fullData: {
            ...structuredData,
            additionalInfo: '',  // Empty initially, user can add later
            processedAdditionalInfo: {},
            summary: summary
          }
        }
      });
      return;

    } catch (parseError) {
      logger.error('Structured parsing failed, falling back to OpenAI basic extraction:', parseError);
    }

    // Fallback to existing OpenAI parsing
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const modelName = config.openai.textModels.default;
    const requestParams = {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: modelName.includes('gpt-5-mini')
            ? 'Resume parser. Extract info from resume. Return JSON only.'
            : 'You are a precise resume parser. Extract ONLY information that is explicitly stated in the resume. If information is not found, return null for that field. Do not make up or infer information.'
        },
        {
          role: 'user',
          content: `Parse this resume and extract ONLY the information that is explicitly mentioned. Return a JSON object.

Resume:
"""
${resumeText.substring(0, 4000)}
"""

Instructions:
1. Extract ONLY information that is clearly stated in the resume
2. For name: Look for the person's full name (usually at the top)
3. For email: Look for an email address (contains @)
4. For phone: Look for a phone number
5. For location: Look for city/state information
6. For summary: Create a 2-3 sentence summary based ONLY on the actual experience and roles mentioned
7. For skills: Extract ONLY technical skills, tools, and technologies that are explicitly mentioned (e.g., Python, React, AWS, etc.)
8. Do NOT include generic skills like "problem-solving" or "collaboration"
9. Return null for any field that cannot be found

Return ONLY a valid JSON object, no other text.`
        }
      ],
      max_completion_tokens: 800
    };

    // Temperature handling for different models
    if (!modelName.includes('gpt-5')) {
      requestParams.temperature = 0.1; // Lower temperature for more precise extraction
    } else if (modelName === 'gpt-5-mini') {
      requestParams.temperature = 0.1;
    }
    // Skip temperature for GPT-5-mini

    const response = await openai.chat.completions.create(requestParams);

    const analysisText = response.choices[0].message.content;

    // Try to parse as JSON
    let parsedData;
    try {
      parsedData = JSON.parse(analysisText);
    } catch (e) {
      // Fallback to regex parsing if not valid JSON
      const skills = analysisText.match(/(?:Skills?|Technologies|Tools?)[\s:]*([^\n]+)/i)?.[1]
        ?.split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s.length > 0) || [];

      parsedData = {
        summary: analysisText.match(/(?:Summary|Overview)[\s:]*([^\n]+(?:\n[^\n]+)?)/i)?.[1] || resumeText.substring(0, 200) + '...',
        skills: skills.slice(0, 10)
      };
    }

    logger.info('✅ Resume analysis complete');

    // Clean up AI responses - remove any placeholder or generic text
    const cleanValue = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value !== 'string') return value;
      const lowerValue = value.toLowerCase();

      // Remove any placeholder responses
      if (lowerValue.includes('not provided') ||
          lowerValue.includes('not extractable') ||
          lowerValue.includes('not found') ||
          lowerValue.includes('not available') ||
          lowerValue.includes('not mentioned') ||
          value === 'null' ||
          value === 'N/A') {
        return '';
      }
      return value.trim();
    };

    // Filter out generic or placeholder skills
    const filterSkills = (skills) => {
      if (!Array.isArray(skills)) return [];

      const genericSkills = [
        'problem-solving', 'collaboration', 'communication', 'teamwork',
        'leadership', 'skill1', 'skill2', 'skill3', 'technical skills',
        'soft skills', 'analytical skills'
      ];

      return skills
        .filter(skill => {
          if (!skill) return false;
          const lower = skill.toLowerCase();
          return !genericSkills.includes(lower) &&
                 !lower.includes('skill') &&
                 skill.length > 1;
        })
        .slice(0, 15);
    };

    // Only use the summary if it's actually based on the resume content
    const summary = parsedData.summary &&
                   parsedData.summary.length > 20 &&
                   !parsedData.summary.toLowerCase().includes('experienced professional') &&
                   !parsedData.summary.toLowerCase().includes('diverse experience')
                   ? parsedData.summary
                   : '';

    res.json({
      structured: {
        name: cleanValue(parsedData.name),
        email: cleanValue(parsedData.email),
        phone: cleanValue(parsedData.phone),
        location: cleanValue(parsedData.location),
        summary: summary,
        skills: filterSkills(parsedData.skills),
        resumeText,
        isComplete: true
      }
    });
  } catch (error) {
    logger.error('Resume analysis error:', error);

    // Fallback to basic extraction if AI fails
    const lines = req.body.resumeText?.split('\n') || [];
    const skills = req.body.resumeText?.match(/\b(?:JavaScript|Python|React|Node\.js|Java|SQL|AWS|Docker|TypeScript|HTML|CSS|Git)\b/gi) || [];

    res.json({
      structured: {
        summary: lines.find(l => l.length > 50) || 'Professional with diverse experience',
        skills: Array.from(new Set(skills)).slice(0, 10),
        resumeText: req.body.resumeText,
        isComplete: true
      }
    });
  }
});

// Resume generation endpoint - Simplified version
// Redis rate limit: 10 req/min per user (expensive operation)
app.post('/api/generate', authenticateToken, apiLimiters.resume, async (req, res) => {
  try {
    const { resumeText, jobDescription, aiMode = 'gpt-5' } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description required' });
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile?.data) {
      return res.status(400).json({ error: 'Profile not found' });
    }

    // Initialize generator
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

    // Generate resume using simple approach
    const { latex, pdf } = await generator.generateAndCompile(
      profile.data,
      jobDescription,
      { model: aiMode }
    );

    // Generate job ID for tracking
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Save to database
    await prisma.job.create({
      data: {
        id: jobId,
        userId: req.userId,
        status: 'COMPLETED',
        resumeText: resumeText || '',
        jobDescription,
        aiMode
      }
    });

    // Save PDF artifact
    if (pdf) {
      await prisma.artifact.create({
        data: {
          jobId,
          type: 'PDF_OUTPUT',
          content: pdf,
          version: 1
        }
      });
    }

    res.json({
      success: true,
      jobId,
      downloadUrl: `/api/job/${jobId}/download/pdf`
    });
  } catch (error) {
    logger.error('Generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/job/:jobId', authenticateToken, async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      include: {
        artifacts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(job);
  } catch (error) {
    logger.error('Job status error:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

app.get('/api/job/:jobId/download/:type', authenticateToken, async (req, res) => {
  try {
    const { jobId, type } = req.params;

    // Verify job belongs to user
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true, company: true, role: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const artifactType = type.toUpperCase();
    const artifact = await prisma.artifact.findFirst({
      where: {
        jobId,
        type: artifactType === 'PDF' ? 'PDF_OUTPUT' :
              artifactType === 'LATEX' ? 'LATEX_SOURCE' :
              artifactType === 'JSON' ? 'RESUME_JSON' : artifactType
      },
      orderBy: { version: 'desc' }
    });

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const contentType =
      artifact.type === 'PDF_OUTPUT' ? 'application/pdf' :
      artifact.type === 'LATEX_SOURCE' ? 'text/x-latex' :
      'application/json';

    // Use stored filename from metadata, or generate clean filename
    let filename;
    if (artifact.type === 'PDF_OUTPUT' && artifact.metadata?.filename) {
      filename = artifact.metadata.filename;
    } else if (artifact.type === 'PDF_OUTPUT') {
      // Generate clean filename if not in metadata
      const cleanCompany = (job.company || 'Unknown_Company')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      const cleanRole = (job.role || 'Position')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      const shortId = jobId.substring(0, 6);
      filename = `${cleanCompany}_${cleanRole}_${shortId}.pdf`;
    } else {
      filename = artifactType === 'LATEX_SOURCE' ? 'resume.tex' : 'resume.json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(artifact.content);
  } catch (error) {
    logger.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download artifact' });
  }
});

// Enhanced status endpoint with queue progress
// Redis rate limit: 120 req/min per user (allow polling)
app.get('/api/job/:jobId/status', authenticateToken, apiLimiters.status, async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      select: {
        id: true,
        status: true,
        userId: true,
        company: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        completedAt: true,
        error: true,
        diagnostics: true,
        artifacts: {
          select: {
            id: true,
            type: true,
            version: true,
            metadata: true,
            createdAt: true
          }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get queue status for additional progress info
    const { getJobStatus } = await import('./lib/queue.js');
    const queueStatus = await getJobStatus(req.params.jobId);

    const response = {
      id: job.id,
      status: job.status,
      progress: queueStatus.found ? queueStatus.progress : 0,
      company: job.company || null,
      role: job.role || null,
      artifacts: job.artifacts || [],
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      diagnostics: job.diagnostics,
      queueState: queueStatus.found ? queueStatus.state : null,
      attemptsMade: queueStatus.attemptsMade || 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// User's job history
// Renamed to /api/my-jobs to avoid conflict with /routes/jobs.js (aggregated job board listings)
app.get('/api/my-jobs', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;

    const where = { userId: req.userId };
    if (status) {
      // Handle both single status and comma-separated list
      if (status.includes(',')) {
        where.status = { in: status.split(',').map(s => s.trim()) };
      } else if (Array.isArray(status)) {
        where.status = { in: status };
      } else {
        where.status = status;
      }
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        status: true,
        aiMode: true,
        company: true,
        role: true,
        jobUrl: true,
        createdAt: true,
        completedAt: true,
        error: true
      }
    });

    const total = await prisma.job.count({ where });

    res.json({
      jobs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Jobs list error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Queue metrics endpoint
app.get('/api/metrics/queue', authenticateToken, async (req, res) => {
  try {
    const { getQueueMetrics } = await import('./lib/queue.js');
    const metrics = await getQueueMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Queue metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch queue metrics' });
  }
});


// HTML-based resume generation endpoint
app.post('/api/generate-html', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, aiMode = 'gpt-5-mini', outputFormat = 'html' } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description required' });
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile?.data) {
      return res.status(400).json({ error: 'Profile not found' });
    }

    // Import and use HTML generator
    const { generateResumeHTML } = await import('./lib/html-generator.js');
    const result = await generateResumeHTML(profile.data, jobDescription, aiMode);

    if (result.success) {
      if (outputFormat === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.send(result.html);
      } else if (outputFormat === 'json') {
        res.json(result.json);
      } else {
        res.json({ html: result.html, json: result.json });
      }
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('HTML generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYMENT ENDPOINTS (Stripe Integration)
// ============================================

app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { tier } = req.body;

    if (!['PRO', 'UNLIMITED'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const priceId = tier === 'PRO'
      ? process.env.STRIPE_PRICE_ID_PRO
      : process.env.STRIPE_PRICE_ID_UNLIMITED;

    const session = await stripe.checkout.sessions.create({
      customer_email: req.user.email,
      client_reference_id: req.userId.toString(),
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.PUBLIC_BASE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/pricing`,
      metadata: { userId: req.userId, tier }
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error({ error: error.message }, 'Checkout creation failed');
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.get('/api/subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.userId }
    });

    if (!subscription) {
      return res.json({ tier: 'FREE', status: 'ACTIVE', dailyLimit: 5 });
    }

    const dailyLimits = { FREE: 5, PRO: 30, UNLIMITED: 999999 };
    res.json({
      tier: subscription.tier,
      status: subscription.status,
      dailyLimit: dailyLimits[subscription.tier]
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch subscription');
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    // Get user's subscription to determine limit
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.userId }
    });

    const tier = subscription?.tier || 'FREE';
    const dailyLimits = { FREE: 5, PRO: 30, UNLIMITED: 999999 };
    const limit = dailyLimits[tier];

    // Count jobs created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usedToday = await prisma.job.count({
      where: {
        userId: req.userId,
        createdAt: { gte: today }
      }
    });

    res.json({
      used: usedToday,
      limit: limit,
      remaining: Math.max(0, limit - usedToday),
      tier: tier
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch usage');
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// ============================================
// NEW CLERK FRONTEND REQUIRED ENDPOINTS
// ============================================

/**
 * GET /api/resumes - Get user's completed resume history
 * Required by: Dashboard.tsx, DashboardModern.tsx, DashboardUnified.tsx, History.tsx
 */
app.get('/api/resumes', authenticateToken, async (req, res) => {
  try {
    // Fetch all completed jobs for the user with their artifacts
    const jobs = await prisma.job.findMany({
      where: {
        userId: req.userId,
        status: 'COMPLETED'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        artifacts: {
          where: {
            type: 'PDF_OUTPUT'
          },
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    // Transform to ResumeEntry format expected by frontend
    const resumes = jobs.map(job => {
      // Use stored filename from artifact metadata, or generate clean filename
      let fileName = job.artifacts[0]?.metadata?.filename;

      if (!fileName) {
        // Fallback: Generate clean filename (shouldn't happen for new resumes)
        const cleanCompany = (job.company || 'Company').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 20);
        const cleanRole = (job.role || 'Role').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 20);
        fileName = `Resume_${cleanCompany}_${cleanRole}.pdf`;
      }

      return {
        fileName: fileName,
        pdfUrl: `/api/resumes/${job.id}`, // Use job ID in URL, not filename
        texUrl: `/api/job/${job.id}/download/latex`,
        role: job.role || undefined,
        company: job.company || undefined,
        jobUrl: job.jobUrl || undefined,
        createdAt: job.createdAt.toISOString()
      };
    });

    logger.info(`📄 Returning ${resumes.length} resumes for user ${req.userId}`);
    res.json(resumes);
  } catch (error) {
    logger.error('❌ Error fetching resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

/**
 * GET /api/quota - Get user's monthly quota usage
 * Required by: Dashboard.tsx, DashboardUnified.tsx
 */
app.get('/api/quota', authenticateToken, async (req, res) => {
  try {
    // Get current month start and end dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Count completed jobs this month
    const jobCount = await prisma.job.count({
      where: {
        userId: req.userId,
        status: 'COMPLETED',
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    // Define monthly limit (can be adjusted or made configurable per user)
    const MONTHLY_LIMIT = 50;

    const quota = {
      month: now.toISOString().slice(0, 7), // YYYY-MM format
      used: jobCount,
      remaining: Math.max(0, MONTHLY_LIMIT - jobCount),
      limit: MONTHLY_LIMIT
    };

    logger.info(`📊 User ${req.userId} quota: ${quota.used}/${quota.limit}`);
    res.json(quota);
  } catch (error) {
    logger.error('❌ Error fetching quota:', error);
    res.status(500).json({ error: 'Failed to fetch quota' });
  }
});

/**
 * POST /api/process-job - Start a new resume generation job (PRODUCTION-READY)
 * Required by: Dashboard.tsx, DashboardModern.tsx, DashboardUnified.tsx
 */
app.post('/api/process-job', authenticateToken, jobProcessingLimiter, async (req, res) => {
  try {
    const { jobDescription, aiMode, matchMode } = req.body;

    // Comprehensive validation
    const validation = validateJobDescription(jobDescription);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors[0] });
    }

    // Use sanitized job description from validation
    const sanitizedJobDescription = validation.sanitized;

    logger.info({
      userId: req.userId,
      jobDescriptionLength: sanitizedJobDescription.length,
      aiMode: aiMode || 'gpt-5-mini',
      matchMode: matchMode || 'standard'
    }, 'New job request');

    // Get user's profile data
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    // Robust validation
    if (!profile) {
      logger.error(`❌ No profile record found for user ${req.userId}`);
      return res.status(400).json({
        error: 'Profile not found. Please complete your profile first.',
        action: 'REDIRECT_TO_ONBOARDING'
      });
    }

    if (!profile.data || typeof profile.data !== 'object') {
      logger.error(`❌ Invalid profile data structure for user ${req.userId}`);
      return res.status(400).json({
        error: 'Invalid profile data. Please update your profile.',
        action: 'REDIRECT_TO_PROFILE'
      });
    }

    // Detailed profile validation
    const profileData = profile.data;
    logger.debug({
      hasName: !!profileData.name,
      hasEmail: !!profileData.email,
      experiences: (profileData.experiences || profileData.experience || []).length,
      skills: (profileData.skills || []).length,
      education: (profileData.education || []).length,
      projects: (profileData.projects || []).length,
      hasResumeText: !!profileData.resumeText,
      hasAdditionalInfo: !!profileData.additionalInfo
    }, 'Profile data validation');

    // Check minimum data requirements
    const hasExperience = (profileData.experiences || profileData.experience || []).length > 0;
    const hasEducation = (profileData.education || []).length > 0;
    const hasResumeText = profileData.resumeText && profileData.resumeText.trim().length > 100;
    const hasMinimumData = hasExperience || hasEducation || hasResumeText;

    if (!hasMinimumData) {
      logger.error(`❌ Insufficient profile data for user ${req.userId}`);
      return res.status(400).json({
        error: 'Insufficient profile data. Please add your work experience or upload a resume.',
        action: 'ADD_MORE_DATA'
      });
    }

    // Normalize profile data structure for consistency
    const normalizedProfile = {
      ...profileData,
      // Ensure 'experience' field exists (some code uses 'experiences', some uses 'experience')
      experience: profileData.experience || profileData.experiences || [],
      experiences: profileData.experiences || profileData.experience || [],
      // Ensure arrays
      skills: profileData.skills || [],
      education: profileData.education || [],
      projects: profileData.projects || [],
      certifications: profileData.certifications || []
    };

    logger.info({ profileSize: JSON.stringify(normalizedProfile).length }, 'Profile validated and normalized');

    // Create the job record
    const job = await prisma.job.create({
      data: {
        userId: req.userId,
        status: 'PENDING',
        jobDescription: sanitizedJobDescription, // Use sanitized version
        resumeText: normalizedProfile.resumeText || '', // Include resumeText to satisfy NOT NULL constraint
        aiMode: 'gpt-5-mini', // Always use gpt-5-mini
        diagnostics: {
          startTime: new Date().toISOString(),
          requestSource: 'production-ready-v2',
          profileDataSize: JSON.stringify(normalizedProfile).length,
          hasExperience,
          hasEducation,
          hasResumeText
        }
      }
    });

    jobLogger.start(job.id, req.userId);

    // Add job to queue for async processing
    const { addResumeJob } = await import('./lib/queue.js');
    await addResumeJob({
      jobId: job.id,
      userId: req.userId,
      profileData: normalizedProfile,
      jobDescription: sanitizedJobDescription // Use sanitized version
    });

    // Return immediately with job ID
    res.json({ jobId: job.id });
  } catch (error) {
    logger.error(`\n❌ CRITICAL ERROR in /api/process-job:`, error);
    logger.error(`Stack trace:`, error.stack);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// NOTE: processJobAsyncSimplified removed - was using deprecated LaTeX system
// Resume generation now uses HTML/CSS via AIResumeGenerator and GeminiResumeGenerator

// NOTE: generateLatexWithLLM and fixLatexWithLLM removed - LaTeX system deprecated
// Resume generation now uses HTML/CSS via AIResumeGenerator and GeminiResumeGenerator

/**
 * OLD Async job processing function (keeping for backward compatibility)
 */
async function processJobAsync(jobId, userId, jobDescription, aiMode, matchMode, profileData) {
  try {
    logger.info(`🔄 Starting async processing for job ${jobId} (updated)`);
    logger.info(`📊 Processing with: aiMode=${aiMode}, matchMode=${matchMode}`);

    // Extract company and role from job description if not in job record
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    let company = job?.company;
    let role = job?.role;

    if (!company || !role) {
      // Enhanced extraction using AI-like patterns
      const lines = jobDescription.split('\n').slice(0, 10); // Check first 10 lines
      for (const line of lines) {
        const cleanLine = line.trim();
        // Look for role patterns
        if (!role) {
          const roleMatch = cleanLine.match(/^(?:Position|Role|Title|Job Title)[:\s]+(.+)/i) ||
                           cleanLine.match(/^(.+?)\s*(?:Developer|Engineer|Manager|Designer|Analyst|Architect|Lead|Senior|Junior)/i);
          if (roleMatch) role = roleMatch[1]?.trim();
        }
        // Look for company patterns
        if (!company) {
          const companyMatch = cleanLine.match(/^(?:Company|Employer|Organization)[:\s]+(.+)/i) ||
                              cleanLine.match(/^(?:About|Join|At)\s+(.+?)(?:\s|,|\.)/i);
          if (companyMatch) company = companyMatch[1]?.trim();
        }
      }

      // Fallback extraction from first line if it looks like a title
      if (!role && lines[0]) {
        const firstLine = lines[0].trim();
        if (firstLine.length < 100 && !firstLine.includes('.')) {
          role = firstLine;
        }
      }

      // Update job with extracted info
      if (company || role) {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            company: company || job?.company,
            role: role || job?.role
          }
        });
        logger.info(`📝 Extracted: Company="${company || 'N/A'}", Role="${role || 'N/A'}"`);
      }
    }

    // Initialize AI Resume Generator - using the same pattern as /api/generate endpoint
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

    logger.info(`🤖 Starting AI generation...`);

    // Process profile data the same way as /api/generate endpoint
    let processedProfileData = profileData;
    if (processedProfileData) {
      // If structured data is under fullData, lift it up (same logic as main endpoint)
      if (!processedProfileData.experiences && processedProfileData.fullData) {
        const structuredProfile = {
          ...processedProfileData,
          experiences: processedProfileData.fullData.experiences || processedProfileData.experiences,
          skills: processedProfileData.fullData.skills || processedProfileData.skills,
          education: processedProfileData.fullData.education || processedProfileData.education,
          projects: processedProfileData.fullData.projects || processedProfileData.projects,
          certifications: processedProfileData.fullData.certifications || processedProfileData.certifications
        };
        processedProfileData = structuredProfile;
      }

      logger.info(`📊 Profile data structure:`, {
        hasName: !!processedProfileData.name,
        hasEmail: !!processedProfileData.email,
        hasExperiences: !!(processedProfileData.experiences || processedProfileData.experience),
        experiencesCount: (processedProfileData.experiences || processedProfileData.experience || []).length,
        hasSkills: !!processedProfileData.skills,
        skillsCount: (processedProfileData.skills || []).length,
        hasResumeText: !!processedProfileData.resumeText
      });
    }

    // Transform profile data to the format expected by AIResumeGenerator (same as main endpoint)
    const transformedUserData = processedProfileData ? {
      // Personal info in a consistent format
      personalInfo: {
        name: processedProfileData.name || processedProfileData.fullName || 'Candidate',
        email: processedProfileData.email || '',
        phone: processedProfileData.phone || '',
        location: processedProfileData.location || '',
        linkedin: processedProfileData.linkedin || '',
        website: processedProfileData.website || processedProfileData.portfolio || processedProfileData.github || ''
      },
      // Profile can be included as backup
      profile: {
        name: processedProfileData.name || processedProfileData.fullName || 'Candidate',
        email: processedProfileData.email || '',
        phone: processedProfileData.phone || '',
        location: processedProfileData.location || ''
      },
      summary: processedProfileData.summary || '',
      // Map experiences to experience for consistency (handle both field names)
      experience: processedProfileData.experiences || processedProfileData.experience || [],
      education: processedProfileData.education || [],
      skills: processedProfileData.skills || [],
      projects: processedProfileData.projects || [],
      certifications: processedProfileData.certifications || [],
      awards: processedProfileData.awards || [],
      publications: processedProfileData.publications || [],
      // Ensure additionalInfo is included
      additionalInfo: processedProfileData.additionalInfo || '',
      // Keep original data for fallback
      resumeText: processedProfileData.resumeText || '',
      ...processedProfileData // Keep all original fields as fallback
    } : {
      // Fallback mode if no profile data
      resumeText: '',
      personalInfo: {
        name: 'Candidate',
        email: '',
        phone: '',
        location: ''
      }
    };

    logger.info(`📝 Transformed user data:`, {
      hasName: !!transformedUserData.personalInfo.name,
      hasEmail: !!transformedUserData.personalInfo.email,
      experienceCount: transformedUserData.experience ? transformedUserData.experience.length : 0,
      educationCount: transformedUserData.education ? transformedUserData.education.length : 0,
      skillsCount: transformedUserData.skills ? transformedUserData.skills.length : 0,
      hasResumeText: !!transformedUserData.resumeText,
      hasSummary: !!transformedUserData.summary
    });

    // Use SIMPLE generation - just pass raw profile data
    logger.info(`📦 Using SIMPLE generation with raw profile data`);
    const { latex } = await generator.generateResumeSimple(
      processedProfileData,  // Pass RAW profile data, let LLM extract everything
      jobDescription,
      {
        targetJobTitle: role || '',
        model: aiMode === 'gpt-5-mini' ? 'gpt-5-mini' : aiMode
      }
    );

    // Compile to PDF
    let pdf = null;
    try {
      pdf = await generator.compileResume(latex);
      logger.info('✅ PDF compilation successful');
    } catch (compileError) {
      logger.error('❌ PDF compilation failed:', compileError.message);
      throw compileError;
    }

    logger.info(`📄 PDF generated, size: ${pdf ? pdf.length : 0} bytes`);

    // Wrap the result in the expected format
    const result = {
      success: true,
      diagnostics: {
        generatedAt: new Date().toISOString(),
        aiMode,
        matchMode,
        pdfSize: pdf ? pdf.length : 0
      },
      artifacts: {
        pdfBuffer: pdf,
        latexSource: latex,
        templateUsed: 'ai-generated',
        generationType: 'ai-pipeline'
      }
    };

    if (result.success && pdf) {
      logger.info(`💾 Saving artifacts for job ${jobId}...`);

      // Save PDF artifact
      const pdfArtifact = await prisma.artifact.create({
        data: {
          jobId,
          type: 'PDF_OUTPUT',
          content: Buffer.from(pdf), // Ensure it's a Buffer
          metadata: {
            template: result.artifacts.templateUsed || 'default',
            generationType: result.artifacts.generationType || 'ai-pipeline',
            size: pdf.length
          }
        }
      });
      logger.info(`✅ PDF artifact saved with ID: ${pdfArtifact.id}`);

      // Save LaTeX source if available
      if (latex) {
        const latexArtifact = await prisma.artifact.create({
          data: {
            jobId,
            type: 'LATEX_SOURCE',
            content: Buffer.from(latex, 'utf-8'),
            metadata: {
              size: latex.length
            }
          }
        });
        logger.info(`✅ LaTeX artifact saved with ID: ${latexArtifact.id}`);
      }

      // Update job status to completed
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          diagnostics: {
            ...result.diagnostics,
            completionTime: new Date().toISOString(),
            artifactsSaved: true
          }
        }
      });

      logger.info(`✅ Job ${jobId} marked as COMPLETED`);
      logger.info(`📊 Job details: Company="${updatedJob.company}", Role="${updatedJob.role}"`);
    } else {
      logger.error(`❌ Generation failed or no PDF produced for job ${jobId}`);
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          diagnostics: {
            error: 'PDF generation failed',
            completionTime: new Date().toISOString()
          }
        }
      });
    }
  } catch (error) {
    logger.error(`❌ Error processing job ${jobId}:`, error);

    // Update job status to failed
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date()
        }
      });
    } catch (updateError) {
      logger.error(`❌ Failed to update job status:`, updateError);
    }
  }
}

/**
 * GET /api/resumes/:fileName - Download a specific resume file
 * Required by: Dashboard.tsx, DashboardModern.tsx, DashboardUnified.tsx, History.tsx
 */
app.get('/api/resumes/:identifier', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    let artifact = null;

    // Check if identifier is a filename (ends with .pdf) or a jobId
    if (identifier.endsWith('.pdf')) {
      // It's a filename - find by filename in metadata
      artifact = await prisma.artifact.findFirst({
        where: {
          type: 'PDF_OUTPUT',
          metadata: {
            path: ['filename'],
            equals: identifier
          }
        },
        include: {
          job: {
            select: { userId: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!artifact) {
        logger.warn({ filename: identifier, userId: req.userId }, '❌ PDF not found by filename');
        return res.status(404).json({ error: 'Resume not found' });
      }

      // Verify the resume belongs to the authenticated user
      if (artifact.job.userId !== req.userId) {
        logger.warn({ filename: identifier, userId: req.userId }, '❌ Unauthorized access attempt');
        return res.status(403).json({ error: 'Unauthorized access to this resume' });
      }
    } else {
      // It's a jobId - verify job belongs to user first
      const job = await prisma.job.findUnique({
        where: { id: identifier },
        select: { userId: true }
      });

      if (!job) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      if (job.userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized access to this resume' });
      }

      // Fetch the PDF artifact
      artifact = await prisma.artifact.findFirst({
        where: {
          jobId: identifier,
          type: 'PDF_OUTPUT'
        },
        orderBy: { version: 'desc' }
      });

      if (!artifact) {
        return res.status(404).json({ error: 'PDF file not found' });
      }
    }

    // Use stored filename from metadata (should always exist for new resumes)
    const downloadFilename = artifact.metadata?.filename || `Resume_${identifier.substring(0, 8)}.pdf`;

    // Set appropriate headers and send the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.send(artifact.content);

    logger.info({ identifier, filename: downloadFilename, userId: req.userId }, '📥 Served PDF download');
  } catch (error) {
    logger.error({ error, identifier: req.params.identifier }, '❌ Error downloading resume');
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

// PDF download endpoint (alternative path used by frontend)
app.get('/api/job/:jobId/download/pdf', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Verify job belongs to user
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (job.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized access to this resume' });
    }

    // Fetch the PDF artifact
    const artifact = await prisma.artifact.findFirst({
      where: {
        jobId,
        type: 'PDF_OUTPUT'
      },
      orderBy: { version: 'desc' }
    });

    if (!artifact) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    // Use stored filename from metadata
    const downloadFilename = artifact.metadata?.filename || `Resume_${jobId.substring(0, 8)}.pdf`;

    // Set appropriate headers and send the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.send(artifact.content);

    logger.info({ jobId, filename: downloadFilename }, '📥 Served PDF download');
  } catch (error) {
    logger.error({ error, jobId: req.params.jobId }, '❌ Error downloading PDF');
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

// NEW SIMPLIFIED AI GENERATION ENDPOINT
import { generateResumeEndpoint, checkCompilersEndpoint } from './lib/simplified-api.js';
import { extractJobHandler } from './routes/extract-job.js';

// Import new route modules
import jobsRouter from './routes/jobs.js';
import aiSearchRouter from './routes/ai-search.js';
import autoApplyRouter from './routes/auto-apply.js';
import diagnosticsRouter from './routes/diagnostics.js';
import migrateDatabaseRouter from './routes/migrate-database.js';
import chatRouter from './routes/chat.js';
import profileRouter from './routes/profile.js';
import goalsRouter from './routes/goals.js';
import healthRouter from './routes/health.js';
import conversationsRouter from './routes/conversations.js';
import routinesRouter from './routes/routines.js';
import gmailRouter from './routes/gmail.js';
import workerRouter from './routes/worker.js';
import templatesRouter from './routes/templates.js';
import { workerWebSocket } from './lib/worker-websocket.js';

app.post('/api/generate-ai', authenticateToken, generateResumeEndpoint);
app.get('/api/check-compilers', authenticateToken, checkCompilersEndpoint);

// Gemini-powered resume generation endpoint (AI-native approach with Google Search grounding)
app.post('/api/generate-gemini', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, userData, enableSearch = true, outputFormat = 'json' } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    // Check if Gemini is available
    if (!isGeminiAvailable()) {
      return res.status(503).json({
        error: 'Gemini AI is not available. Check GEMINI_API_KEY configuration.',
        fallback: '/api/generate-ai'
      });
    }

    // Get user data from profile if not provided
    let resumeData = userData;
    if (!userData && req.user) {
      const profile = await prisma.profile.findUnique({
        where: { userId: req.user.id }
      });

      if (!profile?.data) {
        return res.status(400).json({ error: 'No profile data found. Please complete your profile first.' });
      }

      resumeData = profile.data;
    }

    if (!resumeData) {
      return res.status(400).json({ error: 'User data is required' });
    }

    logger.info({
      userId: req.userId,
      enableSearch,
      outputFormat,
      profileSize: JSON.stringify(resumeData).length
    }, 'Starting Gemini resume generation');

    // Generate resume using Gemini
    const { latex, pdf, metadata } = await geminiGenerateAndCompile(
      resumeData,
      jobDescription,
      { enableSearch }
    );

    // Generate job ID for tracking
    const jobId = `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Save to database
    await prisma.job.create({
      data: {
        id: jobId,
        userId: req.userId,
        status: 'COMPLETED',
        resumeText: '',
        jobDescription,
        aiMode: 'gemini-3-flash-preview',
        metadata: {
          ...metadata,
          generator: 'gemini-resume-generator',
          enableSearch
        }
      }
    });

    // Save PDF artifact
    if (pdf) {
      await prisma.artifact.create({
        data: {
          jobId,
          type: 'PDF_OUTPUT',
          content: pdf,
          version: 1
        }
      });
    }

    // Save LaTeX artifact
    await prisma.artifact.create({
      data: {
        jobId,
        type: 'LATEX_SOURCE',
        content: Buffer.from(latex),
        version: 1
      }
    });

    logger.info({
      jobId,
      generationTime: metadata.generationTime,
      usedCompanyResearch: metadata.usedCompanyResearch
    }, 'Gemini resume generation completed');

    if (outputFormat === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="resume-${jobId}.pdf"`);
      res.send(pdf);
    } else {
      res.json({
        success: true,
        jobId,
        downloadUrl: `/api/job/${jobId}/download/pdf`,
        metadata: {
          ...metadata,
          generator: 'gemini-resume-generator'
        }
      });
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Gemini resume generation error');
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: '/api/generate-ai'
    });
  }
});

// Job extraction endpoint for Chrome extension
app.post('/api/extract-job', authenticateToken, extractJobHandler);

// Health check endpoints - NO authentication required (used by load balancers)
app.use('/', healthRouter);

// Gmail OAuth callback - NO authentication required (comes from Google redirect)
app.get('/api/gmail/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (oauthError) {
      console.error('[Gmail Callback] OAuth error:', oauthError);
      return res.redirect(`${frontendUrl}/profile?gmail_error=${encodeURIComponent(oauthError)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/profile?gmail_error=Missing%20authorization%20code`);
    }

    let userId;
    try {
      const stateData = JSON.parse(state);
      userId = stateData.userId;
    } catch (e) {
      return res.redirect(`${frontendUrl}/profile?gmail_error=Invalid%20state%20parameter`);
    }

    if (!userId) {
      return res.redirect(`${frontendUrl}/profile?gmail_error=User%20ID%20not%20found`);
    }

    const tokens = await gmailExchangeCodeForTokens(code);
    const email = await gmailGetGmailAddress(tokens.accessToken);
    await gmailSaveGmailConnection(userId, tokens, email);

    console.log(`[Gmail Callback] Connected Gmail for user ${userId}: ${email}`);
    res.redirect(`${frontendUrl}/profile?gmail_connected=true&email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('[Gmail Callback] Error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/profile?gmail_error=${encodeURIComponent(error.message)}`);
  }
});

// Mount new routers - MUST be before static file serving!
// Apply auth middleware once for all /api routes except health and migration
const apiRouter = express.Router();
apiRouter.use(authenticateToken); // Apply auth once to all API routes

// Mount protected routers
apiRouter.use(jobsRouter);
apiRouter.use(aiSearchRouter);
apiRouter.use(autoApplyRouter);
apiRouter.use(diagnosticsRouter);
apiRouter.use(chatRouter);
apiRouter.use(profileRouter);
apiRouter.use(goalsRouter);
apiRouter.use(conversationsRouter);
apiRouter.use(routinesRouter);
apiRouter.use(gmailRouter);
apiRouter.use(templatesRouter);

// Mount the API router
app.use('/api', apiRouter);

// Worker routes (separate from main API - workers have their own auth)
app.use('/api/worker', workerRouter);

// Migration endpoint (protected by secret key, no auth token needed)
app.use('/api', migrateDatabaseRouter);

// Static file serving in production - MUST be AFTER API routes!
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = config.server.port;
const server = app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`);
  logger.info(`   - Health check: http://localhost:${PORT}/health`);
  logger.info(`   - Auth endpoints: http://localhost:${PORT}/api/register, /api/login`);
  logger.info(`   - Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start routine executor for automated task scheduling
  startRoutineExecutor();

  // Initialize Worker WebSocket for real-time worker dashboard updates
  workerWebSocket.initialize(server);
  logger.info('✅ Worker WebSocket initialized on /ws/worker');

  // Start SMART job sync service (tiered frequency for fresh jobs)
  smartJobSync.start();
  logger.info('✅ Smart Job Sync service started');
  logger.info('   - High-priority companies: Every hour');
  logger.info('   - Medium-priority companies: Every 3 hours');
  logger.info('   - Full sync + discovery: Every 6 hours');
  logger.info('   - Job closure detection: Every 12 hours');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  // Stop routine executor
  stopRoutineExecutor();

  // Stop smart job sync service
  smartJobSync.stop();

  // Close server
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  // Stop routine executor
  stopRoutineExecutor();

  // Stop smart job sync service
  smartJobSync.stop();

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;