/**
 * Resume Generation Prompts
 * Focus on content and ATS optimization.
 * HTML-based output - NO LATEX
 */

export const RESUME_SYSTEM_PROMPT = `You are an expert resume writer. Generate ATS-optimized resume content.

CONTENT FOCUS:
- Match keywords from job description naturally
- Quantify achievements with metrics (%, $, numbers)
- Strong action verbs: Led, Built, Reduced, Increased, Implemented
- Each bullet: [Action] + [What you did] + [Result/Impact]

STRUCTURE:
1. Header: Name, contact info, links
2. Summary: 2-3 tailored sentences
3. Experience: 3-5 most relevant roles, 3-5 bullets each with metrics
4. Skills: Grouped by category, matching job requirements
5. Education: Degree, school, dates
6. Projects/Certifications: If relevant

ATS OPTIMIZATION:
- Use standard section headers: Summary, Experience, Skills, Education
- Include both full terms and acronyms (Machine Learning (ML))
- Use keywords from job description naturally in context
- Quantify achievements where possible
`;

export function buildCompanyResearchPrompt(companyName, jobTitle) {
  return `Research "${companyName}" for the role of "${jobTitle}".
Find:
1. Company's core values and culture
2. Tech stack they use
3. Recent news, products, or initiatives
4. What they look for in candidates
5. Any specific terminology they use

Return 5 actionable tips to tailor a resume for this company. Be specific.`;
}

export function buildUserPrompt(profileData, jobDescription, companyInsights = null) {
  let prompt = `Create an optimized resume tailored to this job.

USER PROFILE:
${JSON.stringify(profileData, null, 2)}

JOB DESCRIPTION:
${jobDescription}`;

  if (companyInsights) {
    prompt += `

COMPANY INSIGHTS:
${companyInsights}`;
  }

  prompt += `

Generate the resume content now.`;

  return prompt;
}

export function extractCompanyName(jobDescription) {
  if (!jobDescription) return null;

  // Generic words that should NOT be company names
  const invalidCompanyWords = [
    'the', 'this', 'our', 'we', 'an', 'a', 'and', 'or', 'for', 'with',
    'biggest', 'best', 'leading', 'top', 'premier', 'world', 'global',
    'innovative', 'dynamic', 'growing', 'exciting', 'fast', 'new',
    'ideas', 'solutions', 'services', 'systems', 'technologies',
    'fintech', 'tech', 'startup', 'company', 'team', 'organization',
    'position', 'role', 'opportunity', 'job', 'career'
  ];

  const isValidCompanyName = (name) => {
    if (!name || name.length < 2 || name.length > 40) return false;
    const lower = name.toLowerCase().trim();
    // Check if it's just generic words
    const words = lower.split(/\s+/);
    if (words.every(w => invalidCompanyWords.includes(w))) return false;
    // Must start with capital letter
    if (!/^[A-Z]/.test(name.trim())) return false;
    // Should look like a company name (not a full sentence)
    if (words.length > 4) return false;
    return true;
  };

  // Priority 1: Explicit company field
  const explicitPatterns = [
    /Company:\s*([A-Za-z0-9\s&.,'()-]+?)(?:\n|$)/i,
    /Employer:\s*([A-Za-z0-9\s&.,'()-]+?)(?:\n|$)/i,
    /Organization:\s*([A-Za-z0-9\s&.,'()-]+?)(?:\n|$)/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = jobDescription.match(pattern);
    if (match && match[1] && isValidCompanyName(match[1].trim())) {
      return match[1].trim();
    }
  }

  // Priority 2: "at [Company]" pattern (strict - company name only, 1-3 words)
  const atMatch = jobDescription.match(/(?:position|role|job|engineer|developer|manager|designer|analyst)\s+at\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})(?:\s|,|\.|$)/i);
  if (atMatch && atMatch[1] && isValidCompanyName(atMatch[1])) {
    return atMatch[1].trim();
  }

  // Priority 3: "About [Company]" section header
  const aboutMatch = jobDescription.match(/About\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})(?:\s*[:|\n])/);
  if (aboutMatch && aboutMatch[1] && isValidCompanyName(aboutMatch[1])) {
    return aboutMatch[1].trim();
  }

  // Priority 4: "[Company] is looking/hiring/seeking"
  const seekingMatch = jobDescription.match(/^([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})\s+(?:is|are)\s+(?:looking|hiring|seeking|recruiting)/im);
  if (seekingMatch && seekingMatch[1] && isValidCompanyName(seekingMatch[1])) {
    return seekingMatch[1].trim();
  }

  // Priority 5: "Join [Company]" or "Join the [Company] team"
  const joinMatch = jobDescription.match(/Join\s+(?:the\s+)?([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}?)(?:\s+team|\s*!|\s*\.|\s*,)/i);
  if (joinMatch && joinMatch[1] && isValidCompanyName(joinMatch[1])) {
    // Remove "team" if accidentally captured
    const cleaned = joinMatch[1].replace(/\s+team$/i, '').trim();
    if (isValidCompanyName(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

export function extractJobTitle(jobDescription) {
  if (!jobDescription) return null;

  const patterns = [
    /(?:Title|Position|Role):\s*([^\n]+)/i,
    /^([A-Z][A-Za-z\s]+(?:Engineer|Developer|Manager|Designer|Analyst|Architect|Lead|Director|Scientist))/m,
    /(?:hiring|looking for|seeking)\s+(?:a|an)?\s*([A-Z][A-Za-z\s]+(?:Engineer|Developer|Manager|Designer|Analyst))/i,
  ];

  for (const pattern of patterns) {
    const match = jobDescription.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }

  return 'the position';
}

export default {
  RESUME_SYSTEM_PROMPT,
  buildCompanyResearchPrompt,
  buildUserPrompt,
  extractCompanyName,
  extractJobTitle
};
