import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function planPrompt(jdDigest, candidateDigest) {
  const prompt = `Create a strategic resume generation plan by matching job requirements to candidate experience.
Return ONLY valid JSON with these exact fields:
- targetScore: number (always 0.85)
- templateHint: string (e.g., "PO-Compact-1col", "Eng-Technical-1col", "Sales-Results-1col", "General-Readable-1col")
- domainAdapter: string (match to role: "POS", "Engineering", "Sales", "Leadership", "Finance", "General")
- keywordPlacement: object mapping top 15 keywords to sections {"keyword": "Skills|Summary|Experience"}
- bulletPlan: array of 6-10 {expIndex: number, bulletScaffold: string (12-18 words, action + context + impact)}
- caps: {bulletsPerRole: 4, bulletMaxWords: 25, rolesMax: 5, summaryMaxWords: 35}

Map keywords strategically. Create scaffolds that align experience with job needs. Stay truthful.`;

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
            job: {
              role: jdDigest.roleFamily,
              seniority: jdDigest.seniority,
              industry: jdDigest.industry,
              keywords: jdDigest.keywords,
              responsibilities: jdDigest.responsibilities
            },
            candidate: {
              experiences: candidateDigest.experiences.map(exp => ({
                title: exp.title,
                company: exp.company,
                bullets: exp.bullets.slice(0, 3)
              })),
              skills: candidateDigest.skills,
              guardrails: candidateDigest.guardrails
            }
          })
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);

    // Validate and normalize the response
    return {
      targetScore: result.targetScore || 0.85,
      templateHint: result.templateHint || 'General-Readable-1col',
      domainAdapter: result.domainAdapter || 'General',
      keywordPlacement: result.keywordPlacement && typeof result.keywordPlacement === 'object'
        ? result.keywordPlacement
        : {},
      bulletPlan: Array.isArray(result.bulletPlan)
        ? result.bulletPlan.filter(b =>
            typeof b.expIndex === 'number' &&
            typeof b.bulletScaffold === 'string'
          ).slice(0, 10)
        : [],
      caps: {
        bulletsPerRole: result.caps?.bulletsPerRole || 4,
        bulletMaxWords: result.caps?.bulletMaxWords || 25,
        rolesMax: result.caps?.rolesMax || 5,
        summaryMaxWords: result.caps?.summaryMaxWords || 35
      }
    };
  } catch (error) {
    console.error('[Plan Prompt] Error:', error.message);
    throw new Error(`Failed to create generation plan: ${error.message}`);
  }
}

// Example usage for testing
export async function testPlanPrompt() {
  // Sample JD digest (from previous stage)
  const sampleJdDigest = {
    roleFamily: "Software Engineer",
    seniority: "Senior",
    industry: "Fintech",
    companySize: "Scaleup",
    companyThemes: ["innovation", "customer-focused", "fast-paced", "collaborative"],
    keywords: [
      "React", "Node.js", "TypeScript", "AWS", "PostgreSQL",
      "Microservices", "API Design", "Docker", "CI/CD", "Agile",
      "Performance Optimization", "Team Leadership", "Code Reviews"
    ],
    responsibilities: [
      "Design scalable microservices architecture",
      "Lead technical initiatives and mentor team",
      "Optimize application performance",
      "Collaborate with product and design teams",
      "Implement CI/CD pipelines",
      "Conduct code reviews and ensure quality"
    ]
  };

  // Sample candidate digest (from previous stage)
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
          "Led development of microservices architecture serving 2M+ daily users",
          "Reduced API response times by 45% through optimization",
          "Mentored team of 5 junior developers",
          "Implemented CI/CD pipelines using Jenkins and Docker"
        ]
      },
      {
        title: "Software Engineer",
        company: "StartupXYZ",
        location: "San Francisco, CA",
        start: "Jun 2019",
        end: "Dec 2020",
        bullets: [
          "Built RESTful APIs using Node.js and Express",
          "Developed React components for customer dashboard",
          "Improved database performance by 30% with query optimization",
          "Collaborated with product team on feature specifications"
        ]
      }
    ],
    skills: [
      "JavaScript", "TypeScript", "Python", "React", "Node.js",
      "Express", "Django", "PostgreSQL", "MongoDB", "Docker",
      "AWS", "Git", "Jenkins", "Agile", "REST APIs"
    ],
    education: [
      {
        school: "University of California, Berkeley",
        degree: "B.S.",
        field: "Computer Science",
        graduationDate: "May 2019",
        gpa: "3.8"
      }
    ],
    projects: [
      {
        name: "Personal Finance Tracker",
        description: "Full-stack web application for budget management",
        technologies: ["React", "Node.js", "PostgreSQL", "AWS"],
        link: "github.com/johndoe/finance-tracker"
      }
    ],
    guardrails: {
      noFakeNumbers: true,
      doNotClaim: ["Kubernetes", "Machine Learning", "Go", "Ruby"]
    }
  };

  try {
    const result = await planPrompt(sampleJdDigest, sampleCandidateDigest);
    console.log('Generation Plan Result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Test failed:', error);
  }
}