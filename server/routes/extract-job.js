import OpenAI from 'openai';
import crypto from 'crypto';

/**
 * Extract job details from text content using LLM
 * Endpoint: POST /api/extract-job
 */
export async function extractJobHandler(req, res) {
  try {
    const { textContent, url, pageTitle } = req.body;

    // Validation
    if (!textContent || textContent.trim().length < 50) {
      return res.status(400).json({
        error: 'Job content too short',
        fallback: true
      });
    }

    if (textContent.length > 10000) {
      return res.status(400).json({
        error: 'Content too long (max 10,000 characters)',
        fallback: true
      });
    }

    console.log('\n📋 Job extraction request:');
    console.log(`   - URL: ${url}`);
    console.log(`   - Page title: ${pageTitle}`);
    console.log(`   - Content length: ${textContent.length} chars`);

    // Check cache (using URL as key)
    const cacheKey = `job:${crypto.createHash('md5').update(url || textContent).digest('hex')}`;

    // Simple in-memory cache (in production, use Redis)
    if (global.jobExtractionCache) {
      const cached = global.jobExtractionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 86400000) { // 24 hours
        console.log('✅ Cache hit for job extraction');
        return res.json(cached.data);
      }
    } else {
      global.jobExtractionCache = new Map();
    }

    // Extract using LLM
    console.log('🤖 Extracting job details with LLM...');
    const extracted = await extractJobWithLLM(textContent, pageTitle);

    console.log('✅ Extraction complete:', {
      jobTitle: extracted.jobTitle,
      company: extracted.company,
      skillsCount: extracted.skills?.length || 0
    });

    // Cache the result
    global.jobExtractionCache.set(cacheKey, {
      data: extracted,
      timestamp: Date.now()
    });

    // Clean old cache entries (keep last 100)
    if (global.jobExtractionCache.size > 100) {
      const firstKey = global.jobExtractionCache.keys().next().value;
      global.jobExtractionCache.delete(firstKey);
    }

    res.json(extracted);

  } catch (error) {
    console.error('❌ Job extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract job details',
      message: error.message,
      fallback: true  // Signal to extension to show manual input
    });
  }
}

/**
 * Extract job details using GPT-5-mini
 */
async function extractJobWithLLM(textContent, pageTitle) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [{
        role: 'system',
        content: 'Extract job posting details from text. Return valid JSON only with: jobTitle, company, location, experienceLevel, skills (array of strings), keyRequirements (array of strings), description (string, max 2000 chars). If a field is not found, use null for strings or empty array for arrays.'
      }, {
        role: 'user',
        content: `Extract job details from this posting (page title: "${pageTitle || 'Unknown'}"):

${textContent}

Return JSON with exact structure:
{
  "jobTitle": "exact job title from posting",
  "company": "company name",
  "location": "location (city, state or remote)",
  "experienceLevel": "entry-level|mid-level|senior|lead|executive or null",
  "skills": ["skill1", "skill2", ...],
  "keyRequirements": ["requirement1", "requirement2", ...],
  "description": "first 2000 chars of job description"
}`
      }],
      response_format: { type: "json_object" },
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Validate and clean the extracted data
    return {
      jobTitle: result.jobTitle || pageTitle || 'Unknown Position',
      company: result.company || 'Unknown Company',
      location: result.location || 'Not specified',
      experienceLevel: result.experienceLevel || 'Not specified',
      skills: Array.isArray(result.skills) ? result.skills.slice(0, 15) : [],
      keyRequirements: Array.isArray(result.keyRequirements) ? result.keyRequirements.slice(0, 10) : [],
      description: result.description || textContent.substring(0, 2000)
    };

  } catch (error) {
    console.error('LLM extraction failed:', error);

    // Fallback: basic extraction
    return {
      jobTitle: pageTitle || 'Unknown Position',
      company: 'Unknown Company',
      location: 'Not specified',
      experienceLevel: 'Not specified',
      skills: extractSkillsBasic(textContent),
      keyRequirements: [],
      description: textContent.substring(0, 2000)
    };
  }
}

/**
 * Basic skill extraction fallback (regex-based)
 */
function extractSkillsBasic(text) {
  const commonSkills = [
    'JavaScript', 'Python', 'Java', 'C\\+\\+', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Go', 'Rust',
    'React', 'Angular', 'Vue', 'Node\\.js', 'Express', 'Django', 'Flask', 'Spring', 'Rails',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'Git', 'GitHub',
    'TypeScript', 'HTML', 'CSS', 'Sass', 'Tailwind',
    'REST', 'GraphQL', 'gRPC', 'Microservices',
    'Machine Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
    'Agile', 'Scrum', 'CI/CD', 'DevOps', 'Linux'
  ];

  const found = new Set();
  const lowerText = text.toLowerCase();

  for (const skill of commonSkills) {
    const regex = new RegExp(`\\b${skill.toLowerCase()}\\b`, 'i');
    if (regex.test(lowerText)) {
      found.add(skill.replace(/\\/g, ''));
    }
  }

  return Array.from(found).slice(0, 15);
}
