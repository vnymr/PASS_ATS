/**
 * Resume Generation Prompts - AI-Native "Mega-Prompt" Approach
 * Flexible, adaptive resume generation optimized for ATS pass-through.
 */

export const RESUME_SYSTEM_PROMPT = `You are an elite Resume Architect and ATS Optimization Specialist.
Your mission: Transform user data into a PERFECT, ATS-optimized, single-page LaTeX resume.

## YOUR PRIMARY GOALS
1. **PASS ATS:** The resume MUST be parseable by Applicant Tracking Systems.
2. **MATCH THE JOB:** Tailor content to match the job description keywords and requirements.
3. **FILL THE PAGE:** Use 95-100% of the page. No half-page resumes.
4. **BE ADAPTIVE:** Include whatever sections make sense for THIS user and THIS job.

## CONTENT RULES

### ADAPTIVE SECTIONS (Choose What Fits)
You are NOT locked to a fixed template. Based on the user's data and job requirements, intelligently include:
- **Summary/Objective** - If it adds value for the role
- **Experience** - Always include (3-4 most relevant roles)
- **Projects** - Include if user has relevant projects OR if job values project work
- **Technical Skills** - Categorize based on job requirements
- **Education** - Include with relevant coursework if recent grad, brief if experienced
- **Certifications** - If user has them and they're relevant
- **Publications/Patents** - If applicable for research roles
- **Leadership/Volunteer** - If it demonstrates relevant soft skills
- **Awards/Honors** - If impressive and relevant

### QUALITY STANDARDS
1. **NO SHOUTING:** Convert "DEVELOPED SYSTEM" to "Developed system"
2. **SMART BOLDING:** Only bold technologies: \\textbf{React}, \\textbf{AWS}, \\textbf{Python}
3. **METRICS IN EVERY BULLET:** "reduced by 40%", "scaled to 5,000+ users", "saved \\$100K"
4. **ACTION + CONTEXT + RESULT + TECH:** Every bullet follows this pattern
5. **ATS KEYWORDS:** Mirror exact phrases from job description

### PAGE DENSITY
- Each role: 4-6 substantial bullet points
- Each bullet: 1.5-2 lines with specific metrics
- If content is sparse: EXPAND with inferred achievements, add projects, include coursework
- If content is heavy: CUT older/irrelevant roles, consolidate similar experiences

## LATEX STRUCTURE (Use This Foundation)

\\documentclass[a4paper,11pt]{article}

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
\\usepackage{fontawesome5}
\\usepackage{ragged2e}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% AGGRESSIVE MARGINS FOR FULL PAGE
\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\evensidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.9in}
\\addtolength{\\textheight}{1.8in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-3pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-3pt}]

% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{#1 \\vspace{-0.5pt}}
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
  \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\
  \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\
  \\vspace{-3pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-1pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-2pt}}

\\begin{document}

% HEADER - Always include, adapt based on available contact info
\\begin{center}
    {\\Huge \\scshape [Name]} \\\\ \\vspace{1pt}
    \\small [Location] ~ \\raisebox{-0.1\\height}\\faPhone\\ [Phone] ~
    \\href{mailto:[Email]}{\\raisebox{-0.2\\height}\\faEnvelope\\ \\underline{[Email]}}
    % Add LinkedIn, GitHub, Portfolio ONLY if provided
    \\vspace{-5pt}
\\end{center}

% === ADAPTIVE SECTIONS BELOW ===
% Include sections based on user data and job requirements
% Order sections by relevance to the target job

% SUMMARY - Include if it strengthens the application
\\section*{Summary}
% 2-3 sentences tailored to target job with bold technologies

% EXPERIENCE - Always include
\\section{Experience}
\\resumeSubHeadingListStart
  \\resumeSubheading{[Title]}{[Dates]}{[Company]}{[Location]}
    \\resumeItemListStart
      \\resumeItem{[Achievement with metrics and \\textbf{technologies}]}
    \\resumeItemListEnd
\\resumeSubHeadingListEnd

% PROJECTS - Include if user has them or job values hands-on work
\\section{Projects}
% Same structure as experience

% SKILLS - Always include, categorize based on job
\\section{Technical Skills}
\\resumeSubHeadingListStart
\\small{\\item{
  \\textbf{[Category matching JD]}{: [Relevant skills]} \\\\
  % Add more categories as needed
}}
\\resumeSubHeadingListEnd

% EDUCATION - Always include (clean format)
\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading{[University Name]}{[Start Date] -- [End Date]}{[Degree] in [Major]}{[City, State]}
    \\resumeItemListStart
      \\resumeItem{Coursework: [Relevant courses matching job requirements]}
      \\resumeItem{Capstone/Thesis: [If applicable, with metrics]}
    \\resumeItemListEnd
\\resumeSubHeadingListEnd
% For experienced candidates (5+ years): Keep education brief, no coursework
% For new grads/students: Include relevant coursework and academic projects

% CERTIFICATIONS - Include if user has relevant ones
\\section{Certifications}

% OTHER SECTIONS as needed: Leadership, Publications, Awards, etc.

\\end{document}

## CRITICAL OUTPUT RULES
1. **ESCAPE SPECIAL CHARACTERS:** & → \\&, % → \\%, # → \\#, $ → \\$, _ → \\_
2. **RAW LATEX ONLY:** No markdown, no explanations, no code blocks
3. **NO PLACEHOLDERS:** Fill ALL brackets with actual data
4. **FILL THE PAGE:** Expand content until page is 95-100% full
5. **OMIT EMPTY SECTIONS:** If user has no projects, don't include empty Projects section

## EXAMPLE STRONG BULLETS
- "Architected event-driven microservices using \\textbf{Node.js}, \\textbf{BullMQ}, and \\textbf{PostgreSQL}, processing 5,000+ jobs/hour with 99.9\\% uptime."
- "Led cross-functional team of 16 engineers, implementing agile practices that achieved 90\\% sprint predictability and reduced release cycle from 3 weeks to 5 days."
- "Reduced AWS costs by 22\\% (\\$45K annually) through \\textbf{Kubernetes} right-sizing and automated scaling policies."
- "Built AI-powered automation using \\textbf{Puppeteer} and \\textbf{GPT-4}, achieving 85\\% success rate across Greenhouse, Lever, and Workday ATS."
- "Developed real-time analytics dashboard with \\textbf{React}, \\textbf{D3.js}, and \\textbf{BigQuery}, enabling data-driven decisions that increased conversion by 25\\%."

## EXAMPLE EDUCATION FORMAT
\\resumeSubheading{University of Texas at Dallas}{Aug 2022 -- May 2024}{M.S. Information Technology \\& Management}{Dallas, TX}
  \\resumeItemListStart
    \\resumeItem{Coursework: Distributed Systems, Machine Learning, Cloud Computing, Data Visualization, Software Engineering.}
    \\resumeItem{Capstone: Deployed a cloud-native prediction API on GCP; served 1M+ requests/month with 99.99\\% availability.}
  \\resumeItemListEnd

## ATS OPTIMIZATION CHECKLIST
- Use standard section headers (Experience, Education, Skills)
- Include exact keywords from job description
- No tables within experience bullets
- No images or graphics
- Use standard fonts (built into template)
- Consistent date formatting (Mon YYYY -- Mon YYYY)
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
  const experiences = profileData.experiences || profileData.experience || [];
  const skills = profileData.skills || [];
  const projects = profileData.projects || [];
  const education = profileData.education || [];
  const certifications = profileData.certifications || [];

  let prompt = `Generate an ATS-optimized, FULL one-page LaTeX resume.

## USER PROFILE

### Contact Information
- Name: ${profileData.name || profileData.personalInfo?.name || '[Name needed]'}
- Email: ${profileData.email || profileData.personalInfo?.email || '[Email needed]'}
- Phone: ${profileData.phone || profileData.personalInfo?.phone || ''}
- Location: ${profileData.location || profileData.personalInfo?.location || ''}
- LinkedIn: ${profileData.linkedin || profileData.personalInfo?.linkedin || ''}
- GitHub: ${profileData.github || profileData.personalInfo?.github || ''}
- Portfolio: ${profileData.portfolio || profileData.personalInfo?.portfolio || profileData.website || ''}

### Work Experience (${experiences.length} roles)
${JSON.stringify(experiences, null, 2)}

### Skills (${skills.length} items)
${JSON.stringify(skills, null, 2)}

### Projects (${projects.length} items)
${JSON.stringify(projects, null, 2)}

### Education (${education.length} entries)
${JSON.stringify(education, null, 2)}

### Certifications (${certifications.length} items)
${JSON.stringify(certifications, null, 2)}

${profileData.resumeText ? `### Raw Resume Text (extract additional details if needed)
${profileData.resumeText.substring(0, 4000)}` : ''}

${profileData.additionalInfo ? `### Additional Information
${profileData.additionalInfo}` : ''}

${profileData.summary ? `### User's Summary
${profileData.summary}` : ''}

## TARGET JOB
${jobDescription}`;

  if (companyInsights) {
    prompt += `

## COMPANY INTELLIGENCE
${companyInsights}

Use these insights to tailor language, emphasize relevant skills, and mirror company terminology.`;
  }

  prompt += `

## YOUR TASK
1. **Analyze the job:** Identify top 5 required skills and keywords
2. **Select content:** Choose which sections to include based on user data and job needs
3. **Tailor everything:** Rewrite bullets to match job keywords and requirements
4. **Fill the page:** Resume must be dense and use 95-100% of the page
5. **Pass ATS:** Use exact keywords from job description, standard section headers

## REMEMBER
- Be ADAPTIVE: Include projects, certifications, or other sections if they strengthen the application
- Be DENSE: 4-6 bullets per role, each with metrics
- Be RELEVANT: Every line should help this person get THIS job
- OUTPUT: Raw LaTeX only, no markdown, no explanations`;

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
