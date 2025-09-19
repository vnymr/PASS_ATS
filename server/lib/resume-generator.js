import OpenAI from 'openai';
import { exec } from 'child_process';
import { config, getOpenAIModel } from './config.js';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { validateLatexSafety } from './latex-sanitizer.js';
import { buildLatexSystemPrompt, buildLatexUserPrompt, buildCompactLatexPrompt } from './latex-prompts.js';
import { jdDigestPrompt } from './prompts/jdDigestPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateResumeWithDiagnostics(params) {
  const { jobId, resumeText, jobDescription, aiMode, relevantContent } = params;

  console.log(`[Resume Generator] Starting generation for job ${jobId} with params:`, {
    hasResumeText: !!resumeText,
    hasJobDescription: !!jobDescription,
    aiMode,
    hasRelevantContent: !!relevantContent
  });

  const artifacts = {};

  try {
      const modelName = getOpenAIModel(aiMode);
      console.log(`[Job ${jobId}] Using model: ${modelName}, aiMode: ${aiMode}`);

      // Extract target job title
      const jobTitleMatch = jobDescription.match(/(?:position|role|title)[:\s]+([^\n]+)/i) ||
                            jobDescription.match(/^([^\n]+)/);
      const targetJobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'the target position';

      // Always generate LaTeX directly
      console.log(`[Job ${jobId}] Generating LaTeX directly`);
      let systemPrompt, userPrompt;

      if (modelName === 'gpt-5-mini') {
        systemPrompt = buildCompactLatexPrompt();
        userPrompt = `Generate LaTeX resume for:\n\nJOB: ${jobDescription.substring(0, 400)}\n\nRESUME: ${resumeText.substring(0, 600)}\n\nOutput ONLY LaTeX code. Fill entire page.`;
      } else {
        systemPrompt = buildLatexSystemPrompt();
        userPrompt = buildLatexUserPrompt(resumeText, jobDescription, relevantContent, targetJobTitle);
      }

      // Build request parameters for LaTeX generation
      const requestParams = {
        model: modelName,
        messages: [
          {
            role: 'system',
            content: systemPrompt + '\n\nCRITICAL: Output ONLY valid LaTeX code. No markdown backticks, no explanations, no JSON. Start with \\documentclass and end with \\end{document}.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_completion_tokens: config.openai.maxTokens,
      };

      // Temperature handling for different models
      if (!modelName.includes('gpt-5')) {
        console.log(`[Job ${jobId}] Adding temperature for non-GPT-5 model`);
        requestParams.temperature = 0.3;
      } else if (modelName === 'gpt-5' || modelName === 'gpt-5-nano') {
        // GPT-5 and GPT-5-nano can handle temperature
        console.log(`[Job ${jobId}] Adding low temperature for ${modelName}`);
        requestParams.temperature = 0.2;
      } else {
        // GPT-5-mini seems to work better without temperature
        console.log(`[Job ${jobId}] Skipping temperature for GPT-5-mini`);
      }

      let completion;
      try {
        completion = await openai.chat.completions.create(requestParams);
      } catch (apiError) {
        console.log(`[Job ${jobId}] OpenAI API error with ${modelName}, falling back to gpt-4o-mini`);
        // Fallback to a working model
        requestParams.model = 'gpt-4o-mini';
        completion = await openai.chat.completions.create(requestParams);
      }

      console.log(`[Job ${jobId}] OpenAI response received:`, {
        model: requestParams.model,
        choices: completion.choices?.length || 0,
        hasContent: !!completion.choices?.[0]?.message?.content,
        contentLength: completion.choices?.[0]?.message?.content?.length || 0
      });

      if (!completion.choices?.[0]?.message?.content) {
        // Try fallback if empty response
        if (modelName === 'gpt-5-mini') {
          console.log(`[Job ${jobId}] Empty response from ${modelName}, retrying with gpt-4o-mini`);
          requestParams.model = 'gpt-4o-mini';
          completion = await openai.chat.completions.create(requestParams);

          if (!completion.choices?.[0]?.message?.content) {
            throw new Error('OpenAI returned empty response even with fallback model');
          }
        } else {
          throw new Error('OpenAI returned empty response');
        }
      }

      let latexSource = completion.choices[0].message.content;
      console.log(`[Job ${jobId}] Processing LaTeX response (length: ${latexSource.length})`);

      // Clean up common issues
      latexSource = latexSource.replace(/^```latex\n?/, '').replace(/\n?```$/, '');
      latexSource = latexSource.replace(/^```tex\n?/, '').replace(/\n?```$/, '');
      latexSource = latexSource.trim();

      // Validate LaTeX structure
      if (!latexSource.includes('\\documentclass') || !latexSource.includes('\\begin{document}')) {
        throw new Error('Invalid LaTeX structure - missing documentclass or begin{document}');
      }

      artifacts.latexSource = latexSource;
      artifacts.generationType = 'direct-latex';

      const safetyCheck = validateLatexSafety(latexSource);
      if (!safetyCheck.safe) {
        throw new Error(`LaTeX safety check failed: ${safetyCheck.issues.join(', ')}`);
      }

      artifacts.latexSource = latexSource;

      let pdfResult = await compileLaTeX(latexSource, jobId);

      // If LaTeX compilation fails, try to fix it with AI
      if (!pdfResult.success) {
        console.log(`[Job ${jobId}] LaTeX compilation failed, attempting to fix with AI feedback`);

        // Extract the error message
        const latexError = pdfResult.error;
        console.log(`[Job ${jobId}] LaTeX error: ${latexError.substring(0, 200)}`);

        // Create a prompt to fix the LaTeX
        const fixPrompt = `The LaTeX code you generated has an error. Here's the error message:

${latexError}

Here's the LaTeX code that failed:

${latexSource.substring(0, 1000)}...

Please fix this LaTeX code and return ONLY the corrected complete LaTeX document. Make sure:
1. All \\item commands are inside proper list environments (\\begin{itemize} or \\begin{enumerate})
2. All environments are properly closed
3. All special characters are properly escaped
4. The document compiles without errors

Output ONLY the fixed LaTeX code, no explanations.`;

        try {
          // Ask AI to fix the LaTeX
          const fixRequest = {
            model: modelName === 'gpt-5-mini' ? 'gpt-5-mini' : 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a LaTeX expert. Fix the LaTeX code to compile without errors. Output ONLY valid LaTeX code.'
              },
              {
                role: 'user',
                content: fixPrompt
              }
            ],
            max_completion_tokens: config.openai.maxTokens
          };

          // Only add temperature for models that support it
          if (modelName !== 'gpt-5-mini') {
            fixRequest.temperature = 0.3;
          }

          const fixCompletion = await openai.chat.completions.create(fixRequest);

          if (fixCompletion.choices?.[0]?.message?.content) {
            let fixedLatex = fixCompletion.choices[0].message.content;

            // Clean up the response
            fixedLatex = fixedLatex.replace(/^```latex\n?/, '').replace(/\n?```$/, '');
            fixedLatex = fixedLatex.replace(/^```tex\n?/, '').replace(/\n?```$/, '');
            fixedLatex = fixedLatex.trim();

            console.log(`[Job ${jobId}] Received fixed LaTeX (length: ${fixedLatex.length})`);

            // Validate the fixed LaTeX
            const fixedSafetyCheck = validateLatexSafety(fixedLatex);
            if (!fixedSafetyCheck.safe) {
              throw new Error(`Fixed LaTeX safety check failed: ${fixedSafetyCheck.issues.join(', ')}`);
            }

            // Try compiling the fixed LaTeX
            pdfResult = await compileLaTeX(fixedLatex, jobId);

            if (pdfResult.success) {
              console.log(`[Job ${jobId}] Successfully compiled fixed LaTeX!`);
              latexSource = fixedLatex; // Update the source for artifacts
            } else {
              console.log(`[Job ${jobId}] Fixed LaTeX still failed: ${pdfResult.error.substring(0, 100)}`);
              throw new Error(`LaTeX compilation failed even after fix attempt: ${pdfResult.error}`);
            }
          } else {
            throw new Error(`LaTeX compilation failed and fix attempt returned empty: ${latexError}`);
          }
        } catch (fixError) {
          console.error(`[Job ${jobId}] Failed to fix LaTeX:`, fixError.message);
          throw new Error(`LaTeX compilation failed: ${latexError}`);
        }
      }

      artifacts.pdfBuffer = pdfResult.pdfBuffer;
      artifacts.pdfMetadata = pdfResult.metadata;

      return {
        success: true,
        artifacts,
      };

  } catch (error) {
    console.error(`[Job ${jobId}] Failed:`, error.message);

    return {
      success: false,
      error: error.message,
      artifacts,
    };
  }
}

// New function that uses jdDigestPrompt for better resume generation
export async function generateResumeWithJdDigest(params) {
  const { jobId, resumeText, jobDescription, aiMode, relevantContent } = params;

  console.log(`[Resume Generator] Starting JD-digest generation for job ${jobId} with params:`, {
    hasResumeText: !!resumeText,
    hasJobDescription: !!jobDescription,
    aiMode,
    hasRelevantContent: !!relevantContent
  });

  const artifacts = {};

  try {
    const modelName = getOpenAIModel(aiMode);
    console.log(`[Job ${jobId}] Using model: ${modelName}, aiMode: ${aiMode}`);

    // Step 1: Analyze job description with jdDigestPrompt
    console.log(`[Job ${jobId}] Analyzing job description...`);
    const jdDigest = await jdDigestPrompt(jobDescription);
    console.log(`[Job ${jobId}] JD Analysis:`, {
      roleFamily: jdDigest.roleFamily,
      seniority: jdDigest.seniority,
      industry: jdDigest.industry,
      keywordsCount: jdDigest.keywords.length,
      responsibilitiesCount: jdDigest.responsibilities.length
    });

    // Extract target job title
    const jobTitleMatch = jobDescription.match(/(?:position|role|title)[:\s]+([^\n]+)/i) ||
                          jobDescription.match(/^([^\n]+)/);
    const targetJobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : jdDigest.roleFamily;

    // Step 2: Generate LaTeX with enhanced prompt using JD digest
    console.log(`[Job ${jobId}] Generating LaTeX with JD digest`);
    let systemPrompt, userPrompt;

    if (modelName === 'gpt-5-mini') {
      systemPrompt = buildCompactLatexPrompt();
      userPrompt = `Generate LaTeX resume for:\n\nJOB: ${jobDescription.substring(0, 400)}\n\nRESUME: ${resumeText.substring(0, 600)}\n\nOutput ONLY LaTeX code. Fill entire page.`;
    } else {
      systemPrompt = buildLatexSystemPrompt();
      // Use the enhanced user prompt with JD digest
      userPrompt = buildEnhancedUserPrompt(resumeText, jobDescription, jdDigest, targetJobTitle, relevantContent);
    }

    // Build request parameters for LaTeX generation
    const requestParams = {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt + '\n\nCRITICAL: Output ONLY valid LaTeX code. No markdown backticks, no explanations, no JSON. Start with \\documentclass and end with \\end{document}.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_completion_tokens: config.openai.maxTokens,
    };

    // Temperature handling for different models
    if (!modelName.includes('gpt-5')) {
      console.log(`[Job ${jobId}] Adding temperature for non-GPT-5 model`);
      requestParams.temperature = 0.3;
    } else if (modelName === 'gpt-5' || modelName === 'gpt-5-nano') {
      console.log(`[Job ${jobId}] Adding low temperature for ${modelName}`);
      requestParams.temperature = 0.2;
    } else {
      console.log(`[Job ${jobId}] Skipping temperature for GPT-5-mini`);
    }

    let completion;
    try {
      completion = await openai.chat.completions.create(requestParams);
    } catch (apiError) {
      console.log(`[Job ${jobId}] OpenAI API error with ${modelName}, falling back to gpt-4o-mini`);
      requestParams.model = 'gpt-4o-mini';
      completion = await openai.chat.completions.create(requestParams);
    }

    console.log(`[Job ${jobId}] OpenAI response received:`, {
      model: requestParams.model,
      choices: completion.choices?.length || 0,
      hasContent: !!completion.choices?.[0]?.message?.content,
      contentLength: completion.choices?.[0]?.message?.content?.length || 0
    });

    if (!completion.choices?.[0]?.message?.content) {
      if (modelName === 'gpt-5-mini') {
        console.log(`[Job ${jobId}] Empty response from ${modelName}, retrying with gpt-4o-mini`);
        requestParams.model = 'gpt-4o-mini';
        completion = await openai.chat.completions.create(requestParams);

        if (!completion.choices?.[0]?.message?.content) {
          throw new Error('OpenAI returned empty response even with fallback model');
        }
      } else {
        throw new Error('OpenAI returned empty response');
      }
    }

    let latexSource = completion.choices[0].message.content;
    console.log(`[Job ${jobId}] Processing LaTeX response (length: ${latexSource.length})`);

    // Clean up common issues
    latexSource = latexSource.replace(/^```latex\n?/, '').replace(/\n?```$/, '');
    latexSource = latexSource.replace(/^```tex\n?/, '').replace(/\n?```$/, '');
    latexSource = latexSource.trim();

    // Validate LaTeX structure
    if (!latexSource.includes('\\documentclass') || !latexSource.includes('\\begin{document}')) {
      throw new Error('Invalid LaTeX structure - missing documentclass or begin{document}');
    }

    artifacts.latexSource = latexSource;
    artifacts.generationType = 'jd-digest-latex';
    artifacts.jdDigest = jdDigest; // Store the JD analysis for debugging

    const safetyCheck = validateLatexSafety(latexSource);
    if (!safetyCheck.safe) {
      throw new Error(`LaTeX safety check failed: ${safetyCheck.issues.join(', ')}`);
    }

    let pdfResult = await compileLaTeX(latexSource, jobId);

    // If LaTeX compilation fails, try to fix it with AI
    if (!pdfResult.success) {
      console.log(`[Job ${jobId}] LaTeX compilation failed, attempting to fix with AI feedback`);

      const latexError = pdfResult.error;
      console.log(`[Job ${jobId}] LaTeX error: ${latexError.substring(0, 200)}`);

      const fixPrompt = `The LaTeX code you generated has an error. Here's the error message:

${latexError}

Here's the LaTeX code that failed:

${latexSource.substring(0, 1000)}...

Please fix this LaTeX code and return ONLY the corrected complete LaTeX document. Make sure:
1. All \\item commands are inside proper list environments (\\begin{itemize} or \\begin{enumerate})
2. All environments are properly closed
3. All special characters are properly escaped
4. The document compiles without errors

Output ONLY the fixed LaTeX code, no explanations.`;

      try {
        const fixRequest = {
          model: modelName === 'gpt-5-mini' ? 'gpt-5-mini' : 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a LaTeX expert. Fix the LaTeX code to compile without errors. Output ONLY valid LaTeX code.'
            },
            {
              role: 'user',
              content: fixPrompt
            }
          ],
          max_completion_tokens: config.openai.maxTokens
        };

        if (modelName !== 'gpt-5-mini') {
          fixRequest.temperature = 0.3;
        }

        const fixCompletion = await openai.chat.completions.create(fixRequest);

        if (fixCompletion.choices?.[0]?.message?.content) {
          let fixedLatex = fixCompletion.choices[0].message.content;

          fixedLatex = fixedLatex.replace(/^```latex\n?/, '').replace(/\n?```$/, '');
          fixedLatex = fixedLatex.replace(/^```tex\n?/, '').replace(/\n?```$/, '');
          fixedLatex = fixedLatex.trim();

          console.log(`[Job ${jobId}] Received fixed LaTeX (length: ${fixedLatex.length})`);

          const fixedSafetyCheck = validateLatexSafety(fixedLatex);
          if (!fixedSafetyCheck.safe) {
            throw new Error(`Fixed LaTeX safety check failed: ${fixedSafetyCheck.issues.join(', ')}`);
          }

          pdfResult = await compileLaTeX(fixedLatex, jobId);

          if (pdfResult.success) {
            console.log(`[Job ${jobId}] Successfully compiled fixed LaTeX!`);
            latexSource = fixedLatex;
          } else {
            console.log(`[Job ${jobId}] Fixed LaTeX still failed: ${pdfResult.error.substring(0, 100)}`);
            throw new Error(`LaTeX compilation failed even after fix attempt: ${pdfResult.error}`);
          }
        } else {
          throw new Error(`LaTeX compilation failed and fix attempt returned empty: ${latexError}`);
        }
      } catch (fixError) {
        console.error(`[Job ${jobId}] Failed to fix LaTeX:`, fixError.message);
        throw new Error(`LaTeX compilation failed: ${latexError}`);
      }
    }

    artifacts.pdfBuffer = pdfResult.pdfBuffer;
    artifacts.pdfMetadata = pdfResult.metadata;

    return {
      success: true,
      artifacts,
    };

  } catch (error) {
    console.error(`[Job ${jobId}] Failed:`, error.message);

    return {
      success: false,
      error: error.message,
      artifacts,
    };
  }
}

// Enhanced user prompt that uses JD digest information
function buildEnhancedUserPrompt(resumeText, jobDescription, jdDigest, targetJobTitle, relevantContent) {
  let prompt = `Generate a complete LaTeX resume optimized for ATS screening.

TARGET POSITION: ${targetJobTitle}

JOB ANALYSIS:
- Role Family: ${jdDigest.roleFamily}
- Seniority Level: ${jdDigest.seniority}
- Industry: ${jdDigest.industry}
- Company Size: ${jdDigest.companySize}
- Company Themes: ${jdDigest.companyThemes.join(', ')}

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME:
${resumeText}

CRITICAL INSTRUCTIONS:
1. Output ONLY valid LaTeX code - no JSON, no explanations
2. Fill the ENTIRE page from top to bottom with content
3. Include 4-6 experience entries, projects if needed
4. Quantify EVERY achievement with metrics
5. Include ALL job description keywords naturally
6. Use the exact template structure provided
7. Enhance up to 40% of content for ATS success
8. Tailor content to ${jdDigest.industry} industry and ${jdDigest.seniority} level`;

  // Add JD digest keywords
  if (jdDigest.keywords.length > 0) {
    prompt += `

MUST-INCLUDE KEYWORDS (use 2-3 times each):
${jdDigest.keywords.slice(0, 15).join(', ')}`;
  }

  // Add JD digest responsibilities
  if (jdDigest.responsibilities.length > 0) {
    prompt += `

KEY RESPONSIBILITIES TO MATCH:
${jdDigest.responsibilities.slice(0, 8).map(r => `- ${r}`).join('\n')}`;
  }

  // Add existing relevant content if available
  if (relevantContent) {
    prompt += `

KEY ELEMENTS TO EMPHASIZE:
`;
    if (relevantContent.skills?.length > 0) {
      const criticalSkills = relevantContent.skills
        .filter(s => s.relevance >= 0.85)
        .slice(0, 15);
      prompt += `
MUST-HAVE SKILLS (include all):
${criticalSkills.map(s => s.content).join(', ')}
`;
    }

    if (relevantContent.topKeywords?.length > 0) {
      prompt += `
ATS KEYWORDS (use 2-3 times each):
${relevantContent.topKeywords.slice(0, 20).join(', ')}
`;
    }

    if (relevantContent.experiences?.length > 0) {
      prompt += `
TOP EXPERIENCES TO HIGHLIGHT:
${relevantContent.experiences.slice(0, 5).map(e => `- ${e.content}`).join('\n')}
`;
    }
  }

  prompt += `

REMEMBER: Generate a COMPLETE LaTeX document that fills the entire page. Make the resume look impressive and perfectly tailored to the ${jdDigest.roleFamily} role in ${jdDigest.industry} industry.`;

  return prompt;
}

async function compileLaTeX(latexSource, jobId) {
  const tempDir = path.join(__dirname, '..', 'temp', `job-${jobId}`);
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

