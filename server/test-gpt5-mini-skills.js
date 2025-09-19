import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testGPT5Mini() {
  const systemPrompt = `Generate a JSON resume. EXACT FORMAT REQUIRED:
{
  "personalInfo": {"name": "string", "email": "string", "phone": "string", "location": "string"},
  "summary": "string (2-3 sentences)",
  "experience": [
    {
      "company": "string",
      "position": "string",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM" or "Present",
      "location": "string",
      "bullets": ["bullet1", "bullet2", "bullet3", "bullet4"] // 2-6 bullets
    }
  ],
  "skills": {
    "technical": [
      {"name": "Python", "category": "programming"},
      {"name": "React", "category": "framework"},
      {"name": "AWS", "category": "cloud"},
      {"name": "PostgreSQL", "category": "database"},
      {"name": "Git", "category": "tool"}
    ],
    "soft": ["Leadership", "Communication", "Problem Solving"]
  },
  "education": [
    {"school": "University Name", "degree": "Bachelor's", "field": "Computer Science", "graduationDate": "2020-05"}
  ]
}

CRITICAL RULES:
- Dates: "YYYY-MM" (e.g., "2023-06")
- endDate: "Present" for current jobs
- technical skills: array of {name, category} objects
- category must be: programming/framework/database/cloud/tool/other
- soft skills: array of strings
- 2-6 bullets per job
- Output ONLY JSON`;

  const userPrompt = `Create a tailored resume JSON for this job:

JOB: Business Development Manager at Tech Company

RESUME: John Doe, Senior Business Developer with 5 years experience

Generate JSON matching the exact format shown. Use "YYYY-MM" dates, max 6 bullets per job, skills as object with categories.`;

  try {
    console.log('Calling OpenAI with GPT-5-mini...');
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 3000
    });

    const content = response.choices[0].message.content;
    console.log('\nRaw Response:');
    console.log(content);
    console.log('\nResponse length:', content.length);

    try {
      const parsed = JSON.parse(content);
      console.log('\n✅ Valid JSON!');
      console.log('\nSkills structure:');
      console.log('Technical skills type:', typeof parsed.skills?.technical);
      console.log('Technical skills:', JSON.stringify(parsed.skills?.technical, null, 2));
    } catch (e) {
      console.log('\n❌ Invalid JSON:', e.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testGPT5Mini();