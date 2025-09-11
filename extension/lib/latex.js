(function() {
  'use strict';
  
  async function generateLatex(profile, draft, template, jobSignals) {
  const systemPrompt = `You are an expert resume LaTeX generator. Create an ATS-friendly, professional resume using the exact LaTeX style format provided.
  
Important formatting rules:
- Use the exact LaTeX preamble and document structure from the example
- Include all packages and custom commands
- Follow the exact section formatting (Summary, Experience, Projects, Skills, Education)
- Use \\resumeSubheading and \\resumeItem commands as shown
- Escape special LaTeX characters properly
- Keep summaries concise (2-3 lines max)
- Experience bullets should be impact-focused with metrics when possible
- Prioritize content based on job requirements
 - Do NOT dump keywords into the Skills section. Keep skills concise (12–18 items) and authentic tools/technologies only.
 - Distribute job keywords naturally across the Summary and Experience bullets. Maximum one relevant keyword per bullet. Avoid repetition across bullets.

LaTeX style format to follow:
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
\\usepackage{ragged2e}

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

\\titleformat{\\section}{
  \\vspace{-3pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-3pt}]

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
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-2pt}}`;

  const filteredSkills = buildFilteredSkills(profile.skills, jobSignals);

  const userPrompt = `Generate a complete LaTeX resume for the following candidate, tailored to match this job:

Candidate profile:
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
Location: ${profile.location}
Headline: ${profile.headline}
About: ${profile.summary_narrative}
Skills: ${filteredSkills.join(', ')}

Experience:
${profile.experience.map((exp, idx) => {
  const bullets = draft.experienceBullets.find(eb => eb.jobIndex === idx);
  return `
Company: ${exp.company}
Role: ${exp.role}
Period: ${exp.start} - ${exp.end || 'Present'}
Achievements:
${bullets ? bullets.newBullets.map(b => `- ${b}`).join('\n') : exp.bullets.map(b => `- ${b}`).join('\n')}`;
}).join('\n\n')}

Projects:
${profile.projects.map((proj, idx) => {
  const bullets = draft.projectsBullets?.find(pb => pb.projectIndex === idx);
  return `
Project: ${proj.name}
Details:
${bullets ? bullets.newBullets.map(b => `- ${b}`).join('\n') : proj.bullets.map(b => `- ${b}`).join('\n')}`;
}).join('\n\n')}

Education:
${profile.education.map(edu => `
School: ${edu.school}
Degree: ${edu.degree}
Period: ${edu.period}`).join('\n')}

Job requirements:
Role: ${jobSignals.roleGuess}
Top keywords (distribute across summary & bullets; do not put into skills): ${jobSignals.topKeywords.slice(0, 12).join(', ')}
Must have: ${jobSignals.mustHave.join(', ')}
Domain: ${jobSignals.domainHints.join(', ')}

Tailored content:
Summary: ${draft.summary}
Allowed Skills List (choose from these only; keep 12–18 items total): ${filteredSkills.join(', ')}

Generate a complete, compilable LaTeX document using the exact format provided. Include all sections and format properly.`;

  try {
    const response = await callAIModel(systemPrompt, userPrompt);
    return response;
  } catch (error) {
    console.error('AI generation failed, using fallback');
    return generateFallbackLatex(profile, draft);
  }
}

async function callAIModel(systemPrompt, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAPIKey()}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  if (!response.ok) throw new Error('AI API call failed');
  const data = await response.json();
  return data.choices[0].message.content;
}

async function getAPIKey() {
  const storage = await chrome.storage.local.get('openaiKey');
  return storage.openaiKey || process.env.OPENAI_API_KEY;
}

function generateFallbackLatex(profile, draft) {
  const escapeLatex = (text) => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  };

  const latex = `\\documentclass[a4paper,11pt]{article}

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
\\usepackage{ragged2e}
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

\\titleformat{\\section}{
  \\vspace{-3pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-3pt}]

% removed pdfgentounicode for Tectonic compatibility

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

% Header
\\begin{center}
    {\\Huge \\scshape ${escapeLatex(profile.name)}} \\\\ \\vspace{1pt}
    \\small ${[escapeLatex(profile.location), escapeLatex(profile.phone), `\\href{mailto:${profile.email}}{\\underline{${escapeLatex(profile.email)}}}`].filter(Boolean).join(' ~ | ~ ')}
    \\vspace{-5pt}
\\end{center}

% Summary
\\section*{Summary}
${escapeLatex(draft.summary)}

% Experience
\\section{Experience}
\\resumeSubHeadingListStart
${draft.experienceBullets.map(change => {
  const exp = profile.experience[change.jobIndex];
  if (!exp) return '';
  return `
  \\resumeSubheading{${escapeLatex(exp.role)}}{${escapeLatex(exp.start)} -- ${escapeLatex(exp.end || 'Present')}}
  {${escapeLatex(exp.company)}}{${escapeLatex(profile.location)}}
    \\resumeItemListStart
${change.newBullets.slice(0, 5).map(bullet => 
  `      \\resumeItem{${escapeLatex(bullet)}}`
).join('\n')}
    \\resumeItemListEnd`;
}).join('\n')}
\\resumeSubHeadingListEnd

% Projects
${profile.projects && profile.projects.length > 0 ? `
\\section{Projects}
\\resumeSubHeadingListStart
${(draft.projectsBullets || []).map(change => {
  const proj = profile.projects[change.projectIndex];
  if (!proj) return '';
  return `
  \\resumeSubheading{${escapeLatex(proj.name)}}{}
  {Personal Project}{${escapeLatex(profile.location)}}
    \\resumeItemListStart
${change.newBullets.map(bullet => 
  `      \\resumeItem{${escapeLatex(bullet)}}`
).join('\n')}
    \\resumeItemListEnd`;
}).join('\n')}
\\resumeSubHeadingListEnd` : ''}

% Skills
\\section{Skills}
\\resumeSubHeadingListStart
\\small{\\item{
  \\textbf{Technical}: ${(Array.isArray(draft.skills) && draft.skills.length ? draft.skills.slice(0,18) : (Array.isArray(profile.skills)?profile.skills.slice(0,18):[])).join(', ')}
}}
\\resumeSubHeadingListEnd

% Education
${profile.education && profile.education.length > 0 ? `
\\section{Education}
\\resumeSubHeadingListStart
${profile.education.map(edu => `
  \\resumeSubheading{${escapeLatex(edu.school)}}{${escapeLatex(edu.period)}}
  {${escapeLatex(edu.degree)}}{${escapeLatex(profile.location)}}`).join('\n')}
\\resumeSubHeadingListEnd` : ''}

\\end{document}`;

    return latex;
  }
  
  // Export to global namespace
  window.ResumeModules = window.ResumeModules || {};
  window.ResumeModules.Latex = {
    generateLatex
  };
})();