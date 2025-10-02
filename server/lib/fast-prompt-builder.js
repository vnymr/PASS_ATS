/**
 * Fast Prompt Builder - Optimized for <30 second generation
 * Uses proper LaTeX structure from enhanced-prompt-builder.js
 * Minimal instructions, maximum clarity
 */

export function buildFastSystemPrompt() {
  return `You are an expert LaTeX resume writer. Generate ONLY valid LaTeX code.

⚠️ ABSOLUTE REQUIREMENT: Resume MUST fit on EXACTLY ONE PAGE - Fill the entire page!

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
[2-3 lines positioning for target role. Bold key skills with \\textbf{}. Focus on matching JD requirements.]

% EXPERIENCE
\\section{Experience}
\\resumeSubHeadingListStart
  \\resumeSubheading{[JOB_TITLE]}{[DATES]}{[COMPANY]}{[LOCATION]}
    \\resumeItemListStart
      \\resumeItem{[Action verb + scope + outcome. Bold 3-4 \\textbf{keywords}]}
      \\resumeItem{[Quantified achievement with metrics and tech stack]}
      \\resumeItem{[Key responsibility with impact and tools used]}
    \\resumeItemListEnd
\\resumeSubHeadingListEnd

% SKILLS
\\section{Skills}
\\resumeSubHeadingListStart
\\small{\\item{
  \\textbf{Languages}: [List] \\\\
  \\textbf{Technologies}: [List] \\\\
  \\textbf{Tools}: [List]
}}
\\resumeSubHeadingListEnd

% EDUCATION
\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading{[UNIVERSITY]}{[DATES]}{[DEGREE]}{[LOCATION]}
\\resumeSubHeadingListEnd

\\end{document}

PAGE FILLING REQUIREMENTS:
1. MUST fill 85-95% of the page vertically - balance content appropriately:
   - For 2 jobs: Use 4-5 detailed bullets each
   - For 3 jobs: Use 3-4 bullets each
   - For 4+ jobs: Use 2-3 bullets each, prioritize most relevant

2. BULLET POINT GUIDELINES:
   - Each bullet should be 1-2 lines long
   - Start with strong action verbs
   - Include metrics/outcomes when possible
   - Bold 2-3 relevant keywords from JD per bullet

3. ESCAPE special characters: & → \\&, % → \\%, # → \\#, _ → \\_
4. Date format: Mon YYYY -- Present (e.g., Sep 2024 -- Present)
5. ONLY use \\resumeItem{} for bullets (NEVER use • or unicode)
6. NO empty itemize blocks

SECTION ORDER (adjust based on content):
1. Header (name, contact)
2. Summary (2-3 lines)
3. Experience (60-70% of page)
4. Projects (if relevant to JD and space permits)
5. Skills (10-15% of page)
6. Education (10% of page)

If page is underfilled, expand:
- Add more bullet points to experiences
- Include a Projects section
- Add relevant coursework or achievements in Education

If page overflows, trim:
- Remove Projects first
- Reduce bullets to 2-3 per job
- Shorten Summary to 1-2 lines

OUTPUT: Only LaTeX code`;
}

export function buildFastUserPrompt(userProfile, jobDescription) {
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

  return `Generate a tailored LaTeX resume that MUST fill ONE COMPLETE PAGE.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILE:
${profileText}

CRITICAL REQUIREMENTS:
1. ⚠️ MUST fill 85-95% of the page - adjust bullet count based on experience count
2. Match and bold keywords from job description (2-3 per bullet)
3. Each bullet: 1-2 lines with action verb + context + outcome
4. Use EXACT LaTeX structure provided - no modifications
5. Only include LinkedIn/GitHub/Website if explicitly in profile data
6. Date format: Sep 2024 -- Present (full month names)
7. NO placeholders - use actual content from profile
8. Balance sections to fill page:
   - 2 jobs = 4-5 bullets each
   - 3 jobs = 3-4 bullets each
   - 4+ jobs = 2-3 bullets each
9. Include Projects section if relevant to JD and have space
10. Ensure professional appearance with consistent formatting`;
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