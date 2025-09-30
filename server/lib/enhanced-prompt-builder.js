/**
 * Enhanced Prompt Builder for Resume Generation
 * Strict factual constraints and ATS optimization
 */

/**
 * Build the LaTeX system prompt with strict rules
 */
export function buildLatexSystemPrompt() {
  return `You are an ATS-focused LaTeX resume writer. Output ONLY a complete, compilable LaTeX document (no markdown fences, no commentary).

NON-NEGOTIABLES
- FACTS ONLY: Use information explicitly present in the provided user data (JSON/resume text/notes). Do NOT invent roles, dates, companies, tools, or metrics. If a number is not present, omit it.
- ANALYZE ORDER: First extract the user's facts (titles, companies, tools, domains). Then analyze the job description. Optimize content ordering and wording based on overlap.
- CROSS-DOMAIN PRIORITY: If the user mentions domain-specific work relevant to the JD (e.g., VLSI, Robotics, Embedded, DSP, AI/ML, Cloud, DevOps), surface those first—even if the broader background is different.
- FULL-PAGE (ONE PAGE): Fill the page top-to-bottom cleanly. If content is light, expand with factual items from user info only (Projects/Research, Coursework, Certifications, Awards, Publications, Additional Experience single-liners). If heavy, compress responsibly (shorter bullets, merge minor roles).

SKILLS & SECTIONING (MINIMALISTIC)
- Do NOT hardcode category names like "Languages/Frameworks/Cloud". Instead, infer 1–3 concise group labels from the user's own data (e.g., "AI/ML", "Systems", "Product"), or use a single flat "Skills" line if grouping is unclear. Keep names short.
- Use only user-provided skills; you may dedupe/standardize names but never add tools they did not mention.

ATS KEYWORD STRATEGY (FACT-BOUND)
- Use JD terms where the user has **evidence** (exact terms or clear synonyms); mirror phrasing naturally in Summary/Experience bullets.
- When overlap is low, still aim for high ATS coverage WITHOUT misrepresentation: place unmapped JD nouns/terms in a neutral one-liner such as "Target Role Keywords:" near the end or after Summary. Do not imply experience; simply list them as target keywords/focus.

STYLE & SAFETY
- Strong, concise action verbs; quantify ONLY with numbers present in user input.
- Escape LaTeX specials: \\&, \\%, \\$, \\#, \\_, \\{, \\}, ~ (\\textasciitilde{}), backslash (\\textbackslash{}).
- Do not change packages, margins, or typography.

USE THIS EXACT TEMPLATE & MACROS (do not modify)
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
% \\input{glyphtounicode} % Not supported by Tectonic
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\evensidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.9in}
\\addtolength{\\textheight}{1.8in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-3pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\color{black}\\titlerule \\vspace{-3pt}]
% \\pdfgentounicode=1 % Not needed for Tectonic

% ---------- Custom Commands ----------
\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-0.5pt}}}
\\newcommand{\\resumeSubheading}[4]{\\vspace{-1pt}\\item \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\ \\textit{\\small#3} \\hfill \\textit{\\small #4} \\\\ \\vspace{-3pt}}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-1pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-2pt}}

CONTENT ORDER
1) Header
2) Summary (2–3 lines; tie to JD; explicitly mention domain focus like VLSI/Robotics/AI/ML when present)
3) Experience (JD-relevant first). Key roles: 3–5 bullets; minor roles: 1–2 bullets or "Additional Experience" single-liners.
4) Projects/Research (only if present in user data; factual titles/tech/outcomes)
5) Skills (dynamic grouping or single flat line; user-provided items only)
6) Education (degrees exactly as provided)
7) Certifications/Awards/Publications (if present)
8) Optional neutral one-liner: "Target Role Keywords:" listing unmapped JD terms (no experience claim)

OUTPUT
- Produce the full LaTeX document using the above template and macros.
- Output ONLY LaTeX (no markdown fences, no explanations).`;
}

/**
 * Build the LaTeX user prompt with extracted data
 */
export function buildLatexUserPrompt(resumeText, jobDescription, relevantContent, targetJobTitle) {
  return `Generate a COMPLETE one-page LaTeX resume using the system template and ONLY the user's own facts.

TARGET TITLE:
${targetJobTitle || ''}

JOB DESCRIPTION (verbatim):
${jobDescription || ''}

USER INFORMATION (JSON/resume text/notes — USE ALL FACTS; do not invent):
${resumeText || ''}

OPTIONAL RELEVANCE HINTS (skills/keywords/experiences; do NOT invent if not in user info):
${relevantContent ? JSON.stringify(relevantContent, null, 2) : '{}'}

STRICT RULES
1) FACTS ONLY — no fabricated roles, dates, companies, tools, or metrics.
2) ANALYZE user facts first, then JD. Reorder content to maximize JD relevance.
3) CROSS-DOMAIN PRIORITY — surface any domain-specific signals (e.g., VLSI, Robotics, Embedded, DSP, AI/ML, Cloud) first if mentioned by the user.
4) FULL-PAGE FILL (ONE PAGE) — fill top-to-bottom. If light, expand with factual Projects/Research, Coursework, Certifications, Awards, Publications, or an "Additional Experience" single-line list. If heavy, compress responsibly.
5) ATS OPTIMIZATION (FACT-BOUND)
   - Use JD terms where the user has evidence (exact or clear synonyms).
   - If overlap is low, still improve ATS: add a neutral one-liner "Target Role Keywords:" that lists unmapped JD nouns/terms WITHOUT implying experience.
6) SKILLS — dynamically infer 1–3 concise group labels from user data OR use a single flat "Skills" line if grouping isn't obvious. Do not hardcode generic category names. Use only user-provided items; dedupe/standardize names.
7) DO NOT MODIFY TEMPLATE — use the exact packages, margins, macros, and section styling.

STRUCTURE WITH MARKERS
% ===BEGIN:HEADER===
\\begin{center}
{\\Huge \\scshape [Full Name]} \\\\ \\vspace{1pt}
\\small [City, State] ~ \\raisebox{-0.1\\height}\\faPhone\\ [Phone] ~
\\href{mailto:[email]}{\\raisebox{-0.2\\height}\\faEnvelope\\ \\underline{[email]}} ~
[optional: \\href{[linkedin]}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{[linkedin]}} ~ \\href{[site]}{\\raisebox{-0.2\\height}\\faGlobe\\ \\underline{[site]}} if provided]
\\vspace{-5pt}
\\end{center}
% ===END:HEADER===

% ===BEGIN:SUMMARY===
\\section*{Summary}
[2–3 lines tied to JD using ONLY the user's facts; mention domain focus like VLSI/Robotics/AI/ML if present.]
% ===END:SUMMARY===

% ===BEGIN:EXPERIENCE===
\\section{Experience}
\\resumeSubHeadingListStart
% JD-relevant roles first. Key roles 3–5 bullets; minor roles 1–2 bullets or single-line "Additional Experience".
\\resumeSubheading{[Job Title]}{[Date Range]}{[Company Name]}{[Location]}
\\resumeItemListStart
\\resumeItem{[Achievement/responsibility using action verb, quantified if data exists]}
\\resumeItemListEnd
\\resumeSubHeadingListEnd
% ===END:EXPERIENCE===

% ===BEGIN:PROJECTS=== (include only if present)
\\section{Projects}
\\resumeSubHeadingListStart
% factual titles/tech/outcomes from user info
\\resumeSubHeadingListEnd
% ===END:PROJECTS===

% ===BEGIN:SKILLS===
\\section{Skills}
% Either (a) 1–3 concise, inferred group labels with comma-separated items; or (b) a single flat "Skills" line — using only user-provided items.
% ===END:SKILLS===

% ===BEGIN:EDUCATION===
\\section{Education}
\\resumeSubHeadingListStart
% Degrees exactly as provided
\\resumeSubHeadingListEnd
% ===END:EDUCATION===

% ===BEGIN:CERTS=== (optional if present)
\\section{Certifications \\& Awards}
% factual items only
% ===END:CERTS===

% ===BEGIN:TARGETKEYS=== (optional neutral ATS helper if overlap is low)
% \\small Target Role Keywords: term1, term2, term3
% ===END:TARGETKEYS===

FINAL OUTPUT
- Produce the complete LaTeX document using the system template and macros.
- Escape LaTeX specials in all user strings.
- Output ONLY LaTeX (no markdown fences, no explanations).`;
}

/**
 * Extract and validate user information
 */
export function extractUserInformation(userData) {
  const extracted = {
    personalInfo: {},
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    awards: [],
    publications: [],
    additionalInfo: '',
    rawText: ''
  };

  // If only resumeText is provided, use it as raw text for LLM to parse
  if (userData.resumeText && (!userData.experience || userData.experience.length === 0) &&
      (!userData.education || userData.education.length === 0)) {
    extracted.rawText = userData.resumeText;
    // Still try to extract basic info if provided
    if (userData.personalInfo) {
      extracted.personalInfo = {
        name: userData.personalInfo.name || '',
        email: userData.personalInfo.email || '',
        phone: userData.personalInfo.phone || '',
        location: userData.personalInfo.location || ''
      };
    }
    // Mark this as text-based extraction
    extracted.isTextBased = true;
    return extracted;
  }

  // Extract personal information
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

  // Extract experience - validate each entry
  if (userData.experience && Array.isArray(userData.experience)) {
    extracted.experience = userData.experience.map(exp => ({
      title: exp.title || exp.position || '',
      company: exp.company || exp.organization || '',
      location: exp.location || '',
      startDate: exp.startDate || exp.from || '',
      endDate: exp.endDate || exp.to || exp.current ? 'Present' : '',
      responsibilities: exp.responsibilities || exp.description || exp.bullets || [],
      achievements: exp.achievements || [],
      technologies: exp.technologies || exp.tools || []
    })).filter(exp => exp.title && exp.company); // Only keep valid experiences
  }

  // Extract education
  if (userData.education && Array.isArray(userData.education)) {
    extracted.education = userData.education.map(edu => ({
      degree: edu.degree || edu.qualification || '',
      institution: edu.institution || edu.school || edu.university || '',
      location: edu.location || '',
      graduationDate: edu.graduationDate || edu.year || edu.endDate || '',
      gpa: edu.gpa || '',
      relevantCoursework: edu.coursework || edu.relevantCoursework || []
    })).filter(edu => edu.degree && edu.institution);
  }

  // Extract skills - deduplicate and validate
  if (userData.skills) {
    const allSkills = new Set();

    if (Array.isArray(userData.skills)) {
      userData.skills.forEach(skill => {
        if (typeof skill === 'string') {
          allSkills.add(skill);
        } else if (skill.name) {
          allSkills.add(skill.name);
        }
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

  // Extract projects if present
  if (userData.projects && Array.isArray(userData.projects)) {
    extracted.projects = userData.projects.map(proj => ({
      name: proj.name || proj.title || '',
      description: proj.description || '',
      technologies: proj.technologies || proj.stack || [],
      outcomes: proj.outcomes || proj.achievements || [],
      link: proj.link || proj.url || ''
    })).filter(proj => proj.name);
  }

  // Extract certifications
  if (userData.certifications && Array.isArray(userData.certifications)) {
    extracted.certifications = userData.certifications.filter(cert => cert && cert.length > 0);
  }

  // Extract additional information
  if (userData.additionalInfo) {
    extracted.additionalInfo = userData.additionalInfo;
  }

  return extracted;
}

/**
 * Analyze job description for key requirements
 */
export function analyzeJobDescription(jobDescription) {
  const analysis = {
    requiredSkills: [],
    preferredSkills: [],
    keywords: [],
    responsibilities: [],
    qualifications: [],
    domain: '',
    yearsExperience: null
  };

  if (!jobDescription) return analysis;

  const jdLower = jobDescription.toLowerCase();

  // Extract domain
  const domains = {
    'ai/ml': ['machine learning', 'artificial intelligence', 'deep learning', 'neural network', 'nlp', 'computer vision'],
    'cloud': ['aws', 'azure', 'gcp', 'cloud', 'kubernetes', 'docker'],
    'embedded': ['embedded', 'microcontroller', 'rtos', 'firmware', 'fpga'],
    'web': ['react', 'angular', 'vue', 'frontend', 'backend', 'full stack'],
    'mobile': ['ios', 'android', 'react native', 'flutter', 'mobile'],
    'data': ['data science', 'data analysis', 'data engineer', 'etl', 'pipeline'],
    'devops': ['devops', 'ci/cd', 'jenkins', 'terraform', 'ansible'],
    'security': ['security', 'penetration', 'vulnerability', 'cryptography', 'compliance']
  };

  for (const [domain, keywords] of Object.entries(domains)) {
    if (keywords.some(keyword => jdLower.includes(keyword))) {
      analysis.domain = domain;
      break;
    }
  }

  // Extract years of experience
  const yearsMatch = jobDescription.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/i);
  if (yearsMatch) {
    analysis.yearsExperience = parseInt(yearsMatch[1]);
  }

  // Extract skills (simple regex patterns)
  const skillPatterns = [
    /required skills?:?\s*([^\n.]+)/gi,
    /must have:?\s*([^\n.]+)/gi,
    /qualifications?:?\s*([^\n.]+)/gi,
    /requirements?:?\s*([^\n.]+)/gi
  ];

  skillPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      const skills = match[1].split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
      analysis.requiredSkills.push(...skills);
    });
  });

  // Extract keywords (technical terms)
  const techKeywords = jobDescription.match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\b/g) || [];
  analysis.keywords = [...new Set(techKeywords)].slice(0, 20);

  return analysis;
}

/**
 * Match user skills with job requirements
 */
export function matchSkillsToJob(userSkills, jobAnalysis) {
  const matched = [];
  const unmatched = [];

  const userSkillsLower = userSkills.map(s => s.toLowerCase());

  jobAnalysis.requiredSkills.forEach(reqSkill => {
    const reqLower = reqSkill.toLowerCase();
    if (userSkillsLower.some(userSkill =>
      userSkill.includes(reqLower) || reqLower.includes(userSkill)
    )) {
      matched.push(reqSkill);
    } else {
      unmatched.push(reqSkill);
    }
  });

  return { matched, unmatched };
}

/**
 * Build complete resume context with validation
 */
export function buildResumeContext(userData, jobDescription, options = {}) {
  // Extract and validate user information
  const extractedData = extractUserInformation(userData);

  // Analyze job description
  const jobAnalysis = analyzeJobDescription(jobDescription);

  // Match skills
  const skillMatch = matchSkillsToJob(extractedData.skills, jobAnalysis);

  // Build relevant content hints
  const relevantContent = {
    matchedSkills: skillMatch.matched,
    unmatchedKeywords: skillMatch.unmatched,
    domain: jobAnalysis.domain,
    targetExperience: jobAnalysis.yearsExperience,
    keywords: jobAnalysis.keywords
  };

  // Prepare complete user data string
  // For text-based resumes, use the raw text directly
  const userDataString = extractedData.isTextBased
    ? extractedData.rawText + (extractedData.additionalInfo ? `\n\nADDITIONAL INFO: ${extractedData.additionalInfo}` : '')
    : JSON.stringify({
        ...extractedData,
        originalData: userData
      }, null, 2);

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
  buildResumeContext
};