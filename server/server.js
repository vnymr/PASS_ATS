import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from './lib/prisma-client.js';
import dotenv from 'dotenv';
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

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
} else {
  if (!process.env.DATABASE_URL) {
    dotenv.config();
  }
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
  origin: config.server.allowedOrigins,
  credentials: true
}));

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
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    req.userId = user.id; // Use 'id' from JWT payload
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
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Return the profile data directly, not wrapped in a profile object
    console.log('📤 Returning profile data:', JSON.stringify(profile.data, null, 2));
    res.json(profile.data);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Profile update request:', req.user.email);

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
      where: { userId: req.user.id },
      update: {
        data: processedData,
        updatedAt: new Date()
      },
      create: {
        userId: req.user.id,
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
app.post('/api/upload/resume', resumeUpload.single('resume'), async (req, res) => {
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

// Resume generation endpoints - Direct generation with error retry
app.post('/api/generate', authenticateToken, async (req, res) => {
  try {
    const {
      resumeText,
      jobDescription,
      company,
      role,
      jobUrl,
      aiMode = 'gpt-5-mini',
      matchMode = 'balanced'
    } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description required' });
    }

    // Generate a unique job ID
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[API] Starting new pipeline generation for job ${jobId}`);
    console.log(`[API] Parameters: aiMode=${aiMode}, company=${company}, role=${role}`);

    // Get structured profile data if user has profile
    let profileData = null;
    let useStructuredData = false;

    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: req.user.id }
      });

      if (profile && profile.data) {
        profileData = profile.data;

        // Check if profile data has the new structure directly OR under fullData
        if (profileData.experiences || profileData.skills || profileData.education ||
            profileData.fullData?.experiences || profileData.fullData?.skills || profileData.fullData?.education) {

          // If structured data is under fullData, lift it up (non-destructively)
          if (!profileData.experiences && profileData.fullData) {
            const structuredProfile = {
              ...profileData,
              experiences: profileData.fullData.experiences || profileData.experiences,
              skills: profileData.fullData.skills || profileData.skills,
              education: profileData.fullData.education || profileData.education,
              projects: profileData.fullData.projects || profileData.projects,
              certifications: profileData.fullData.certifications || profileData.certifications
            };
            profileData = structuredProfile;
          }

          // Check if structured data is sufficient
          if (dataValidator.hassufficientStructuredData(profileData)) {
            useStructuredData = true;
            console.log(`[API] Using structured profile data for user ${req.user.id}`);
            console.log(`[API] Profile has ${profileData.skills?.length || 0} skills, ${profileData.experiences?.length || 0} experiences`);
          } else {
            console.log(`[API] Structured data insufficient, will use fallback to combined raw text`);
            useStructuredData = false;
          }
        } else {
          console.log(`[API] Profile exists but has no structured data, will use fallback`);
          useStructuredData = false;
        }
      }
    } catch (err) {
      console.error('[API] Could not fetch profile:', err.message);
      // Continue with resume text if profile fetch fails
      useStructuredData = false;
    }

    // Validation: Require either structured profile OR resumeText
    if (!useStructuredData && !resumeText) {
      // Try to use raw fields from profile as fallback
      if (profileData?.resumeText) {
        const combinedRawText = profileData.additionalInfo
          ? `${profileData.resumeText}\n\nADDITIONAL INFORMATION:\n${profileData.additionalInfo}`
          : profileData.resumeText;

        console.log(`[API] Using combined resumeText + additionalInfo from profile as fallback`);
        // Override resumeText for pipeline
        req.body.resumeText = combinedRawText;
      } else {
        return res.status(400).json({ error: 'Resume text or structured profile required' });
      }
    }

    // If not using structured data but have additionalInfo, combine with resumeText
    let pipelineResumeText = null;
    if (!useStructuredData) {
      if (profileData?.additionalInfo && resumeText) {
        pipelineResumeText = `${resumeText}\n\nADDITIONAL INFORMATION:\n${profileData.additionalInfo}`;
        console.log(`[API] Combined resumeText with additionalInfo for fallback parsing`);
      } else {
        pipelineResumeText = resumeText || req.body.resumeText;
      }
    }

    // === AI RESUME GENERATOR ===
    console.log(`[API] Using AI Resume Generator for job ${jobId}`);
    const pipelineStartTime = Date.now();

    // Initialize generator
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY);

    // Prepare user data - ensure all fields are included
    const userData = useStructuredData ? {
      ...profileData,
      // Map field names correctly
      fullName: profileData.name || profileData.fullName || 'Candidate',
      email: profileData.email || '',
      phone: profileData.phone || '',
      location: profileData.location || '',
      linkedin: profileData.linkedin || '',
      website: profileData.website || '',
      summary: profileData.summary || '',
      skills: profileData.skills || [],
      experiences: profileData.experiences || [],
      education: profileData.education || [],
      projects: profileData.projects || [],
      certifications: profileData.certifications || [],
      // Ensure additionalInfo is included
      additionalInfo: profileData.additionalInfo || '',
      resumeText: profileData.resumeText || ''
    } : {
      resumeText: pipelineResumeText,
      fullName: profileData?.name || profileData?.fullName || 'Candidate',
      email: profileData?.email || '',
      phone: profileData?.phone || '',
      location: profileData?.location || '',
      // Include additionalInfo even in fallback mode
      additionalInfo: profileData?.additionalInfo || ''
    };

    // Generate resume with PDF
    const generatedResult = await generator.generateWithPDF(
      userData,
      jobDescription,
      {
        style: 'auto',
        model: aiMode === 'gpt-5-mini' ? 'gpt-4' : aiMode,
        preferences: { company, role }
      }
    );

    // Create result object compatible with existing code
    const result = {
      success: true,
      artifacts: {
        pdfBuffer: generatedResult.pdf,
        latexSource: generatedResult.latex,
        templateUsed: 'ai-generated',
        generationType: 'ai-generator',
        metrics: {}
      }
    };

    const pipelineDuration = Date.now() - pipelineStartTime;
    console.log(`[API] Pipeline completed in ${pipelineDuration}ms`);

    // Log pipeline metrics
    if (result.artifacts?.templateUsed) {
      console.log(`[API] Template used: ${result.artifacts.templateUsed}`);
    }
    if (result.artifacts?.metrics) {
      console.log(`[API] Pipeline metrics:`, result.artifacts.metrics);
    }

    if (result.success) {
      // Save to database for history
      let job;
      try {
        job = await prisma.job.create({
          data: {
            id: jobId,
            userId: req.user.id,
            status: 'COMPLETED',
            resumeText: resumeText || '',  // Handle null resumeText when using profile data
            jobDescription,
            company: company || null,
            role: role || null,
            jobUrl: jobUrl || null,
            aiMode,
            matchMode,
            diagnostics: {
              generationType: result.artifacts.generationType || 'pipeline',
              templateUsed: result.artifacts.templateUsed || 'unknown',
              pipelineMetrics: result.artifacts.metrics || {},
              processingTime: pipelineDuration,
              dataSource: useStructuredData ? 'profile' : 'resumeText_fallback',
              timestamp: Date.now()
            }
          }
        });
      } catch (dbError) {
        console.error(`[API] Failed to save job to database:`, dbError);
        // Continue even if database save fails - user still gets their PDF
      }

      // Save artifacts - with detailed logging
      console.log(`[API] Saving artifacts for job ${jobId}`);
      console.log(`[API] PDF Buffer exists: ${!!result.artifacts.pdfBuffer}`);
      console.log(`[API] PDF Buffer size: ${result.artifacts.pdfBuffer ? result.artifacts.pdfBuffer.length : 0}`);
      console.log(`[API] LaTeX Source exists: ${!!result.artifacts.latexSource}`);

      if (result.artifacts.pdfBuffer) {
        console.log(`[API] Saving PDF artifact (${result.artifacts.pdfBuffer.length} bytes)`);
        await prisma.artifact.create({
          data: {
            jobId,
            type: 'PDF_OUTPUT',
            content: result.artifacts.pdfBuffer,
            version: 1,
            metadata: result.artifacts.pdfMetadata || {}
          }
        });
        console.log(`[API] PDF artifact saved successfully`);
      } else {
        console.error(`[API] ❌ NO PDF BUFFER FOUND - PDF will not be downloadable!`);
      }

      if (result.artifacts.latexSource) {
        console.log(`[API] Saving LaTeX artifact`);
        await prisma.artifact.create({
          data: {
            jobId,
            type: 'LATEX_SOURCE',
            content: Buffer.from(result.artifacts.latexSource),
            version: 1,
            metadata: {}
          }
        });
        console.log(`[API] LaTeX artifact saved successfully`);
      }

      // Include additional pipeline data for debugging
      const response = {
        success: true,
        jobId,
        message: 'Resume generated successfully',
        downloadUrl: `/api/job/${jobId}/download/pdf`,
        // New pipeline-specific data
        templateUsed: result.artifacts?.templateUsed,
        generationType: result.artifacts?.generationType || 'pipeline',
        processingTime: pipelineDuration
      };

      // Include pipeline log in development/testing
      if (process.env.NODE_ENV !== 'production') {
        response.pipelineLog = result.artifacts?.pipelineLog;
        response.metrics = result.artifacts?.metrics;
      }

      res.json(response);
    } else {
      // Pipeline failed - log details for debugging
      console.error(`[API] Pipeline failed for job ${jobId}:`, result.error);
      if (result.artifacts?.pipelineLog) {
        console.error(`[API] Pipeline log:`, JSON.stringify(result.artifacts.pipelineLog, null, 2));
      }

      // Save failed job to database
      await prisma.job.create({
        data: {
          id: jobId,
          userId: req.user.id,
          status: 'FAILED',
          resumeText,
          jobDescription,
          company: company || null,
          role: role || null,
          jobUrl: jobUrl || null,
          aiMode,
          matchMode,
          error: result.error,
          diagnostics: {
            error: result.error,
            pipelineLog: result.artifacts?.pipelineLog || [],
            failedAtStage: result.artifacts?.pipelineLog?.slice(-1)[0]?.stage || 'unknown'
          }
        }
      });

      res.status(500).json({
        error: result.error || 'Failed to generate resume',
        jobId,
        // Include debug info in non-production
        ...(process.env.NODE_ENV !== 'production' && {
          pipelineLog: result.artifacts?.pipelineLog,
          failedAtStage: result.artifacts?.pipelineLog?.slice(-1)[0]?.stage
        })
      });
    }
  } catch (error) {
    console.error(`[API] Unexpected error in /api/generate:`, error);
    console.error(`[API] Stack trace:`, error.stack);

    // Get pipeline metrics for debugging
    const metrics = getMetrics();
    console.error(`[API] Current pipeline metrics:`, metrics);

    res.status(500).json({
      error: error.message || 'Failed to generate resume',
      // Include detailed error info in non-production
      ...(process.env.NODE_ENV !== 'production' && {
        errorType: error.constructor.name,
        errorStack: error.stack
      })
    });
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

    if (job.userId !== req.user.id) {
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

    if (job.userId !== req.user.id) {
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

    if (job.userId !== req.user.id) {
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

    const where = { userId: req.user.id };
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

// Direct resume generation - simple endpoint (LaTeX-based)
app.post('/api/generate-direct', authenticateToken, async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const userId = req.userId;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description required' });
    }

    // Get user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user?.profile) {
      return res.status(400).json({ error: 'Profile not found' });
    }

    // Import and use direct generator
    const { generateResumeDirect } = await import('./lib/direct-generator.js');
    const result = await generateResumeDirect(user.profile, jobDescription);

    if (result.success) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.send(result.pdf);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Direct generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// HTML-based resume generation endpoint (NEW - simpler and more reliable)
app.post('/api/generate-html', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, aiMode = 'gpt-5-mini', outputFormat = 'pdf' } = req.body;
    const userId = req.userId;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description required' });
    }

    // Get user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user?.profile) {
      return res.status(400).json({ error: 'Profile not found' });
    }

    // Import and use HTML generator
    const { generateResumeHTML } = await import('./lib/html-generator.js');
    const result = await generateResumeHTML(user.profile, jobDescription, aiMode);

    if (result.success) {
      if (outputFormat === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.send(result.html);
      } else if (outputFormat === 'json') {
        res.json(result.json);
      } else if (outputFormat === 'pdf' && result.pdf) {
        // Send PDF if available
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
        res.send(result.pdf);
      } else if (outputFormat === 'pdf' && !result.pdf && result.html) {
        // Fallback: send HTML with warning when PDF generation failed
        res.json({
          warning: 'PDF generation failed, returning HTML and JSON instead',
          html: result.html,
          json: result.json,
          error: result.error
        });
      } else {
        res.status(500).json({ error: 'Failed to generate resume in requested format' });
      }
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('HTML generation error:', error);
    res.status(500).json({ error: error.message });
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