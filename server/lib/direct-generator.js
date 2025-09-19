// Direct resume generation without queue complexity
import OpenAI from 'openai';
import { jsonToLatex } from './json-to-latex.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateResumeDirect(profile, jobDescription) {
  try {
    console.log('Starting direct resume generation...');

    // Step 1: Tailor resume with AI
    const prompt = `Given this profile and job description, create a tailored resume in JSON format.

    Profile:
    ${JSON.stringify(profile, null, 2)}

    Job Description:
    ${jobDescription}

    Return ONLY valid JSON with this structure:
    {
      "personalInfo": {
        "name": "...",
        "email": "...",
        "phone": "...",
        "location": "...",
        "linkedin": "...",
        "website": "..."
      },
      "summary": "2-3 sentence professional summary tailored to the job",
      "experience": [
        {
          "company": "...",
          "position": "...",
          "startDate": "MM/YYYY",
          "endDate": "MM/YYYY or Present",
          "location": "...",
          "bullets": ["Achievement 1", "Achievement 2"]
        }
      ],
      "skills": {
        "technical": [
          {"name": "Skill", "category": "programming|framework|database|cloud|tool"}
        ]
      },
      "education": [
        {
          "school": "...",
          "degree": "...",
          "field": "...",
          "graduationDate": "MM/YYYY"
        }
      ],
      "projects": []
    }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a professional resume writer. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    const content = response.choices[0].message.content;
    const resumeJson = JSON.parse(content);

    console.log('AI tailoring complete');

    // Step 2: Generate LaTeX
    const latex = jsonToLatex(resumeJson);
    console.log('LaTeX generated');

    // Step 3: Compile to PDF
    const tempDir = path.join(dirname(dirname(__dirname)), 'temp', `job-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const latexPath = path.join(tempDir, 'resume.tex');
    await fs.writeFile(latexPath, latex);

    console.log('Compiling LaTeX to PDF...');
    const { stdout, stderr } = await execAsync(
      `cd "${tempDir}" && tectonic --chatter minimal resume.tex`,
      { timeout: 30000 }
    );

    const pdfPath = path.join(tempDir, 'resume.pdf');
    const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);

    if (!pdfExists) {
      throw new Error(`PDF generation failed: ${stderr || 'No PDF created'}`);
    }

    const pdfBuffer = await fs.readFile(pdfPath);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    console.log('Resume generation complete!');

    return {
      success: true,
      pdf: pdfBuffer,
      latex,
      json: resumeJson
    };

  } catch (error) {
    console.error('Generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}