/**
 * Resume Template Library with Placeholder Support
 *
 * Templates use mustache-style placeholders that get filled with content:
 * - {{HEADER}} - Name, contact info
 * - {{SUMMARY}} - Professional summary (optional)
 * - {{EXPERIENCE}} - Work experience entries
 * - {{EDUCATION}} - Education entries
 * - {{SKILLS}} - Skills section
 * - {{PROJECTS}} - Projects (optional, conditional)
 * - {{CERTIFICATIONS}} - Certifications (optional, conditional)
 * - {{PUBLICATIONS}} - Publications (optional, for academic)
 *
 * Conditional sections use: {{#SECTION}}...{{/SECTION}}
 */

export const TEMPLATES = {
  /**
   * Template 1: Classic Professional (85% fill)
   * Best for: Traditional industries, senior roles, conservative companies
   * Style: Clean, centered header, tabular layout, conservative spacing
   */
  classic_professional: {
    name: "Classic Professional",
    fillPercentage: 85,
    bestFor: ["finance", "consulting", "legal", "healthcare", "government", "senior executives"],
    characteristics: ["centered header", "tabular layout", "conservative spacing", "traditional sections"],
    latexTemplate: `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[pdftex,hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{tabularx}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins - Conservative spacing
\\addtolength{\\oddsidemargin}{-0.375in}
\\addtolength{\\evensidemargin}{-0.375in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{#1 \\vspace{-2pt}}
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand{\\labelitemii}{$\\circ$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*,label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

%----------HEADING-----------
{{HEADER}}

%----------SUMMARY-----------
{{#SUMMARY}}
\\section{Summary}
{{SUMMARY}}
{{/SUMMARY}}

%-----------EXPERIENCE-----------
\\section{Experience}
\\resumeSubHeadingListStart
{{EXPERIENCE}}
\\resumeSubHeadingListEnd

%-----------EDUCATION-----------
\\section{Education}
\\resumeSubHeadingListStart
{{EDUCATION}}
\\resumeSubHeadingListEnd

%-----------SKILLS-----------
\\section{Technical Skills}
{{SKILLS}}

%----------PROJECTS-----------
{{#PROJECTS}}
\\section{Projects}
\\resumeSubHeadingListStart
{{PROJECTS}}
\\resumeSubHeadingListEnd
{{/PROJECTS}}

%----------CERTIFICATIONS-----------
{{#CERTIFICATIONS}}
\\section{Certifications}
\\resumeSubHeadingListStart
{{CERTIFICATIONS}}
\\resumeSubHeadingListEnd
{{/CERTIFICATIONS}}

\\end{document}`,
    usage: "Use for traditional industries, conservative companies, or senior executive roles where clean, professional appearance is valued over modern aesthetics."
  },

  /**
   * Template 2: Modern Dense (95% fill)
   * Best for: Tech, startups, product roles, modern companies
   * Style: Left-aligned header, compact spacing, modern icons, high density
   */
  modern_dense: {
    name: "Modern Dense",
    fillPercentage: 95,
    bestFor: ["tech", "startups", "product", "engineering", "data science", "AI/ML", "design"],
    characteristics: ["left-aligned header", "fontawesome icons", "compact spacing", "high content density"],
    latexTemplate: `\\documentclass[a4paper,11pt]{article}

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

% glyphtounicode removed for tectonic compatibility
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Aggressive margins for maximum space utilization
\\addtolength{\\oddsidemargin}{-0.6in}
\\addtolength{\\evensidemargin}{-0.6in}
\\addtolength{\\textwidth}{1.2in}
\\addtolength{\\topmargin}{-0.7in}
\\addtolength{\\textheight}{1.4in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

% Custom Commands - Optimized for density
\\newcommand{\\resumeItem}[1]{
  \\item\\small{#1 \\vspace{-2pt}}
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[itemsep=0pt,parsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

%----------HEADING----------
{{HEADER}}

%----------SUMMARY----------
{{#SUMMARY}}
\\section{Summary}
\\small{{{SUMMARY}}}
\\vspace{-5pt}
{{/SUMMARY}}

%-----------EXPERIENCE-----------
\\section{Experience}
\\resumeSubHeadingListStart
{{EXPERIENCE}}
\\resumeSubHeadingListEnd

%-----------PROJECTS-----------
{{#PROJECTS}}
\\section{Projects}
\\resumeSubHeadingListStart
{{PROJECTS}}
\\resumeSubHeadingListEnd
{{/PROJECTS}}

%-----------SKILLS-----------
\\section{Technical Skills}
{{SKILLS}}

%-----------EDUCATION-----------
\\section{Education}
\\resumeSubHeadingListStart
{{EDUCATION}}
\\resumeSubHeadingListEnd

%----------CERTIFICATIONS-----------
{{#CERTIFICATIONS}}
\\section{Certifications}
{{CERTIFICATIONS}}
{{/CERTIFICATIONS}}

\\end{document}`,
    usage: "Use for tech roles, startups, product positions where modern aesthetics and content density are valued. Best for candidates with rich experience."
  },

  /**
   * Template 3: Academic/Research (90% fill)
   * Best for: PhD, research roles, academic positions, publications-heavy
   * Style: Traditional academic format, publication-friendly, LaTeX-native feel
   */
  /**
   * Template: Jake's Resume (Clean Traditional)
   * Based on the popular open-source template
   * Style: Tabular header, clean sections, proven format
   */
  jakes_resume: {
    name: "Jake's Resume",
    fillPercentage: 90,
    bestFor: ["software engineering", "tech", "general purpose", "internships"],
    characteristics: ["tabular header", "clean sections", "proven format", "ATS-friendly"],
    latexTemplate: `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[pdftex]{hyperref}
\\usepackage{fancyhdr}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.375in}
\\addtolength{\\evensidemargin}{-0.375in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\newcommand{\\resumeItem}[2]{
  \\item\\small{
    \\textbf{#1}{: #2 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeSubItem}[2]{\\resumeItem{#1}{#2}\\vspace{-4pt}}
\\renewcommand{\\labelitemii}{$\\circ$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

{{HEADER}}

\\section{Education}
\\resumeSubHeadingListStart
{{EDUCATION}}
\\resumeSubHeadingListEnd

\\section{Experience}
\\resumeSubHeadingListStart
{{EXPERIENCE}}
\\resumeSubHeadingListEnd

{{#PROJECTS}}
\\section{Projects}
\\resumeSubHeadingListStart
{{PROJECTS}}
\\resumeSubHeadingListEnd
{{/PROJECTS}}

\\section{Skills}
{{SKILLS}}

\\end{document}`,
    usage: "Classic proven format. Great for software engineering roles, internships, and general tech positions. ATS-friendly and widely accepted."
  },

  /**
   * Template: Minimal Centered
   * Clean, modern, centered header with professional summary
   * Style: Centered header, clear sections, generous whitespace
   */
  minimal_centered: {
    name: "Minimal Centered",
    fillPercentage: 88,
    bestFor: ["AI/ML", "senior roles", "product", "modern companies"],
    characteristics: ["centered header", "professional summary", "clean sections", "modern feel"],
    latexTemplate: `\\documentclass[a4paper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{ragged2e}
\\usepackage{enumitem}

\\setlength{\\tabcolsep}{0pt}
\\addtolength{\\oddsidemargin}{-0.55in}
\\addtolength{\\evensidemargin}{-0.55in}
\\addtolength{\\textwidth}{1.1in}
\\addtolength{\\topmargin}{-0.58in}
\\addtolength{\\textheight}{1.30in}

\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\urlstyle{same}
\\raggedbottom
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

\\titleformat{\\section}{\\scshape\\large\\bfseries}{}{0em}{}[\\color{black}\\titlerule]
\\titlespacing*{\\section}{0pt}{6pt}{4pt}

\\newcommand{\\resumeSubheading}[4]{
  \\noindent
  \\begin{tabular*}{\\textwidth}{l@{\\extracolsep{\\fill}}r}
    \\textbf{#1} & \\textbf{\\small #2} \\\\
    \\textit{\\small #3} & \\textit{\\small #4} \\\\
  \\end{tabular*}
}

\\newcommand{\\resumeItem}[1]{\\item\\small{#1}}

\\newcommand{\\resumeItemListStart}{
  \\begin{itemize}[leftmargin=0.18in, itemsep=2pt, topsep=2pt, partopsep=0pt, parsep=0pt]
}
\\newcommand{\\resumeItemListEnd}{
  \\end{itemize}\\vspace{-2pt}
}

\\newcommand{\\resumeEntrySpace}{\\vspace{4pt}}

\\begin{document}

{{HEADER}}

{{#SUMMARY}}
\\section{Professional Summary}
\\small{{{SUMMARY}}}
{{/SUMMARY}}

\\section{Education}
{{EDUCATION}}

\\section{Technical Skills}
{{SKILLS}}

\\section{Professional Experience}
{{EXPERIENCE}}

{{#PROJECTS}}
\\section{Products \\& Projects}
{{PROJECTS}}
{{/PROJECTS}}

\\end{document}`,
    usage: "Modern minimal design with centered header. Perfect for AI/ML roles, product positions, and companies that value clean aesthetics."
  },

  academic_research: {
    name: "Academic Research",
    fillPercentage: 90,
    bestFor: ["academia", "research", "PhD", "postdoc", "scientific", "publications-heavy"],
    characteristics: ["traditional academic format", "publications section", "research-focused", "formal styling"],
    latexTemplate: `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage[hidelinks]{hyperref}
\\usepackage{tabularx}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins - Academic standard
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{#1 \\vspace{-2pt}}
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumePublicationItem}[1]{
  \\item\\small{#1 \\vspace{-2pt}}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand{\\labelitemii}{$\\circ$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*,label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}
\\newcommand{\\resumePublicationListStart}{\\begin{enumerate}[leftmargin=*]}
\\newcommand{\\resumePublicationListEnd}{\\end{enumerate}}

\\begin{document}

%----------HEADING----------
{{HEADER}}

%----------SUMMARY----------
{{#SUMMARY}}
\\section{Research Interests}
\\small{{{SUMMARY}}}
{{/SUMMARY}}

%-----------EDUCATION-----------
\\section{Education}
\\resumeSubHeadingListStart
{{EDUCATION}}
\\resumeSubHeadingListEnd

%-----------EXPERIENCE-----------
\\section{Research Experience}
\\resumeSubHeadingListStart
{{EXPERIENCE}}
\\resumeSubHeadingListEnd

%-----------PUBLICATIONS-----------
{{#PUBLICATIONS}}
\\section{Publications}
\\resumePublicationListStart
{{PUBLICATIONS}}
\\resumePublicationListEnd
{{/PUBLICATIONS}}

%-----------SKILLS-----------
\\section{Technical Skills}
{{SKILLS}}

%-----------PROJECTS-----------
{{#PROJECTS}}
\\section{Research Projects}
\\resumeSubHeadingListStart
{{PROJECTS}}
\\resumeSubHeadingListEnd
{{/PROJECTS}}

%----------CERTIFICATIONS-----------
{{#CERTIFICATIONS}}
\\section{Awards \\& Honors}
{{CERTIFICATIONS}}
{{/CERTIFICATIONS}}

\\end{document}`,
    usage: "Use for academic, research, or PhD roles where publications, research experience, and traditional academic format are expected."
  }
};

/**
 * Placeholder definitions for template filling
 * Maps placeholder names to their rendering functions
 */
export const PLACEHOLDER_DEFINITIONS = {
  HEADER: {
    description: "Contact information header",
    required: true
  },
  SUMMARY: {
    description: "Professional summary or research interests",
    required: false,
    conditional: true
  },
  EXPERIENCE: {
    description: "Work experience entries",
    required: true
  },
  EDUCATION: {
    description: "Education entries",
    required: true
  },
  SKILLS: {
    description: "Technical skills section",
    required: true
  },
  PROJECTS: {
    description: "Project entries",
    required: false,
    conditional: true
  },
  CERTIFICATIONS: {
    description: "Certifications and awards",
    required: false,
    conditional: true
  },
  PUBLICATIONS: {
    description: "Academic publications",
    required: false,
    conditional: true
  }
};

/**
 * Function: Get Template Recommendation
 * AI calls this to understand which template fits the scenario
 */
export function getTemplateRecommendation(context) {
  const { industry, role, experienceYears, careerStage, hasPublications, companyType } = context;

  // Decision logic
  if (industry === "academia" || role?.includes("research") || role?.includes("phd") || hasPublications) {
    return {
      recommended: "academic_research",
      reason: "Academic/research role detected, publications-friendly format needed",
      template: TEMPLATES.academic_research
    };
  }

  if (["tech", "startup", "product", "engineering", "ai", "ml"].some(keyword =>
    industry?.toLowerCase().includes(keyword)) || companyType === "startup") {
    return {
      recommended: "modern_dense",
      reason: "Tech/startup environment, modern dense format maximizes content and keywords",
      template: TEMPLATES.modern_dense
    };
  }

  if (careerStage === "executive" || experienceYears > 15 ||
      ["finance", "consulting", "legal", "healthcare"].includes(industry)) {
    return {
      recommended: "classic_professional",
      reason: "Traditional industry or senior role, conservative format preferred",
      template: TEMPLATES.classic_professional
    };
  }

  // Default to modern dense for most cases
  return {
    recommended: "modern_dense",
    reason: "Default modern format, good balance of density and readability",
    template: TEMPLATES.modern_dense
  };
}

/**
 * Function: Get All Templates
 * AI calls this to see all available options
 */
export function getAllTemplates() {
  return Object.keys(TEMPLATES).map(key => ({
    id: key,
    name: TEMPLATES[key].name,
    fillPercentage: TEMPLATES[key].fillPercentage,
    bestFor: TEMPLATES[key].bestFor,
    characteristics: TEMPLATES[key].characteristics,
    usage: TEMPLATES[key].usage
  }));
}

/**
 * Function: Get Template by ID
 * AI calls this to get specific template details
 */
export function getTemplateById(templateId) {
  return TEMPLATES[templateId] || null;
}

export default {
  TEMPLATES,
  PLACEHOLDER_DEFINITIONS,
  getTemplateRecommendation,
  getAllTemplates,
  getTemplateById
};
