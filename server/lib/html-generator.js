// HTML-based resume generation (simpler, more reliable than LaTeX)
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateResumeHTML(profile, jobDescription, aiMode = 'gpt-5-mini') {
  try {
    console.log('Starting HTML resume generation...');

    // Step 1: Tailor resume with AI (same prompting logic, but for HTML)
    const prompt = `Given this profile and job description, create a tailored resume.

    Profile Information:
    ${JSON.stringify(profile, null, 2)}

    Job Description:
    ${jobDescription}

    Instructions:
    1. Analyze the job requirements and match relevant experience
    2. Prioritize skills and experiences that align with the role
    3. Use strong action verbs and quantify achievements where possible
    4. Keep the summary concise and targeted to this specific role

    Return ONLY valid JSON with this exact structure:
    {
      "personalInfo": {
        "name": "Full Name",
        "email": "email@example.com",
        "phone": "XXX-XXX-XXXX",
        "location": "City, State",
        "linkedin": "linkedin.com/in/username",
        "website": "website.com"
      },
      "summary": "2-3 sentence professional summary specifically tailored to match this job's requirements",
      "experience": [
        {
          "company": "Company Name",
          "position": "Job Title",
          "startDate": "MM/YYYY",
          "endDate": "MM/YYYY or Present",
          "location": "City, State",
          "bullets": [
            "Start with strong action verb and quantify impact where possible",
            "Focus on achievements relevant to target job",
            "Include technologies/skills mentioned in job description"
          ]
        }
      ],
      "skills": {
        "categories": [
          {
            "name": "Programming Languages",
            "items": ["Python", "JavaScript", "etc"]
          },
          {
            "name": "Frameworks & Tools",
            "items": ["React", "Node.js", "etc"]
          }
        ]
      },
      "education": [
        {
          "school": "University Name",
          "degree": "Degree Type",
          "field": "Field of Study",
          "graduationDate": "MM/YYYY",
          "gpa": "3.8/4.0 (optional)"
        }
      ],
      "projects": [
        {
          "name": "Project Name",
          "description": "Brief description focusing on technologies used and impact",
          "technologies": ["Tech1", "Tech2"],
          "link": "github.com/project (optional)"
        }
      ]
    }`;

    // Build request parameters - use same approach as working /generate endpoint
    const modelName = aiMode === 'fast' ? 'gpt-5-mini' :
                      aiMode === 'quality' ? 'gpt-5-mini' :
                      aiMode === 'gpt-4' ? 'gpt-4' :
                      aiMode.includes('gpt') ? aiMode :  // Use as-is if it's already a model name
                      'gpt-5-mini';

    const requestParams = {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: modelName.includes('gpt-5-mini')
            ? 'Expert resume writer. Create tailored ATS resume. Output ONLY valid JSON.'
            : `You are an ELITE ATS-optimization specialist and professional resume writer. Your task is to create a tailored resume that passes ATS systems.

IMPORTANT: Return ONLY valid JSON matching the structure provided. No markdown formatting, no explanations, no comments.`
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2000,
    };

    // Add response_format only for models that support it properly
    if (!modelName.includes('gpt-5-mini')) {
      requestParams.response_format = { type: 'json_object' };  // Force JSON response
    }

    // Temperature handling for different models
    if (!modelName.includes('gpt-5')) {
      requestParams.temperature = 0.3;
    } else if (modelName === 'gpt-5-mini') {
      requestParams.temperature = 0.2;
    }
    // Skip temperature for GPT-5-mini

    const response = await openai.chat.completions.create(requestParams);

    if (!response.choices || !response.choices[0] || !response.choices[0].message || !response.choices[0].message.content) {
      console.error('Invalid OpenAI response structure:', response);
      throw new Error('Invalid response from OpenAI API');
    }

    const content = response.choices[0].message.content;
    console.log('AI response received, length:', content.length);

    let resumeJson;
    try {
      resumeJson = JSON.parse(content);
    } catch (e) {
      console.log('Raw AI response:', content);
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        try {
          resumeJson = JSON.parse(jsonStr);
        } catch (e2) {
          console.error('Failed to parse extracted JSON:', jsonStr);
          throw new Error('Failed to parse AI response as JSON: ' + e2.message);
        }
      } else {
        console.error('No JSON found in response');
        throw new Error('Failed to parse AI response as JSON - no JSON found');
      }
    }

    console.log('AI tailoring complete');

    // Step 2: Generate HTML
    const html = generateHTMLFromJSON(resumeJson);
    console.log('HTML generated');

    // Currently returning HTML and JSON only (PDF generation disabled due to system constraints)
    // To enable PDF: install puppeteer when disk space is available
    console.log('Returning HTML and JSON response');

    return {
      success: true,
      html,
      json: resumeJson,
      note: 'PDF generation temporarily disabled. Use HTML or implement client-side PDF conversion.'
    };

  } catch (error) {
    console.error('HTML generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function generateHTMLFromJSON(data) {
  const { personalInfo, summary, experience, skills, education, projects } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalInfo.name || 'Resume'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
    .container { max-width: 8.5in; margin: 0 auto; }
    header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
    h1 { font-size: 24pt; margin-bottom: 8px; color: #333; }
    .contact-info { font-size: 10pt; color: #666; }
    h2 { font-size: 14pt; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin: 20px 0 10px 0; }
    .experience-item, .education-item, .project-item { margin-bottom: 15px; }
    .position-title { font-weight: bold; }
    .company-name { font-style: italic; }
    .date-location { font-size: 10pt; color: #666; }
    .bullets { margin-left: 20px; }
    .bullets li { margin-bottom: 3px; }
    .skill-category { margin-bottom: 10px; }
    .skill-category h3 { font-size: 11pt; margin-bottom: 5px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${personalInfo.name || ''}</h1>
      <div class="contact-info">
        ${personalInfo.email ? `✉ ${personalInfo.email}` : ''}
        ${personalInfo.phone ? ` | ☎ ${personalInfo.phone}` : ''}
        ${personalInfo.location ? ` | 📍 ${personalInfo.location}` : ''}
        ${personalInfo.linkedin ? ` | 💼 ${personalInfo.linkedin}` : ''}
        ${personalInfo.website ? ` | 🌐 ${personalInfo.website}` : ''}
      </div>
    </header>

    ${summary ? `<h2>Professional Summary</h2><p>${summary}</p>` : ''}

    ${experience && experience.length > 0 ? `
    <h2>Experience</h2>
    ${experience.map(exp => `
      <div class="experience-item">
        <div><span class="position-title">${exp.position}</span> <span class="company-name">at ${exp.company}</span></div>
        <div class="date-location">${exp.startDate} - ${exp.endDate || 'Present'} ${exp.location ? `| ${exp.location}` : ''}</div>
        ${exp.bullets && exp.bullets.length > 0 ? `<ul class="bullets">${exp.bullets.map(bullet => `<li>${bullet}</li>`).join('')}</ul>` : ''}
      </div>
    `).join('')}
    ` : ''}

    ${skills && skills.categories && skills.categories.length > 0 ? `
    <h2>Technical Skills</h2>
    ${skills.categories.map(category => `
      <div class="skill-category">
        <h3>${category.name}:</h3>
        <div>${category.items.join(', ')}</div>
      </div>
    `).join('')}
    ` : ''}

    ${education && education.length > 0 ? `
    <h2>Education</h2>
    ${education.map(edu => `
      <div class="education-item">
        <div><span class="position-title">${edu.degree}${edu.field ? ` in ${edu.field}` : ''}</span></div>
        <div class="company-name">${edu.school}</div>
        <div class="date-location">${edu.graduationDate || ''} ${edu.gpa ? `| GPA: ${edu.gpa}` : ''}</div>
      </div>
    `).join('')}
    ` : ''}

    ${projects && projects.length > 0 ? `
    <h2>Projects</h2>
    ${projects.map(project => `
      <div class="project-item">
        <div><span class="position-title">${project.name}</span> ${project.technologies && project.technologies.length > 0 ? `(${project.technologies.join(', ')})` : ''}</div>
        <div>${project.description} ${project.link ? `<a href="${project.link}">[Link]</a>` : ''}</div>
      </div>
    `).join('')}
    ` : ''}
  </div>
</body>
</html>`;
}