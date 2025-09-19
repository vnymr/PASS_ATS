import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function jdDigestPrompt(jobDescriptionText) {
  const prompt = `Extract structured information from this job description.
Return ONLY valid JSON with these exact fields:
- roleFamily: string (e.g., "Product Owner", "Software Engineer", "Data Scientist")
- seniority: string (one of: "Entry", "Mid", "Senior", "Lead", "Staff", "Principal", "Manager", "Director", "Executive")
- industry: string (e.g., "Fintech", "Healthcare", "E-commerce", "SaaS", "AI/ML", "Cybersecurity")
- companySize: string (one of: "Startup", "Scaleup", "Mid-size", "Enterprise", "Fortune500")
- companyThemes: array of 3-5 strings (mission, culture, tone, values)
- keywords: array of 12-18 unique strings (technical skills, tools, methodologies)
- responsibilities: array of 6-10 short phrases (core duties, max 10 words each)

Focus on what matters for resume matching. Be precise. Dedupe keywords.`;

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
          content: jobDescriptionText
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);

    // Validate and normalize the response
    return {
      roleFamily: result.roleFamily || 'General',
      seniority: result.seniority || 'Mid',
      industry: result.industry || 'General',
      companySize: result.companySize || 'Mid-size',
      companyThemes: Array.isArray(result.companyThemes) ? result.companyThemes.slice(0, 5) : [],
      keywords: Array.isArray(result.keywords) ? [...new Set(result.keywords)].slice(0, 18) : [],
      responsibilities: Array.isArray(result.responsibilities) ?
        result.responsibilities.map(r => r.substring(0, 80)).slice(0, 10) : []
    };
  } catch (error) {
    console.error('[JD Digest] Error:', error.message);
    throw new Error(`Failed to analyze job description: ${error.message}`);
  }
}

// Example usage for testing
export async function testJdDigest() {
  const sampleJD = `
    Senior Software Engineer - Full Stack

    We're looking for an experienced full-stack engineer to join our growing team.

    Requirements:
    - 5+ years of experience with React, Node.js, and TypeScript
    - Strong understanding of AWS services (EC2, S3, Lambda)
    - Experience with PostgreSQL and Redis
    - Familiarity with CI/CD pipelines and Docker
    - Excellent communication skills

    Responsibilities:
    - Design and implement scalable web applications
    - Collaborate with product managers and designers
    - Mentor junior developers
    - Participate in code reviews
    - Optimize application performance
    - Write technical documentation

    Our company values innovation, collaboration, and continuous learning.
    We're building next-generation fintech solutions for small businesses.
  `;

  try {
    const result = await jdDigestPrompt(sampleJD);
    console.log('JD Analysis Result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Test failed:', error);
  }
}