import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function masterPrompt({ jdDigest, candidateDigest, plan, preamble, wireframe }) {
  const prompt = `Generate a LaTeX resume using the provided template and data.

TEMPLATE STRUCTURE:
${preamble}
\\begin{document}
${wireframe}
\\end{document}

GENERATION RULES:
1. Fill the wireframe with candidate data following the plan
2. Place keywords as specified in plan.keywordPlacement
3. Use domain adapter "${plan.domainAdapter}" for industry language
4. Enforce caps: ${plan.caps.bulletsPerRole} bullets/role, ${plan.caps.bulletMaxWords} words/bullet
5. Summary: ${plan.caps.summaryMaxWords} words, incorporating ${jdDigest.seniority} ${jdDigest.roleFamily} positioning
6. Use bullet scaffolds from plan, enhancing with metrics and keywords
7. Include top ${jdDigest.keywords.length} keywords naturally throughout
8. LaTeX escaping: \\& for &, \\% for %, \\$ for $, \\# for #, \\_ for _

OUTPUT REQUIREMENTS:
- Complete LaTeX document only (no explanations)
- All sections filled with real candidate data
- Keywords strategically placed per plan
- Metrics in 30%+ of bullets
- Industry-appropriate language
- Respect guardrails: don't claim ${candidateDigest.guardrails.doNotClaim.join(', ')}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: JSON.stringify({
            target: {
              title: `${jdDigest.seniority} ${jdDigest.roleFamily}`,
              industry: jdDigest.industry,
              company: jdDigest.companySize,
              themes: jdDigest.companyThemes,
              responsibilities: jdDigest.responsibilities
            },
            candidate: candidateDigest,
            plan: {
              keywords: plan.keywordPlacement,
              bullets: plan.bulletPlan,
              template: plan.templateHint
            }
          })
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 4000
    });

    const latexOutput = completion.choices[0].message.content;

    // Clean up any markdown formatting if present
    let cleanedLatex = latexOutput
      .replace(/^```latex\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^```tex\n?/, '')
      .trim();

    // Validate basic LaTeX structure
    if (!cleanedLatex.includes('\\documentclass') || !cleanedLatex.includes('\\begin{document}')) {
      throw new Error('Invalid LaTeX structure generated');
    }

    return cleanedLatex;
  } catch (error) {
    console.error('[Master Prompt] Error:', error.message);
    throw new Error(`Failed to generate LaTeX resume: ${error.message}`);
  }
}

// Test function with sample data
export async function testMasterPrompt() {
  // Sample template preamble (simplified)
  const samplePreamble = `\\documentclass[a4paper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{fontawesome5}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}

\\addtolength{\\oddsidemargin}{-0.8in}
\\addtolength{\\textwidth}{1.6in}
\\addtolength{\\topmargin}{-0.9in}
\\addtolength{\\textheight}{1.8in}

\\newcommand{\\resumeItem}[1]{\\item\\small{#1}}
\\newcommand{\\resumeSubheading}[4]{
  \\item \\textbf{#1} \\hfill \\textbf{\\small #2} \\\\
  \\textit{\\small#3} \\hfill \\textit{\\small #4}
}`;

  // Sample wireframe
  const sampleWireframe = `% Header
\\begin{center}
{\\Huge \\scshape [NAME]} \\\\
\\small [LOCATION] ~ [PHONE] ~ [EMAIL] ~ [LINKEDIN]
\\end{center}

% Summary
\\section*{Summary}
[SUMMARY]

% Experience
\\section{Experience}
\\begin{itemize}[leftmargin=0in, label={}]
[EXPERIENCES]
\\end{itemize}

% Skills
\\section{Skills}
\\small{[SKILLS]}

% Education
\\section{Education}
[EDUCATION]`;

  // Sample data from previous stages
  const sampleJdDigest = {
    roleFamily: "Software Engineer",
    seniority: "Senior",
    industry: "Fintech",
    companySize: "Scaleup",
    companyThemes: ["innovation", "customer-focused", "fast-paced"],
    keywords: ["React", "Node.js", "TypeScript", "AWS", "Microservices", "CI/CD"],
    responsibilities: [
      "Design scalable microservices",
      "Lead technical initiatives",
      "Optimize performance"
    ]
  };

  const sampleCandidateDigest = {
    name: "John Doe",
    location: "San Francisco, CA",
    phone: "(555) 123-4567",
    email: "john.doe@email.com",
    linkedin: "linkedin.com/in/johndoe",
    website: "github.com/johndoe",
    experiences: [
      {
        title: "Senior Software Engineer",
        company: "TechCorp Inc.",
        location: "San Francisco, CA",
        start: "Jan 2021",
        end: "Present",
        bullets: [
          "Led development of microservices architecture",
          "Reduced API response times by 45%",
          "Mentored team of 5 developers"
        ]
      }
    ],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "AWS", "Docker"],
    education: [{
      school: "UC Berkeley",
      degree: "B.S.",
      field: "Computer Science",
      graduationDate: "May 2019",
      gpa: "3.8"
    }],
    projects: [],
    guardrails: {
      noFakeNumbers: true,
      doNotClaim: ["Kubernetes", "Go"]
    }
  };

  const samplePlan = {
    targetScore: 0.85,
    templateHint: "Eng-Technical-1col",
    domainAdapter: "Engineering",
    keywordPlacement: {
      "React": "Skills",
      "Microservices": "Experience",
      "TypeScript": "Skills",
      "AWS": "Skills",
      "CI/CD": "Experience"
    },
    bulletPlan: [
      {
        expIndex: 0,
        bulletScaffold: "Architected microservices handling millions of transactions"
      },
      {
        expIndex: 0,
        bulletScaffold: "Improved system performance through optimization techniques"
      }
    ],
    caps: {
      bulletsPerRole: 4,
      bulletMaxWords: 25,
      rolesMax: 5,
      summaryMaxWords: 35
    }
  };

  try {
    const result = await masterPrompt({
      jdDigest: sampleJdDigest,
      candidateDigest: sampleCandidateDigest,
      plan: samplePlan,
      preamble: samplePreamble,
      wireframe: sampleWireframe
    });

    console.log('Generated LaTeX (first 500 chars):');
    console.log(result.substring(0, 500) + '...');
    console.log('\nTotal length:', result.length);
    return result;
  } catch (error) {
    console.error('Test failed:', error);
  }
}