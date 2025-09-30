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
import OpenAI from 'openai';
// Import parse libraries
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs';
// Import AI Resume Generator
import AIResumeGenerator from './lib/ai-resume-generator.js';
import { config, getOpenAIModel } from './lib/config.js';
import dataValidator from './lib/utils/dataValidator.js';
import ResumeParser from './lib/resume-parser.js';
// Import LaTeX compiler
import { compileLatex } from './lib/latex-compiler.js';

// Load environment variables - .env first, then .env.local to override
dotenv.config();
dotenv.config({ path: '.env.local' });

// Override for production if needed
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  dotenv.config();
}

// Initialize Clerk if keys are available
let clerkClient = null;
console.log('Clerk secret key check:', {
  exists: !!process.env.CLERK_SECRET_KEY,
  length: process.env.CLERK_SECRET_KEY ? process.env.CLERK_SECRET_KEY.length : 0,
  startsWithSk: process.env.CLERK_SECRET_KEY ? process.env.CLERK_SECRET_KEY.startsWith('sk_') : false,
  value: process.env.CLERK_SECRET_KEY ? process.env.CLERK_SECRET_KEY.substring(0, 10) + '...' : 'not set'
});

if (process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY !== 'YOUR_CLERK_SECRET_KEY') {
  clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  console.log('🔐 Clerk authentication enabled');
} else {
  console.log('⚠️  Clerk authentication not configured, using legacy JWT auth');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });


// Environment validation
function validateEnvironment() {
  const required = ['JWT_SECRET', 'OPENAI_API_KEY', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('🚀 Environment validated successfully');
  console.log('   - Node Environment:', process.env.NODE_ENV || 'development');
  console.log('   - Port:', process.env.PORT || '3000');
  console.log('   - OpenAI API Key:', '✅ Present');
  console.log('   - Database URL:', '✅ Present');
}

validateEnvironment();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (config.server.allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      console.warn('Allowed origins:', config.server.allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400 // 24 hours
}));

// Enable pre-flight for all routes
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected'
      }
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

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Try Clerk authentication first if available
  if (clerkClient) {
    try {
      // Verify the Clerk session token
      const sessionClaims = await clerkClient.verifyToken(token);

      // Get or create user in our database
      let user = await prisma.user.findUnique({
        where: { clerkId: sessionClaims.sub }
      });

      if (!user) {
        // Create user if doesn't exist
        user = await prisma.user.create({
          data: {
            clerkId: sessionClaims.sub,
            email: sessionClaims.email || `${sessionClaims.sub}@clerk.user`,
            password: 'clerk-managed' // Placeholder since Clerk manages auth
          }
        });
      }

      req.user = { id: user.id, email: user.email, clerkId: user.clerkId };
      req.userId = user.id;
      return next();
    } catch (clerkError) {
      // Only log meaningful Clerk errors, not JWT format issues or expirations
      if (!clerkError.message.includes('JWT') &&
          !clerkError.message.includes('expired') &&
          !clerkError.message.includes('Invalid JWT form')) {
        console.log('Clerk auth issue:', clerkError.message);
      }
      // Fall through to legacy JWT auth silently
    }
  }

  // Legacy JWT authentication
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // For legacy tokens, ensure user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = decoded;
    req.userId = decoded.id;
    next();
  });
};


// Auth endpoints
app.post('/api/register', async (req, res) => {
  console.log('📝 Registration request received:', req.body.email);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ User registered successfully:', user.email);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Registration error:', error);
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

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { email }
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

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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

    // Return the profile data directly, not wrapped in a profile object
    console.log('📤 Returning profile data:', JSON.stringify(profileData, null, 2));
    res.json(profileData);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('📝 Profile update request for user:', req.user.email);

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
    console.log('✨ Cleaned profile data:', JSON.stringify(cleanedBody, null, 2));

    // Process additional information if present
    let processedData = cleanedBody;
    if (cleanedBody.additionalInfo && typeof cleanedBody.additionalInfo === 'string' && cleanedBody.additionalInfo.trim().length > 0) {
      try {
        console.log('🤖 Processing additional information...');
        console.log(`   - Additional info length: ${cleanedBody.additionalInfo.length} characters`);
        // processedData = await processAdditionalInformation(cleanedBody);
        // For now, just pass through the data as-is
        processedData = cleanedBody;
        console.log('✅ Additional information stored');

        // Log what was extracted
        if (processedData.processedAdditionalInfo) {
          const { newSkills, newExperiences, newProjects, newCertifications } = processedData.processedAdditionalInfo;
          console.log(`   - Extracted: ${newSkills?.length || 0} skills, ${newExperiences?.length || 0} experiences, ${newProjects?.length || 0} projects, ${newCertifications?.length || 0} certifications`);
        }
      } catch (aiError) {
        console.error('⚠️ Failed to process additional information:', aiError.message);
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

    console.log('✅ Profile updated successfully with processed data');
    res.json(profile);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Parse resume endpoint - extract information from uploaded resume
app.post('/api/parse-resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📄 Parsing resume:', req.file.originalname);

    const parser = new ResumeParser();
    const { text, extractedData } = await parser.parseResume(req.file.buffer, req.file.mimetype);

    console.log('✅ Resume parsed successfully');
    res.json({
      resumeText: text,
      extractedData
    });
  } catch (error) {
    console.error('Resume parse error:', error);
    res.status(500).json({ error: 'Failed to parse resume' });
  }
});

// Save profile with resume endpoint
app.post('/api/profile/with-resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    const profileData = JSON.parse(req.body.profile);
    let resumeBuffer = null;

    if (req.file) {
      console.log('📎 Saving resume file:', req.file.originalname);
      resumeBuffer = req.file.buffer;

      // Parse resume if not already parsed
      if (!profileData.resumeText) {
        const parser = new ResumeParser();
        const { text } = await parser.parseResume(resumeBuffer, req.file.mimetype);
        profileData.resumeText = text;
      }
    }

    // Clean and validate profile data
    const cleanedData = {
      ...profileData,
      savedResumeBuffer: resumeBuffer ? resumeBuffer.toString('base64') : null,
      savedResumeMimeType: req.file ? req.file.mimetype : null,
      savedResumeFilename: req.file ? req.file.originalname : null
    };

    // Save profile
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

    console.log('✅ Profile saved with resume');
    res.json(profile);
  } catch (error) {
    console.error('Profile save error:', error);
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
    console.error('Resume download error:', error);
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

    console.log('📄 Processing uploaded file:', req.file.originalname);
    let extractedText = '';

    // Extract text based on file type
    if (req.file.mimetype === 'application/pdf') {
      // Parse PDF
      try {
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text;
        console.log('✅ PDF parsed, extracted', extractedText.length, 'characters');
      } catch (err) {
        console.error('PDF parse error:', err);
        return res.status(400).json({
          error: 'Failed to parse PDF. Please try uploading as TXT or DOCX.'
        });
      }
    }
    else if (req.file.mimetype === 'text/plain') {
      // Plain text
      extractedText = req.file.buffer.toString('utf-8');
      console.log('✅ Text file read, extracted', extractedText.length, 'characters');
    }
    else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Parse DOCX
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = result.value;
      console.log('✅ DOCX parsed, extracted', extractedText.length, 'characters');
    }
    else if (req.file.mimetype === 'application/msword') {
      // For old .doc files, try mammoth (it might work) or return error
      try {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
        console.log('✅ DOC parsed, extracted', extractedText.length, 'characters');
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
    console.error('File upload error:', error);
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

    console.log('🔍 Analyzing resume text (public)...');

    // Import candidateDigestPrompt for structured extraction
    const { candidateDigestPrompt } = await import('./lib/prompts/candidateDigestPrompt.js');

    try {
      // Get structured data using the same prompt used in pipeline
      const structuredData = await candidateDigestPrompt(resumeText);

      console.log('✅ Resume analysis complete with structured data');
      console.log(`   - Extracted ${structuredData.skills?.length || 0} skills`);
      console.log(`   - Extracted ${structuredData.experiences?.length || 0} experiences`);
      console.log(`   - Extracted ${structuredData.education?.length || 0} education entries`);
      console.log(`   - Extracted ${structuredData.projects?.length || 0} projects`);

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
      console.error('Structured parsing failed, falling back to OpenAI basic extraction:', parseError);
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
    } else if (modelName === 'gpt-5' || modelName === 'gpt-5-nano') {
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

    console.log('✅ Resume analysis complete');

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
    console.error('Resume analysis error:', error);

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
app.post('/api/generate', authenticateToken, async (req, res) => {
  try {
    const { resumeText, jobDescription, aiMode = 'gpt-4o' } = req.body;

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
    console.error('Generate error:', error);
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
    console.error('Job status error:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

app.get('/api/job/:jobId/download/:type', authenticateToken, async (req, res) => {
  try {
    const { jobId, type } = req.params;

    // Verify job belongs to user
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true }
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
      artifactType === 'PDF_OUTPUT' ? 'application/pdf' :
      artifactType === 'LATEX_SOURCE' ? 'text/x-latex' :
      'application/json';

    const filename =
      artifactType === 'PDF_OUTPUT' ? 'resume.pdf' :
      artifactType === 'LATEX_SOURCE' ? 'resume.tex' :
      'resume.json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(artifact.content);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download artifact' });
  }
});

// Simple status endpoint for polling if needed
app.get('/api/job/:jobId/status', authenticateToken, async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      select: {
        id: true,
        status: true,
        userId: true,
        createdAt: true,
        updatedAt: true
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
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// User's job history
app.get('/api/jobs', authenticateToken, async (req, res) => {
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
    console.error('Jobs list error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Queue metrics endpoint
app.get('/api/metrics/queue', authenticateToken, async (req, res) => {
  try {
    const metrics = await getQueueMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Queue metrics error:', error);
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
    console.error('HTML generation error:', error);
    res.status(500).json({ error: error.message });
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
    const resumes = jobs.map(job => ({
      fileName: `resume-${job.id}.pdf`,
      pdfUrl: `/api/resumes/resume-${job.id}.pdf`,
      texUrl: `/api/job/${job.id}/download/latex`,
      role: job.role || undefined,
      company: job.company || undefined,
      jobUrl: job.jobUrl || undefined,
      createdAt: job.createdAt.toISOString()
    }));

    console.log(`📄 Returning ${resumes.length} resumes for user ${req.userId}`);
    res.json(resumes);
  } catch (error) {
    console.error('❌ Error fetching resumes:', error);
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

    console.log(`📊 User ${req.userId} quota: ${quota.used}/${quota.limit}`);
    res.json(quota);
  } catch (error) {
    console.error('❌ Error fetching quota:', error);
    res.status(500).json({ error: 'Failed to fetch quota' });
  }
});

/**
 * POST /api/process-job - Start a new resume generation job (PRODUCTION-READY)
 * Required by: Dashboard.tsx, DashboardModern.tsx, DashboardUnified.tsx
 */
app.post('/api/process-job', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, aiMode, matchMode } = req.body;

    // Validation
    if (!jobDescription || jobDescription.trim().length === 0) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    if (jobDescription.trim().length < 50) {
      return res.status(400).json({ error: 'Job description too short. Please provide more details.' });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 NEW JOB REQUEST - User ${req.userId}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📋 Request body:`, {
      jobDescriptionLength: jobDescription.length,
      jobDescriptionPreview: jobDescription.substring(0, 100) + '...',
      aiMode: aiMode || 'not specified',
      matchMode: matchMode || 'not specified'
    });

    // Get user's profile data
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    // Robust validation
    if (!profile) {
      console.error(`❌ No profile record found for user ${req.userId}`);
      return res.status(400).json({
        error: 'Profile not found. Please complete your profile first.',
        action: 'REDIRECT_TO_ONBOARDING'
      });
    }

    if (!profile.data || typeof profile.data !== 'object') {
      console.error(`❌ Invalid profile data structure for user ${req.userId}`);
      return res.status(400).json({
        error: 'Invalid profile data. Please update your profile.',
        action: 'REDIRECT_TO_PROFILE'
      });
    }

    // Detailed profile validation
    const profileData = profile.data;
    console.log(`\n📊 PROFILE DATA ANALYSIS:`);
    console.log(`├─ Personal Info:`);
    console.log(`│  ├─ Name: ${profileData.name || 'MISSING'}`);
    console.log(`│  ├─ Email: ${profileData.email || 'MISSING'}`);
    console.log(`│  ├─ Phone: ${profileData.phone || 'MISSING'}`);
    console.log(`│  └─ Location: ${profileData.location || 'MISSING'}`);
    console.log(`├─ Professional Data:`);
    console.log(`│  ├─ Experiences: ${(profileData.experiences || profileData.experience || []).length} items`);
    console.log(`│  ├─ Skills: ${(profileData.skills || []).length} items`);
    console.log(`│  ├─ Education: ${(profileData.education || []).length} items`);
    console.log(`│  ├─ Projects: ${(profileData.projects || []).length} items`);
    console.log(`│  └─ Resume Text: ${profileData.resumeText ? `${profileData.resumeText.length} chars` : 'NONE'}`);
    console.log(`└─ Additional Info: ${profileData.additionalInfo ? `${profileData.additionalInfo.length} chars` : 'NONE'}`);

    // Check minimum data requirements
    const hasExperience = (profileData.experiences || profileData.experience || []).length > 0;
    const hasEducation = (profileData.education || []).length > 0;
    const hasResumeText = profileData.resumeText && profileData.resumeText.trim().length > 100;
    const hasMinimumData = hasExperience || hasEducation || hasResumeText;

    if (!hasMinimumData) {
      console.error(`❌ Insufficient profile data for user ${req.userId}`);
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

    console.log(`\n✅ Profile validation passed`);
    console.log(`📦 Normalized profile ready for LLM (${JSON.stringify(normalizedProfile).length} chars)`);

    // Create the job record
    const job = await prisma.job.create({
      data: {
        userId: req.userId,
        status: 'PENDING',
        jobDescription,
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

    console.log(`\n✅ Job ${job.id} created and queued`);
    console.log(`${'='.repeat(80)}\n`);

    // Start async processing with normalized profile data
    processJobAsyncSimplified(job.id, normalizedProfile, jobDescription);

    // Return immediately with job ID
    res.json({ jobId: job.id });
  } catch (error) {
    console.error(`\n❌ CRITICAL ERROR in /api/process-job:`, error);
    console.error(`Stack trace:`, error.stack);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

/**
 * Production-ready async job processing - LLM-driven with error feedback loop
 */
async function processJobAsyncSimplified(jobId, profileData, jobDescription) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  const startTime = Date.now();

  try {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🤖 ASYNC PROCESSING STARTED - Job ${jobId}`);
    console.log(`${'─'.repeat(80)}`);

    // Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    // Detailed data inspection before sending to LLM
    console.log(`\n📊 DATA BEING SENT TO LLM:`);
    console.log(`├─ Profile Data:`);
    console.log(`│  ├─ Name: "${profileData.name || 'NOT PROVIDED'}"`);
    console.log(`│  ├─ Email: "${profileData.email || 'NOT PROVIDED'}"`);
    console.log(`│  ├─ Phone: "${profileData.phone || 'NOT PROVIDED'}"`);
    console.log(`│  ├─ Location: "${profileData.location || 'NOT PROVIDED'}"`);
    console.log(`│  ├─ Experience items: ${(profileData.experience || []).length}`);
    console.log(`│  ├─ Skills: ${(profileData.skills || []).length}`);
    console.log(`│  ├─ Education: ${(profileData.education || []).length}`);
    console.log(`│  ├─ Projects: ${(profileData.projects || []).length}`);
    console.log(`│  ├─ Additional Info: ${profileData.additionalInfo ? profileData.additionalInfo.length + ' chars' : 'none'}`);
    console.log(`│  └─ Resume Text: ${profileData.resumeText ? profileData.resumeText.length + ' chars' : 'none'}`);

    if (profileData.experience && profileData.experience.length > 0) {
      console.log(`│`);
      console.log(`│  📌 First experience: ${profileData.experience[0].title || profileData.experience[0].role || 'untitled'} at ${profileData.experience[0].company || 'unknown'}`);
    }

    if (profileData.additionalInfo && profileData.additionalInfo.length > 100) {
      console.log(`│  📝 Additional context preview: "${profileData.additionalInfo.substring(0, 100)}..."`);
    }

    // Prepare data for LLM - pass everything as structured JSON
    const userDataForLLM = JSON.stringify(profileData, null, 2);
    console.log(`\n📦 Total profile data size: ${userDataForLLM.length} characters`);
    console.log(`📝 Job description length: ${jobDescription.length} characters`);

    // Show a sample of what's being sent
    console.log(`\n📄 Sample of profile data being sent to LLM:`);
    console.log(userDataForLLM.substring(0, 500) + '...\n');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Initial generation
    console.log(`🧠 Calling gpt-5-mini (no reasoning effort for speed)...`);
    const genStart = Date.now();
    let latexCode = await generateLatexWithLLM(openai, userDataForLLM, jobDescription);
    const genTime = Date.now() - genStart;
    console.log(`✅ LaTeX generation completed in ${(genTime / 1000).toFixed(2)}s`);
    console.log(`📄 Generated LaTeX: ${latexCode.length} characters`);

    // Show first 300 chars of generated LaTeX to verify it has user's actual name
    console.log(`\n📋 First 300 chars of generated LaTeX:`);
    console.log(latexCode.substring(0, 300));

    // Verify the LaTeX contains the user's actual name (if provided)
    if (profileData.name && profileData.name !== 'Candidate' && profileData.name.trim()) {
      if (latexCode.includes(profileData.name)) {
        console.log(`✅ Verified: User's name "${profileData.name}" found in LaTeX`);
      } else {
        console.warn(`⚠️  WARNING: User's name "${profileData.name}" NOT found in generated LaTeX!`);
        console.warn(`   This might indicate LLM didn't properly extract user data`);
      }
    }

    // Try to compile with error feedback loop
    let pdfBuffer = null;
    while (attempt < MAX_RETRIES && !pdfBuffer) {
      attempt++;
      console.log(`\n🔨 Compilation attempt ${attempt}/${MAX_RETRIES}`);

      try {
        const compileStart = Date.now();
        pdfBuffer = await compileLatex(latexCode);
        const compileTime = Date.now() - compileStart;
        console.log(`✅ PDF compiled successfully on attempt ${attempt} (${(compileTime / 1000).toFixed(2)}s)`);
        console.log(`📊 PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
      } catch (compileError) {
        console.log(`❌ Compilation failed: ${compileError.message}`);
        console.log(`📋 Error details:`, compileError.stack ? compileError.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace');

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
          console.log(`\n🔄 Sending LaTeX error back to LLM for fixing (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          const fixStart = Date.now();
          latexCode = await fixLatexWithLLM(openai, latexCode, compileError.message);
          const fixTime = Date.now() - fixStart;
          console.log(`✅ LLM returned fixed LaTeX in ${(fixTime / 1000).toFixed(2)}s`);
        } else {
          throw new Error(`Failed to compile after ${MAX_RETRIES} attempts. Last error: ${compileError.message}`);
        }
      }
    }

    // Save artifacts
    console.log(`\n💾 Saving artifacts to database...`);
    await prisma.artifact.create({
      data: {
        jobId,
        type: 'PDF_OUTPUT',
        content: pdfBuffer,
        metadata: {
          attempts: attempt,
          model: 'gpt-5-mini',
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2)
        }
      }
    });
    console.log(`✅ PDF artifact saved`);

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
    console.log(`✅ LaTeX artifact saved`);

    // Mark job as completed
    const totalTime = Date.now() - startTime;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        diagnostics: {
          completedAt: new Date().toISOString(),
          attempts: attempt,
          model: 'gpt-5-mini',
          totalTimeSeconds: (totalTime / 1000).toFixed(2),
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2),
          success: true
        }
      }
    });

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`✅ JOB COMPLETED SUCCESSFULLY - ${jobId}`);
    console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`🔢 Compilation attempts: ${attempt}`);
    console.log(`${'─'.repeat(80)}\n`);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`\n${'─'.repeat(80)}`);
    console.error(`❌ JOB FAILED - ${jobId}`);
    console.error(`${'─'.repeat(80)}`);
    console.error(`Error: ${error.message}`);
    console.error(`Time before failure: ${(totalTime / 1000).toFixed(2)}s`);
    console.error(`Attempts made: ${attempt}`);
    console.error(`Stack trace:`, error.stack);
    console.error(`${'─'.repeat(80)}\n`);

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
          success: false
        }
      }
    });
  }
}

/**
 * Generate LaTeX using gpt-5-mini with ultrathink
 */
async function generateLatexWithLLM(openai, userDataJSON, jobDescription) {
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `You are an expert ATS-optimized resume writer and LaTeX developer specializing in tailoring resumes for specific roles.

YOUR TASK:
Analyze ALL available user data (structured fields, resumeText, additionalInfo) and the target job description to create a strategically optimized resume that:
1. Passes ATS systems with proper keyword matching
2. Highlights the most relevant experiences for THIS specific role
3. Reframes accomplishments to align with the job requirements
4. Uses the candidate's ACTUAL information (never invent or hallucinate)

DATA SOURCES TO USE:
- name, email, phone, location (use exactly as provided)
- experiences[] - Work history with companies, roles, dates, and accomplishments
- skills[] - Technical and soft skills
- projects[] - Side projects and portfolio work
- education[] - Degrees and certifications
- resumeText - Full resume context (may contain additional details)
- additionalInfo - Extra context the user provided (use this to understand background)
- summary - Professional summary

INTELLIGENT TAILORING STRATEGY:
1. **Keyword Optimization**: Extract key requirements from the job description (technologies, methodologies, soft skills) and ensure they appear naturally if the user has that experience
2. **Experience Selection**: Prioritize experiences most relevant to the target role. If applying to a sales role but user has tech background, emphasize client-facing work, revenue impact, stakeholder communication
3. **Bullet Reframing**: Rewrite experience bullets to emphasize aspects most relevant to the job (e.g., for PM role: decision-making, roadmap, metrics; for engineering role: architecture, scalability, performance)
4. **Skills Matching**: Place job-relevant skills prominently
5. **Additional Context**: Use additionalInfo to fill gaps or understand the user's career narrative

ATS REQUIREMENTS:
- Use standard section headers: Summary, Experience, Projects, Education, Skills
- No graphics, tables, or complex formatting
- Clean LaTeX with standard fonts
- Keywords from job description naturally integrated
- Quantified achievements (numbers, percentages, scale)

OUTPUT RULES:
- Output ONLY valid LaTeX code - no markdown, no explanations
- Include \\documentclass, \\begin{document}, and \\end{document}
- Use 10pt article class with tight margins for 1-page fit
- Use user's ACTUAL name (never "Candidate" or generic names)
- Never invent experiences, companies, or metrics not in the data`,
            cache_control: { type: 'ephemeral' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `USER PROFILE DATA (cached):
${userDataJSON}`,
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text: `TARGET JOB DESCRIPTION:
${jobDescription}

Instructions:
1. Read through ALL the user data carefully (including additionalInfo and resumeText)
2. Identify the 3-5 most important requirements/keywords in the job description
3. Select and reframe the user's experiences to emphasize relevant skills
4. Ensure every bullet point is achievement-focused with quantified results
5. Make sure the resume would pass ATS keyword matching for this specific role

Generate the complete LaTeX document now.`
          }
        ]
      }
    ]
    // Note: gpt-5-mini doesn't support temperature parameter, only default (1) is allowed
  });

  let latex = response.choices[0].message.content.trim();

  // Clean markdown code blocks if present
  latex = latex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '').replace(/^```.*$/gm, '');

  console.log(`📝 Generated LaTeX (${latex.length} chars)`);
  return latex;
}

/**
 * Fix LaTeX errors using LLM
 */
async function fixLatexWithLLM(openai, brokenLatex, errorMessage) {
  console.log(`🔧 Asking LLM to fix: ${errorMessage.substring(0, 200)}`);

  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content: `You are a LaTeX debugging expert. Fix the LaTeX compilation error and return the corrected LaTeX code.

COMMON LATEX ERRORS AND FIXES:
- "Missing $ inserted" → Escape special characters: _ → \_ , & → \& , % → \% , $ → \$ , # → \#
- Unescaped underscores in text → Wrap in \texttt{} or escape with \_
- Math mode characters outside $ $ → Either escape them or wrap in math mode
- Undefined control sequences → Check for typos in commands

RULES:
1. If error mentions "Missing $", find ALL unescaped special characters (_, &, %, $, #) and escape them
2. Keep all content intact - don't remove information
3. Return ONLY the corrected LaTeX code
4. No explanations, no markdown`
      },
      {
        role: 'user',
        content: `This LaTeX code failed to compile with this error:

ERROR:
${errorMessage}

LATEX CODE:
${brokenLatex}

SPECIFIC INSTRUCTIONS:
- Look for line ${errorMessage.match(/line (\d+)/)?.[1] || errorMessage.match(/resume\.tex:(\d+)/)?.[1] || '?'} mentioned in the error
- If "Missing $" error: Find and escape ALL special characters (_ & % $ #) in that area
- Common issue: underscore in text like "skill_name" should be "skill\\_name"

Fix the error and return the corrected LaTeX code.`
      }
    ]
    // Note: gpt-5-mini doesn't support temperature parameter
  });

  let fixedLatex = response.choices[0].message.content.trim();
  fixedLatex = fixedLatex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '').replace(/^```.*$/gm, '');

  console.log(`✅ LLM returned fixed LaTeX (${fixedLatex.length} chars)`);
  return fixedLatex;
}

/**
 * OLD Async job processing function (keeping for backward compatibility)
 */
async function processJobAsync(jobId, userId, jobDescription, aiMode, matchMode, profileData) {
  try {
    console.log(`🔄 Starting async processing for job ${jobId} (updated)`);
    console.log(`📊 Processing with: aiMode=${aiMode}, matchMode=${matchMode}`);

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
        console.log(`📝 Extracted: Company="${company || 'N/A'}", Role="${role || 'N/A'}"`);
      }
    }

    // Initialize AI Resume Generator - using the same pattern as /api/generate endpoint
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

    console.log(`🤖 Starting AI generation...`);

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

      console.log(`📊 Profile data structure:`, {
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

    console.log(`📝 Transformed user data:`, {
      hasName: !!transformedUserData.personalInfo.name,
      hasEmail: !!transformedUserData.personalInfo.email,
      experienceCount: transformedUserData.experience ? transformedUserData.experience.length : 0,
      educationCount: transformedUserData.education ? transformedUserData.education.length : 0,
      skillsCount: transformedUserData.skills ? transformedUserData.skills.length : 0,
      hasResumeText: !!transformedUserData.resumeText,
      hasSummary: !!transformedUserData.summary
    });

    // Use SIMPLE generation - just pass raw profile data
    console.log(`📦 Using SIMPLE generation with raw profile data`);
    const { latex } = await generator.generateResumeSimple(
      processedProfileData,  // Pass RAW profile data, let LLM extract everything
      jobDescription,
      {
        targetJobTitle: role || '',
        model: aiMode === 'gpt-5-mini' ? 'gpt-4o' : aiMode
      }
    );

    // Compile to PDF
    let pdf = null;
    try {
      pdf = await generator.compileResume(latex);
      console.log('✅ PDF compilation successful');
    } catch (compileError) {
      console.error('❌ PDF compilation failed:', compileError.message);
      throw compileError;
    }

    console.log(`📄 PDF generated, size: ${pdf ? pdf.length : 0} bytes`);

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
      console.log(`💾 Saving artifacts for job ${jobId}...`);

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
      console.log(`✅ PDF artifact saved with ID: ${pdfArtifact.id}`);

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
        console.log(`✅ LaTeX artifact saved with ID: ${latexArtifact.id}`);
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

      console.log(`✅ Job ${jobId} marked as COMPLETED`);
      console.log(`📊 Job details: Company="${updatedJob.company}", Role="${updatedJob.role}"`);
    } else {
      console.error(`❌ Generation failed or no PDF produced for job ${jobId}`);
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
    console.error(`❌ Error processing job ${jobId}:`, error);

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
      console.error(`❌ Failed to update job status:`, updateError);
    }
  }
}

/**
 * GET /api/resumes/:fileName - Download a specific resume file
 * Required by: Dashboard.tsx, DashboardModern.tsx, DashboardUnified.tsx, History.tsx
 */
app.get('/api/resumes/:fileName', authenticateToken, async (req, res) => {
  try {
    const { fileName } = req.params;

    // Extract job ID from fileName (format: resume-{jobId}.pdf)
    const jobIdMatch = fileName.match(/resume-(.+)\.pdf$/);
    if (!jobIdMatch) {
      return res.status(400).json({ error: 'Invalid file name format' });
    }

    const jobId = jobIdMatch[1];

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

    // Set appropriate headers and send the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(artifact.content);

    console.log(`📥 Served PDF ${fileName} for user ${req.userId}`);
  } catch (error) {
    console.error('❌ Error downloading resume:', error);
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

// Static file serving in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// NEW SIMPLIFIED AI GENERATION ENDPOINT
import { generateResumeEndpoint, checkCompilersEndpoint } from './lib/simplified-api.js';

app.post('/api/generate-ai', authenticateToken, generateResumeEndpoint);
app.get('/api/check-compilers', authenticateToken, checkCompilersEndpoint);

// Start server
const PORT = config.server.port;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   - Health check: http://localhost:${PORT}/health`);
  console.log(`   - Auth endpoints: http://localhost:${PORT}/api/register, /api/login`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  // Close server
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;