(function() {
  'use strict';
  
  async function analyzeJobWithAI(jdText, profile) {
  const systemPrompt = `You are an expert ATS optimization specialist and resume strategist with deep knowledge of 2025 ATS parsing algorithms.

YOUR MISSION: Analyze the job description and candidate profile to create a perfectly tailored, ATS-optimized resume that maximizes interview chances.

CRITICAL ATS RULES (2025):
1. Job title match increases interview chances by 10.6x - ALWAYS include exact job title
2. Keywords must appear 2-3 times naturally throughout the resume
3. 99.7% of recruiters use keyword filters - missing keywords = automatic rejection
4. Context matters - ATS systems recognize keyword stuffing and penalize it
5. Skills placement hierarchy: Summary > Core Competencies > Experience bullets
6. Both abbreviations and full terms needed (e.g., "SEO" AND "Search Engine Optimization")

ANALYSIS FRAMEWORK:
1. Extract exact job title and all title variations
2. Identify must-have keywords (appearing 3+ times in JD)
3. Find nice-to-have keywords (appearing 1-2 times)
4. Detect industry-specific terminology and certifications
5. Recognize required years of experience and seniority level
6. Identify quantifiable metrics the employer values
7. Find company culture keywords (innovation, collaboration, etc.)
8. Detect technical stack and tools mentioned

OUTPUT STRUCTURE:
Provide a JSON response with the following structure:
{
  "atsScore": number (0-100),
  "jobTitle": "exact title from JD",
  "criticalKeywords": ["keywords that MUST appear"],
  "importantKeywords": ["secondary keywords"],
  "suggestedSummary": "2-3 line summary with job title and top keywords",
  "skillsPriority": ["skills ordered by JD relevance"],
  "experienceOptimizations": [
    {
      "original": "original bullet",
      "optimized": "rewritten with keywords and metrics",
      "keywords": ["keywords added"],
      "improvement": "explanation"
    }
  ],
  "missingQualifications": ["qualifications you don't have"],
  "strengthMatches": ["your strongest matches to requirements"],
  "customizations": {
    "tone": "formal/conversational based on company",
    "focus": "technical/leadership/results based on role",
    "length": "concise/detailed based on seniority"
  },
  "warnings": ["any red flags or concerns"]
}`;

  const userPrompt = `Analyze this job posting and candidate profile for ATS optimization:

JOB DESCRIPTION:
${jdText}

CANDIDATE PROFILE:
Name: ${profile.name}
Current Role: ${profile.headline}
Experience: ${profile.experience.map(e => `${e.role} at ${e.company} (${e.start}-${e.end || 'Present'})`).join(', ')}
Skills: ${profile.skills.join(', ')}
About: ${profile.summary_narrative}

EXPERIENCE DETAILS:
${profile.experience.map(exp => `
${exp.role} at ${exp.company}:
${exp.bullets.map(b => `- ${b}`).join('\n')}`).join('\n\n')}

PROJECTS:
${profile.projects.map(p => `${p.name}: ${p.bullets.join('; ')}`).join('\n')}

Perform deep ATS analysis and provide optimization recommendations.`;

  try {
    const response = await callOpenAI(systemPrompt, userPrompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('AI analysis failed:', error);
    return fallbackAnalysis(jdText, profile);
  }
}

  async function generateOptimizedBullets(experience, jobKeywords, companyTone) {
  const systemPrompt = `You are an expert resume writer specializing in creating high-impact, ATS-optimized experience bullets.

BULLET WRITING FORMULA:
[Action Verb] + [Task/Project] + [Result/Impact] + [Keywords naturally integrated]

RULES:
1. Start with strong action verbs (managed, developed, increased, optimized)
2. Include quantifiable metrics (%, $, time saved, team size)
3. Naturally integrate 1-2 keywords per bullet
4. Keep bullets 12-22 words for readability
5. Focus on achievements, not responsibilities
6. Use industry-specific terminology appropriately

TONE GUIDELINES:
- Formal: Use professional language, avoid contractions
- Tech-focused: Emphasize technical implementation details
- Results-focused: Lead with business impact and metrics
- Leadership-focused: Highlight team management and strategic decisions`;

  const userPrompt = `Optimize these experience bullets for ATS and impact:

ORIGINAL BULLETS:
${experience.bullets.map((b, i) => `${i+1}. ${b}`).join('\n')}

TARGET KEYWORDS: ${jobKeywords.join(', ')}
COMPANY TONE: ${companyTone}

Generate optimized versions that naturally incorporate keywords while maintaining truthfulness.`;

  try {
    const response = await callOpenAI(systemPrompt, userPrompt);
    return JSON.parse(response);
  } catch (error) {
    return experience.bullets;
  }
}

  async function generateDynamicSummary(profile, jobAnalysis) {
  const systemPrompt = `You are a professional summary writer who creates compelling, keyword-rich summaries that pass ATS filters.

SUMMARY FORMULA:
[Job Title] with [Years] years of experience in [Domain] | [Top 3-4 Skills] | [Unique Value Proposition]

Requirements:
1. Include exact job title from the posting
2. Mention years of relevant experience
3. Include 3-4 critical keywords naturally
4. Keep under 3 lines (150 characters)
5. Focus on value you bring, not what you want
6. Avoid clichés (hard-working, team player, self-starter)
7. Be specific about expertise areas`;

  const userPrompt = `Create an ATS-optimized summary:

TARGET ROLE: ${jobAnalysis.jobTitle}
CRITICAL KEYWORDS: ${jobAnalysis.criticalKeywords.join(', ')}
CANDIDATE BACKGROUND: ${profile.summary_narrative}
YEARS OF EXPERIENCE: ${calculateYearsOfExperience(profile.experience)}
TOP SKILLS: ${profile.skills.slice(0, 5).join(', ')}

Generate a compelling 2-3 line summary.`;

  try {
    const response = await callOpenAI(systemPrompt, userPrompt);
    return response.trim();
  } catch (error) {
    return `${jobAnalysis.jobTitle} with expertise in ${jobAnalysis.criticalKeywords.slice(0, 3).join(', ')}`;
  }
}

  async function callOpenAI(systemPrompt, userPrompt) {
    // Call server endpoint instead of direct OpenAI API for security
    try {
      const { serverUrl } = await chrome.storage.local.get('serverUrl');
      const API_BASE = (serverUrl || 'http://localhost:3000').replace(/\/$/, '');
      const response = await fetch(`${API_BASE}/api/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          model: 'gpt-4',
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI analysis error: ${errorText}`);
      }

      const data = await response.json();
      return data.result || data.content;
    } catch (error) {
      console.error('AI API call failed:', error);
      throw error;
    }
  }

function calculateYearsOfExperience(experience) {
  if (!experience || experience.length === 0) return 0;
  
  const dates = experience.map(exp => {
    const start = new Date(exp.start);
    const end = exp.end ? new Date(exp.end) : new Date();
    return { start, end };
  });
  
  dates.sort((a, b) => a.start - b.start);
  
  let totalMonths = 0;
  let currentStart = dates[0].start;
  let currentEnd = dates[0].end;
  
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].start <= currentEnd) {
      currentEnd = dates[i].end > currentEnd ? dates[i].end : currentEnd;
    } else {
      totalMonths += (currentEnd - currentStart) / (1000 * 60 * 60 * 24 * 30);
      currentStart = dates[i].start;
      currentEnd = dates[i].end;
    }
  }
  
  totalMonths += (currentEnd - currentStart) / (1000 * 60 * 60 * 24 * 30);
  return Math.round(totalMonths / 12);
}

async function fallbackAnalysis(jdText, profile) {
  // Try to use the server-side AI analysis as fallback
  try {
    const response = await fetch('http://localhost:3000/analyze-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jdText: jdText,
        profile: profile
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result;
    }
  } catch (error) {
    console.warn('Server-side AI analysis also failed:', error);
  }
  
  // Only as last resort, return minimal analysis
  const words = jdText.toLowerCase().split(/\s+/);
  const frequency = {};
  
  words.forEach(word => {
    if (word.length > 3 && !isStopWord(word)) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  });
  
  const keywords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
  
  return {
    atsScore: null, // Let the system determine this
    jobTitle: extractJobTitle(jdText),
    criticalKeywords: keywords.slice(0, 10),
    importantKeywords: keywords.slice(10, 20),
    suggestedSummary: null, // Let AI generate this
    skillsPriority: profile.skills || [],
    experienceOptimizations: [],
    missingQualifications: [],
    strengthMatches: [],
    customizations: {
      tone: null, // Let AI decide
      focus: null, // Let AI decide based on job
      length: null // Let AI decide based on seniority
    },
    warnings: ['AI analysis unavailable - using basic keyword extraction. Results may be limited.']
  };
}

function extractJobTitle(text) {
  const patterns = [
    /(?:job\s+title|position|role)[\s:]+([^\n]+)/i,
    /hiring\s+(?:a|an)\s+([^\n]+)/i,
    /^([^-\n]+(?:engineer|developer|manager|analyst|designer))/mi
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  return 'Professional';
}

  function isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'you', 'will', 'our', 'your',
      'this', 'that', 'from', 'have', 'are', 'can', 'but', 'not'
    ]);
    return stopWords.has(word);
  }
  
  // Export to global namespace
  window.ResumeModules = window.ResumeModules || {};
  window.ResumeModules.AIAnalyzer = {
    analyzeJobWithAI,
    generateOptimizedBullets,
    generateDynamicSummary
  };
})();