/**
 * Fast Prompt Builder - Optimized for <30 second generation
 * Uses proper LaTeX structure from enhanced-prompt-builder.js
 * Minimal instructions, maximum clarity
 */

export function buildFastSystemPrompt() {
  return `You are an expert LaTeX resume writer and ATS optimization specialist. Generate a resume that will score 85+ on ATS systems.

🚨 CRITICAL NON-NEGOTIABLE REQUIREMENT 🚨
The resume MUST be EXACTLY ONE PAGE when compiled.
- NOT 1.5 pages
- NOT 2 pages
- EXACTLY ONE PAGE
- If you generate more than one page, the system will FAIL
- Adjust content density to fit ONE PAGE ONLY

🎯 ATS OPTIMIZATION REQUIREMENTS:

1. KEYWORD EXTRACTION & MATCHING:
   - Extract ALL technical terms, tools, frameworks, certifications from the job description
   - Use these EXACT terms in the resume (case-sensitive matching)
   - Example: If JD says "Microsoft Purview" → Use "Microsoft Purview" NOT "data security tool"
   - Product names, frameworks, and certifications must match EXACTLY

2. KEYWORD DENSITY & PLACEMENT:
   - Place critical keywords from JD in:
     * Summary section (top 3-5 most important keywords)
     * Experience bullets (distributed naturally)
     * Skills section (grouped by category from JD)
   - Use each critical keyword 2-3 times (not more, not less)
   - Natural placement - keywords must make semantic sense

3. EXPERIENCE TAILORING:
   - Rewrite experience bullets to highlight relevant work matching JD requirements
   - Map candidate's actual work to JD requirements using JD's language
   - Example: If candidate built "security system" and JD needs "data protection strategies"
     → Write: "Implemented data protection strategies through security system..."
   - Every bullet should contain 1-2 keywords from JD

4. SKILLS SECTION OPTIMIZATION:
   - Group skills exactly as JD groups them (if JD has categories)
   - Order skills by importance in JD (most mentioned first)
   - Include ALL required tools/technologies from JD that candidate has experience with

5. CONTENT TRUTHFULNESS:
   - NEVER invent experience candidate doesn't have
   - Only emphasize and reframe existing experience
   - If candidate lacks a required skill, omit it (don't lie)
   - Rewrite truthfully but optimized for keyword matching

Generate this EXACT LaTeX structure:

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

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Optimal margins for full page utilization
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

% Custom Commands - Optimized spacing
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

% HEADER
\\begin{center}
    {\\Huge \\scshape [NAME]} \\\\ \\vspace{1pt}
    \\small [LOCATION] ~ \\raisebox{-0.1\\height}\\faPhone\\ [PHONE] ~
    \\href{mailto:[EMAIL]}{\\raisebox{-0.2\\height}\\faEnvelope\\ \\underline{[EMAIL]}}
    % Only add if provided: ~ \\href{[LINKEDIN]}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{linkedin}}
    % Only add if provided: ~ \\href{[WEBSITE]}{\\raisebox{-0.2\\height}\\faGlobe\\ \\underline{website}}
    \\vspace{-5pt}
\\end{center}

% SUMMARY
\\section*{Summary}
[2-3 lines positioning for target role. Bold key skills with \\textbf{} using EXACT keywords from JD. Include top 3-5 critical keywords naturally.]

% EXPERIENCE
\\section{Experience}
\\resumeSubHeadingListStart
  \\resumeSubheading{[JOB_TITLE]}{[DATES]}{[COMPANY]}{[LOCATION]}
    \\resumeItemListStart
      \\resumeItem{[Action verb + scope + outcome. Use \\textbf{exact keywords from JD} - 2-3 per bullet]}
      \\resumeItem{[Quantified achievement using JD terminology and metrics]}
      \\resumeItem{[Responsibility rewritten to mirror JD language and requirements]}
    \\resumeItemListEnd
\\resumeSubHeadingListEnd

% SKILLS
\\section{Skills}
\\resumeSubHeadingListStart
\\small{\\item{
  \\textbf{[Category from JD]}: [List using EXACT terms from JD, ordered by importance] \\\\
  \\textbf{[Category from JD]}: [List using EXACT terms from JD] \\\\
  \\textbf{[Category from JD]}: [List using EXACT terms from JD]
}}
\\resumeSubHeadingListEnd

% EDUCATION
\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading{[UNIVERSITY]}{[DATES]}{[DEGREE]}{[LOCATION]}
\\resumeSubHeadingListEnd

\\end{document}

🎯 ONE PAGE REQUIREMENTS (CRITICAL):
1. Content must fill 85-95% of EXACTLY ONE page - no more, no less:
   - For 2 jobs: Use 4-5 bullets each (adjust if overflowing)
   - For 3 jobs: Use 3-4 bullets each (adjust if overflowing)
   - For 4+ jobs: Use 2-3 bullets each (adjust if overflowing)

2. If content is about to overflow to page 2:
   - Reduce bullet points per job
   - Make bullets more concise (1 line instead of 2)
   - Remove Projects section if present
   - Shorten Summary to 1-2 lines

3. NEVER let content spill to a second page under any circumstances

2. BULLET POINT GUIDELINES:
   - Each bullet should be 1-2 lines long
   - Start with strong action verbs
   - Include metrics/outcomes when possible
   - Bold 2-3 EXACT keywords from JD per bullet using \\textbf{keyword}
   - Use JD's language and terminology throughout

3. LATEX FORMATTING (CRITICAL):
   - Bold keywords: \\textbf{keyword} NOT **keyword**
   - Italic: \\textit{text} NOT _text_
   - NO MARKDOWN EVER (no **, *, _, #)
   - All formatting must be valid LaTeX

4. CRITICAL LATEX SYNTAX (Follow EXACTLY):
   a) NO & CHARACTER except in tables
      WRONG: Python & JavaScript & React
      RIGHT: Python, JavaScript, React

   b) ALL commands must have closing braces
      WRONG: \\resumeItem{Text here
      RIGHT: \\resumeItem{Text here}

   c) Skills section format:
      \\resumeSubHeadingListStart
      \\small{\\item{
        \\textbf{Category}: Skill1, Skill2, Skill3 \\\\
        \\textbf{Category}: Skill1, Skill2
      }}
      \\resumeSubHeadingListEnd

   d) Experience bullets format:
      \\resumeItem{Complete sentence ending with period.}

   e) ALWAYS end with \\end{document}

   f) Test each section for balanced braces before moving to next section

5. ESCAPE special characters: & → \\&, % → \\%, # → \\#, _ → \\_
6. Date format: Mon YYYY -- Present (e.g., Sep 2024 -- Present)
7. ONLY use \\resumeItem{} for bullets (NEVER use • or unicode)
8. NO empty itemize blocks

🎯 ATS KEYWORD PROCESS (CRITICAL - FOLLOW EXACTLY):

Step 1: ANALYZE job description and extract:
   - Required skills (must-have keywords)
   - Preferred skills (nice-to-have keywords)
   - Tools/technologies mentioned
   - Certifications mentioned
   - Key responsibilities and their exact terminology

Step 2: MAP candidate experience to JD requirements:
   - Identify which JD requirements they meet
   - Find which keywords they can legitimately use
   - Match experience to JD responsibilities

Step 3: PLAN keyword placement BEFORE writing:
   - Summary section: Select top 5 CRITICAL keywords to include
   - Each experience bullet: Plan which 1-2 keywords to integrate
   - Skills section: Group ALL remaining keywords by category

Step 4: WRITE the resume with planned keywords:
   - Write Summary with planned keywords bolded
   - Write each experience bullet with 1-2 JD keywords naturally integrated
   - Write Skills section with exact JD terminology

Step 5: SELF-VERIFY before outputting (MANDATORY):
   - Check Summary: Does it contain 3-5 critical keywords? ✓
   - Check Experience: Does EACH bullet contain 1-2 JD keywords? ✓
   - Check each critical keyword: Is it used 2-3 times total? ✓
   - Check keyword distribution: Are keywords spread across sections? ✓
   - If ANY check fails → Go back to Step 4 and rewrite that section

Step 6: OUTPUT only after all verifications pass

SECTION ORDER (must fit on ONE PAGE):
1. Header (name, contact) - 10%
2. Summary (2-3 lines with top JD keywords) - 10%
3. Experience (60-70% of page, using JD language) - ADJUST TO FIT ONE PAGE
4. Skills (10-15% of page, using EXACT JD terms)
5. Education (10% of page)

⚠️ PAGE OVERFLOW PREVENTION (CRITICAL):
- If you have 5+ years of experience, use 2-3 bullets per job MAX
- If bullets are getting long (>2 lines), make them concise
- NEVER include Projects section if you have 3+ jobs
- Summary should be 2 lines max, 1 line if content is dense
- Prioritize most recent and relevant experience only

OUTPUT: Only LaTeX code`;
}

export function buildFastUserPrompt(userProfile, jobDescription, keywords = null) {
  // Streamlined prompt focusing on essential data
  let profileText = '';

  // If userProfile is a string (resume text), use it directly
  if (typeof userProfile === 'string') {
    profileText = userProfile;
  } else {
    // Extract key information for structured data
    const info = userProfile.personalInfo || userProfile.profile || {};
    const experience = userProfile.experience || [];
    const education = userProfile.education || [];
    const skills = userProfile.skills || [];

    profileText = `
CONTACT:
Name: ${info.name || info.fullName || 'Not provided'}
Email: ${info.email || 'Not provided'}
Phone: ${info.phone || info.phoneNumber || 'Not provided'}
Location: ${info.location || info.city || 'Not provided'}
LinkedIn: ${info.linkedin || info.linkedinUrl || ''}
Website: ${info.website || info.portfolio || info.github || ''}

EXPERIENCE:
${experience.map(exp => `
- ${exp.title || exp.position} at ${exp.company || exp.organization}
  ${exp.startDate || exp.from} - ${exp.endDate || exp.to || 'Present'}
  ${exp.location || ''}
  ${Array.isArray(exp.responsibilities) ? exp.responsibilities.join('; ') : exp.responsibilities || exp.description || ''}
  ${Array.isArray(exp.achievements) ? exp.achievements.join('; ') : ''}
  Tech: ${Array.isArray(exp.technologies) ? exp.technologies.join(', ') : exp.technologies || exp.tools || ''}
`).join('')}

EDUCATION:
${education.map(edu => `
- ${edu.degree || edu.qualification} from ${edu.institution || edu.school || edu.university}
  ${edu.graduationDate || edu.year || edu.endDate || ''}
  ${edu.location || ''}
  GPA: ${edu.gpa || ''}
`).join('')}

SKILLS:
${Array.isArray(skills) ? skills.join(', ') : JSON.stringify(skills)}
`;
  }

  // Build keyword integration section if keywords provided
  let keywordSection = '';
  if (keywords && (keywords.criticalKeywords?.length > 0 || keywords.importantKeywords?.length > 0)) {
    keywordSection = `
🚨 MANDATORY KEYWORD INTEGRATION - ATS OPTIMIZATION 🚨

You MUST incorporate these extracted keywords to achieve 85%+ ATS score:

CRITICAL KEYWORDS (MUST use ALL, each 2-3 times):
${keywords.criticalKeywords ? keywords.criticalKeywords.map(k => `"${k}"`).join(', ') : 'None'}

IMPORTANT KEYWORDS (use at least 70% of these):
${keywords.importantKeywords ? keywords.importantKeywords.map(k => `"${k}"`).join(', ') : 'None'}

TECHNICAL KEYWORDS (use where relevant):
${keywords.technicalKeywords ? keywords.technicalKeywords.map(k => `"${k}"`).join(', ') : 'None'}

📋 KEYWORD INTEGRATION CHECKLIST (Complete BEFORE outputting LaTeX):

1️⃣ SUMMARY SECTION:
   - Include 3-5 CRITICAL keywords naturally: ✓
   - Bold first mention of each keyword: ✓
   - Keywords must fit naturally in 2-3 sentences: ✓

2️⃣ EXPERIENCE SECTION:
   - EACH bullet must contain 1-2 JD keywords: ✓
   - Keywords integrated in context (not just listed): ✓
   - Example: "Built \\textbf{Python} microservices" NOT "Used Python": ✓

3️⃣ SKILLS SECTION:
   - All CRITICAL keywords present: ✓
   - All IMPORTANT keywords (70%+) present: ✓
   - Grouped by category from JD: ✓

4️⃣ KEYWORD DENSITY CHECK (For each CRITICAL keyword):
   ${keywords.criticalKeywords ? keywords.criticalKeywords.map(k => `   - "${k}": Count = 2-3 times? ✓`).join('\n') : ''}

5️⃣ DISTRIBUTION CHECK:
   - Keywords in Summary: Yes? ✓
   - Keywords in Experience bullets: Yes? ✓
   - Keywords in Skills: Yes? ✓
   - NOT all keywords in Skills only: ✓

INTEGRATION EXAMPLES:

❌ WRONG (keyword stuffing, no context):
"Used Python, JavaScript, AWS, Docker, Kubernetes for development."

✅ RIGHT (contextual integration):
"Architected \\textbf{microservices} using \\textbf{Python} and \\textbf{FastAPI}, deployed on \\textbf{AWS} with \\textbf{Docker} containers, achieving 99.9\\% uptime."

❌ WRONG (keyword only in Skills):
Skills: Python, Machine Learning, TensorFlow
Experience: Built data processing pipeline...

✅ RIGHT (keyword in context + Skills):
Experience: Built \\textbf{Machine Learning} pipeline using \\textbf{TensorFlow}...
Skills: Machine Learning, TensorFlow, Python

🔍 MANDATORY SELF-VERIFICATION:
Before outputting, mentally verify:
1. Did I use EVERY critical keyword 2-3 times? (Count them)
2. Are keywords in Summary, Experience, AND Skills?
3. Are keywords used IN CONTEXT in experience bullets?
4. If NO to any → Rewrite that section NOW before outputting
`;
  }

  return `Generate a tailored LaTeX resume that MUST fill ONE COMPLETE PAGE.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILE:
${profileText}

${keywordSection}

🚨 CRITICAL NON-NEGOTIABLE REQUIREMENTS 🚨

1. ⚠️ ONE PAGE ONLY - If content exceeds one page, you FAILED the task
   - Reduce bullets, shorten text, remove sections as needed
   - The resume MUST compile to EXACTLY 1 page

2. Extract keywords from JD and use EXACT terms (case-sensitive)

3. Bold keywords using \\textbf{keyword} NOT **keyword**

4. Match 85%+ of critical JD keywords in the resume

5. Each bullet: 1-2 lines with action verb + JD keyword + outcome

6. Use EXACT LaTeX structure provided - no modifications

7. Only include LinkedIn/GitHub/Website if explicitly in profile data

8. Date format: Sep 2024 -- Present (full month names)

9. NO placeholders - use actual content from profile

10. Balance sections to fit ONE PAGE (adjust as needed):
    - 2 jobs = 4-5 bullets each (reduce if overflowing)
    - 3 jobs = 3-4 bullets each (reduce if overflowing)
    - 4+ jobs = 2-3 bullets each (reduce if overflowing)

11. Skills section must use EXACT terminology from JD

12. Never invent experience - only reframe existing work using JD language

EXAMPLE TRANSFORMATION:
Job Description says: "Experience with Microsoft Purview, Data Loss Prevention (DLP), and Information Protection (MIP)"
Candidate has: "Built data security system with encryption"
You write: "Architected data security system implementing \\textbf{encryption} and \\textbf{access controls}, aligning with \\textbf{Data Loss Prevention (DLP)} best practices"`;
}

// Helper function to quickly extract keywords from job description
export function extractKeywords(jobDescription) {
  if (!jobDescription) return [];

  // Common tech keywords and skills
  const keywords = [];

  // Extract capitalized words (likely tech/tools)
  const techWords = jobDescription.match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\b/g) || [];
  keywords.push(...techWords);

  // Common skill patterns
  const skillPatterns = [
    /\b(python|javascript|java|c\+\+|typescript|go|rust|ruby|php|swift|kotlin)\b/gi,
    /\b(react|angular|vue|node|django|flask|spring|rails|laravel)\b/gi,
    /\b(aws|azure|gcp|docker|kubernetes|jenkins|terraform|ansible)\b/gi,
    /\b(sql|nosql|mongodb|postgresql|mysql|redis|elasticsearch)\b/gi,
    /\b(git|agile|scrum|ci\/cd|devops|microservices|rest|api|graphql)\b/gi,
    /\b(machine learning|ai|data science|analytics|etl|pipeline)\b/gi
  ];

  skillPatterns.forEach(pattern => {
    const matches = jobDescription.match(pattern) || [];
    keywords.push(...matches);
  });

  // Remove duplicates and return top 20
  return [...new Set(keywords)].slice(0, 20);
}

export default {
  buildFastSystemPrompt,
  buildFastUserPrompt,
  extractKeywords
};