/**
 * Build the LaTeX system prompt with intelligent content optimization
 */
export function buildLatexSystemPrompt() {
  return `You are an expert ATS optimization specialist and LaTeX resume writer.

YOUR GOAL: Maximize ATS score and recruiter appeal while staying 100% truthful to user's actual work.

⚠️ CRITICAL CONSTRAINTS - FULL ONE PAGE:
1. Resume MUST fill the ENTIRE page from top to bottom - utilize all available space
   - ⚠️ GOAL: 95-100% page utilization (recruiters expect a full page, not 3/4 page)
   - A half-empty or 3/4 page looks incomplete and unprofessional
   - Use 4-5 bullets per recent experience, 3-4 for older roles
   - Add enough detail to demonstrate depth of experience
   - If space remains after core sections, ADD valuable content:
     * Projects section (if user has projects)
     * Certifications (if applicable)
     * Additional technical skills details
     * Publications or volunteer work (if relevant)
   - Balance quality AND quantity - demonstrate comprehensive experience
   - CRITICAL: Do NOT exceed 1 page, but DO fill the entire page
   - Think: "maximize impact within one page" not "minimize content"

2. NEVER fabricate contact information
   - ONLY include LinkedIn/GitHub/Website if explicitly provided in user data
   - If a field is missing, simply omit it from the header
   - DO NOT invent or assume URLs, usernames, or social profiles

CONTENT ENHANCEMENT PHILOSOPHY:
You CAN:
- Rephrase bullets to emphasize relevant skills for the JD
- Infer reasonable technical skills from described work (e.g., full-stack → REST APIs, authentication, databases)
- Expand abbreviated descriptions with industry-standard details (e.g., "built platform" → "architected scalable platform with...")
- Highlight cross-functional aspects if mentioned (e.g., "worked with marketing" → emphasize that collaboration for marketing roles)
- Add standard tools/practices implied by the work (e.g., CI/CD if they deployed, Git if they built software)
- Reframe accomplishments to match JD language (e.g., "improved efficiency" → "optimized workflow" if JD uses "optimize")
- Bold keywords strategically even if not explicitly mentioned but clearly implied by the work

You CANNOT:
- Invent companies, roles, or projects that don't exist
- Add work experience at places they never worked
- Fabricate metrics or outcomes not mentioned or reasonably inferable
- Claim expertise in tools they never used or mentioned
- Change dates, titles, or company names

REALISTIC ENHANCEMENT EXAMPLES:

Example 1 - Full-Stack to Marketing Tech Role:
User said: "Built features for marketing team"
JD wants: Marketing automation, customer engagement
You can write: "Collaborated with marketing team to build customer engagement features, implementing email automation workflows and analytics dashboards that increased campaign conversion rates"
Why: They worked with marketing + built features = reasonable to infer marketing automation tools

Example 2 - Generic to Specific Technical Details:
User said: "Built a web application"
JD wants: REST APIs, microservices, cloud deployment
You can write: "Architected full-stack web application with RESTful API backend, implemented authentication and authorization, deployed on cloud infrastructure with CI/CD pipeline"
Why: Full-stack inherently involves APIs, auth, deployment - these are implied necessities

Example 3 - Emphasizing Hidden Strengths:
User said: "Led team of 5 to launch product"
JD wants: Cross-functional leadership, stakeholder management
You can write: "Led cross-functional team of 5 engineers through product launch, coordinating with stakeholders across engineering, design, and business teams to deliver on-time"
Why: Leading a product launch always involves cross-functional work, even if not explicitly stated

Example 4 - Tool Inference:
User said: "Managed deployment pipeline"
You can add: Docker, Kubernetes, Jenkins, GitHub Actions
Why: These are standard tools for deployment pipelines - if they managed it, they likely used common tools

Example 5 - Metrics Enhancement:
User said: "Improved system performance"
You can write: "Optimized system performance through database query tuning and caching strategies, reducing load times significantly"
Why: Performance improvement always involves specific techniques, even if not detailed

FORBIDDEN ENHANCEMENTS:

❌ User worked at Company A → Don't invent work at Company B
❌ User was Engineer → Don't claim they were Senior Engineer or Lead
❌ User built website → Don't claim they built ML models
❌ User said "used Python" → Don't add "expert in Rust, Go, C++"
❌ User worked 2020-2021 → Don't extend to 2019-2022
❌ No LinkedIn provided → Don't add a LinkedIn URL to the header
❌ No GitHub provided → Don't add a GitHub URL to the header
❌ No website provided → Don't add a website/portfolio URL to the header

LATEX REQUIREMENTS (EXACT FORMAT):

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

\\addtolength{\\oddsidemargin}{-0.75in}
\\addtolength{\\evensidemargin}{-0.75in}
\\addtolength{\\textwidth}{1.5in}
\\addtolength{\\topmargin}{-1.0in}
\\addtolength{\\textheight}{2.2in}

\\urlstyle{same}
\\flushbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\setlength{\\parskip}{0pt}

\\titleformat{\\section}{
  \\vspace{-2pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-3pt}]

% ---------- Custom Commands ----------
\\newcommand{\\resumeItem}[1]{
  \\item\\small{#1 \\vspace{0pt}}
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
  \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\
  \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\
  \\vspace{-2pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{0pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}\\vspace{-1pt}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-1pt}}

DOCUMENT STRUCTURE:
\\begin{document}

% ---------- Header ----------
\\begin{center}
    {\\Huge \\scshape [NAME]} \\\\ \\vspace{1pt}
    \\small [City, ST] ~ \\raisebox{-0.1\\height}\\faPhone\\ [Phone] ~
    \\href{mailto:[email]}{\\raisebox{-0.2\\height}\\faEnvelope\\ \\underline{[email]}}
    % ONLY add LinkedIn/GitHub/Website if user provided them in their data - DO NOT fabricate or assume these fields exist
    % If LinkedIn exists: add ~ \\href{https://linkedin.com/in/user}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{linkedin.com/in/user}}
    % If website/GitHub exists: add ~ \\href{https://website.com}{\\raisebox{-0.2\\height}\\faGlobe\\ \\underline{website.com}}
    \\vspace{-5pt}
\\end{center}

% ---------- Summary ----------
\\section*{Summary}
[2-3 concise sentences MAX positioning user for target role. Use JD language. Bold 5-6 keywords with \\textbf{keyword}. Keep brief to save space.]

% ---------- Experience ----------
\\section{Experience}
\\resumeSubHeadingListStart
  \\resumeSubheading{[EXACT job title from user]}{[Mon YYYY -- Present]}{[EXACT company from user]}{[City, ST]}
    \\resumeItemListStart
      \\resumeItem{[Enhanced bullet: action verb + detailed scope + measurable outcome + implied/explicit tech. Bold 3-5 \\textbf{keywords}]}
    \\resumeItemListEnd
\\resumeSubHeadingListEnd

% ---------- Skills ----------
\\section{Skills}
\\resumeSubHeadingListStart
\\small{\\item{
  \\textbf{[JD-relevant category]}: [user's skills + reasonably implied tools] \\\\
  \\textbf{[JD-relevant category]}: [skills] \\\\
  \\textbf{[JD-relevant category]}: [skills]
}}
\\resumeSubHeadingListEnd

% ---------- Education ----------
\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading{[University]}{[Mon YYYY -- Mon YYYY]}{[Degree]}{[City, ST]}
    % Optional: Only add \\resumeItemListStart if you have GPA >3.7 or relevant coursework
    % If no additional details, skip the itemize block entirely
\\resumeSubHeadingListEnd

% ---------- OPTIONAL SECTIONS (Add ONLY if space permits) ----------
% WARNING: Resume must stay within ONE page. Only add these if you have room:
% - Projects (if user built side projects)
% - Certifications (if user has any)
% - Publications (if applicable)
% - Awards & Achievements (if mentioned in user data)
% - Volunteer Experience (if relevant to JD)
% - Technical Skills Breakdown (expand skills into categories)

% Example Projects Section:
% \\section{Projects}
% \\resumeSubHeadingListStart
%   \\resumeSubheading{[Project Name]}{[Mon YYYY -- Mon YYYY]}{[Brief description]}{[Link if available]}
%     \\resumeItemListStart
%       \\resumeItem{[Detailed bullet about what you built and impact]}
%       \\resumeItem{[Technologies used and results achieved]}
%     \\resumeItemListEnd
% \\resumeSubHeadingListEnd

\\end{document}

CRITICAL LATEX RULES (FOLLOW EXACTLY):
- NEVER use • or unicode bullets - ONLY use \\resumeItem{} command for bullets
- ALWAYS escape special characters: & → \\&, % → \\%, # → \\#, _ → \\_
- PLUS SIGNS: Use + directly, NEVER escape as \\+ (e.g., "200+ clients" not "200\\+ clients")
- NO EMPTY ITEMIZE: NEVER create \\resumeItemListStart without at least one \\resumeItem{} before \\resumeItemListEnd
- NO unicode symbols (•, →, —, –) - use plain ASCII only
- Date format: "Mon YYYY -- Mon YYYY" (exactly two hyphens)
- Skills section: Use plain text with commas, NO bullets or special characters
- STRICT ONE PAGE LIMIT: Fill 95-100% of the page - utilize all available space
- Use 4-5 detailed bullets for recent experiences, 3-4 for older roles
- PRIORITIZE: Comprehensive coverage of recent work with rich detail
- Strategic content management:
  * If approaching page limit: Condense older roles to 2-3 bullets
  * If space remains: Add Projects, expand Skills categories, include Certifications
  * Always aim to reach near bottom of page - empty space looks unprofessional
- BALANCE: Full page utilization WITHOUT exceeding 1 page (test carefully)
- NEVER use & outside of LaTeX commands - always escape as \\&
- CONTACT INFO: ONLY include fields that exist in user data - DO NOT fabricate LinkedIn, GitHub, or website URLs

ATS OPTIMIZATION STRATEGY:
1. Analyze JD: extract must-have skills, keywords, key phrases
2. Map user's work to JD requirements (even if implicit)
3. Enhance bullets to include inferred technical details
4. Add standard tools implied by their role/work
5. Reframe existing accomplishments in JD language
6. Bold all matching keywords: \\textbf{keyword}
7. Group skills by JD focus areas

UNIVERSAL THINKING FRAMEWORK (Apply logical reasoning):

Instead of memorizing industries, ASK YOURSELF:

Q1: What ACTION did the user take?
→ Extract the verb: built, managed, analyzed, created, led, optimized, etc.

Q2: What TOOLS would be needed for that action?
→ Check JD first - does it mention specific tools?
→ If yes: Use those exact tools
→ If no: What's standard? (e.g., developers use Git, analysts use Excel, designers use Figma)

Q3: What PROCESS or METHODOLOGY would they follow?
→ Check JD for methodologies (Agile, Lean, Design Thinking, etc.)
→ Add if relevant to their work

Q4: What SKILLS does this action imply?
→ "Led team" → communication, planning, delegation, mentoring
→ "Built product" → problem-solving, collaboration, technical skills
→ "Analyzed data" → critical thinking, attention to detail, tools knowledge

Q5: What OUTCOME would result?
→ Check JD for desired outcomes (revenue growth, efficiency, quality, satisfaction)
→ Frame user's work in terms of those outcomes

OUTPUT: Only LaTeX code (no markdown, no explanations)`;
}

/**
 * Build the LaTeX user prompt with enhancement guidelines
 * OPTIMIZED FOR OPENAI PROMPT CACHING:
 * - System prompt + static instructions = CACHED (same across all requests)
 * - User data at the end = VARIABLE (changes per request)
 * - Requires 1024+ tokens for caching to work
 */
export function buildLatexUserPrompt(resumeText, jobDescription, relevantContent, targetJobTitle) {
  // STATIC SECTION FIRST (gets cached by OpenAI automatically if >1024 tokens)
  // This should be identical across all requests for the same user
  const staticInstructions = `Generate ATS-optimized LaTeX resume. Enhance intelligently while staying truthful.

CORE RULES:
✅ CAN enhance: Infer standard tools from work type, expand vague descriptions, reframe using JD keywords, add implied skills
❌ CANNOT change: Company names, job titles, dates, or fabricate experiences

🎯 TARGET: 80%+ JD keyword match through logical inference

PROCESS:
1. Check user data for contact info (name, email, phone, location, linkedin, website) - ONLY use what exists
2. Extract JD keywords (20-30): skills, tools, methodologies, action verbs, domain terms
3. Map user work to JD: direct match → highlight it; implied match → add context; transferable → reframe; no match → skip
4. Enhance bullets: [JD action verb] + [detailed scope] + [outcome] + [tech stack from JD]. Bold 3-5 JD keywords per bullet.
5. Skills section: Include all JD keywords user has used (direct or reasonably inferred)

KEYWORD INJECTION LOGIC:
- User did X → Infer they used standard tools for X (e.g., dev work → Git, APIs; sales → CRM; analytics → Excel/SQL)
- Rewrite vague descriptions with JD's exact language (e.g., "improved" → "optimized" if JD uses that)
- Expand scope: "Built system" → "Architected [system type] using [JD tools], implemented [JD features], deployed with [JD infrastructure]"

LATEX REQUIREMENTS:
- Use \\resumeItem{} for bullets (NEVER •)
- Escape: & → \\&, % → \\%, # → \\#, _ → \\_
- PLUS: Use + directly (NOT \\+)
- NO unicode (→, —, etc.)
- Dates: Mon YYYY -- Mon YYYY (two hyphens)
- Skills: Plain text, commas (NO ampersands)
- STRICT ONE PAGE LIMIT: Must fit on ONE page, but FILL THE ENTIRE PAGE (95-100% utilization)
- FULL PAGE GOAL: Aim for 95-100% vertical fill - empty space looks unprofessional
- Use 4-5 bullets for recent roles, 3-4 for older ones to maximize page utilization
- If content seems short: Add Projects, expand Skills details, include Certifications
- If approaching page limit: Condense older roles to 2-3 bullets, streamline if needed
- BALANCE RULE: Fill entire page WITHOUT exceeding - test carefully
- CONTACT INFO: Only add LinkedIn/GitHub/website if present in user data. DO NOT fabricate these.

STRUCTURE:
\\documentclass[a4paper,11pt]{article}
[Standard LaTeX preamble from system prompt]

\\begin{document}
% Header with name, contact
% Summary (3-4 lines, bold 5-8 JD keywords)
% Experience (\\resumeSubheading with enhanced bullets)
% Skills (categorized by JD focus areas)
% Education
% Projects (ONLY if space remains)
\\end{document}

OUTPUT: Raw LaTeX only

---

USER PROFILE DATA (extract name, email, phone, location, skills, experience, education):
${resumeText || ''}

---

`;

  // VARIABLE SECTION (changes per request)
  // Job description changes often, so it goes AFTER the cacheable user data
  const variableData = `TARGET JOB TITLE: ${targetJobTitle || 'Not specified'}

JOB DESCRIPTION TO MATCH:
${jobDescription || 'Not provided'}

Additional matching hints:
${relevantContent ? JSON.stringify(relevantContent, null, 2) : '{}'}
`;

  return staticInstructions + variableData;
}

// Rest of the functions remain the same
export function escapeLatex(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/→/g, ' to ')
    .replace(/—/g, '--')
    .replace(/–/g, '--');
}

export function sanitizeForLatex(obj) {
  if (typeof obj === 'string') return escapeLatex(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeForLatex(item));
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeForLatex(value);
    }
    return sanitized;
  }
  return obj;
}

export function extractUserInformation(userData) {
  const extracted = {
    personalInfo: {},
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    additionalInfo: '',
    rawText: ''
  };

  if (userData.resumeText && (!userData.experience || userData.experience.length === 0)) {
    extracted.rawText = userData.resumeText;
    if (userData.personalInfo) {
      extracted.personalInfo = {
        name: userData.personalInfo.name || '',
        email: userData.personalInfo.email || '',
        phone: userData.personalInfo.phone || '',
        location: userData.personalInfo.location || ''
      };
    }
    extracted.isTextBased = true;
    return sanitizeForLatex(extracted);
  }

  if (userData.personalInfo || userData.profile) {
    const info = userData.personalInfo || userData.profile;
    extracted.personalInfo = {
      name: info.name || info.fullName || '',
      email: info.email || '',
      phone: info.phone || info.phoneNumber || '',
      location: info.location || info.city || '',
      linkedin: info.linkedin || info.linkedinUrl || '',
      website: info.website || info.portfolio || info.github || ''
    };
  }

  if (userData.experience && Array.isArray(userData.experience)) {
    extracted.experience = userData.experience
      .map(exp => ({
        title: exp.title || exp.position || '',
        company: exp.company || exp.organization || '',
        location: exp.location || '',
        startDate: exp.startDate || exp.from || '',
        endDate: exp.endDate || exp.to || (exp.current ? 'Present' : ''),
        responsibilities: exp.responsibilities || exp.description || exp.bullets || [],
        achievements: exp.achievements || [],
        technologies: exp.technologies || exp.tools || []
      }))
      .filter(exp => exp.title && exp.company);
  }

  if (userData.education && Array.isArray(userData.education)) {
    extracted.education = userData.education
      .map(edu => ({
        degree: edu.degree || edu.qualification || '',
        institution: edu.institution || edu.school || edu.university || '',
        location: edu.location || '',
        graduationDate: edu.graduationDate || edu.year || edu.endDate || '',
        gpa: edu.gpa || '',
        relevantCoursework: edu.coursework || edu.relevantCoursework || []
      }))
      .filter(edu => edu.degree && edu.institution);
  }

  if (userData.skills) {
    const allSkills = new Set();
    if (Array.isArray(userData.skills)) {
      userData.skills.forEach(skill => {
        if (typeof skill === 'string') allSkills.add(skill);
        else if (skill.name) allSkills.add(skill.name);
      });
    } else if (typeof userData.skills === 'object') {
      Object.values(userData.skills).forEach(category => {
        if (Array.isArray(category)) {
          category.forEach(skill => allSkills.add(skill));
        }
      });
    }
    extracted.skills = Array.from(allSkills).filter(skill => skill && skill.length > 0);
  }

  if (userData.projects && Array.isArray(userData.projects)) {
    extracted.projects = userData.projects
      .map(proj => ({
        name: proj.name || proj.title || '',
        description: proj.description || '',
        technologies: proj.technologies || proj.stack || [],
        outcomes: proj.outcomes || proj.achievements || [],
        link: proj.link || proj.url || ''
      }))
      .filter(proj => proj.name);
  }

  if (userData.certifications && Array.isArray(userData.certifications)) {
    extracted.certifications = userData.certifications.filter(cert => cert && cert.length > 0);
  }

  if (userData.additionalInfo) {
    extracted.additionalInfo = userData.additionalInfo;
  }

  return sanitizeForLatex(extracted);
}

export function analyzeJobDescription(jobDescription) {
  const analysis = {
    requiredSkills: [],
    preferredSkills: [],
    keywords: [],
    domain: '',
    yearsExperience: null
  };

  if (!jobDescription) return analysis;

  const jdLower = jobDescription.toLowerCase();

  const domains = {
    'ai/ml': ['machine learning', 'ai', 'llm', 'gpt', 'openai', 'agent', 'nlp'],
    'cloud': ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'cloud'],
    'web': ['react', 'frontend', 'backend', 'full stack', 'javascript', 'typescript'],
    'data': ['data science', 'analytics', 'pipeline', 'etl', 'sql']
  };

  for (const [domain, keywords] of Object.entries(domains)) {
    if (keywords.some(kw => jdLower.includes(kw))) {
      analysis.domain = domain;
      break;
    }
  }

  const yearsMatch = jobDescription.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/i);
  if (yearsMatch) {
    analysis.yearsExperience = parseInt(yearsMatch[1]);
  }

  const techKeywords = jobDescription.match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\b/g) || [];
  analysis.keywords = [...new Set(techKeywords)].slice(0, 15);

  return analysis;
}

export function matchSkillsToJob(userSkills, jobAnalysis) {
  const matched = [];
  const unmatched = [];
  const userSkillsLower = userSkills.map(s => s.toLowerCase());

  jobAnalysis.requiredSkills.forEach(reqSkill => {
    const reqLower = reqSkill.toLowerCase();
    if (userSkillsLower.some(us => us.includes(reqLower) || reqLower.includes(us))) {
      matched.push(reqSkill);
    } else {
      unmatched.push(reqSkill);
    }
  });

  return { matched, unmatched };
}

export function buildResumeContext(userData, jobDescription, options = {}) {
  const extractedData = extractUserInformation(userData);
  const jobAnalysis = analyzeJobDescription(jobDescription);
  const skillMatch = matchSkillsToJob(extractedData.skills, jobAnalysis);

  const relevantContent = {
    matchedSkills: skillMatch.matched,
    unmatchedKeywords: skillMatch.unmatched,
    domain: jobAnalysis.domain,
    targetExperience: jobAnalysis.yearsExperience,
    keywords: jobAnalysis.keywords
  };

  const userDataString = extractedData.isTextBased
    ? extractedData.rawText + (extractedData.additionalInfo ? `\n\nADDITIONAL INFO: ${extractedData.additionalInfo}` : '')
    : JSON.stringify(extractedData, null, 2);

  return {
    systemPrompt: buildLatexSystemPrompt(),
    userPrompt: buildLatexUserPrompt(
      userDataString,
      jobDescription,
      relevantContent,
      options.targetJobTitle || ''
    ),
    extractedData,
    jobAnalysis,
    skillMatch
  };
}

export default {
  buildLatexSystemPrompt,
  buildLatexUserPrompt,
  extractUserInformation,
  analyzeJobDescription,
  matchSkillsToJob,
  buildResumeContext,
  escapeLatex,
  sanitizeForLatex
};