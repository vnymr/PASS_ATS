/**
 * Hardcoded Recipes for Common ATS Platforms
 *
 * Pre-made recipes for Greenhouse, Lever, etc.
 * These are manually created based on known form structures.
 * No need to use BrowserUse to record these!
 */

import { prisma } from './prisma-client.js';
import logger from './logger.js';

/**
 * Standard Greenhouse application form recipe
 * Works for most Greenhouse-powered companies
 */
const GREENHOUSE_RECIPE = {
  platform: 'greenhouse',
  atsType: 'GREENHOUSE',
  steps: [
    {
      action: 'type',
      selector: 'input[name="job_application[first_name]"], #first_name',
      value: '{{personalInfo.firstName}}',
      fieldName: 'First Name',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="job_application[last_name]"], #last_name',
      value: '{{personalInfo.lastName}}',
      fieldName: 'Last Name',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="job_application[email]"], #email',
      value: '{{personalInfo.email}}',
      fieldName: 'Email',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="job_application[phone]"], #phone',
      value: '{{personalInfo.phone}}',
      fieldName: 'Phone',
      required: true
    },
    {
      action: 'upload',
      selector: 'input[type="file"][name="job_application[resume]"], input[name="resume"]',
      value: '{{resumeUrl}}',
      fieldName: 'Resume',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="job_application[linkedin_profile_url]"], textarea[name*="linkedin"], input[placeholder*="LinkedIn"]',
      value: '{{personalInfo.linkedinUrl}}',
      fieldName: 'LinkedIn URL',
      required: false
    },
    {
      action: 'type',
      selector: 'input[name*="github"], input[placeholder*="GitHub"]',
      value: '{{personalInfo.githubUrl}}',
      fieldName: 'GitHub URL',
      required: false
    },
    {
      action: 'select',
      selector: 'select[name*="authorization"], select[name*="work_authorization"]',
      value: '{{commonAnswers.workAuthorization}}',
      fieldName: 'Work Authorization',
      required: false
    },
    {
      action: 'select',
      selector: 'select[name*="sponsorship"], select[name*="require_sponsorship"]',
      value: '{{commonAnswers.requiresSponsorship}}',
      fieldName: 'Requires Sponsorship',
      required: false
    },
    {
      action: 'wait',
      duration: 1000
    },
    {
      action: 'click',
      selector: 'input[type="submit"][value*="Submit"], button[type="submit"]',
      fieldName: 'Submit Application',
      required: true
    }
  ]
};

/**
 * Standard Lever application form recipe
 */
const LEVER_RECIPE = {
  platform: 'lever',
  atsType: 'LEVER',
  steps: [
    {
      action: 'type',
      selector: 'input[name="name"]',
      value: '{{personalInfo.firstName}} {{personalInfo.lastName}}',
      fieldName: 'Full Name',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="email"]',
      value: '{{personalInfo.email}}',
      fieldName: 'Email',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="phone"]',
      value: '{{personalInfo.phone}}',
      fieldName: 'Phone',
      required: true
    },
    {
      action: 'upload',
      selector: 'input[type="file"][name="resume"]',
      value: '{{resumeUrl}}',
      fieldName: 'Resume',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="urls[LinkedIn]"], input[placeholder*="LinkedIn"]',
      value: '{{personalInfo.linkedinUrl}}',
      fieldName: 'LinkedIn URL',
      required: false
    },
    {
      action: 'type',
      selector: 'input[name="urls[GitHub]"], input[placeholder*="GitHub"]',
      value: '{{personalInfo.githubUrl}}',
      fieldName: 'GitHub URL',
      required: false
    },
    {
      action: 'type',
      selector: 'input[name="urls[Portfolio]"], input[placeholder*="Portfolio"]',
      value: '{{personalInfo.portfolioUrl}}',
      fieldName: 'Portfolio URL',
      required: false
    },
    {
      action: 'wait',
      duration: 1000
    },
    {
      action: 'click',
      selector: 'button[type="submit"]',
      fieldName: 'Submit Application',
      required: true
    }
  ]
};

/**
 * Ashby application form recipe
 */
const ASHBY_RECIPE = {
  platform: 'ashby',
  atsType: 'ASHBY',
  steps: [
    {
      action: 'type',
      selector: 'input[name="fullName"]',
      value: '{{personalInfo.firstName}} {{personalInfo.lastName}}',
      fieldName: 'Full Name',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="email"]',
      value: '{{personalInfo.email}}',
      fieldName: 'Email',
      required: true
    },
    {
      action: 'type',
      selector: 'input[name="phoneNumber"]',
      value: '{{personalInfo.phone}}',
      fieldName: 'Phone',
      required: true
    },
    {
      action: 'upload',
      selector: 'input[type="file"]',
      value: '{{resumeUrl}}',
      fieldName: 'Resume',
      required: true
    },
    {
      action: 'type',
      selector: 'input[placeholder*="LinkedIn"]',
      value: '{{personalInfo.linkedinUrl}}',
      fieldName: 'LinkedIn URL',
      required: false
    },
    {
      action: 'wait',
      duration: 1000
    },
    {
      action: 'click',
      selector: 'button[type="submit"]',
      fieldName: 'Submit Application',
      required: true
    }
  ]
};

/**
 * Initialize hardcoded recipes in database
 */
async function initializeHardcodedRecipes() {
  const recipes = [
    GREENHOUSE_RECIPE,
    LEVER_RECIPE,
    ASHBY_RECIPE
  ];

  logger.info('📋 Initializing hardcoded recipes...');

  for (const recipeData of recipes) {
    try {
      const recipe = await prisma.applicationRecipe.upsert({
        where: { platform: recipeData.platform },
        create: {
          platform: recipeData.platform,
          atsType: recipeData.atsType,
          steps: recipeData.steps,
          recordedBy: 'system_hardcoded',
          recordingCost: 0.0, // Free - we hardcoded it!
          replayCost: 0.05
        },
        update: {
          steps: recipeData.steps,
          updatedAt: new Date()
        }
      });

      logger.info(`✅ ${recipeData.platform} recipe initialized (${recipeData.steps.length} steps)`);

    } catch (error) {
      logger.error({ error: error.message, platform: recipeData.platform }, 'Failed to initialize recipe');
    }
  }

  logger.info('✅ All hardcoded recipes initialized');
}

/**
 * Get all available recipes
 */
async function getAllRecipes() {
  try {
    const recipes = await prisma.applicationRecipe.findMany({
      orderBy: { timesUsed: 'desc' }
    });

    return recipes;

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get recipes');
    return [];
  }
}

export {
  GREENHOUSE_RECIPE,
  LEVER_RECIPE,
  ASHBY_RECIPE,
  initializeHardcodedRecipes,
  getAllRecipes
};
