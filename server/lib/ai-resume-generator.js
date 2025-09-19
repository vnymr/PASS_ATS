/**
 * Simplified AI Resume Generator
 * Direct AI generation without templates or structured prompts
 */

import OpenAI from 'openai';
import { compileLatex } from './latex-compiler.js';

// Example LaTeX resumes for AI to learn from
const EXAMPLE_RESUMES = {
  technical: `\\documentclass[10.5pt,letterpaper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{geometry}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\geometry{left=0.8in, right=0.8in, top=0.7in, bottom=0.7in}
\\definecolor{techcolor}{RGB}{0,60,120}
\\renewcommand{\\familydefault}{\\sfdefault}
\\newcommand{\\tech}[1]{{\\small\\ttfamily #1}}

\\titleformat{\\section}{\\large\\bfseries\\scshape}{}{0pt}{}[\\color{techcolor}\\titlerule]
\\titlespacing{\\section}{0pt}{10pt}{6pt}

\\setlist[itemize]{nosep, left=0pt, labelwidth=13pt, labelsep=4pt, itemsep=1.5pt}
\\renewcommand{\\labelitemi}{\\textcolor{techcolor}{$\\blacktriangleright$}}
\\pagestyle{empty}

\\begin{document}

\\begin{center}
{\\Large\\bfseries John Smith}\\\\[3pt]
San Francisco, CA \\textbar{} (555) 123-4567 \\textbar{} john@email.com\\\\
\\href{https://linkedin.com/in/johnsmith}{linkedin.com/in/johnsmith}
\\end{center}

\\section{Technical Skills}
\\noindent\\textbf{Languages:} \\tech{Python, JavaScript, TypeScript, Go, SQL}\\\\[2pt]
\\textbf{Frameworks:} \\tech{React, Node.js, Django, FastAPI, Next.js}\\\\[2pt]
\\textbf{Cloud/DevOps:} \\tech{AWS, Docker, Kubernetes, Terraform, CI/CD}\\\\[2pt]
\\textbf{Databases:} \\tech{PostgreSQL, MongoDB, Redis, DynamoDB}

\\section{Professional Experience}
\\subsection{Senior Software Engineer \\hfill Jan 2021 - Present}
\\textit{TechCorp} \\hfill \\textit{San Francisco, CA}
\\begin{itemize}
\\item Architected microservices platform using \\tech{Go} and \\tech{gRPC}, improving throughput by 300\\%
\\item Implemented distributed caching with \\tech{Redis}, reducing database load by 70\\%
\\item Built CI/CD pipeline with \\tech{GitLab CI} for 40+ microservices
\\item Optimized \\tech{PostgreSQL} queries, reducing p99 latency from 800ms to 120ms
\\end{itemize}

\\section{Education}
\\textbf{Bachelor of Science in Computer Science}\\\\
\\textit{University of California, Berkeley} \\hfill 2018

\\end{document}`,

  professional: `\\documentclass[11pt,letterpaper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\geometry{margin=0.75in}
\\titleformat{\\section}{\\large\\bfseries}{}{0pt}{}[\\titlerule]
\\setlist[itemize]{nosep, left=0pt, itemsep=2pt}
\\pagestyle{empty}

\\begin{document}

\\begin{center}
{\\LARGE\\bfseries Sarah Johnson}\\\\[5pt]
New York, NY 10001 \\textbar{} (555) 987-6543 \\textbar{} sarah.johnson@email.com
\\end{center}

\\section{Professional Summary}
Strategic product manager with 8+ years driving product innovation in fintech. Led cross-functional teams to deliver products generating \\$50M+ revenue. Expert in agile methodologies, user research, and data-driven decision making.

\\section{Experience}
\\textbf{Senior Product Manager} \\hfill 2020 - Present\\\\
\\textit{FinTech Solutions Inc., New York, NY}
\\begin{itemize}
\\item Launched mobile payment platform reaching 2M users in 6 months
\\item Increased user engagement by 45\\% through data-driven feature optimization
\\item Managed \\$5M product budget and team of 15 engineers and designers
\\item Reduced customer churn by 30\\% through improved onboarding flow
\\end{itemize}

\\textbf{Product Manager} \\hfill 2018 - 2020\\\\
\\textit{Digital Banking Corp., Boston, MA}
\\begin{itemize}
\\item Led development of AI-powered fraud detection saving \\$10M annually
\\item Conducted 100+ user interviews to identify key pain points
\\item Increased NPS score from 35 to 62 through product improvements
\\end{itemize}

\\section{Education}
\\textbf{MBA, Finance} - Harvard Business School, 2018\\\\
\\textbf{BS, Computer Science} - MIT, 2015

\\section{Skills}
Product Strategy • User Research • Agile/Scrum • SQL • Tableau • JIRA • Figma • A/B Testing

\\end{document}`,

  creative: `\\documentclass[11pt,letterpaper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\geometry{margin=0.8in}
\\definecolor{accent}{RGB}{25,100,126}
\\titleformat{\\section}{\\large\\bfseries\\color{accent}}{}{0pt}{}
\\setlength{\\parindent}{0pt}
\\pagestyle{empty}

\\begin{document}

\\begin{center}
{\\huge\\bfseries Emily Chen}\\\\[8pt]
\\large Graphic Designer \\& Creative Director\\\\[5pt]
Los Angeles, CA • emily@designstudio.com • (555) 234-5678\\\\
Portfolio: \\href{https://emilychen.design}{emilychen.design}
\\end{center}

\\vspace{10pt}

\\section{About Me}
Award-winning designer with 7 years creating compelling visual narratives for global brands. Passionate about minimalist design, typography, and sustainable branding. Led creative teams at top agencies delivering campaigns for Fortune 500 clients.

\\section{Experience}
\\textbf{Creative Director} \\textit{— Spark Design Agency} \\hfill 2021 - Present\\\\
• Led rebrand for Nike sustainability initiative, increasing engagement by 200\\%\\\\
• Managed team of 12 designers across 3 continents\\\\
• Won 3 industry awards including Cannes Lions Silver\\\\
• Developed brand guidelines for 20+ enterprise clients

\\vspace{8pt}

\\textbf{Senior Designer} \\textit{— Creative Collective} \\hfill 2019 - 2021\\\\
• Designed visual identity for Spotify podcast division\\\\
• Created motion graphics viewed by 10M+ users\\\\
• Established design system reducing production time by 40\\%

\\section{Education}
\\textbf{MFA, Graphic Design} — Rhode Island School of Design, 2019\\\\
\\textbf{BA, Visual Arts} — UCLA, 2017

\\section{Skills}
Adobe Creative Suite • Figma • Sketch • After Effects • Cinema 4D • Typography • Branding • UI/UX

\\end{document}`
};

class AIResumeGenerator {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate a complete LaTeX resume using AI
   * @param {Object} userData - User profile, experience, education, skills
   * @param {String} jobDescription - Target job description
   * @param {Object} options - Additional options (style preferences, etc.)
   */
  async generateResume(userData, jobDescription, options = {}) {
    try {
      // Determine which example style to use based on job type
      const style = this.determineStyle(jobDescription, options);
      const examples = this.getRelevantExamples(style);

      // Create the prompt with all information
      const prompt = this.buildPrompt(userData, jobDescription, examples, options);

      // Generate LaTeX code directly
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert resume writer and LaTeX typesetter. Generate professional, ATS-optimized resumes in LaTeX format. Output ONLY valid, compilable LaTeX code without any explanations or markdown code blocks.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });

      const latexCode = response.choices[0].message.content.trim();

      // Validate and clean the LaTeX
      const cleanedLatex = this.cleanLatex(latexCode);

      return {
        latex: cleanedLatex,
        style: style,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: options.model || 'gpt-4',
          style: style
        }
      };
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error(`Failed to generate resume: ${error.message}`);
    }
  }

  /**
   * Compile LaTeX to PDF
   */
  async compileResume(latexCode) {
    return await compileLatex(latexCode);
  }

  /**
   * Generate and compile in one step
   */
  async generateAndCompile(userData, jobDescription, options = {}) {
    const { latex } = await this.generateResume(userData, jobDescription, options);
    const pdf = await this.compileResume(latex);
    return { latex, pdf };
  }

  /**
   * Determine the best style based on job description
   */
  determineStyle(jobDescription, options) {
    if (options.style) return options.style;

    const jdLower = jobDescription.toLowerCase();

    if (jdLower.includes('engineer') || jdLower.includes('developer') ||
        jdLower.includes('devops') || jdLower.includes('software')) {
      return 'technical';
    }

    if (jdLower.includes('design') || jdLower.includes('creative') ||
        jdLower.includes('artist') || jdLower.includes('ux')) {
      return 'creative';
    }

    return 'professional';
  }

  /**
   * Get relevant LaTeX examples for the style
   */
  getRelevantExamples(style) {
    // Return 2 examples - the main style and professional as backup
    const examples = [EXAMPLE_RESUMES[style]];
    if (style !== 'professional') {
      examples.push(EXAMPLE_RESUMES.professional);
    }
    return examples;
  }

  /**
   * Build the complete prompt for AI
   */
  buildPrompt(userData, jobDescription, examples, options) {
    // Extract and highlight additional information if present
    const additionalInfoSection = userData.additionalInfo
      ? `\n\nIMPORTANT ADDITIONAL INFORMATION FROM USER:\n${userData.additionalInfo}\n\nIncorporate this additional information appropriately into the resume where relevant.`
      : '';

    return `Generate a professional LaTeX resume based on the following information:

CANDIDATE INFORMATION:
${JSON.stringify(userData, null, 2)}${additionalInfoSection}

TARGET JOB:
${jobDescription}

REQUIREMENTS:
- Create a complete, compilable LaTeX document
- Optimize for ATS (Applicant Tracking Systems)
- Match relevant keywords from the job description
- Use clean, professional formatting
- Include all relevant sections: contact info, summary/objective, experience, education, skills
- Quantify achievements where possible
- Use action verbs for bullet points
- Keep to 1-2 pages maximum

EXAMPLE LATEX RESUMES FOR REFERENCE:
${examples.map((ex, i) => `Example ${i + 1}:\n${ex}`).join('\n\n')}

ADDITIONAL PREFERENCES:
${options.preferences || 'None specified'}

Generate the complete LaTeX code for this resume. Output only the LaTeX code, no explanations.`;
  }

  /**
   * Clean and validate LaTeX code
   */
  cleanLatex(latex) {
    // Remove markdown code blocks if present
    let cleaned = latex.replace(/^```latex?\n?/gm, '').replace(/\n?```$/gm, '');

    // Ensure it starts with documentclass
    if (!cleaned.includes('\\documentclass')) {
      throw new Error('Invalid LaTeX: missing documentclass');
    }

    // Ensure it has begin and end document
    if (!cleaned.includes('\\begin{document}') || !cleaned.includes('\\end{document}')) {
      throw new Error('Invalid LaTeX: missing document environment');
    }

    // Basic escape validation
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    if (Math.abs(openBraces - closeBraces) > 2) {
      console.warn('Warning: Potential brace mismatch in LaTeX');
    }

    return cleaned.trim();
  }

  /**
   * Regenerate specific sections
   */
  async regenerateSection(currentLatex, section, userData, jobDescription) {
    const prompt = `Given this LaTeX resume, regenerate only the ${section} section to better match this job:

Job Description: ${jobDescription}

Current LaTeX:
${currentLatex}

User Data for ${section}:
${JSON.stringify(userData, null, 2)}

Output only the LaTeX code for the new ${section} section, from \\section{${section}} to the start of the next section.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a LaTeX expert. Output only valid LaTeX code.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content.trim();
  }
}

export default AIResumeGenerator;