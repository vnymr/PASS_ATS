/**
 * Simplified Prompt Builder - Send raw user data to LLM
 * Let the LLM extract and process everything
 */

/**
 * Build the system prompt for LaTeX resume generation
 */
export function buildSimpleSystemPrompt() {
  return `You are an expert ATS-optimized resume writer. Your task is to create a professional LaTeX resume.

IMPORTANT RULES:
1. USE ONLY the information provided in the user data. Do NOT invent or hallucinate any information.
2. Extract the user's name, email, phone, location from the provided data.
3. Extract all experience, education, skills, projects from the provided data.
4. If information is missing, omit it rather than making it up.
5. Optimize for ATS by matching keywords from the job description where the user has relevant experience.
6. Generate a complete, compilable LaTeX document.
7. Output ONLY LaTeX code, no explanations or markdown blocks.

LaTeX Template Requirements:
- Use the standard article class with proper packages
- Include sections for: Header, Summary, Experience, Education, Skills, Projects (if present)
- Use professional formatting with proper spacing
- Ensure all LaTeX special characters are escaped
- Fill one full page without exceeding it`;
}

/**
 * Build the user prompt with raw data
 */
export function buildSimpleUserPrompt(userProfileData, jobDescription, options = {}) {
  return `Generate a one-page ATS-optimized LaTeX resume for this job application.

JOB DESCRIPTION:
${jobDescription}

USER PROFILE DATA (Extract all information from this):
${typeof userProfileData === 'string' ? userProfileData : JSON.stringify(userProfileData, null, 2)}

TARGET JOB TITLE: ${options.targetJobTitle || 'Not specified'}

INSTRUCTIONS:
1. Carefully read through the user profile data and extract:
   - Personal information (name, email, phone, location, linkedin, etc.)
   - All work experience with dates, companies, roles, and responsibilities
   - Education details
   - Skills (technical and soft skills)
   - Projects, certifications, awards if present
   - Any additional relevant information

2. Match the user's experience with the job requirements:
   - Prioritize relevant experience
   - Use keywords from the job description where applicable
   - Highlight matching skills

3. Generate a complete LaTeX resume that:
   - Uses ONLY information found in the user profile data
   - Is optimized for ATS scanning
   - Fills one full page
   - Follows professional formatting standards

Output ONLY the LaTeX code.`;
}

/**
 * Simplified resume context builder
 */
export function buildSimpleResumeContext(userProfileData, jobDescription, options = {}) {
  // Just pass the raw data - let LLM do all the extraction
  return {
    systemPrompt: buildSimpleSystemPrompt(),
    userPrompt: buildSimpleUserPrompt(userProfileData, jobDescription, options),
    rawUserData: userProfileData,
    jobDescription: jobDescription
  };
}

export default {
  buildSimpleSystemPrompt,
  buildSimpleUserPrompt,
  buildSimpleResumeContext
};