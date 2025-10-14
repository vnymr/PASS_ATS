/**
 * Resume Template Library for Function Calling
 * AI can call these functions to get appropriate templates based on context
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
\\usepackage[pdftex]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{multirow}

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
\\newcommand{\\resumeItem}[2]{
  \\item\\small{
    \\textbf{#1}{: #2 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeItemNH}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
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

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*,label={}]}
\\newcommand{\\resumeSubHeadingListStartBullets}{\\begin{itemize}[leftmargin=*]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}}

\\begin{document}

%----------HEADING-----------------
\\begin{tabular*}{\\textwidth}{L@{\\extracolsep{\\fill}}C@{\\extracolsep{\\fill}}R}
  \\href{mailto:[EMAIL]}{[EMAIL]} &
  \\multirow{2}{*}{\\Huge \\textbf{[NAME]}} &
  \\href{[WEBSITE]}{[WEBSITE]} \\\\
  [PHONE] & & [LOCATION]
\\end{tabular*}

% Content sections follow...
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

\\input{glyphtounicode}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Aggressive margins for maximum space utilization
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

\\pdfgentounicode=1

% Custom Commands - Optimized for density
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

% ---------- Header ----------
\\begin{center}
    {\\Huge \\scshape [NAME]} \\\\ \\vspace{1pt}
    \\small [LOCATION] ~ \\raisebox{-0.1\\height}\\faPhone\\ [PHONE] ~
    \\href{mailto:[EMAIL]}{\\raisebox{-0.2\\height}\\faEnvelope\\ \\underline{[EMAIL]}} ~
    \\href{[LINKEDIN]}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{linkedin}} ~
    \\href{[WEBSITE]}{\\raisebox{-0.2\\height}\\faGlobe\\ \\underline{website}}
    \\vspace{-5pt}
\\end{center}

% Content sections follow...
\\end{document}`,
    usage: "Use for tech roles, startups, product positions where modern aesthetics and content density are valued. Best for candidates with rich experience."
  },

  /**
   * Template 3: Academic/Research (90% fill)
   * Best for: PhD, research roles, academic positions, publications-heavy
   * Style: Traditional academic format, publication-friendly, LaTeX-native feel
   */
  academic_research: {
    name: "Academic Research",
    fillPercentage: 90,
    bestFor: ["academia", "research", "PhD", "postdoc", "scientific", "publications-heavy"],
    characteristics: ["traditional academic format", "lua scripting support", "publications section", "research-focused"],
    latexTemplate: `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage[urw-garamond]{mathdesign}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins - Academic standard
\\addtolength{\\oddsidemargin}{-0.475in}
\\addtolength{\\evensidemargin}{-0.375in}
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
\\newcommand{\\resumeItem}[2]{
  \\item{
    \\textbf{#1}{: \\small #2 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeEduEntry}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{#3} & \\textit{#4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeExpEntry}[5]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{#3 $\\cdot$ #4} & \\textit{#5} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeSubItem}[2]{\\resumeItem{#1}{#2}\\vspace{-4pt}}

\\renewcommand{\\labelitemii}{$\\circ$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*,label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\setlist{rightmargin=10pt}\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

% Content sections follow...
\\end{document}`,
    usage: "Use for academic, research, or PhD roles where publications, research experience, and traditional academic format are expected."
  }
};

/**
 * Function: Get Template Recommendation
 * AI calls this to understand which template fits the scenario
 */
export function getTemplateRecommendation(context) {
  const { industry, role, experienceYears, careerStage, hasPublications, companyType } = context;

  // Decision logic
  if (industry === "academia" || role.includes("research") || role.includes("phd") || hasPublications) {
    return {
      recommended: "academic_research",
      reason: "Academic/research role detected, publications-friendly format needed",
      template: TEMPLATES.academic_research
    };
  }

  if (["tech", "startup", "product", "engineering", "ai", "ml"].some(keyword => industry.includes(keyword)) ||
      companyType === "startup") {
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
  getTemplateRecommendation,
  getAllTemplates,
  getTemplateById
};
