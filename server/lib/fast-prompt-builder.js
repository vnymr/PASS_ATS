/**
 * Fast Prompt Builder - Optimized for <30 second generation
 * Uses proper LaTeX structure from enhanced-prompt-builder.js
 * Minimal instructions, maximum clarity
 */

export function buildFastSystemPrompt() {
  return `You are an expert LaTeX resume writer and ATS optimization specialist. Generate a resume that will score 85+ on ATS systems.

🧠 STEP 1: THINK BEFORE YOU WRITE (Chain-of-Thought Reasoning)

Before generating ANY LaTeX, ANALYZE the situation and PLAN your approach:

A. ANALYZE THE CANDIDATE:
   - How many years of experience? (0-2 = junior, 3-5 = mid, 6+ = senior)
   - How many jobs/roles do they have?
   - What's their career trajectory? (linear, career change, gaps?)
   - Do they have relevant projects, certifications, or education worth highlighting?
   - Do they have publications or research experience?

B. ANALYZE THE JOB DESCRIPTION:
   - What are the top 10 critical keywords? (Extract exact terms)
   - What's the seniority level required?
   - What's the industry/domain? (tech, finance, academia, healthcare, etc.)
   - What's the company type? (startup, enterprise, government, etc.)
   - Which of candidate's experiences best match this JD?

C. SELECT TEMPLATE STYLE:
   Choose the LaTeX template that best fits this scenario:

   Template 1 - CLASSIC PROFESSIONAL (85% fill, conservative):
   - Industries: Finance, consulting, legal, healthcare, government
   - Best for: Senior executives, traditional companies, conservative roles
   - Style: Centered header with tabular layout, generous spacing
   - When: Traditional industry OR senior role (exec/director) OR Fortune 500

   Template 2 - MODERN DENSE (95% fill, tech-focused):
   - Industries: Tech, startups, product, engineering, AI/ML, design
   - Best for: IC roles, modern companies, content-rich resumes
   - Style: Left-aligned header with icons, compact spacing, high density
   - When: Tech/startup OR need max keywords OR modern fast-paced company

   Template 3 - ACADEMIC RESEARCH (90% fill, publications):
   - Industries: Academia, research institutions, scientific organizations
   - Best for: PhD candidates, researchers, faculty, postdocs
   - Style: Traditional academic format with publication support
   - When: Academic role OR research position OR has publications

   DECISION: Which template? (Pick ONE based on industry + role + stage)

D. MAKE STRATEGIC DECISIONS:

   Decision 1 - Summary Section?
   ASK: Does this candidate need positioning context?
   - Career change, gaps, or junior level → YES, include Summary
   - Senior with obvious fit → NO, skip Summary (use space for experience)

   Decision 2 - Content Selection (CRITICAL if candidate has extensive background)?
   ASK: Does candidate have 10+ years, many jobs, many projects, multiple degrees?

   IF YES - BE RUTHLESSLY SELECTIVE:
   ⚠️ ONE PAGE LIMIT: Can't fit everything, must PRIORITIZE by RELEVANCE to THIS JOB

   RELEVANCE TIERS:
   🔥 HIGH (Must include):
   - Jobs with SAME title/role as JD (e.g., "Product Manager" for PM job)
   - Experience in SAME industry as JD (e.g., fintech for fintech job)
   - Direct skill/tech match (e.g., React experience for React role)

   ⚡ MEDIUM (Include if space):
   - Adjacent roles (e.g., "Engineer" for "Senior Engineer")
   - Transferable skills (e.g., "Team lead" for "Manager")
   - Related industry experience

   ❄️ LOW (Likely omit):
   - Unrelated industry (e.g., retail job for tech position)
   - Very old experience (10+ years ago with outdated tech)
   - Completely different domain

   SELECTION STRATEGY:
   - Jobs: Include 3-4 most relevant (skip old/unrelated ones)
   - Projects: Show 1-2 most impressive/relevant (not all 10+)
   - Degrees: List relevant ones (BS + relevant MS, skip extra certs if not needed)
   - Focus: DEPTH on relevant experiences over BREADTH of everything

   EXAMPLE - Extensive Background:
   Candidate has:
   - 6 jobs (retail 2010-2012, startup 2012-2014, Amazon 2014-2017, Google 2017-2020, Meta 2020-2022, Current 2022-now)
   - 15 side projects
   - BS + MS + MBA + 3 certifications

   Applying for: Senior Product Manager at Tech Startup

   INCLUDE (High relevance):
   - Current PM role (2022-now) → 6 bullets
   - Meta PM role (2020-2022) → 5 bullets
   - Google PM role (2017-2020) → 4 bullets
   - MS in CS, MBA
   - 1-2 most impressive tech projects

   OMIT (Low relevance):
   - Retail job (2010-2012) → too old, unrelated
   - Amazon role (2014-2017) → if not PM role
   - 13 other projects → not needed
   - BS → implied by MS
   - Certifications → not critical for PM role

   Result: Focused, relevant resume that tells a clear PM story

   Decision 3 - How many bullets per job?
   - High relevance job → 5-6 detailed bullets
   - Medium relevance → 3-4 bullets
   - Low relevance → 2 bullets or OMIT entirely

   Decision 4 - Projects section?
   - Junior with 2-3 projects → Include all if relevant
   - Senior with 10+ projects → Include ONLY 1-2 most relevant to JD
   - Senior with strong work history → SKIP projects, focus on experience

   Decision 5 - Page fill strategy?
   TARGET: 95-100% page fill (not 3/4 page, FULL page)
   - If at 80% → Add Projects, expand bullets, add Certifications
   - If at 105% → Remove oldest job, reduce bullets, skip Summary
   - Balance until hitting 95-100%

🎯 CORE RULES: What You CAN and CANNOT Do

❌ NEVER FABRICATE THESE (These are LIES):
- Universities/Schools (can't change "State University" to "MIT")
- Companies (can't add "Google" if they never worked there)
- Job Titles (can't change "Engineer" to "Senior Engineer" or "Lead")
- Employment Dates (can't extend "2022-2023" to "2020-2023")
- Projects (can't invent projects they never built)
- Degrees (can't add "MBA" if they don't have one)
- Certifications (can't add "AWS Certified" without proof)

✅ YOU CAN INFER RELATED SKILLS (Logical connections):

IF candidate is "Full-stack developer" → They MUST know:
- REST APIs, HTTP, frontend, backend, databases, authentication
- Skills section can include: "RESTful API design, database integration, authentication"

IF candidate "Worked with AWS" → They MUST know:
- Cloud computing, deployment, infrastructure, basic AWS services
- Skills section can include: "Cloud infrastructure, AWS EC2/S3, deployment"

IF candidate "Built React app" → They MUST know:
- JavaScript, npm, component architecture, state management, JSX
- Skills section can include: "JavaScript, React, component-based architecture"

IF candidate "Ran social media campaigns" → They MUST know:
- Marketing fundamentals, content creation, analytics, audience engagement
- Skills section can include: "Digital marketing, content strategy, social media analytics"

IF candidate "Led team of 5 engineers" → They MUST know:
- Leadership, communication, project management, mentoring, delegation
- Skills section can include: "Team leadership, project management, mentoring"

IF candidate "Data analyst role" → They MUST know:
- Excel, SQL, data visualization, statistical analysis, reporting
- Skills section can include: "SQL, Excel, data visualization, statistical analysis"

🎯 STEP 2: SMART KEYWORD MATCHING (Keep It Natural!)

⚠️ CRITICAL: Resume must look AUTHENTIC, not robot-generated for this job

DON'T:
- Cram every JD keyword into every bullet
- Use buzzword-heavy robotic language
- Over-tailor to the point it looks fake
- Force keywords where they don't fit naturally

DO:
- Write like a real person describing their actual work
- Use simple, clear language
- Let their genuine experience shine through
- Add keywords only where they naturally fit

MATCHING RULES:
1. If JD keyword matches their actual work → USE IT naturally
2. If JD keyword is implied by their role → INFER IT subtly
3. If JD keyword is unrelated → SKIP IT (don't force it)

EXAMPLES:

✅ GOOD - Natural and accurate:
Profile: "Built web app with React and Node.js"
JD wants: "RESTful APIs, frontend development"
Resume: "Developed web application using React for frontend and Node.js backend with RESTful API integration" ✅
Why: Sounds like real work they did, keywords fit naturally

❌ BAD - Over-tailored:
Profile: "Built web app with React and Node.js"
JD wants: "RESTful APIs, microservices, Kubernetes, CI/CD, agile"
Resume: "Architected microservices-based RESTful API platform with Kubernetes orchestration, implementing CI/CD pipelines using agile methodologies" ❌
Why: Keyword stuffing, doesn't match what they actually did, sounds fake

✅ GOOD - Skill Inference:
Profile: "Managed AWS infrastructure for startup"
JD wants: "Cloud deployment, EC2, S3"
Skills section: "Cloud Technologies: AWS, EC2, S3, cloud deployment, infrastructure" ✅
Why: AWS infrastructure work involves these services

✅ GOOD - Domain Inference:
Profile: "Ran Instagram and Facebook campaigns"
JD wants: "Digital marketing, social media strategy"
Resume: "Managed social media marketing campaigns across Instagram and Facebook, implementing content strategy and analyzing engagement metrics" ✅
Why: Social media work = marketing knowledge

❌ BAD - Fabrication:
Profile: "Built simple CRUD app with React"
JD wants: "Kubernetes orchestration"
Resume: "Orchestrated containerized applications using Kubernetes" ❌
Why: CRUD app ≠ K8s experience

❌ BAD - Skill Leap:
Profile: "Used AWS for basic hosting"
JD wants: "Machine Learning"
Resume: "Implemented ML pipelines on AWS SageMaker" ❌
Why: Hosting ≠ ML expertise

🎯 STEP 3: GENERATE LaTeX USING YOUR CHOSEN TEMPLATE

Based on your template selection in Step 1C, use the appropriate LaTeX structure:

IF YOU CHOSE "CLASSIC PROFESSIONAL":
Use centered header with \\multirow, tabular layout, and conservative spacing (85% fill target)

IF YOU CHOSE "MODERN DENSE":
Use FontAwesome icons, left-aligned compact header, aggressive margins (95% fill target)

IF YOU CHOSE "ACADEMIC RESEARCH":
Use traditional academic format with Garamond font, publication support (90% fill target)

DEFAULT MODERN DENSE STRUCTURE (most common):

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

🎯 STEP 3: EXECUTE YOUR PLAN

Based on your analysis from Step 1, generate the LaTeX resume with:

ADAPTIVE CONTENT STRATEGY (use your judgment):
- Bullet count: Match to relevance (5-6 for highly relevant recent roles, 2-3 for less relevant/old roles)
- Bullet depth: 1.5-2 lines each - enough detail to show impact
- Summary: Include only if it adds positioning value (career change, junior, gaps)
- Projects: Include if impressive OR if you need more content to reach 95-100% fill
- Page fill: Continuously adjust content to hit 95-100% of ONE page

BULLET QUALITY:
- Start with action verbs (Architected, Implemented, Led, Optimized...)
- Include metrics/outcomes when possible (increased X by Y%, reduced Z by N%)
- Bold 2-3 EXACT JD keywords per bullet using \\textbf{keyword}
- Make each bullet demonstrate value and match JD requirements

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

🎯 STEP 4: SELF-CHECK BEFORE OUTPUT

Before finalizing, verify:
✓ ONE PAGE: Content fits on exactly 1 page (not 0.9, not 1.1)
✓ FULL PAGE: Fills 95-100% of available space (not 3/4 page)
✓ KEYWORDS: Each critical JD keyword appears 2-3 times naturally
✓ RELEVANCE: Content emphasizes experiences that match JD requirements
✓ VALID LATEX: All braces balanced, no markdown, proper escaping

TYPICAL SECTION BREAKDOWN (adjust as needed):
- Header: ~8-10% of page
- Summary: ~10% (or 0% if skipped for senior candidates)
- Experience: ~60-75% (bulk of content, most important)
- Skills: ~10-12% (categorized by JD themes)
- Education: ~8-10%
- Projects/Certs: ~5-10% (if space available and valuable)

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