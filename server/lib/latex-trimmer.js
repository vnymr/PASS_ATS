/**
 * LaTeX Content Trimmer
 * Reduces LaTeX resume content to fit on one page while preserving quality
 */

import logger from './logger.js';

/**
 * Trim LaTeX content to fit on one page
 * Strategy:
 * 1. Remove Projects section first
 * 2. Reduce bullet points per experience (from 5 to 4 to 3)
 * 3. Limit to most recent 2 experiences
 * 4. Reduce Skills section detail
 * 5. Remove Summary section if desperate
 *
 * @param {string} latexCode - Original LaTeX code
 * @param {number} currentPages - Current page count
 * @returns {string} Trimmed LaTeX code
 */
export function trimLatexToOnePage(latexCode, currentPages) {
  logger.info({ currentPages }, 'Trimming LaTeX to fit on one page');

  let trimmed = latexCode;

  // Strategy 1: Remove Projects section (least critical for ATS)
  if (currentPages > 1) {
    const projectsMatch = trimmed.match(/\\section\{Projects\}[\s\S]*?(?=\\section|\\end\{document\})/i);
    if (projectsMatch) {
      trimmed = trimmed.replace(projectsMatch[0], '');
      logger.info('Removed Projects section');
      return trimmed;
    }
  }

  // Strategy 2: Remove Certifications/Awards section
  if (currentPages > 1) {
    const certsMatch = trimmed.match(/\\section\{(Certifications|Awards|Achievements)\}[\s\S]*?(?=\\section|\\end\{document\})/i);
    if (certsMatch) {
      trimmed = trimmed.replace(certsMatch[0], '');
      logger.info('Removed Certifications/Awards section');
      return trimmed;
    }
  }

  // Strategy 3: Reduce bullets per experience entry
  if (currentPages > 1) {
    const experienceSection = trimmed.match(/\\section\{(Experience|Work Experience|Professional Experience)\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
    if (experienceSection) {
      let expContent = experienceSection[2];

      // Count bullets per job and reduce
      const jobs = expContent.split(/\\resumeSubheading\{/);
      const trimmedJobs = jobs.map((job, index) => {
        if (index === 0) return job; // Skip first (empty)

        // Extract bullet points
        const bulletMatch = job.match(/\\resumeItemListStart([\s\S]*?)\\resumeItemListEnd/);
        if (bulletMatch) {
          const bullets = bulletMatch[1].match(/\\resumeItem\{[^}]*\}/g) || [];

          // Keep only first 3 bullets per job
          if (bullets.length > 3) {
            const keepBullets = bullets.slice(0, 3).join('\n      ');
            job = job.replace(bulletMatch[0], `\\resumeItemListStart\n      ${keepBullets}\n    \\resumeItemListEnd`);
            logger.info(`Reduced bullets in job ${index} from ${bullets.length} to 3`);
          }
        }

        return job;
      });

      const newExpContent = trimmedJobs.join('\\resumeSubheading{');
      trimmed = trimmed.replace(experienceSection[2], newExpContent);
      return trimmed;
    }
  }

  // Strategy 4: Limit to 2 most recent experiences
  if (currentPages > 1) {
    const experienceSection = trimmed.match(/\\section\{(Experience|Work Experience|Professional Experience)\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
    if (experienceSection) {
      let expContent = experienceSection[2];

      // Split by resumeSubheading
      const jobs = expContent.split(/\\resumeSubheading\{/).filter(j => j.trim().length > 0);

      if (jobs.length > 2) {
        // Keep only first 2 jobs (most recent)
        const keepJobs = jobs.slice(0, 2);
        const newExpContent = '\\resumeSubheading{' + keepJobs.join('\\resumeSubheading{');
        trimmed = trimmed.replace(experienceSection[2], newExpContent);
        logger.info(`Reduced experiences from ${jobs.length} to 2`);
        return trimmed;
      }
    }
  }

  // Strategy 5: Condense Skills section
  if (currentPages > 1) {
    const skillsSection = trimmed.match(/\\section\{Skills\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
    if (skillsSection) {
      const skillsContent = skillsSection[1];

      // Count skill categories
      const categories = skillsContent.match(/\\textbf\{[^}]+\}:/g) || [];

      if (categories.length > 3) {
        // Combine into fewer categories
        const condensed = skillsContent
          .split(/\\textbf\{[^}]+\}:/)
          .filter(s => s.trim())
          .slice(0, 3)
          .join(', ');

        const newSkills = `\\resumeSubHeadingListStart
\\small{\\item{
  \\textbf{Technical Skills}: ${condensed}
}}
\\resumeSubHeadingListEnd
`;

        trimmed = trimmed.replace(skillsSection[0], `\\section{Skills}\n${newSkills}`);
        logger.info('Condensed Skills section');
        return trimmed;
      }
    }
  }

  // Strategy 6: Remove Summary section as last resort
  if (currentPages > 1) {
    const summaryMatch = trimmed.match(/\\section\*?\{(Summary|Professional Summary|Profile)\}[\s\S]*?(?=\\section|\\end\{document\})/i);
    if (summaryMatch) {
      trimmed = trimmed.replace(summaryMatch[0], '');
      logger.info('Removed Summary section as last resort');
      return trimmed;
    }
  }

  // If still too long, reduce spacing
  if (currentPages > 1) {
    trimmed = trimmed
      .replace(/\\vspace\{-?\d+pt\}/g, '\\vspace{-4pt}') // Tighter spacing
      .replace(/\\addtolength\{\\topmargin\}\{-?[\d.]+in\}/g, '\\addtolength{\\topmargin}{-1.2in}')
      .replace(/\\addtolength\{\\textheight\}\{[\d.]+in\}/g, '\\addtolength{\\textheight}{2.5in}');

    logger.info('Reduced vertical spacing');
    return trimmed;
  }

  logger.warn('Could not trim LaTeX further - manual intervention needed');
  return trimmed;
}

/**
 * Analyze LaTeX structure for trimming decisions
 * @param {string} latexCode - LaTeX code to analyze
 * @returns {Object} Structure analysis
 */
export function analyzeLatexStructure(latexCode) {
  const analysis = {
    hasProjects: latexCode.match(/\\section\{Projects\}/i) !== null,
    hasCertifications: latexCode.match(/\\section\{Certifications\}/i) !== null,
    hasSummary: latexCode.match(/\\section\*?\{(Summary|Professional Summary)\}/i) !== null,
    experienceCount: 0,
    bulletsPerExperience: [],
    skillCategories: 0
  };

  // Count experiences
  const expMatches = latexCode.match(/\\resumeSubheading\{/g);
  if (expMatches) {
    analysis.experienceCount = expMatches.length;
  }

  // Count bullets per experience
  const bulletBlocks = latexCode.match(/\\resumeItemListStart[\s\S]*?\\resumeItemListEnd/g);
  if (bulletBlocks) {
    bulletBlocks.forEach(block => {
      const bullets = block.match(/\\resumeItem\{/g);
      if (bullets) {
        analysis.bulletsPerExperience.push(bullets.length);
      }
    });
  }

  // Count skill categories
  const skillCategories = latexCode.match(/\\textbf\{[^}]+\}:/g);
  if (skillCategories) {
    analysis.skillCategories = skillCategories.length;
  }

  return analysis;
}

export default {
  trimLatexToOnePage,
  analyzeLatexStructure
};
