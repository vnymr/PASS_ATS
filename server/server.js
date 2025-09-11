import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'chrome-extension://*',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return pattern.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.options('*', cors(corsOptions));

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return next();
  }
  
  const userData = requestCounts.get(ip);
  
  if (now > userData.resetTime) {
    userData.count = 1;
    userData.resetTime = now + RATE_WINDOW;
    return next();
  }
  
  if (userData.count >= RATE_LIMIT) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((userData.resetTime - now) / 1000)
    });
  }
  
  userData.count++;
  next();
}

app.use(rateLimit);

// Simple JSON file persistence (upgradeable to a real DB)
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)));
const dbFile = path.join(dataDir, 'db.json');

async function loadDB() {
  try {
    const raw = await fs.readFile(dbFile, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || {},
      profiles: parsed.profiles || {}
    };
  } catch (e) {
    // Initialize empty DB if not exists or invalid
    return { users: {}, profiles: {} };
  }
}

async function saveDB(db) {
  const serialized = JSON.stringify(db, null, 2);
  await fs.writeFile(dbFile, serialized, 'utf-8');
}

let db = await loadDB();

// Optional: Prisma (Postgres) integration with graceful fallback
let prisma = null;
async function getPrisma() {
  if (prisma) return prisma;
  if (!process.env.DATABASE_URL) return null;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    return prisma;
  } catch (e) {
    console.warn('Prisma not available, using JSON DB fallback. Reason:', e.message);
    return null;
  }
}

async function dbGetUser(email) {
  const p = await getPrisma();
  if (p) {
    return p.user.findUnique({ where: { email } });
  }
  return db.users[email];
}

async function dbCreateUser(email, hashedPassword) {
  const p = await getPrisma();
  if (p) {
    return p.user.create({ data: { email, password: hashedPassword } });
  }
  const userId = Date.now().toString();
  db.users[email] = { id: userId, email, password: hashedPassword, createdAt: new Date().toISOString() };
  await saveDB(db);
  return db.users[email];
}

async function dbGetProfile(email) {
  const p = await getPrisma();
  if (p) {
    const user = await p.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user || !user.profile) return null;
    return { ...user.profile.data, email, updatedAt: user.profile.updatedAt.toISOString?.() || user.profile.updatedAt };
  }
  return db.profiles[email] || null;
}

async function dbSaveProfile(email, profile) {
  const p = await getPrisma();
  if (p) {
    const user = await p.user.findUnique({ where: { email } });
    if (!user) throw new Error('User not found');
    await p.profile.upsert({
      where: { userId: user.id },
      update: { data: profile, updatedAt: new Date() },
      create: { userId: user.id, data: profile }
    });
    return;
  }
  db.profiles[email] = profile;
  await saveDB(db);
}

// Store generated resume metadata (JSON or Prisma profile.data)
async function dbAddResume(email, entry) {
  const p = await getPrisma();
  if (p) {
    const user = await p.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user) return;
    const data = (user.profile?.data || {});
    data.resumes = Array.isArray(data.resumes) ? data.resumes : [];
    data.resumes.unshift(entry);
    if (data.resumes.length > 50) data.resumes.length = 50;
    await p.profile.upsert({ where: { userId: user.id }, update: { data }, create: { userId: user.id, data } });
    return;
  }
  db.resumes = db.resumes || {};
  db.resumes[email] = Array.isArray(db.resumes[email]) ? db.resumes[email] : [];
  db.resumes[email].unshift(entry);
  if (db.resumes[email].length > 50) db.resumes[email].length = 50;
  await saveDB(db);
}

async function dbGetResumes(email) {
  const p = await getPrisma();
  if (p) {
    const user = await p.user.findUnique({ where: { email }, include: { profile: true } });
    const data = (user?.profile?.data || {});
    return Array.isArray(data.resumes) ? data.resumes : [];
  }
  return (db.resumes?.[email]) || [];
}

const tempDir = path.join(__dirname, 'temp');
await fs.mkdir(tempDir, { recursive: true });
const generatedDir = path.join(__dirname, 'generated');
await fs.mkdir(generatedDir, { recursive: true });
await fs.mkdir(path.join(tempDir, 'uploads'), { recursive: true });

// Serve generated PDFs
app.use('/pdfs', express.static(generatedDir));
app.use('/tex', express.static(generatedDir));

// --- In-memory caches to speed up generation ---
const keywordCache = new Map(); // jdHash -> [keywords]
const structuredCache = new Map(); // profileHash:jdHash -> structured JSON
const MAX_CACHE = 100;
function sha(input) { return crypto.createHash('sha1').update(String(input)).digest('hex'); }
function cacheSet(map, key, val) {
  if (map.size >= MAX_CACHE) {
    const firstKey = map.keys().next().value; map.delete(firstKey);
  }
  map.set(key, val);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Authentication endpoints
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Check if user already exists
    const existingUser = await dbGetUser(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await dbCreateUser(email, hashedPassword);
    
    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      success: true, 
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await dbGetUser(email);
  console.log(`[AUTH] login ${email} (exists=${!!user})`);

  if (!user) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await dbCreateUser(email, hashedPassword);

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, isNew: true });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/me', authenticateToken, async (req, res) => {
  const profile = await dbGetProfile(req.user.email);
  console.log(`[PROFILE:GET] ${req.user.email} -> ${profile ? '200' : '404'}`);
  
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  
  res.json(profile);
});

app.put('/me', authenticateToken, async (req, res) => {
  const profile = {
    ...req.body,
    email: req.user.email,
    updatedAt: new Date().toISOString()
  };
  await dbSaveProfile(req.user.email, profile);
  console.log(`[PROFILE:PUT] ${req.user.email} keys=[${Object.keys(req.body)}]`);
  res.sendStatus(200);
});

// List generated resumes
app.get('/me/resumes', authenticateToken, async (req, res) => {
  const list = await dbGetResumes(req.user.email);
  res.json(list);
});

// Profile endpoints
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await dbGetProfile(req.user.email);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.post('/profile', authenticateToken, async (req, res) => {
  try {
    const profileData = req.body;
    await dbSaveProfile(req.user.email, profileData);
    res.json({ success: true });
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

app.put('/profile', authenticateToken, async (req, res) => {
  try {
    const profileData = req.body;
    await dbSaveProfile(req.user.email, profileData);
    res.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.delete('/profile', authenticateToken, async (req, res) => {
  try {
    // Delete user profile and account
    const p = await getPrisma();
    if (p) {
      await p.profile.deleteMany({ where: { user: { email: req.user.email } } });
      await p.user.deleteMany({ where: { email: req.user.email } });
    } else {
      // JSON fallback - just acknowledge the request
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// Quota helpers: 10 free per month
const MONTHLY_LIMIT = 10;
function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
async function checkAndIncrementQuota(email) {
  if (!email) return { allowed: true, used: 0, remaining: Infinity };
  const p = await getPrisma();
  const key = monthKey();
  if (p) {
    // Prisma path: store in Profile.data.usage
    const user = await p.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user) return { allowed: true, used: 0, remaining: MONTHLY_LIMIT };
    const data = (user.profile?.data || {});
    data.usage = data.usage || {};
    const used = data.usage[key] || 0;
    if (used >= MONTHLY_LIMIT) return { allowed: false, used, remaining: 0 };
    data.usage[key] = used + 1;
    await p.profile.upsert({ where: { userId: user.id }, update: { data }, create: { userId: user.id, data } });
    return { allowed: true, used: used + 1, remaining: Math.max(0, MONTHLY_LIMIT - (used + 1)) };
  }
  // JSON path
  db.usage = db.usage || {};
  db.usage[email] = db.usage[email] || {};
  const used = db.usage[email][key] || 0;
  if (used >= MONTHLY_LIMIT) return { allowed: false, used, remaining: 0 };
  db.usage[email][key] = used + 1;
  await saveDB(db);
  return { allowed: true, used: used + 1, remaining: Math.max(0, MONTHLY_LIMIT - (used + 1)) };
}

app.get('/quota', authenticateToken, async (req, res) => {
  const key = monthKey();
  const email = req.user.email;
  const p = await getPrisma();
  if (p) {
    const user = await p.user.findUnique({ where: { email }, include: { profile: true } });
    const data = (user?.profile?.data || {});
    const used = (data.usage?.[key] || 0);
    return res.json({ month: key, used, remaining: Math.max(0, MONTHLY_LIMIT - used), limit: MONTHLY_LIMIT });
  }
  const used = db.usage?.[email]?.[key] || 0;
  res.json({ month: key, used, remaining: Math.max(0, MONTHLY_LIMIT - used), limit: MONTHLY_LIMIT });
});

app.post('/compile', async (req, res) => {
  const { tex } = req.body;
  console.log(`[COMPILE] request bytes=${tex ? tex.length : 0}`);
  
  if (!tex) {
    return res.status(400).json({ error: 'LaTeX content required' });
  }

  const jobId = crypto.randomBytes(16).toString('hex');
  const texFile = path.join(tempDir, `${jobId}.tex`);
  const pdfFile = path.join(tempDir, `${jobId}.pdf`);

  try {
    await fs.writeFile(texFile, tex, 'utf-8');

    const tectonicPath = process.env.TECTONIC_PATH || 'tectonic';
    
    await new Promise((resolve, reject) => {
      const tectonic = spawn(tectonicPath, [
        '--untrusted',
        '--keep-logs',
        '-o', tempDir,
        texFile
      ]);

      let stderr = '';
      
      tectonic.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tectonic.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Tectonic failed: ${stderr}`));
        } else {
          resolve();
        }
      });

      tectonic.on('error', (err) => {
        reject(err);
      });
    });

    const pdfBuffer = await fs.readFile(pdfFile);
    
    await fs.unlink(texFile).catch(() => {});
    await fs.unlink(pdfFile).catch(() => {});
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="resume.pdf"'
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Compilation error:', error);
    
    await fs.unlink(texFile).catch(() => {});
    await fs.unlink(pdfFile).catch(() => {});
    
    if (error.message.includes('ENOENT') && error.message.includes('tectonic')) {
      return res.status(500).json({ 
        error: 'Tectonic not installed. Please install: cargo install tectonic' 
      });
    }
    
    res.status(500).json({ 
      error: 'PDF compilation failed',
      details: error.message
    });
  }
});

// Generate endpoint: creates LaTeX (placeholder AI), compiles to PDF, returns URL
app.post('/generate', async (req, res) => {
  try {
    let { profile = {}, jobData = {}, tempId = 'TMP' } = req.body || {};
    
    // Check if user is authenticated and load their profile
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userProfile = await dbGetProfile(decoded.email);
        if (userProfile) {
          // Use the authenticated user's profile data
          profile = userProfile;
          console.log(`[GENERATE] Authenticated user: ${decoded.email}`);
        }
      } catch (err) {
        console.log(`[GENERATE] Invalid token, proceeding as anonymous`);
      }
    }
    
    console.log(`[GENERATE] email=${profile.email || 'anon'} role=${jobData.role || ''} company=${jobData.company || ''} tempId=${tempId}`);
    if (profile.email) {
      const quota = await checkAndIncrementQuota(profile.email);
      if (!quota.allowed) return res.status(429).json({ error: 'Monthly limit reached', limit: MONTHLY_LIMIT });
    }

    // Prefer AI-generated LaTeX if available; fallback to transformation template
    const latex = await generateLatexWithAI(
      profile,
      jobData,
      (msg, p) => console.log('[GENERATE]', msg || 'render', p ?? '')
    );

    // 2) Write .tex and compile via tectonic
    const ts = Date.now();
    const base = `resume_${tempId}_${ts}`;
    const texPath = path.join(generatedDir, `${base}.tex`);
    const pdfPath = path.join(generatedDir, `${base}.pdf`);

    await fs.writeFile(texPath, latex, 'utf-8');

    try {
    await new Promise((resolve, reject) => {
      const tectonicPath = process.env.TECTONIC_PATH || 'tectonic';
      const proc = spawn(tectonicPath, [texPath], { cwd: generatedDir });
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code !== 0) return reject(new Error(`LaTeX compilation failed: ${stderr}`));
        resolve();
      });
      proc.on('error', err => reject(err));
    });
    } catch (latexError) {
      console.warn('[GENERATE] LaTeX compilation failed, retrying with fallback template');
      // Use the reliable fallback template
      const fallbackLatex = buildOnePageTemplateWithTransformation(profile, jobData);
      await fs.writeFile(texPath, fallbackLatex, 'utf-8');
      await new Promise((resolve, reject) => {
        const tectonicPath = process.env.TECTONIC_PATH || 'tectonic';
        const proc = spawn(tectonicPath, [texPath], { cwd: generatedDir });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
          if (code !== 0) return reject(new Error(`Fallback LaTeX also failed: ${stderr}`));
          resolve();
        });
        proc.on('error', err => reject(err));
      });
    }

    // 3) Ensure output exists and return URL
    await fs.access(pdfPath);
    const origin = PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}` || `http://localhost:${PORT}`;
    const pdfUrl = `${origin}/pdfs/${base}.pdf`;
    const texUrl = `${origin}/tex/${base}.tex`;

    if (profile.email) {
      await dbAddResume(profile.email, {
        fileName: `${base}.pdf`,
        pdfUrl,
        texUrl,
        role: jobData.role || '',
        company: jobData.company || '',
        createdAt: new Date().toISOString()
      });
    }

    res.json({ success: true, pdfUrl, texUrl, fileName: `${base}.pdf` });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Streaming job-based generation (SSE) ---
const jobs = new Map(); // jobId -> { listeners:Set<res>, last: any }

function sendEvent(jobId, type, data) {
  const job = jobs.get(jobId);
  if (!job) return;
  const payload = `event: ${type}\n` + `data: ${JSON.stringify(data)}\n\n`;
  job.last = { type, data };
  for (const res of job.listeners) {
    try { res.write(payload); } catch (_) {}
  }
}

function closeJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  for (const res of job.listeners) {
    try { res.end(); } catch (_) {}
  }
  jobs.delete(jobId);
}

app.post('/generate/job', async (req, res) => {
  const { profile = {}, jobData = {}, tempId = 'TMP' } = req.body || {};
  const jobId = crypto.randomBytes(8).toString('hex');
  jobs.set(jobId, { listeners: new Set(), last: null, startedAt: Date.now() });
  console.log(`[JOB] start jobId=${jobId} email=${profile.email || 'anon'} role=${jobData.role || ''} company=${jobData.company || ''}`);
  res.json({ jobId });

  // start async process
  (async () => {
    try {
      // Quota check if email present
      if (profile.email) {
        const quota = await checkAndIncrementQuota(profile.email);
        if (!quota.allowed) {
          sendEvent(jobId, 'error', { error: 'Monthly limit reached' });
          return setTimeout(() => closeJob(jobId), 500);
        }
      }
      sendEvent(jobId, 'status', { message: 'Extracting JD keywords...', progress: 10 });
      const synonyms = await loadSynonyms();
      const jdText = jobData.text || '';
      const jdKey = sha(jdText);
      let priority = keywordCache.get(jdKey);
      if (!priority) {
        priority = await generateKeywordsWithAI(jdText, profile, synonyms);
        cacheSet(keywordCache, jdKey, priority);
      }
      const locked = extractNumericFacts(profile);
      sendEvent(jobId, 'analysis', { matchedSkills: (profile.skills||[]).slice(0,10), missingSkills: priority.filter(k => !(profile.skills||[]).map(s=>String(s).toUpperCase()).includes(k)).slice(0,10) });

      // Stage 1: get structured JSON
      sendEvent(jobId, 'status', { message: 'Structuring user memory...', progress: 20 });
      const profileKey = sha(JSON.stringify(profileToStructured(profile)));
      const structKey = `${profileKey}:${jdKey}`;
      let structured1 = structuredCache.get(structKey);
      if (!structured1) {
        structured1 = await generateStructuredWithAI(profile, jobData, priority, locked, (msg, p) => sendEvent(jobId, 'status', { message: msg, progress: p }));
        cacheSet(structuredCache, structKey, structured1);
      }

      // Stage 2: coverage check and refine if needed
      sendEvent(jobId, 'status', { message: 'Checking keyword coverage...', progress: 45 });
      const cov = computeCoverage(structured1, priority, synonyms);
      let structured = structured1;
      let tries = 0;
      const threshold = 0.7; // require 70% of priority keywords present
      while (tries < 1) {
        const ratio = (cov.present.length) / (priority.length || 1);
        if (ratio >= threshold || cov.missing.length === 0) break;
        sendEvent(jobId, 'status', { message: `Refining draft to improve coverage (${Math.round(ratio*100)}%)...`, progress: 50 + tries*5 });
        structured = await refineStructuredWithAI(structured, cov.missing.slice(0,8), locked);
        const cov2 = computeCoverage(structured, priority, synonyms);
        if (cov2.present.length > cov.present.length) {
          cov.present = cov2.present; cov.missing = cov2.missing;
          cacheSet(structuredCache, structKey, structured);
        }
        tries++;
      }

      // Stage 3: render LaTeX deterministically
      sendEvent(jobId, 'status', { message: 'Rendering LaTeX...', progress: 60 });
      // Prefer direct AI LaTeX when possible; fallback to structured->template
      let latex = null;
      try {
        latex = await generateLatexWithAI(profile, jobData, (m, pr) => sendEvent(jobId, 'status', { message: m, progress: pr || 60 }));
      } catch (_) {
        latex = renderLatexFromStructured(structured, jobData);
      }

      sendEvent(jobId, 'status', { message: 'Compiling PDF...', progress: 70 });
      const ts = Date.now();
      const base = `resume_${tempId}_${ts}`;
      const texPath = path.join(generatedDir, `${base}.tex`);
      const pdfPath = path.join(generatedDir, `${base}.pdf`);
      await fs.writeFile(texPath, latex, 'utf-8');

      await new Promise((resolve, reject) => {
        const tectonicPath = process.env.TECTONIC_PATH || 'tectonic';
        const proc = spawn(tectonicPath, [texPath], { cwd: generatedDir });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
          if (code !== 0) return reject(new Error(`LaTeX compilation failed: ${stderr}`));
          resolve();
        });
        proc.on('error', err => reject(err));
      });

      await fs.access(pdfPath);
      const origin = PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}` || `http://localhost:${PORT}`;
      const pdfUrl = `${origin}/pdfs/${base}.pdf`;
      const texUrl = `${origin}/tex/${base}.tex`;
      if (profile.email) {
        await dbAddResume(profile.email, {
          fileName: `${base}.pdf`,
          pdfUrl,
          texUrl,
          role: jobData.role || '',
          company: jobData.company || '',
          createdAt: new Date().toISOString(),
          meta: {
            priorityKeywords: priority,
            coverage: { present: cov.present, missing: cov.missing }
          }
        });
      }
      sendEvent(jobId, 'complete', { pdfUrl, texUrl, fileName: `${base}.pdf` });
      setTimeout(() => closeJob(jobId), 500);
    } catch (err) {
      console.error('Generate job error:', err);
      sendEvent(jobId, 'error', { error: err.message });
      setTimeout(() => closeJob(jobId), 500);
    }
  })();
});

app.get('/generate/stream/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  console.log(`[JOB] stream open jobId=${jobId}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`retry: 3000\n\n`);

  job.listeners.add(res);
  if (job.last) {
    const { type, data } = job.last;
    res.write(`event: ${type}\n` + `data: ${JSON.stringify(data)}\n\n`);
  } else {
    res.write(`event: status\n` + `data: ${JSON.stringify({ message: 'Queued...', progress: 5 })}\n\n`);
  }

  req.on('close', () => {
    try { job.listeners.delete(res); } catch (_) {}
    console.log(`[JOB] stream closed jobId=${jobId}`);
  });
});

// Onboarding resume parsing endpoint
const upload = multer({ dest: path.join(tempDir, 'uploads') });
app.post('/onboarding/parse', upload.single('resume'), async (req, res) => {
  try {
    console.log(`[PARSE] inbound file=${req.file?.originalname} type=${req.file?.mimetype}`);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    const mimetype = req.file.mimetype || '';
    let text = '';

    if (mimetype.includes('text/plain')) {
      text = await fs.readFile(filePath, 'utf-8');
    } else if (mimetype.includes('pdf')) {
      try {
        const require = createRequire(import.meta.url);
        const pdfParse = require('pdf-parse');
        const nfs = await import('fs');
        const buf = await nfs.promises.readFile(filePath);
        const data = await pdfParse(buf);
        text = data.text || '';
      } catch (e) {
        console.warn('pdf-parse failed:', e.message);
      }
    } else if (mimetype.includes('officedocument') || mimetype.includes('word')) {
      try {
        const require = createRequire(import.meta.url);
        const mammoth = require('mammoth');
        const nfs = await import('fs');
        const buf = await nfs.promises.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: buf });
        text = result.value || '';
      } catch (e) {
        console.warn('mammoth failed:', e.message);
      }
    }

    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = text.match(/\+?\d[\d\s().-]{7,}\d/g);
    const lines = (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const nameGuess = (lines[0] && lines[0].length < 60) ? lines[0].replace(/[^A-Za-z\s.-]/g,'').trim() : '';
    // Extract URLs
    const urlMatches = Array.from(new Set((text.match(/https?:\/\/[^\s)]+/g) || []).slice(0, 20)));
    // Extract skills using synonyms/skills dictionary
    let skills = [];
    try {
      const skillsPath = path.join(__dirname, '..', 'extension', 'lib', 'skills.json');
      const skillsJson = JSON.parse(await fs.readFile(skillsPath, 'utf-8'));
      const docLower = text.toLowerCase();
      const found = new Set();
      for (const s of skillsJson) {
        const key = String(s).toLowerCase();
        if (docLower.includes(key)) found.add(s);
      }
      skills = Array.from(found).slice(0, 50);
    } catch {}

    res.json({
      text,
      fields: {
        name: nameGuess || '',
        email: emailMatch ? emailMatch[0] : '',
        phone: phoneMatch ? phoneMatch[0] : ''
      },
      urls: urlMatches,
      skills
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    if (req.file) { try { await fs.unlink(req.file.path); } catch {} }
  }
});

// AI-based resume analysis: structure profile from text
app.post('/onboarding/analyze', async (req, res) => {
  try {
    const { text = '' } = req.body || {};
    if (!text || text.length < 50) return res.status(400).json({ error: 'Insufficient text' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(501).json({ error: 'OPENAI_API_KEY not configured' });
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    const system = 'You extract structured resume data as strict JSON. Always return valid JSON only.';
    const user = `Resume text:\n\n${text}\n\nSchema:\n{\n  "summary": string,\n  "skills": string[],\n  "experience": [{ "company": string, "role": string, "location": string, "dates": string, "bullets": string[] }],\n  "projects": [{ "name": string, "summary": string, "bullets": string[] }],\n  "education": [{ "institution": string, "degree": string, "location": string, "dates": string }]\n}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
      temperature: 0,
      max_tokens: 2000
    });
    let content = completion.choices?.[0]?.message?.content || '{}';
    try { content = content.replace(/^```json|```$/g, '').trim(); } catch {}
    const structured = JSON.parse(content);
    res.json({ structured });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AI analysis endpoint for extension (secure server-side OpenAI calls)
app.post('/api/ai-analyze', async (req, res) => {
  try {
    const { systemPrompt, userPrompt, model = 'gpt-5-mini', temperature = 0.3, max_tokens = 2000 } = req.body;
    
    if (!systemPrompt || !userPrompt) {
      return res.status(400).json({ error: 'Missing required prompts' });
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(501).json({ error: 'OpenAI API key not configured on server' });
    }
    
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens,
      response_format: { type: "json_object" }
    });
    
    const result = completion.choices?.[0]?.message?.content || '{}';
    res.json({ result, success: true });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ 
      error: error.message || 'AI analysis failed',
      success: false 
    });
  }
});

// Speech-to-text using OpenAI Whisper
const audioUpload = multer({ dest: path.join(tempDir, 'uploads') });
app.post('/onboarding/stt', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio provided' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(501).json({ error: 'OPENAI_API_KEY not configured' });
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    const nfs = await import('fs');
    const stream = nfs.createReadStream(req.file.path);
    const resp = await openai.audio.transcriptions.create({ file: stream, model: 'whisper-1' });
    res.json({ text: resp.text || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    if (req.file) { try { await fs.unlink(req.file.path); } catch {} }
  }
});

// Helper function to extract location from job description
function extractLocationFromJD(jobText) {
  if (!jobText) return '';
  // Common location patterns in job descriptions
  const locationPatterns = [
    /(?:Location|Based in|Office in|Located in)[\s:]+([^,\n.]+(?:,\s*[A-Z]{2})?)/i,
    /([A-Za-z\s]+,\s*[A-Z]{2}(?:\s*\d{5})?)/g, // City, State format
    /\b([A-Za-z\s]+,\s*(?:CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|MA|IN|AZ|TN|MO|MD|WI|MN|CO|AL|SC|LA|KY|OR|OK|CT|IA|MS|AR|KS|UT|NV|NM|WV|NE|ID|HI|ME|NH|RI|MT|DE|SD|ND|AK|VT|WY|DC))\b/g
  ];
  
  for (const pattern of locationPatterns) {
    const matches = jobText.match(pattern);
    if (matches) {
      return matches[0].replace(/^(?:Location|Based in|Office in|Located in)[\s:]+/i, '').trim();
    }
  }
  return '';
}

async function generateLatexWithAI(profile, jobData, statusCb) {
  statusCb?.('Preparing profile and job context...', 20);
  
  // Build the new master prompt system
  const outputSettings = {
    outputMode: "resume_only",
    targetCompany: jobData.company || "Target Company",
    targetRole: jobData.role || "Target Role", 
    locationFromJd: extractLocationFromJD(jobData.text || ''),
    pageGoal: "complete_full_page_coverage",
    skillFlexPercent: 40,
    includeProjects: true,
    includeCerts: true,
    contentTarget: "2000_plus_words",
    expandContent: true
  };

  const systemPrompt = `You are an elite resume strategist specializing in ATS-optimized, cross-domain career transitions. Generate ONLY LaTeX body content that fits into an existing document template. The document header, preamble, and contact information are already handled - you generate ONLY the content sections.

% === Critical Structure Requirements ===
- Generate no contact information: Do not include name, email, phone, address, or contact details
- Generate no document structure: Do not use \\documentclass, \\begin{document}, \\end{document}, or preamble
- Generate no manual headers: Do not create \\section*{Name} or contact info blocks
- Start with summary: Your first line must be \\section*{Summary}
- Body content only: Generate only Summary, Experience, Skills, Education sections
- The complete document template with headers is automatically provided

% === Macro Whitelist (Only These Allowed) ===
\\section* (always with *), \\resumeSubHeadingListStart, \\resumeSubHeadingListEnd, \\resumeItemListStart, \\resumeItemListEnd, \\resumeSubheading{#1}{#2}{#3}{#4}, \\resumeItem{#1}
Critical: All sections must use \\section* (with asterisk) - never \\section without asterisk
Critical: \\resumeItem can ONLY be used inside \\resumeItemListStart ... \\resumeItemListEnd blocks
Escape LaTeX special chars: \\% \\& \\_ \\# \\{ \\}

% === Core Transformation Methodology ===

1. Keyword Extraction & Mapping:
   - Extract 15-25 critical keywords from job description (technical skills, soft skills, industry terms, action verbs)
   - Map each keyword to evidence in user profile (direct match, transferable skill, or contextual fit)
   - Distribute keywords naturally: 3-4 in summary, 1 per experience bullet (max), remainder in skills section
   - Priority order: exact matches > transferable skills > industry synonyms

2. Cross-Domain Translation Matrix:
   Technical → Business: engineering/development → solution delivery, debugging → problem-solving, architecture → strategic planning
   Business → Technical: sales → user acquisition, market research → data analysis, client management → stakeholder engagement
   Academic → Industry: research → analysis, teaching → training/mentoring, publications → documentation
   Startup → Corporate: founder → business leader, scrappy → resourceful, pivot → strategic adaptation

3. Experience Bullet Transformation:
   Formula: [Action Verb] + [Scope/Context] + [Method/Tool] + [Quantified Impact] + [Relevance Bridge]
   Example: "Built web platform" → "Delivered scalable client solution using modern frameworks, serving 10K+ users and reducing operational costs by 30%"
   
4. Skills Architecture:
   - Cluster into 3-5 logical groups (Languages/Frameworks, Tools/Platforms, Methodologies, Industry Knowledge)
   - 40% skill-flex rule: reorder/alias/condense existing skills to mirror job description language
   - Never fabricate skills; maximum 3 adjacent skills if clearly supported by profile context
   - Cap total skills at 18 items across all clusters

% === Section-Specific Instructions ===

Summary (Critical - determines initial screening):
- Format: \\section*{Summary} followed by single paragraph (no bullets)
- Length: 4-5 sentences, 150-220 words, fill substantial vertical space
- Opening: [Target Role] professional with [X years] experience in [most relevant domain]
- Body: Highlight 3-4 transferable achievements with metrics, mention target company
- Closing: Clear value proposition for the specific role
- Keyword density: 4-5 natural integrations, avoid keyword stuffing

Experience (2-3 roles, most recent first):
- Structure: \\section*{Experience} \\resumeSubHeadingListStart ... \\resumeSubHeadingListEnd
- Role Format: \\resumeSubheading{Title}{Dates}{Company}{Location}
- Role Title Adaptation: If cross-domain, subtly reframe titles (Engineer → Solutions Developer)
- Bullet Count: 6-8 per role to fill page completely, prioritize job description-relevant achievements
- Bullet Structure: \\resumeItem{Strong action verb + specific scope + relevant technology/method + quantified impact + business context}
- Cross-Domain Bridging: Lead each role with most transferable bullet, use industry-appropriate language
- Metric Authenticity: Use exact numbers from profile; if none exist, let AI determine appropriate scale/scope based on context

Skills (Strategic keyword placement, substantial content):
- Structure: \\section*{Skills} \\resumeSubHeadingListStart \\small{\\item{...}} \\resumeSubHeadingListEnd
- Format: Group skills with \\textbf{Category}: skill1, skill2, skill3, skill4, skill5 \\\\ 
- 5-6 categories minimum to fill space: Languages/Frameworks, Tools/Platforms, Methodologies, Industry Knowledge, Business Skills, Domain Expertise
- 25-30 items total across categories for full page coverage
- Group 1: Core competencies matching job description requirements (5-6 skills)
- Group 2: Technical/tools skills (filtered for relevance) (5-6 skills)
- Group 3: Methodologies/frameworks (4-5 skills)
- Group 4: Industry-specific knowledge (4-5 skills)
- Group 5: Business/soft skills relevant to target role (4-5 skills)
- Group 6: Additional domain expertise if needed for full coverage

Projects (Always include for full page coverage):
- Structure: \\section*{Projects} \\resumeSubHeadingListStart ... \\resumeSubHeadingListEnd
- Format: \\resumeSubheading{Project Name}{Timeline}{Technology Stack}{Context}
- 2-3 projects minimum, focus on target role relevance and technical depth
- 4-5 bullets each using \\resumeItem{}, emphasizing technical implementation and business impact

Education (Expand for full page coverage):
- Structure: \\section*{Education} \\resumeSubHeadingListStart ... \\resumeSubHeadingListEnd
- Format: \\resumeSubheading{Institution}{Dates}{Degree}{Location}
- Add relevant coursework bullet if needed to fill space: \\resumeItem{Relevant coursework: ...}

% === Full Page Coverage Requirements ===
Mandatory: Generate enough content to fill exactly one full page (2000-2400 words):
- Summary: 150-220 words (4-5 substantial sentences)
- Experience: 1000-1200 words (6-8 bullets per role × 2-3 roles)
- Skills: 300-400 words (25-30 skills across 5-6 categories)
- Projects: 400-500 words (4-5 bullets × 2-3 projects)
- Education: 150-250 words (degree + coursework/certifications)

Critical: If content appears short, expand in this order:
1. Add more experience bullets (up to 8 per role)
2. Expand skills to 30 items across 6 categories
3. Add third project with 4-5 bullets
4. Add coursework/certifications to education
5. Lengthen summary to full 220 words
- Total target: 1800-2200 words of LaTeX content for full page coverage

% === QUALITY ASSURANCE CHECKLIST ===
Before output, verify:
□ All information traceable to USER_PROFILE (no fabrication)
□ Keywords distributed naturally (not dumped)
□ Cross-domain language bridges established
□ Quantified achievements preserved/enhanced
□ FULL PAGE content generated (sufficient bullets and text)
□ LaTeX syntax correct (macros only, special chars escaped)
□ ATS-friendly formatting (clear hierarchy, scannable structure)
□ NO contact info or headers generated (template handles this)

% === OUTPUT CONTRACT ===
MANDATORY: Start immediately with \\section*{Summary} - NO contact info, NO name sections, NO headers!

Return ONLY LaTeX body content between markers:
% === BEGIN RESUME ===
\\section*{Summary}
[Summary paragraph - 3-4 sentences about target role at target company]

\\section{Experience}
\\resumeSubHeadingListStart
  \\resumeSubheading{Job Title}{Dates}{Company Name}{Location}
    \\resumeItemListStart
      \\resumeItem{Bullet point 1 with metrics and keywords}
      \\resumeItem{Bullet point 2 with cross-domain language}
      \\resumeItem{Bullet point 3 with quantified impact}
      \\resumeItem{Bullet point 4 with relevant technology}
      \\resumeItem{Bullet point 5 with business value}
    \\resumeItemListEnd
  [Repeat for 2-3 roles total]
\\resumeSubHeadingListEnd

\\section{Skills}
\\resumeSubHeadingListStart
\\small{\\item{
\\textbf{Business Development}: keyword1, keyword2, keyword3 \\\\
\\textbf{Technical Skills}: tool1, tool2, tool3 \\\\
\\textbf{Methodologies}: method1, method2, method3 \\\\
\\textbf{Industry Knowledge}: domain1, domain2, domain3 \\\\
}}
\\resumeSubHeadingListEnd

\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading{University Name}{Dates}{Degree Title}{Location}
\\resumeSubHeadingListEnd
% === END RESUME ===

No commentary, explanations, or diagnostics unless SETTINGS requests them.`;

  const userPrompt = `% === JOB_DESCRIPTION ===
${(jobData.text || '').slice(0, 5000)}

% === USER_PROFILE ===
CONTACT INFO:
Name: ${profile.name || 'N/A'}
Email: ${profile.email || 'N/A'}
Phone: ${profile.phone || 'N/A'}
Location: ${profile.location || 'N/A'}
LinkedIn: ${profile.linkedin || 'N/A'}
Website: ${profile.website || 'N/A'}

CURRENT SUMMARY: ${profile.summary_narrative || 'N/A'}

SKILLS INVENTORY: ${(Array.isArray(profile.skills) ? profile.skills.join(', ') : 'N/A')}

WORK EXPERIENCE:
${Array.isArray(profile.experience) ? profile.experience.map((exp, idx) => 
  `[${idx + 1}] ${exp.role || 'Role'} at ${exp.company || 'Company'} (${exp.dates || 'Dates'}) - ${exp.location || 'Location'}
Achievements: ${Array.isArray(exp.bullets) ? exp.bullets.join(' | ') : 'N/A'}`
).join('\n') : 'N/A'}

PROJECTS:
${Array.isArray(profile.projects) ? profile.projects.map((proj, idx) => 
  `[${idx + 1}] ${proj.name || 'Project'}: ${proj.summary || 'Summary'}
Details: ${Array.isArray(proj.bullets) ? proj.bullets.join(' | ') : 'N/A'}`
).join('\n') : 'N/A'}

EDUCATION:
${Array.isArray(profile.education) ? profile.education.map((edu, idx) => 
  `[${idx + 1}] ${edu.degree || 'Degree'} from ${edu.institution || 'Institution'} (${edu.dates || 'Dates'}) - ${edu.location || 'Location'}`
).join('\n') : 'N/A'}

ADDITIONAL CONTEXT: ${profile.resumeText || 'N/A'}

% === SETTINGS ===
TARGET_ROLE: ${outputSettings.targetRole}
TARGET_COMPANY: ${outputSettings.targetCompany}
INCLUDE_PROJECTS: ${outputSettings.includeProjects}
SKILL_FLEX_PERCENT: ${outputSettings.skillFlexPercent}

% === TRANSFORMATION REQUIREMENTS ===
1. Extract 15-25 keywords from the JOB_DESCRIPTION above
2. Map candidate's background to target role using cross-domain translation matrix
3. Generate LaTeX body content with natural keyword distribution
4. Ensure all claims are traceable to USER_PROFILE data
5. Optimize for ATS scanning and human readability

% === EXPECTED OUTPUT FORMAT ===
Generate LaTeX body content between the markers exactly as specified in the system instructions.`;

  const fallbackLatex = () => buildOnePageTemplateWithTransformation(profile, jobData);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    statusCb?.('OpenAI API key not set. Using template.', 35);
    return fallbackLatex();
  }

  try {
    statusCb?.('Contacting AI for tailored draft...', 30);
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });
    let latex = completion.choices?.[0]?.message?.content || '';
    
    // Extract content between markers if present
    const markerMatch = latex.match(/% === BEGIN RESUME ===([\s\S]*?)% === END RESUME ===/);
    if (markerMatch) {
      latex = markerMatch[1].trim();
    } else {
      // Fallback: clean up common formatting
    latex = latex.replace(/```latex/g, '').replace(/```/g, '').trim();
    }
    
    // Production-ready content processing
    latex = latex.trim();
    
    if (!latex || latex.length < 100) throw new Error('Empty AI output');
    statusCb?.('AI draft ready.', 55);
    
    // Fix all section commands in AI output (global replace)
    latex = latex.replace(/\\section\{([^}]+)\}/g, '\\section*{$1}');
    
    // Clean up potential LaTeX parsing issues
    latex = latex.replace(/\r\n/g, '\n'); // Normalize line endings
    latex = latex.replace(/[""]/g, '"'); // Replace smart quotes
    latex = latex.replace(/['']/g, "'"); // Replace smart apostrophes
    latex = latex.replace(/–/g, '-'); // Replace en-dash with hyphen
    latex = latex.replace(/—/g, '--'); // Replace em-dash with double hyphen
    
    // Fix misplaced \resumeItem commands (must be inside itemize blocks)
    // First, remove any nested \resumeItemListStart blocks
    latex = latex.replace(/\\resumeItemListStart\s*\\resumeItemListStart/g, '\\resumeItemListStart');
    latex = latex.replace(/\\resumeItemListEnd\s*\\resumeItemListEnd/g, '\\resumeItemListEnd');
    
    // Then fix any remaining misplaced \resumeItem commands
    latex = latex.replace(/(\n\s*)\\resumeItem\{([^}]*)\}(?!\s*\\resumeItemListEnd)(?!\s*\\resumeItem)/g, '$1  \\resumeItemListStart\n    \\resumeItem{$2}\n  \\resumeItemListEnd');
    
    console.log('[AI-LATEX] Fixed sections, body content length:', latex.length);
    console.log('[AI-LATEX] Body content starts with:', latex.substring(0, 100));
    
    // Wrap AI-generated body content in complete LaTeX template
    const completeLatex = buildCompleteLatexDocument(latex, profile);
    console.log('[AI-LATEX] Generated complete document with', completeLatex.length, 'characters');
    console.log('[AI-LATEX] Complete document starts with:', completeLatex.substring(0, 100));
    return completeLatex; // Don't sanitize twice
  } catch (e) {
    console.warn('AI generation failed, falling back to enhanced template:', e.message);
    statusCb?.('Using enhanced template with cross-domain optimization.', 40);
    return fallbackLatex();
  }
}

// Build complete LaTeX document with AI-generated body content
function buildCompleteLatexDocument(bodyContent, profile = {}) {
  const esc = (s = '') => String(s).replace(/([%#&_$~^{}])/g, '\\$1');
  const name = esc(profile.name || profile.tempId || 'Candidate');
  const email = profile.email ? esc(profile.email) : '';
  const phone = profile.phone ? esc(profile.phone) : '';
  const location = profile.location ? esc(profile.location) : '';

  return `\\documentclass[a4paper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{ragged2e}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\evensidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.8in}
\\addtolength{\\textheight}{1.6in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{\\vspace{-6pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Custom commands
\\newcommand{\\resumeItem}[1]{\\item\\small{#1}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{2pt}\\item[]
  \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\
  \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\
  \\vspace{2pt}
}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}  
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=0.3in]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{3pt}}

\\begin{document}

% Header
\\begin{center}
  \\textbf{\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}
  ${phone ? `\\small ${phone} $\\cdot$ ` : ''}${email ? `\\href{mailto:${email}}{${email}} ` : ''}${location ? `$\\cdot$ ${location}` : ''} \\\\
\\end{center}

% Body content from AI
${bodyContent}

\\end{document}`;
}

// Enhanced template with basic cross-domain transformation when AI is not available
function buildOnePageTemplateWithTransformation(profile = {}, jobData = {}) {
  const esc = (s = '') => String(s).replace(/([%#&_$~^{}])/g, '\\$1');
  const name = esc(profile.name || profile.tempId || 'Candidate');
  const email = profile.email ? esc(profile.email) : '';
  const phone = profile.phone ? esc(profile.phone) : '';
  const location = profile.location ? esc(profile.location) : '';
  const linkedin = profile.linkedin ? esc(profile.linkedin) : '';
  const website = profile.website ? esc(profile.website) : '';
  
  // Enhanced summary for cross-domain transitions
  const targetRole = jobData.role || 'Target Role';
  const targetCompany = jobData.company || 'Target Company';
  const jdText = (jobData.text || '').toLowerCase();
  
  // Detect if this is a cross-domain transition and create appropriate summary
  let summary;
  if (jdText.includes('business development') || jdText.includes('sales') || jdText.includes('b2b')) {
    summary = esc(`Business-focused professional with proven track record in market research, client relationship management, and driving growth initiatives. Seeking to leverage analytical skills and leadership experience as ${targetRole} at ${targetCompany}.`);
  } else if (jdText.includes('product') && jdText.includes('management')) {
    summary = esc(`Product-oriented professional with experience in market research, user analysis, and cross-functional team leadership. Proven ability to drive product development and client satisfaction as ${targetRole} at ${targetCompany}.`);
  } else {
    summary = esc(profile.summary_narrative || `Professional seeking to contribute expertise and drive results as ${targetRole} at ${targetCompany}.`);
  }
  
  const expArray = Array.isArray(profile.experience) ? profile.experience : [];
  
  // Transform experience bullets for business roles
  // Remove hardcoded transformations - let AI handle this intelligently
  
  const expBlock = expArray.length > 0 ? expArray.map(exp => {
    const org = esc(exp.company || exp.organization || '');
    let roleTitle = exp.role || exp.title || '';
    
    // Let AI handle role title optimization - no hardcoded transformations
    
    // Escape after transformation
    roleTitle = esc(roleTitle);
    
    const date = esc(exp.dates || exp.period || '');
    const loc = esc(exp.location || '');
    
    let bullets = (Array.isArray(exp.bullets) ? exp.bullets : []).slice(0, 8); // Increased for full page coverage
    
    // Ensure we have at least one bullet to avoid LaTeX errors
    if (bullets.length === 0) {
      bullets = ['Contributed to team objectives and organizational goals'];
    }
    
    // Let AI handle bullet optimization - no hardcoded transformations
    
    const bulletItems = bullets.map(b => `      \\resumeItem{${esc(b)}}`).join('\n');
    return `  \\resumeSubheading{${roleTitle}}{${date}}{${org}}{${loc}}\n    \\resumeItemListStart\n${bulletItems}\n    \\resumeItemListEnd`;
  }).join('\n\n') : `  \\resumeSubheading{Professional Experience}{}{}{}\n    \\resumeItemListStart\n      \\resumeItem{Contributed to team objectives and organizational goals}\n    \\resumeItemListEnd`;

  // Let AI handle skills optimization based on job requirements
  let skillsArray = Array.isArray(profile.skills) ? profile.skills : [];
  skillsArray = skillsArray.slice(0, 18);
  
  // Ensure we have at least some skills to avoid empty itemize
  if (skillsArray.length === 0) {
    skillsArray = ['Professional Skills', 'Team Collaboration', 'Problem Solving'];
  }
  
  const skillsLine = esc(skillsArray.join(', '));
  
  // Add projects section for full page coverage
  const projArray = Array.isArray(profile.projects) ? profile.projects : [];
  const projectsBlock = projArray.length > 0 ? projArray.slice(0, 3).map(proj => {
    const projName = esc(proj.name || proj.title || 'Project');
    const projTech = esc(proj.tech || proj.technologies || '');
    const projDesc = esc(proj.description || proj.desc || '');
    return `  \\resumeSubheading{${projName}}{}{${projTech}}{}\n    \\resumeItemListStart\n      \\resumeItem{${projDesc}}\n    \\resumeItemListEnd`;
  }).join('\n\n') : '';
  
  const eduArray = Array.isArray(profile.education) ? profile.education : [];
  const eduBlock = (eduArray[0]) ? `  \\resumeSubheading{${esc(eduArray[0].institution || eduArray[0].school || '')}}{${esc(eduArray[0].dates || eduArray[0].duration || '')}}{${esc(eduArray[0].degree || '')}}{${esc(eduArray[0].location || '')}}` : `  \\resumeSubheading{Educational Background}{}{}{}`;

  // Build header line dynamically with only present fields
  const headerParts = [];
  if (location) headerParts.push(location);
  if (phone) headerParts.push(phone);
  if (email) headerParts.push(`\\href{mailto:${email}}{\\underline{${email}}}`);
  if (linkedin) {
    const cleanLinkedin = linkedin.replace(/^https?:\/\//, '');
    headerParts.push(`\\href{https://${cleanLinkedin}}{\\underline{${cleanLinkedin}}}`);
  }
  if (website) {
    const cleanWebsite = website.replace(/^https?:\/\//, '');
    headerParts.push(`\\href{https://${cleanWebsite}}{\\underline{${cleanWebsite}}}`);
  }
  const headerLine = headerParts.join(' ~ | ~ ');

  return `\\documentclass[a4paper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{ragged2e}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\evensidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.9in}
\\addtolength{\\textheight}{1.8in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-3pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\color{black}\\titlerule \\vspace{-3pt}]
\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-0.5pt}}}
\\newcommand{\\resumeSubheading}[4]{\\vspace{-1pt}\\item \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\ \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\ \\vspace{-3pt}}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-1pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}  
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-2pt}}
\\begin{document}
\\begin{center}
    {\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}
    \\small ${headerLine}
    \\vspace{-5pt}
\\end{center}
\\section*{Summary}
${summary}
\\section{Experience}
\\resumeSubHeadingListStart
${expBlock}
\\resumeSubHeadingListEnd
\\section{Skills}
\\resumeSubHeadingListStart
\\small{\\item{${skillsLine}}}
\\resumeSubHeadingListEnd
${projectsBlock ? `\\section{Projects}
\\resumeSubHeadingListStart
${projectsBlock}
\\resumeSubHeadingListEnd
` : ''}\\section{Education}
\\resumeSubHeadingListStart
${eduBlock}
\\resumeSubHeadingListEnd
\\end{document}`;
}

// Build LaTeX using the provided one-page style
function buildOnePageTemplate(profile = {}, jobData = {}) {
  const esc = (s = '') => String(s).replace(/([%#&_$~^{}])/g, '\\$1');
  const name = esc(profile.name || profile.tempId || 'Candidate');
  const email = profile.email ? esc(profile.email) : '';
  const phone = profile.phone ? esc(profile.phone) : '';
  const location = profile.location ? esc(profile.location) : '';
  // Only include LinkedIn/website if they actually exist
  const linkedin = profile.linkedin ? esc(profile.linkedin) : '';
  const website = profile.website ? esc(profile.website) : '';
  const summary = esc(profile.summary_narrative || `Professional seeking opportunities to contribute expertise and drive results.`);
  const role = esc(jobData.role || 'Target Role');
  const company = esc(jobData.company || 'Target Company');

  const expArray = Array.isArray(profile.experience) ? profile.experience : [];
  const skillsArray = Array.isArray(profile.skills) ? profile.skills : [];
  const eduArray = Array.isArray(profile.education) ? profile.education : [];

  const expBlock = expArray.length > 0 ? expArray.map(exp => {
    const org = esc(exp.company || exp.organization || '');
    const roleTitle = esc(exp.role || exp.title || '');
    const date = esc(exp.dates || exp.period || '');
    const loc = esc(exp.location || '');
    let bullets = (Array.isArray(exp.bullets) ? exp.bullets : []).slice(0, 5);
    
    // Ensure we have at least one bullet to avoid LaTeX errors
    if (bullets.length === 0) {
      bullets = ['Contributed to team objectives and organizational goals'];
    }
    
    const bulletItems = bullets.map(b => `      \\resumeItem{${esc(b)}}`).join('\n');
    return `  \\resumeSubheading{${roleTitle}}{${date}}{${org}}{${loc}}\n    \\resumeItemListStart\n${bulletItems}\n    \\resumeItemListEnd`;
  }).join('\n\n') : `  \\resumeSubheading{Professional Experience}{}{}{}\n    \\resumeItemListStart\n      \\resumeItem{Contributed to team objectives and organizational goals}\n    \\resumeItemListEnd`;

  // Ensure we have at least some skills to avoid empty itemize
  const finalSkillsArray = skillsArray.length > 0 ? skillsArray.slice(0, 18) : ['Professional Skills', 'Team Collaboration', 'Problem Solving'];
  const skillsLine = esc(finalSkillsArray.join(', '));
  
  // Add projects section
  const projArray = Array.isArray(profile.projects) ? profile.projects : [];
  const projectsBlock = projArray.length > 0 ? projArray.slice(0, 3).map(proj => {
    const projName = esc(proj.name || proj.title || 'Project');
    const projTech = esc(proj.tech || proj.technologies || '');
    const projDesc = esc(proj.description || proj.desc || '');
    return `  \\resumeSubheading{${projName}}{}{${projTech}}{}\n    \\resumeItemListStart\n      \\resumeItem{${projDesc}}\n    \\resumeItemListEnd`;
  }).join('\n\n') : '';
  
  const eduBlock = (eduArray[0]) ? `  \\resumeSubheading{${esc(eduArray[0].institution || '')}}{${esc(eduArray[0].dates || '')}}{${esc(eduArray[0].degree || '')}}{${esc(eduArray[0].location || '')}}` : `  \\resumeSubheading{Educational Background}{}{}{}`;

  // Build header line dynamically with only present fields
  const headerParts = [];
  if (location) headerParts.push(location);
  if (phone) headerParts.push(phone);
  if (email) headerParts.push(`\\href{mailto:${email}}{\\underline{${email}}}`);
  if (linkedin) {
    const cleanLinkedin = linkedin.replace(/^https?:\/\//, '');
    headerParts.push(`\\href{https://${cleanLinkedin}}{\\underline{${cleanLinkedin}}}`);
  }
  if (website) {
    const cleanWebsite = website.replace(/^https?:\/\//, '');
    headerParts.push(`\\href{https://${cleanWebsite}}{\\underline{${cleanWebsite}}}`);
  }
  const headerLine = headerParts.join(' ~ | ~ ');

  return `\\documentclass[a4paper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{ragged2e}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\evensidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.9in}
\\addtolength{\\textheight}{1.8in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-3pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\color{black}\\titlerule \\vspace{-3pt}]
\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-0.5pt}}}
\\newcommand{\\resumeSubheading}[4]{\\vspace{-1pt}\\item \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\ \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\ \\vspace{-3pt}}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-1pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}  
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-2pt}}
\\begin{document}
\\begin{center}
    {\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}
    \\small ${headerLine}
    \\vspace{-5pt}
\\end{center}
\\section*{Summary}
${summary}
\\section{Experience}
\\resumeSubHeadingListStart
${expBlock}
\\resumeSubHeadingListEnd
\\section{Skills}
\\resumeSubHeadingListStart
\\small{\\item{${skillsLine}}}
\\resumeSubHeadingListEnd
${projectsBlock ? `\\section{Projects}
\\resumeSubHeadingListStart
${projectsBlock}
\\resumeSubHeadingListEnd
` : ''}\\section{Education}
\\resumeSubHeadingListStart
${eduBlock}
\\resumeSubHeadingListEnd
\\end{document}`;
}

// Enhanced template with projects section and better space utilization
function buildOnePageTemplateEnhanced(profile = {}, jobData = {}) {
  const esc = (s = '') => String(s).replace(/([%#&_$~^{}])/g, '\\$1');
  const name = esc(profile.name || profile.tempId || 'Candidate');
  const email = profile.email ? esc(profile.email) : '';
  const phone = profile.phone ? esc(profile.phone) : '';
  const location = profile.location ? esc(profile.location) : '';
  const linkedin = profile.linkedin ? esc(profile.linkedin) : '';
  const website = profile.website ? esc(profile.website) : '';
  const summary = esc(profile.summary_narrative || `Professional seeking opportunities to contribute expertise and drive results.`);

  const expArray = Array.isArray(profile.experience) ? profile.experience : [];
  const skillsArray = Array.isArray(profile.skills) ? profile.skills : [];
  const eduArray = Array.isArray(profile.education) ? profile.education : [];
  const projArray = Array.isArray(profile.projects) ? profile.projects : [];

  // Build experience section with more bullets
  const expBlock = expArray.map(exp => {
    const org = esc(exp.company || exp.organization || '');
    const roleTitle = esc(exp.role || exp.title || '');
    const date = esc(exp.dates || exp.period || '');
    const loc = esc(exp.location || '');
    // Use more bullets if available to fill space
    const bullets = (Array.isArray(exp.bullets) ? exp.bullets : []).slice(0, 6).map(b => `      \\resumeItem{${esc(b)}}`).join('\n');
    return `  \\resumeSubheading{${roleTitle}}{${date}}{${org}}{${loc}}\n    \\resumeItemListStart\n${bullets}\n    \\resumeItemListEnd`;
  }).join('\n\n');

  // Build projects section if available
  const projBlock = projArray.length > 0 ? projArray.map(proj => {
    const projName = esc(proj.name || proj.title || 'Project');
    const projDesc = esc(proj.description || '');
    const projBullets = (Array.isArray(proj.bullets) ? proj.bullets : [projDesc]).filter(b => b).slice(0, 3).map(b => `      \\resumeItem{${esc(b)}}`).join('\n');
    return `  \\resumeSubheading{${projName}}{}{}{}\n    \\resumeItemListStart\n${projBullets}\n    \\resumeItemListEnd`;
  }).join('\n\n') : '';

  // Organize skills into categories for better space utilization
  const skillsLine = skillsArray.length > 15 ? 
    `\\small{\\item{\\textbf{Technical:} ${esc(skillsArray.slice(0, Math.ceil(skillsArray.length/2)).join(', '))}}}
\\small{\\item{\\textbf{Additional:} ${esc(skillsArray.slice(Math.ceil(skillsArray.length/2)).join(', '))}}}` :
    `\\small{\\item{${esc(skillsArray.join(', '))}}}`;

  const eduBlock = (eduArray[0]) ? `  \\resumeSubheading{${esc(eduArray[0].institution || '')}}{${esc(eduArray[0].dates || '')}}{${esc(eduArray[0].degree || '')}}{${esc(eduArray[0].location || '')}}` : '';

  // Build header with conditional LinkedIn/website
  const headerContact = [location, phone, email ? `\\href{mailto:${email}}{\\underline{${email}}}` : '']
    .filter(Boolean);
  if (linkedin && !linkedin.includes('yourprofile')) {
    const cleanLinkedin = linkedin.replace(/^https?:\/\//, '');
    headerContact.push(`\\href{https://${cleanLinkedin}}{\\underline{${cleanLinkedin}}}`);
  }
  if (website && !website.includes('yourdomain')) {
    const cleanWebsite = website.replace(/^https?:\/\//, '');
    headerContact.push(`\\href{https://${cleanWebsite}}{\\underline{${cleanWebsite}}}`);
  }
  const headerLine = headerContact.join(' ~ | ~ ');

  // Use tighter spacing to fill the page
  return `\\documentclass[a4paper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{ragged2e}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.85in}
\\addtolength{\\evensidemargin}{-0.85in}
\\addtolength{\\textwidth}{1.7in}
\\addtolength{\\topmargin}{-1in}
\\addtolength{\\textheight}{2in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-2pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\color{black}\\titlerule \\vspace{-2pt}]
\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-1pt}}}
\\newcommand{\\resumeSubheading}[4]{\\vspace{-1pt}\\item \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\ \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\ \\vspace{-2pt}}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-1pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}  
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=-1pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-2pt}}
\\begin{document}
\\begin{center}
    {\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}
    \\small ${headerLine}
    \\vspace{-6pt}
\\end{center}
\\section*{Summary}
${summary}
\\vspace{-2pt}
\\section{Experience}
\\resumeSubHeadingListStart
${expBlock}
\\resumeSubHeadingListEnd
${projBlock ? `\\vspace{-2pt}
\\section{Projects}
\\resumeSubHeadingListStart
${projBlock}
\\resumeSubHeadingListEnd` : ''}
\\vspace{-2pt}
\\section{Skills}
\\resumeSubHeadingListStart
${skillsLine}
\\resumeSubHeadingListEnd
${eduBlock ? `\\vspace{-2pt}
\\section{Education}
\\resumeSubHeadingListStart
${eduBlock}
\\resumeSubHeadingListEnd` : ''}
\\end{document}`;
}

// Replace common placeholder values from AI responses with real user data
function sanitizeLatexPlaceholders(latex, profile = {}) {
  const esc = (s='') => String(s).replace(/([%#&_$~^{}])/g, '\\$1');
  let out = latex;
  if (profile.name) {
    out = out.replace(/Your Name/g, esc(profile.name));
  }
  if (profile.email) {
    out = out.replace(/your\.email@example\.com/g, esc(profile.email));
    out = out.replace(/email@example\.com/g, esc(profile.email));
  }
  if (profile.phone) {
    // Replace common phone placeholders
    out = out.replace(/\(123\) 456-7890|123-456-7890|\(555\) 123-4567/g, esc(profile.phone));
  }
  if (profile.location) {
    out = out.replace(/City, State/g, esc(profile.location));
    out = out.replace(/Dallas, TX/g, esc(profile.location));
  }
  if (profile.linkedin) {
    out = out.replace(/linkedin\.com\/in\/yourprofile/g, esc(profile.linkedin));
  }
  if (profile.website) {
    out = out.replace(/yourdomain\.com/g, esc(profile.website));
  }
  return out;
}

function extractNumericFacts(profile = {}) {
  const facts = new Set();
  const addFromText = (text) => {
    if (!text) return;
    const lines = String(text).split(/\n|\r/);
    for (const line of lines) {
      if (/\d/.test(line)) {
        const snippet = line.trim();
        if (snippet.length > 0 && snippet.length < 300) facts.add(snippet);
      }
    }
  };
  addFromText(profile.summary_narrative);
  if (Array.isArray(profile.experience)) {
    for (const exp of profile.experience) {
      addFromText(exp?.summary);
      if (Array.isArray(exp?.bullets)) {
        for (const b of exp.bullets) addFromText(b);
      }
    }
  }
  if (Array.isArray(profile.projects)) {
    for (const p of profile.projects) {
      addFromText(p?.summary);
      if (Array.isArray(p?.bullets)) {
        for (const b of p.bullets) addFromText(b);
      }
    }
  }
  return Array.from(facts);
}

async function loadSynonyms() {
  try {
    // try local server synonyms first
    const localPath = path.join(__dirname, 'synonyms.json');
    const buf = await fs.readFile(localPath, 'utf-8');
    return JSON.parse(buf);
  } catch {
    try {
      // fallback to extension copy if available
      const buf = await fs.readFile(path.join(__dirname, '..', 'extension', 'lib', 'synonyms.json'), 'utf-8');
      return JSON.parse(buf);
    } catch {
      return {};
    }
  }
}

function canonicalize(term = '', synonyms = {}) {
  const t = String(term).toLowerCase();
  for (const [key, list] of Object.entries(synonyms)) {
    if (key.toLowerCase() === t) return key.toUpperCase();
    if (Array.isArray(list) && list.map(x=>String(x).toLowerCase()).includes(t)) return key.toUpperCase();
  }
  return t.toUpperCase();
}

function extractKeywordHints(jdText = '', profile = {}, synonyms = {}) {
  try {
    const lower = jdText.toLowerCase();
    const tokens = (lower.match(/[a-z][a-z0-9+.#-]{2,}/g) || [])
      .filter(t => !['the','and','for','with','you','are','our','this','that','will','work','team','role','your','from','have','has','not','but','all','who','can','ability','skills','skill','requirements','years','experience','in','of','to','on','as','at','is','be','or','an','we','by','a'].includes(t))
      .slice(0, 200);
    const uniq = Array.from(new Set(tokens.map(t => canonicalize(t, synonyms))));
    const profSkills = new Set((Array.isArray(profile.skills)?profile.skills:[]).map(s=>canonicalize(s, synonyms)))
    // prioritize items present in profile skills - let AI determine relevance, not hardcoded tech patterns
    const scored = uniq.map(t => ({ t, score: (profSkills.has(t)?2:0) }));
    scored.sort((a,b)=>b.score-a.score);
    return scored.filter(s=>s.score>0).slice(0, 20).map(s=>s.t);
  } catch {
    return [];
  }
}

function computeCoverage(structured, keywords = [], synonyms = {}) {
  try {
    const canon = (s) => canonicalize(s, synonyms);
    const kw = new Set(keywords.map(canon));
    const text = JSON.stringify(structured || {}).toLowerCase();
    const present = new Set();
    for (const k of kw) {
      if (text.includes(k.toLowerCase())) present.add(k);
    }
    const missing = Array.from([...kw].filter(k => !present.has(k)));
    return { present: Array.from(present), missing };
  } catch {
    return { present: [], missing: [] };
  }
}

async function generateStructuredWithAI(profile, jobData, keywords, lockedFacts, statusCb) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    statusCb?.('OpenAI API key not set. Using profile memory only.', 25);
    return profileToStructured(profile);
  }
  
  try {
    statusCb?.('Contacting AI to structure data...', 20);
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    
    // Use a cleaner, more focused system prompt without emojis and hardcoded elements
    const system = `You are an expert resume writer who creates compelling, tailored resumes that maximize ATS scores and interview chances.
Your task is to transform the candidate's experience to match the job requirements while maintaining complete truthfulness.
Output ONLY valid minified JSON matching the schema. No code fences or explanations.
Key rules: Distribute job keywords naturally across the summary and experience bullets. Do not dump keywords into the skills section.`;

    const schema = {
      header: { name: 'string', email: 'string', phone: 'string', location: 'string', linkedin: 'string', website: 'string' },
      summary: 'string',
      skills: ['string'],
      experience: [{ company: 'string', role: 'string', location: 'string', dates: 'string', bullets: ['string'] }],
      projects: [{ name: 'string', summary: 'string', bullets: ['string'] }],
      education: [{ institution: 'string', degree: 'string', location: 'string', dates: 'string' }]
    };

    const user = `Schema: ${JSON.stringify(schema)}

Target Role: "${jobData.role || 'Target Role'}" at "${jobData.company || 'Target Company'}"

Transformation Guidelines:
1. Professional Summary (2-3 sentences): Tailor to the exact role and company using the candidate's true background. Weave in 2-3 priority keywords naturally. Be specific and authentic.

2. Experience Section: For each role, write 3-5 concise bullets using action, impact, and metric format. 14-22 words per bullet. Start with strong verbs. Include at most one relevant keyword when it fits naturally. Reuse existing numeric facts: ${lockedFacts.slice(0, 15).join(', ')}. Do not fabricate employers, roles, dates, or results.

3. Projects: 1-3 projects that reinforce match to job requirements. 2-3 bullets each with clear impact and metrics when possible.

4. Skills Section: Limit to 12-18 items total. Include only true skills and technologies the candidate actually has. Do not include job phrases, soft statements, or role titles. Do not dump or mirror the full keyword list. Prefer items already present in candidate memory.

5. Keyword Distribution: Weave these key terms naturally into summary and bullets, not the skills list: ${keywords.join(', ')}. Avoid repetition and keyword stuffing. Each bullet may include 1 relevant key term at most.

6. Formatting: One-page target. Adjust bullet counts to fit layout (typically 3-5 per role). Header fields should use candidate data only.

Candidate Profile:
${JSON.stringify(profileToStructured(profile))}

Job Description:
${(jobData.text || '').slice(0, 5000)}

Transform the candidate's experience to match this job while staying truthful.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
      temperature: 0.2,
      max_tokens: 2500
    });
    
    let content = completion.choices?.[0]?.message?.content || '{}';
    content = content.replace(/^```json|```$/g, '').trim();
    const structured = JSON.parse(content);
    
    // Post-process: keep skills authentic and concise
    if (Array.isArray(structured.skills)) {
      const seen = new Set();
      structured.skills = structured.skills
        .map(s => String(s).trim())
        .filter(s => s && s.length <= 40 && !/\b(owner|manager|leader|professional|methodology|life cycle|project delivery|work schedule)\b/i.test(s))
        .filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, 18);
    }
    
    statusCb?.('Structured draft ready.', 40);
    return mergeStructured(profileToStructured(profile), structured);
  } catch (e) {
    console.warn('Structured AI failed:', e.message);
    return profileToStructured(profile);
  }
}

async function refineStructuredWithAI(structured, missingKeywords, lockedFacts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || missingKeywords.length === 0) return structured;
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    const system = 'You revise ONLY bullets/summary to add missing keywords naturally. Output valid minified JSON, same schema. Do not change employers/roles/dates. Preserve numbers as-is. Do not add irrelevant content.';
    const user = `Current structured resume JSON:\n${JSON.stringify(structured)}\n\nAdd these missing keywords naturally (no fluff): ${missingKeywords.join(', ')}\nPreserve numeric facts verbatim: ${lockedFacts.join(' | ')}\nReturn only JSON.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
      temperature: 0.2,
      max_tokens: 1000
    });
    let content = completion.choices?.[0]?.message?.content || '{}';
    content = content.replace(/^```json|```$/g, '').trim();
    const refined = JSON.parse(content);
    return mergeStructured(structured, refined);
  } catch (e) {
    console.warn('Refine AI failed:', e.message);
    return structured;
  }
}

function profileToStructured(profile = {}) {
  return {
    header: {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      linkedin: profile.linkedin || '',
      website: profile.website || ''
    },
    summary: profile.summary_narrative || '',
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    experience: Array.isArray(profile.experience) ? profile.experience : [],
    projects: Array.isArray(profile.projects) ? profile.projects : [],
    education: Array.isArray(profile.education) ? profile.education : []
  };
}

function mergeStructured(base, incoming) {
  try {
    return {
      header: { ...base.header, ...(incoming.header || {}) },
      summary: incoming.summary || base.summary || '',
      skills: Array.isArray(incoming.skills) && incoming.skills.length ? incoming.skills : base.skills,
      experience: Array.isArray(incoming.experience) && incoming.experience.length ? incoming.experience : base.experience,
      projects: Array.isArray(incoming.projects) && incoming.projects.length ? incoming.projects : base.projects,
      education: Array.isArray(incoming.education) && incoming.education.length ? incoming.education : base.education,
    };
  } catch {
    return base;
  }
}

function renderLatexFromStructured(s = {}, jobData = {}) {
  // Ensure header fields
  const profile = {
    name: s.header?.name || '',
    email: s.header?.email || '',
    phone: s.header?.phone || '',
    location: s.header?.location || '',
    linkedin: s.header?.linkedin || '',
    website: s.header?.website || '',
    summary_narrative: s.summary || '',
    skills: Array.isArray(s.skills) ? s.skills : [],
    experience: Array.isArray(s.experience) ? s.experience : [],
    education: Array.isArray(s.education) ? s.education : [],
    projects: Array.isArray(s.projects) ? s.projects : [] // Add projects support
  };
  return buildOnePageTemplateWithTransformation(profile, jobData);
}

function determineAggressiveness(profile = {}, jobData = {}) {
  // Let AI determine the appropriate tone based on job description and user profile
  // No hardcoded defaults - AI should analyze the context
  const p = (profile.aggressiveness || jobData.aggressiveness || '').toString().toLowerCase();
  if (p === 'conservative' || p === 'assertive' || p === 'moderate') return p;
  return null; // Let AI decide
}

async function generateKeywordsWithAI(jdText = '', profile = {}, synonyms = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !jdText || jdText.length < 60) return extractKeywordHints(jdText, profile, synonyms);
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    const system = 'Extract 15-25 PRIORITY KEYWORDS/PHRASES for resume tailoring. Return a JSON array of strings only. No code fences.';
    const user = `Job description:\n${jdText.slice(0,4000)}\n\nProfile skills (bias toward these): ${(Array.isArray(profile.skills)?profile.skills.join(', '):'')}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
      temperature: 0,
      max_tokens: 400
    });
    let content = completion.choices?.[0]?.message?.content || '[]';
    content = content.replace(/^```json|```$/g, '').trim();
    const arr = JSON.parse(content);
    const canon = (s) => canonicalize(s, synonyms);
    const out = Array.from(new Set(arr.map(canon))).filter(Boolean).slice(0, 25);
    return out.length ? out : extractKeywordHints(jdText, profile, synonyms);
  } catch (e) {
    console.warn('Keyword AI failed:', e.message);
    return extractKeywordHints(jdText, profile, synonyms);
  }
}

setInterval(async () => {
  try {
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > 300000) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 60000);

app.listen(PORT, () => {
  console.log(`🚀 Resume Generator Server v2.0.0`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🤖 AI Generation: ${process.env.OPENAI_API_KEY ? '✅ Enabled' : '❌ Disabled (using enhanced templates)'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Public URL: ${PUBLIC_BASE_URL || 'http://localhost:' + PORT}`);
});

// Health check
app.get('/health', (_req, res) => {
  const health = {
    status: 'ok',
    service: 'resume-server',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: {
      aiGeneration: !!process.env.OPENAI_API_KEY,
      crossDomainTransformation: true,
      enhancedPrompts: true,
      fullPageOptimization: true
    },
    environment: process.env.NODE_ENV || 'development'
  };
  res.json(health);
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'PASS ATS - AI Resume Generator',
    version: '2.0.0',
    status: 'running',
    description: 'AI-powered resume generator with ATS optimization',
    endpoints: {
      health: '/health',
      status: '/api/status',
      generate: '/generate',
      auth: {
        signup: '/auth/signup',
        login: '/auth/login'
      },
      profile: '/profile',
      analyze: '/analyze-job'
    },
    features: {
      aiGeneration: !!process.env.OPENAI_API_KEY,
      database: 'Connected',
      latex: 'Enabled',
      cors: 'Configured'
    },
    timestamp: new Date().toISOString()
  });
});

// API Status endpoint (for compatibility)
app.get('/api/status', (_req, res) => {
  const status = {
    status: 'operational',
    service: 'PASS ATS API',
    version: '2.0.0',
    uptime: process.uptime(),
    database: {
      status: 'connected',
      type: 'PostgreSQL (Supabase)'
    },
    ai: {
      status: process.env.OPENAI_API_KEY ? 'enabled' : 'disabled',
      provider: 'OpenAI GPT-5 Mini'
    },
    latex: {
      status: 'enabled',
      compiler: 'Tectonic'
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

// AI Job Analysis endpoint - let AI make ALL decisions
app.post('/analyze-job', async (req, res) => {
  try {
    const { jdText, profile } = req.body;
    
    if (!jdText) {
      return res.status(400).json({ error: 'Job description text required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI analysis unavailable - API key not configured' });
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are an expert ATS and resume optimization analyst. Analyze the job description and candidate profile to provide strategic resume guidance.

Return a JSON object with:
{
  "atsScore": estimated_score_0_to_100,
  "jobTitle": "extracted_job_title",
  "criticalKeywords": ["top_10_most_important_keywords"],
  "importantKeywords": ["next_10_important_keywords"],
  "suggestedSummary": "tailored_professional_summary_2_3_sentences",
  "skillsPriority": ["reordered_skills_by_relevance"],
  "experienceOptimizations": ["specific_suggestions_for_experience_section"],
  "missingQualifications": ["key_requirements_candidate_lacks"],
  "strengthMatches": ["candidate_strengths_that_match_role"],
  "customizations": {
    "tone": "formal/conversational/technical_based_on_company_culture",
    "focus": "technical/leadership/results_based_on_role_level",
    "length": "concise/detailed_based_on_seniority_level"
  },
  "warnings": ["any_concerns_or_gaps_to_address"]
}

Base all recommendations on actual job requirements and candidate background. No generic advice.`;

    const userPrompt = `Job Description:\n${jdText}\n\nCandidate Profile:\n${JSON.stringify(profile, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const analysisText = completion.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis generated');
    }

    // Clean up JSON response (remove markdown code blocks if present)
    let cleanJson = analysisText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse JSON response
    const analysis = JSON.parse(cleanJson);
    res.json(analysis);

  } catch (error) {
    console.error('Job analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed',
      details: error.message 
    });
  }
});

// Warm up Tectonic cache to speed first compile
(async function warmupTectonic() {
  try {
    const tex = `\\documentclass{article}\\begin{document}warmup\\end{document}`;
    const tmp = path.join(generatedDir, `warmup_${Date.now()}.tex`);
    await fs.writeFile(tmp, tex, 'utf-8');
    const tectonicPath = process.env.TECTONIC_PATH || 'tectonic';
    const proc = spawn(tectonicPath, [tmp], { cwd: generatedDir });
    proc.on('close', async () => {
      try { await fs.unlink(tmp); } catch {}
    });
  } catch (e) {
    console.warn('[WARMUP] Tectonic warmup skipped:', e.message);
  }
})();
