import { escapeLatex } from './latex-sanitizer.js';

export function jsonToLatex(resumeJson) {
  const { personalInfo, summary, experience, skills, education, projects } = resumeJson;

  let latex = `\\documentclass[a4paper,11pt]{article}

\\usepackage[empty]{fullpage}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
% fontawesome5 removed to avoid undefined control sequences

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\setlength{\\headheight}{0pt}
\\setlength{\\headsep}{0pt}
\\setlength{\\footskip}{0pt}

\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\evensidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.9in}
\\addtolength{\\textheight}{1.8in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\setlength{\\parindent}{0pt}

% --------------------------------------
\\begin{document}
`;

  latex += formatHeader(personalInfo);

  if (summary) {
    latex += formatSummary(summary);
  }

  if (experience?.length > 0) {
    latex += formatExperience(experience);
  }

  if (projects?.length > 0) {
    latex += formatProjects(projects);
  }

  if ((skills?.technical?.length || 0) > 0 || (skills?.soft?.length || 0) > 0) {
    latex += formatSkills(skills);
  }

  if (education?.length > 0) {
    latex += formatEducation(education);
  }

  latex += '\n\\end{document}';

  return latex;
}

function formatHeader(info = {}) {
  const name = info.name ? escapeLatex(info.name) : '';
  const location = info.location ? escapeLatex(info.location) : '';
  const phone = info.phone ? escapeLatex(info.phone) : '';
  const email = info.email ? escapeLatex(info.email) : '';
  const linkedin = info.linkedin ? info.linkedin.replace(/^https?:\/\//, '') : '';
  const linkedinDisplay = linkedin ? linkedin.replace(/^(www\.)?linkedin\.com\/in\//, 'linkedin.com/in/') : '';
  const website = info.website ? info.website.replace(/^https?:\/\//, '') : '';

  const parts = [];
  if (location) parts.push(`${location}`);
  if (phone) parts.push(`Phone: ${phone}`);
  if (email) parts.push(`\\href{mailto:${email}}{\\underline{${email}}}`);
  if (linkedin) parts.push(`\\href{https://${linkedin}}{\\underline{${escapeLatex(linkedinDisplay)}}}`);
  if (website) parts.push(`\\href{https://${website}}{\\underline{${escapeLatex(website)}}}`);

  return `\n% ---------- Header ----------\n\\begin{center}\n    {\\Huge\\bfseries ${name}} \\\\ \\vspace{1pt}\n    \\small ${parts.join(' $\\bullet$ ')}\n    \\vspace{-5pt}\n\\end{center}\n\n`;
}

function formatSummary(text) {
  return `\n{\\large\\bfseries Summary}\\\\\n\\vspace{2pt}\n\\hrule\n\\vspace{4pt}\n${escapeLatex(text)}\n\\vspace{8pt}\n\n`;
}

function formatExperience(experiences) {
  let latex = '\n{\\large\\bfseries Experience}\\\\\n\\vspace{2pt}\n\\hrule\n\\vspace{4pt}\n';
  latex += '\\begin{itemize}[leftmargin=0.0in, label={}]\n';

  const items = (experiences || [])
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 6);

  for (const exp of items) {
    const role = exp.position ? escapeLatex(exp.position) : '';
    const company = exp.company ? escapeLatex(exp.company) : '';
    const start = exp.startDate ? escapeLatex(exp.startDate) : '';
    const end = exp.endDate ? escapeLatex(exp.endDate) : 'Present';
    const dates = [start, end].filter(Boolean).join(' -- ');
    const location = exp.location ? escapeLatex(exp.location) : '';

    latex += `  \\vspace{-1pt}\\item
  \\textbf{${role}} \\hfill \\textbf{\\small ${dates}} \\\\
  \\textit{\\small ${company}} \\hfill \\textit{\\small ${location}}
  \\vspace{-3pt}\n`;
    if (exp.bullets?.length) {
      latex += '  \\begin{itemize}[itemsep=0pt]\n';
      for (const bullet of exp.bullets.slice(0, 6)) {
        latex += `    \\item\\small{${escapeLatex(bullet)} \\vspace{-0.5pt}}\n`;
      }
      latex += '  \\end{itemize}\\vspace{-2pt}\n';
    }
  }

  latex += '\\end{itemize}\n\n';
  return latex;
}

function formatProjects(projects) {
  let latex = '\n{\\large\\bfseries Projects}\\\\\n\\vspace{2pt}\n\\hrule\n\\vspace{4pt}\n';
  latex += '\\begin{itemize}[leftmargin=0.0in, label={}]\n';

  const items = (projects || [])
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 4);

  for (const p of items) {
    const name = p.name ? escapeLatex(p.name) : '';
    const when = p.dates ? escapeLatex(p.dates) : '';
    const org = p.organization ? escapeLatex(p.organization) : 'Personal Project';
    const location = p.location ? escapeLatex(p.location) : '';

    latex += `  \\vspace{-1pt}\\item
  \\textbf{${name}} \\hfill \\textbf{\\small ${when}} \\\\
  \\textit{\\small ${org}} \\hfill \\textit{\\small ${location}}
  \\vspace{-3pt}\n`;
    latex += '  \\begin{itemize}[itemsep=0pt]\n';
    if (p.description) latex += `    \\item\\small{${escapeLatex(p.description)} \\vspace{-0.5pt}}\n`;
    if (p.technologies?.length) {
      latex += `    \\item\\small{\\textbf{Technologies}: ${p.technologies.map(escapeLatex).join(', ')} \\vspace{-0.5pt}}\n`;
    }
    if (p.link) latex += `    \\item\\small{\\href{${escapeLatex(p.link)}}{[Link]} \\vspace{-0.5pt}}\n`;
    latex += '  \\end{itemize}\\vspace{-2pt}\n';
  }

  latex += '\\end{itemize}\n\n';
  return latex;
}

function formatSkills(skills = {}) {
  let latex = '\n{\\large\\bfseries Skills}\\\\\n\\vspace{2pt}\n\\hrule\n\\vspace{4pt}\n';
  latex += '\\begin{itemize}[leftmargin=0.0in, label={}]\n';

  const groups = { programming: [], framework: [], database: [], cloud: [], tool: [], other: [] };
  for (const s of skills.technical || []) {
    const cat = s.category || 'other';
    const key = Object.prototype.hasOwnProperty.call(groups, cat) ? cat : 'other';
    groups[key].push(s.name);
  }

  const lines = [];
  if (groups.programming.length) lines.push(`\\textbf{Programming}: ${escapeLatex(groups.programming.join(', '))}`);
  if (groups.framework.length) lines.push(`\\textbf{Frameworks}: ${escapeLatex(groups.framework.join(', '))}`);
  if (groups.database.length) lines.push(`\\textbf{Databases}: ${escapeLatex(groups.database.join(', '))}`);
  if (groups.cloud.length) lines.push(`\\textbf{Cloud/DevOps}: ${escapeLatex(groups.cloud.join(', '))}`);
  if (groups.tool.length) lines.push(`\\textbf{Tools}: ${escapeLatex(groups.tool.join(', '))}`);
  if (skills.soft?.length) lines.push(`\\textbf{Soft}: ${escapeLatex(skills.soft.join(', '))}`);

  if (lines.length) {
    latex += '  \\small{\\item{\n    ' + lines.join(' \\\\ \n    ') + '\n  }}\n';
  }

  latex += '\\end{itemize}\n\n';
  return latex;
}

function formatEducation(education = []) {
  let latex = '\n{\\large\\bfseries Education}\\\\\n\\vspace{2pt}\n\\hrule\n\\vspace{4pt}\n';
  latex += '\\begin{itemize}[leftmargin=0.0in, label={}]\n';

  for (const edu of education) {
    const school = edu.school ? escapeLatex(edu.school) : '';
    const dates = edu.graduationDate ? escapeLatex(edu.graduationDate) : '';
    const degreeText = [edu.degree, edu.field ? `in ${edu.field}` : ''].filter(Boolean).join(' ');
    const degree = escapeLatex(degreeText);
    const location = edu.location ? escapeLatex(edu.location) : '';

    latex += `  \\vspace{-1pt}\\item
  \\textbf{${school}} \\hfill \\textbf{\\small ${dates}} \\\\
  \\textit{\\small ${degree}} \\hfill \\textit{\\small ${location}}
  \\vspace{-3pt}\n`;

    const bullets = [];
    if (edu.coursework?.length) bullets.push(`Coursework: ${edu.coursework.map(escapeLatex).join(', ')}`);
    if (edu.gpa) bullets.push(`GPA: ${escapeLatex(edu.gpa)}`);
    if (edu.honors?.length) bullets.push(`Honors: ${edu.honors.map(escapeLatex).join(', ')}`);

    if (bullets.length) {
      latex += '  \\begin{itemize}[itemsep=0pt]\n';
      for (const b of bullets) latex += `    \\item\\small{${b} \\vspace{-0.5pt}}\n`;
      latex += '  \\end{itemize}\\vspace{-2pt}\n';
    }
  }

  latex += '\\end{itemize}\n\n';
  return latex;
}