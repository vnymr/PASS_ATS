import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function candidateDigestPrompt(resumeText) {
  const prompt = `Extract structured information from this resume.
Return ONLY valid JSON with these exact fields:
- name: string (null if not found)
- location: string (null if not found)
- phone: string (null if not found)
- email: string (null if not found)
- linkedin: string (null if not found)
- website: string (null if not found)
- experiences: array of {title, company, location, start, end, bullets: array of strings}
- skills: array of unique strings (technical skills, tools, languages, frameworks)
- education: array of {school, degree, field, graduationDate, gpa} (gpa null if not listed)
- projects: array of {name, description, technologies: array, link}
- guardrails: {noFakeNumbers: true, doNotClaim: array of skills/certs NOT in resume}

Extract facts only. Clean bullets slightly but preserve meaning. Identify what's missing.`;

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
          content: resumeText
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);

    // Validate and normalize the response
    return {
      name: result.name || null,
      location: result.location || null,
      phone: result.phone || null,
      email: result.email || null,
      linkedin: result.linkedin || null,
      website: result.website || null,
      experiences: Array.isArray(result.experiences) ? result.experiences.map(exp => ({
        title: exp.title || '',
        company: exp.company || '',
        location: exp.location || '',
        start: exp.start || '',
        end: exp.end || '',
        bullets: Array.isArray(exp.bullets) ? exp.bullets.slice(0, 8) : []
      })) : [],
      skills: Array.isArray(result.skills) ? [...new Set(result.skills)].slice(0, 50) : [],
      education: Array.isArray(result.education) ? result.education.map(edu => ({
        school: edu.school || '',
        degree: edu.degree || '',
        field: edu.field || '',
        graduationDate: edu.graduationDate || '',
        gpa: edu.gpa || null
      })) : [],
      projects: Array.isArray(result.projects) ? result.projects.map(proj => ({
        name: proj.name || '',
        description: proj.description || '',
        technologies: Array.isArray(proj.technologies) ? proj.technologies : [],
        link: proj.link || null
      })) : [],
      guardrails: {
        noFakeNumbers: result.guardrails?.noFakeNumbers !== false,
        doNotClaim: Array.isArray(result.guardrails?.doNotClaim) ? result.guardrails.doNotClaim : []
      }
    };
  } catch (error) {
    console.error('[Candidate Digest] Error:', error.message);
    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
}

// Example usage for testing
export async function testCandidateDigest() {
  const sampleResume = `
    John Doe
    San Francisco, CA | john.doe@email.com | (555) 123-4567
    linkedin.com/in/johndoe | github.com/johndoe

    EXPERIENCE

    Senior Software Engineer | TechCorp Inc. | San Francisco, CA | Jan 2021 - Present
    • Led development of microservices architecture serving 2M+ daily users
    • Reduced API response times by 45% through optimization
    • Mentored team of 5 junior developers
    • Implemented CI/CD pipelines using Jenkins and Docker

    Software Engineer | StartupXYZ | San Francisco, CA | Jun 2019 - Dec 2020
    • Built RESTful APIs using Node.js and Express
    • Developed React components for customer dashboard
    • Improved database performance by 30% with query optimization
    • Collaborated with product team on feature specifications

    EDUCATION

    B.S. Computer Science | University of California, Berkeley | May 2019
    GPA: 3.8/4.0

    SKILLS

    Languages: JavaScript, TypeScript, Python, Java, SQL
    Frameworks: React, Node.js, Express, Django, Spring Boot
    Tools: Docker, Kubernetes, AWS, Git, Jenkins, PostgreSQL, MongoDB

    PROJECTS

    Personal Finance Tracker
    • Full-stack web application for budget management built with React and Node.js
    • Integrated Plaid API for bank account synchronization
    • Technologies: React, Node.js, PostgreSQL, AWS
    • Link: github.com/johndoe/finance-tracker
  `;

  try {
    const result = await candidateDigestPrompt(sampleResume);
    console.log('Candidate Analysis Result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Test failed:', error);
  }
}