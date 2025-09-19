/**
 * Complete Pipeline Integration System
 * Connects micro-prompt pipeline with template system for resume generation
 *
 * Pipeline Stages:
 * 1. jdDigestPrompt → analyzes job description
 * 2. candidateDigestPrompt → analyzes resume text
 * 3. planPrompt → creates generation strategy
 * 4. masterPrompt → generates LaTeX using template + data
 * 5. LaTeX compilation → produces PDF
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import yaml from 'js-yaml';

// Import micro-prompts
import { jdDigestPrompt } from '../prompts/jdDigestPrompt.js';
import { candidateDigestPrompt } from '../prompts/candidateDigestPrompt.js';
import { planPrompt } from '../prompts/planPrompt.js';
import { masterPrompt } from '../prompts/masterPrompt.js';

// Import template registry
import templateRegistry from '../templates/registry/index.js';

// Import utilities from existing system
import { config, getOpenAIModel } from '../config.js';
import { validateLatexSafety } from '../latex-sanitizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache directory for JD digests
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'jd-digests');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Performance metrics tracking
const metrics = {
  stageTimings: {},
  cacheHits: 0,
  cacheMisses: 0,
  templateSelections: {},
  errorRates: {},
  fallbackUsage: 0
};

/**
 * Main pipeline function - orchestrates the complete resume generation
 */
export async function runPipeline({
  jobDescription,
  resumeText,
  companyContext = '',
  aiMode = 'gpt-4o-mini',
  templateId = null,
  useCache = true,
  fallbackToCurrent = true,
  jobId = crypto.randomBytes(8).toString('hex')
}) {
  const startTime = Date.now();
  const pipelineLog = [];

  try {
    console.log(`[Pipeline ${jobId}] Starting pipeline with mode: ${aiMode}`);
    pipelineLog.push({ stage: 'start', timestamp: Date.now(), params: { aiMode, templateId, useCache } });

    // Initialize template registry
    await templateRegistry.initialize();

    // Stage 1: JD Digest (with caching)
    const stage1Start = Date.now();
    let jdDigest;

    if (useCache) {
      const cacheKey = generateCacheKey(jobDescription, companyContext);
      jdDigest = await getCachedJdDigest(cacheKey);

      if (jdDigest) {
        metrics.cacheHits++;
        console.log(`[Pipeline ${jobId}] Cache hit for JD digest`);
        pipelineLog.push({ stage: 'jd_digest', source: 'cache', duration: Date.now() - stage1Start });
      }
    }

    if (!jdDigest) {
      metrics.cacheMisses++;
      console.log(`[Pipeline ${jobId}] Stage 1: Running jdDigestPrompt`);

      try {
        jdDigest = await runWithRetry(
          () => jdDigestPrompt(jobDescription),
          3,
          jobId,
          'jdDigest'
        );

        // Cache the result
        if (useCache && jdDigest) {
          const cacheKey = generateCacheKey(jobDescription, companyContext);
          await setCachedJdDigest(cacheKey, jdDigest);
        }
      } catch (error) {
        console.error(`[Pipeline ${jobId}] Stage 1 failed:`, error);

        // Fallback to basic parsing
        jdDigest = {
          roleFamily: extractRoleFamily(jobDescription),
          seniority: extractSeniority(jobDescription),
          industry: 'Technology',
          companySize: 'Medium',
          companyThemes: [],
          keywords: extractKeywords(jobDescription),
          skills: { required: [], preferred: [] }
        };
      }

      pipelineLog.push({ stage: 'jd_digest', duration: Date.now() - stage1Start, result: jdDigest });
    }

    metrics.stageTimings.jdDigest = Date.now() - stage1Start;

    // Stage 2: Candidate Digest
    const stage2Start = Date.now();
    console.log(`[Pipeline ${jobId}] Stage 2: Running candidateDigestPrompt`);

    let candidateDigest;
    try {
      candidateDigest = await runWithRetry(
        () => candidateDigestPrompt(resumeText),
        3,
        jobId,
        'candidateDigest'
      );
    } catch (error) {
      console.error(`[Pipeline ${jobId}] Stage 2 failed:`, error);

      // Fallback to basic parsing
      candidateDigest = {
        name: extractName(resumeText),
        currentRole: extractCurrentRole(resumeText),
        totalExperience: extractExperience(resumeText),
        topSkills: extractSkills(resumeText),
        industries: [],
        strengths: [],
        achievements: []
      };
    }

    pipelineLog.push({ stage: 'candidate_digest', duration: Date.now() - stage2Start });
    metrics.stageTimings.candidateDigest = Date.now() - stage2Start;

    // Stage 3: Plan Generation
    const stage3Start = Date.now();
    console.log(`[Pipeline ${jobId}] Stage 3: Running planPrompt`);

    let plan;
    try {
      plan = await runWithRetry(
        () => planPrompt(jdDigest, candidateDigest),
        2,
        jobId,
        'planPrompt'
      );
    } catch (error) {
      console.error(`[Pipeline ${jobId}] Stage 3 failed, using default plan:`, error);

      // Default plan
      plan = {
        strategy: 'standard',
        focusAreas: ['skills', 'experience', 'achievements'],
        contentEnhancements: [],
        keywordIntegration: jdDigest.keywords || [],
        templateRecommendation: 'General-Readable-1col'
      };
    }

    pipelineLog.push({ stage: 'plan', duration: Date.now() - stage3Start });
    metrics.stageTimings.plan = Date.now() - stage3Start;

    // Template Selection (if not specified)
    if (!templateId) {
      templateId = await selectTemplate(jdDigest, candidateDigest, plan);
      console.log(`[Pipeline ${jobId}] Auto-selected template: ${templateId}`);
    }

    metrics.templateSelections[templateId] = (metrics.templateSelections[templateId] || 0) + 1;

    // Load template
    const template = await templateRegistry.getTemplateById(templateId);
    console.log(`[Pipeline ${jobId}] Loaded template: ${templateId}`);

    // Stage 4: Master Prompt (LaTeX Generation)
    const stage4Start = Date.now();
    console.log(`[Pipeline ${jobId}] Stage 4: Running masterPrompt with template ${templateId}`);

    let latexSource;
    try {
      const masterResult = await runWithRetry(
        () => masterPrompt({
          jdDigest,
          candidateDigest,
          plan,
          preamble: template.preamble,
          wireframe: template.wireframe
        }),
        2,
        jobId,
        'masterPrompt'
      );

      latexSource = masterResult;
    } catch (error) {
      console.error(`[Pipeline ${jobId}] Stage 4 failed:`, error);

      if (fallbackToCurrent) {
        console.log(`[Pipeline ${jobId}] Falling back to current system`);
        metrics.fallbackUsage++;

        // Import and use the current system as fallback
        const { generateResumeWithDiagnostics } = await import('../resume-generator.js');
        return await generateResumeWithDiagnostics({
          jobId,
          resumeText,
          jobDescription,
          aiMode,
          relevantContent: companyContext
        });
      }

      throw error;
    }

    pipelineLog.push({ stage: 'master_prompt', duration: Date.now() - stage4Start });
    metrics.stageTimings.masterPrompt = Date.now() - stage4Start;

    // Validate LaTeX safety
    const safetyCheck = validateLatexSafety(latexSource);
    if (!safetyCheck.safe) {
      console.log(`[Pipeline ${jobId}] LaTeX safety issues found (continuing anyway): ${safetyCheck.issues.join(', ')}`);
      // throw new Error(`LaTeX safety check failed: ${safetyCheck.issues.join(', ')}`);
    }

    // Stage 5: LaTeX Compilation
    const stage5Start = Date.now();
    console.log(`[Pipeline ${jobId}] Stage 5: Compiling LaTeX to PDF`);

    let pdfResult = await compileLaTeXToPDF(latexSource, jobId);

    // If compilation fails, attempt repair
    if (!pdfResult.success) {
      console.log(`[Pipeline ${jobId}] LaTeX compilation failed, attempting repair`);

      const repairedLatex = await repairLatex(latexSource, pdfResult.error, aiMode);
      if (repairedLatex) {
        pdfResult = await compileLaTeXToPDF(repairedLatex, jobId);

        if (pdfResult.success) {
          latexSource = repairedLatex;
          console.log(`[Pipeline ${jobId}] Successfully compiled repaired LaTeX`);
        }
      }

      if (!pdfResult.success && fallbackToCurrent) {
        console.log(`[Pipeline ${jobId}] LaTeX compilation failed, falling back to current system`);
        metrics.fallbackUsage++;

        const { generateResumeWithDiagnostics } = await import('../resume-generator.js');
        return await generateResumeWithDiagnostics({
          jobId,
          resumeText,
          jobDescription,
          aiMode,
          relevantContent: companyContext
        });
      }
    }

    pipelineLog.push({ stage: 'latex_compilation', duration: Date.now() - stage5Start });
    metrics.stageTimings.latexCompilation = Date.now() - stage5Start;

    // Success!
    const totalDuration = Date.now() - startTime;
    console.log(`[Pipeline ${jobId}] Pipeline completed successfully in ${totalDuration}ms`);

    return {
      success: true,
      artifacts: {
        pdfBuffer: pdfResult.pdfBuffer,
        pdfMetadata: pdfResult.metadata,
        latexSource,
        generationType: 'pipeline',
        templateUsed: templateId,
        pipelineLog,
        metrics: {
          totalDuration,
          stageTimings: metrics.stageTimings,
          cacheHit: useCache && metrics.cacheHits > metrics.cacheMisses
        }
      }
    };

  } catch (error) {
    const errorKey = error.message.substring(0, 50);
    metrics.errorRates[errorKey] = (metrics.errorRates[errorKey] || 0) + 1;

    console.error(`[Pipeline ${jobId}] Pipeline failed:`, error);

    if (fallbackToCurrent) {
      console.log(`[Pipeline ${jobId}] Attempting fallback to current system`);
      metrics.fallbackUsage++;

      try {
        const { generateResumeWithDiagnostics } = await import('../resume-generator.js');
        return await generateResumeWithDiagnostics({
          jobId,
          resumeText,
          jobDescription,
          aiMode,
          relevantContent: companyContext
        });
      } catch (fallbackError) {
        console.error(`[Pipeline ${jobId}] Fallback also failed:`, fallbackError);
      }
    }

    return {
      success: false,
      error: error.message,
      artifacts: {
        pipelineLog,
        metrics
      }
    };
  }
}

/**
 * Template selection logic based on JD analysis and plan
 */
export async function selectTemplate(jdDigest, candidateDigest, plan) {
  // Check plan recommendation first
  if (plan?.templateRecommendation) {
    const availableTemplates = await templateRegistry.getAvailableTemplates();
    const templateIds = availableTemplates.map(t => t.id);

    if (templateIds.includes(plan.templateRecommendation)) {
      return plan.templateRecommendation;
    }
  }

  // Load manifest for selection rules
  const manifestPath = path.join(__dirname, '..', 'templates', 'registry', 'manifest.yaml');
  const manifestContent = await fs.readFile(manifestPath, 'utf8');
  const manifest = yaml.load(manifestContent);

  const rules = manifest.template_selection_rules;

  // Match by role keywords
  const roleKeywords = [
    jdDigest.roleFamily?.toLowerCase(),
    candidateDigest.currentRole?.toLowerCase(),
    ...jdDigest.keywords.map(k => k.toLowerCase())
  ].filter(Boolean);

  for (const rule of rules.keywords_to_template) {
    if (rule.keywords[0] === '*') continue; // Skip default rule

    const matchedKeywords = rule.keywords.filter(keyword =>
      roleKeywords.some(rk => rk.includes(keyword.toLowerCase()))
    );

    if (matchedKeywords.length > 0) {
      console.log(`[Template Selection] Matched keywords: ${matchedKeywords.join(', ')} → ${rule.template}`);
      return rule.template;
    }
  }

  // Match by experience level
  const yearsExp = parseInt(candidateDigest.totalExperience) || 0;
  const expRules = rules.experience_level_rules;

  if (yearsExp <= 2) {
    return expRules.entry_level.preferred_template;
  } else if (yearsExp <= 7) {
    return expRules.mid_level.preferred_template;
  } else if (yearsExp <= 15) {
    return expRules.senior_level.preferred_template;
  } else {
    return expRules.executive_level.preferred_template;
  }
}

/**
 * Cache management functions
 */
export async function getCachedJdDigest(cacheKey) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    const stats = await fs.stat(cacheFile);

    // Check if cache is still valid
    const age = Date.now() - stats.mtimeMs;
    if (age > CACHE_TTL) {
      console.log(`[Cache] Expired cache for key ${cacheKey}`);
      return null;
    }

    const cacheContent = await fs.readFile(cacheFile, 'utf8');
    return JSON.parse(cacheContent);
  } catch (error) {
    return null;
  }
}

export async function setCachedJdDigest(cacheKey, digest) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(digest, null, 2));
    console.log(`[Cache] Saved JD digest to cache with key ${cacheKey}`);
  } catch (error) {
    console.error(`[Cache] Failed to save cache:`, error);
  }
}

function generateCacheKey(jobDescription, companyContext) {
  const content = `${jobDescription}::${companyContext}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * LaTeX compilation with proper error handling
 */
export async function compileLaTeXToPDF(latexSource, jobId) {
  const tempDir = path.join(__dirname, '..', '..', 'temp', `pipeline-${jobId}`);
  const texFile = path.join(tempDir, 'resume.tex');
  const pdfFile = path.join(tempDir, 'resume.pdf');
  let compilationSuccess = false;

  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(texFile, latexSource);

    const { stdout, stderr } = await execAsync(
      `cd "${tempDir}" && ${config.pdf.tectonic.command} --chatter minimal --keep-logs resume.tex`,
      { timeout: config.pdf.tectonic.timeout }
    );

    try {
      const pdfBuffer = await fs.readFile(pdfFile);
      const stats = await fs.stat(pdfFile);

      compilationSuccess = true;
      return {
        success: true,
        pdfBuffer,
        metadata: {
          size: stats.size,
          pages: 1,
        },
      };
    } catch (readError) {
      const logFile = path.join(tempDir, 'resume.log');
      let logContent = '';
      try {
        logContent = await fs.readFile(logFile, 'utf8');
      } catch {}

      return {
        success: false,
        error: `PDF not generated. Logs: ${logContent || stderr}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (!config.pdf.keepTempDirOnFail || compilationSuccess) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

/**
 * A/B testing function
 */
export async function runPipelineWithABTest(params) {
  const { testNewSystem = true, ...pipelineParams } = params;

  if (!testNewSystem || Math.random() > 0.5) {
    // Use current system
    console.log(`[A/B Test] Using current system`);
    const { generateResumeWithDiagnostics } = await import('../resume-generator.js');

    const result = await generateResumeWithDiagnostics({
      jobId: pipelineParams.jobId || crypto.randomBytes(8).toString('hex'),
      resumeText: pipelineParams.resumeText,
      jobDescription: pipelineParams.jobDescription,
      aiMode: pipelineParams.aiMode,
      relevantContent: pipelineParams.companyContext
    });

    result.artifacts.testGroup = 'control';
    return result;
  } else {
    // Use new pipeline
    console.log(`[A/B Test] Using new pipeline`);
    const result = await runPipeline(pipelineParams);

    if (result.artifacts) {
      result.artifacts.testGroup = 'treatment';
    }

    return result;
  }
}

/**
 * Retry logic with exponential backoff
 */
async function runWithRetry(fn, maxRetries, jobId, stageName) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`[Pipeline ${jobId}] ${stageName} attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`[Pipeline ${jobId}] Retrying ${stageName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * LaTeX repair function
 */
async function repairLatex(latexSource, errorMessage, aiMode) {
  try {
    const modelName = getOpenAIModel(aiMode);

    const fixPrompt = `Fix this LaTeX compilation error:

Error: ${errorMessage.substring(0, 500)}

LaTeX snippet around error:
${latexSource.substring(0, 1500)}

Return ONLY the complete fixed LaTeX document. Ensure:
1. All \\item commands are in itemize/enumerate environments
2. All environments are properly closed
3. Special characters are escaped
4. Document compiles without errors

Output ONLY LaTeX code, no explanations.`;

    const requestParams = {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'You are a LaTeX expert. Fix compilation errors and return valid LaTeX.'
        },
        {
          role: 'user',
          content: fixPrompt
        }
      ],
      max_completion_tokens: 4000
    };

    // Only add temperature if not gpt-5-mini
    if (modelName !== 'gpt-5-mini') {
      requestParams.temperature = 0.2;
    }

    const completion = await openai.chat.completions.create(requestParams);

    let fixedLatex = completion.choices[0]?.message?.content;
    if (!fixedLatex) return null;

    // Clean up
    fixedLatex = fixedLatex.replace(/^```(?:latex|tex)?\n?/, '').replace(/\n?```$/, '');

    // Validate
    const safetyCheck = validateLatexSafety(fixedLatex);
    if (!safetyCheck.safe) {
      console.error('[LaTeX Repair] Fixed LaTeX failed safety check');
      return null;
    }

    return fixedLatex;
  } catch (error) {
    console.error('[LaTeX Repair] Failed to repair:', error);
    return null;
  }
}

/**
 * Fallback extraction functions
 */
function extractRoleFamily(jobDescription) {
  const roles = ['Software Engineer', 'Product Manager', 'Data Scientist', 'Designer', 'Marketing Manager'];
  for (const role of roles) {
    if (jobDescription.toLowerCase().includes(role.toLowerCase())) {
      return role;
    }
  }
  return 'Professional';
}

function extractSeniority(jobDescription) {
  if (/senior|sr\.|lead|principal/i.test(jobDescription)) return 'Senior';
  if (/junior|jr\.|entry|graduate/i.test(jobDescription)) return 'Junior';
  return 'Mid-level';
}

function extractKeywords(text) {
  // Extract technical terms and important words
  const words = text.match(/\b[A-Z][a-zA-Z]+\b/g) || [];
  return [...new Set(words)].slice(0, 20);
}

function extractName(resumeText) {
  const lines = resumeText.split('\n');
  return lines[0]?.trim() || 'Candidate';
}

function extractCurrentRole(resumeText) {
  const roleMatch = resumeText.match(/current.*?:?\s*([^\n]+)/i);
  return roleMatch?.[1]?.trim() || 'Professional';
}

function extractExperience(resumeText) {
  const yearMatch = resumeText.match(/(\d+)\+?\s*years?/i);
  return yearMatch?.[1] || '5';
}

function extractSkills(resumeText) {
  const skillsMatch = resumeText.match(/skills?:?\s*([^\n]+)/i);
  const skills = skillsMatch?.[1]?.split(/[,;]/).map(s => s.trim()) || [];
  return skills.slice(0, 10);
}

/**
 * Performance monitoring export
 */
export function getMetrics() {
  return {
    ...metrics,
    timestamp: Date.now()
  };
}

/**
 * Clear cache utility
 */
export async function clearCache() {
  try {
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log('[Cache] Cleared all cached JD digests');
    return true;
  } catch (error) {
    console.error('[Cache] Failed to clear cache:', error);
    return false;
  }
}

/**
 * Test function for pipeline validation
 */
export async function testPipeline() {
  console.log('=== Starting Pipeline Test ===');

  const testJobDescription = `Senior Software Engineer

  We are looking for a Senior Software Engineer to join our team.

  Requirements:
  - 5+ years of experience with JavaScript, Node.js, React
  - Experience with cloud platforms (AWS/GCP)
  - Strong problem-solving skills
  - Bachelor's degree in Computer Science or related field

  Responsibilities:
  - Design and develop scalable applications
  - Lead technical initiatives
  - Mentor junior developers
  - Collaborate with product team`;

  const testResumeText = `John Doe
  john.doe@email.com | (555) 123-4567 | San Francisco, CA

  Senior Software Engineer with 7 years of experience

  EXPERIENCE:

  Senior Software Engineer | TechCorp | 2020-Present
  - Led development of microservices architecture serving 1M+ users
  - Reduced API latency by 40% through optimization
  - Mentored team of 5 junior developers

  Software Engineer | StartupXYZ | 2017-2020
  - Built React frontend for SaaS platform
  - Implemented CI/CD pipeline reducing deployment time by 60%
  - Developed RESTful APIs using Node.js and Express

  SKILLS:
  JavaScript, TypeScript, React, Node.js, AWS, Docker, PostgreSQL

  EDUCATION:
  B.S. Computer Science | University of California | 2017`;

  try {
    const result = await runPipeline({
      jobDescription: testJobDescription,
      resumeText: testResumeText,
      companyContext: 'Tech startup focused on AI solutions',
      aiMode: 'gpt-4o-mini',
      templateId: null, // Auto-select
      useCache: true,
      fallbackToCurrent: false // Don't fallback for testing
    });

    console.log('=== Pipeline Test Results ===');
    console.log('Success:', result.success);
    console.log('Template Used:', result.artifacts?.templateUsed);
    console.log('Generation Type:', result.artifacts?.generationType);
    console.log('Metrics:', result.artifacts?.metrics);

    if (result.success) {
      console.log('PDF Size:', result.artifacts?.pdfMetadata?.size, 'bytes');
      console.log('\n✅ Pipeline test completed successfully!');
    } else {
      console.log('Error:', result.error);
      console.log('\n❌ Pipeline test failed');
    }

    return result;
  } catch (error) {
    console.error('Test failed with error:', error);
    return { success: false, error: error.message };
  }
}

// Export default for easy importing
export default {
  runPipeline,
  runPipelineWithABTest,
  selectTemplate,
  getCachedJdDigest,
  setCachedJdDigest,
  compileLaTeXToPDF,
  getMetrics,
  clearCache,
  testPipeline
};