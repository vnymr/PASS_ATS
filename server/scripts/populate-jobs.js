import 'dotenv/config';
import { prisma } from '../lib/prisma-client.js';
import jobSyncService from '../lib/job-sync-service.js';

async function ensureTables() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "AggregatedJob" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "AutoApplication" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "ApplicationRecipe" LIMIT 1`;
  } catch (error) {
    if (error?.code === 'P2021') {
      throw new Error('Required tables are missing. Run the latest Prisma migrations before populating data.');
    }
    throw error;
  }
}

function buildSampleJobs() {
  const now = new Date();
  return [
    {
      id: 'sample-job-1',
      externalId: 'sample_job_greenhouse_1',
      source: 'manual_seed',
      title: 'Senior Frontend Engineer',
      company: 'ExampleTech',
      location: 'Remote (USA)',
      salary: '$150k - $180k',
      description: 'ExampleTech is hiring a Senior Frontend Engineer to build next-generation resume automation tools.',
      requirements: '5+ years experience with React and TypeScript. Experience shipping production systems.',
      applyUrl: 'https://exampletech.com/jobs/frontend-engineer',
      companyUrl: 'https://exampletech.com',
      atsType: 'GREENHOUSE',
      atsCompany: 'exampletech',
      atsComplexity: 'SIMPLE',
      atsConfidence: 0.95,
      aiApplyable: true,
      extractedSkills: ['React', 'TypeScript', 'TailwindCSS'],
      extractedExperience: '5+ years',
      extractedEducation: 'Bachelor\'s degree',
      extractedJobLevel: 'Senior',
      extractedKeywords: ['Frontend', 'React', 'TypeScript'],
      extractedBenefits: ['Remote', 'Health Insurance', 'Equity'],
      lastExtractedAt: now,
      extractionConfidence: 0.9,
      postedDate: now,
      expiresAt: null,
      lastChecked: now,
      isActive: true
    },
    {
      id: 'sample-job-2',
      externalId: 'sample_job_lever_1',
      source: 'manual_seed',
      title: 'AI Resume Coach',
      company: 'CareerPilot',
      location: 'Austin, TX (Hybrid)',
      salary: '$120k - $140k',
      description: 'Join CareerPilot to build AI tools that help candidates land their dream jobs.',
      requirements: '3+ years experience with Node.js and AI tooling. Passion for helping job seekers.',
      applyUrl: 'https://careerpilot.ai/jobs/ai-resume-coach',
      companyUrl: 'https://careerpilot.ai',
      atsType: 'LEVER',
      atsCompany: 'careerpilot',
      atsComplexity: 'MODERATE',
      atsConfidence: 0.9,
      aiApplyable: true,
      extractedSkills: ['Node.js', 'OpenAI', 'Express'],
      extractedExperience: '3+ years',
      extractedEducation: null,
      extractedJobLevel: 'Mid-level',
      extractedKeywords: ['AI', 'Resume', 'Coaching'],
      extractedBenefits: ['Hybrid', 'Wellness Stipend'],
      lastExtractedAt: now,
      extractionConfidence: 0.85,
      postedDate: now,
      expiresAt: null,
      lastChecked: now,
      isActive: true
    },
    {
      id: 'sample-job-3',
      externalId: 'sample_job_workday_1',
      source: 'manual_seed',
      title: 'Automation QA Engineer',
      company: 'LaunchWorks',
      location: 'New York, NY',
      salary: '$110k - $130k',
      description: 'LaunchWorks is scaling its automation team to test AI-driven job application flows.',
      requirements: '4+ years QA automation experience. Familiar with Playwright or Puppeteer.',
      applyUrl: 'https://launchworks.com/careers/automation-qa',
      companyUrl: 'https://launchworks.com',
      atsType: 'WORKDAY',
      atsCompany: 'launchworks',
      atsComplexity: 'COMPLEX',
      atsConfidence: 0.8,
      aiApplyable: false,
      extractedSkills: ['Puppeteer', 'QA Automation', 'CI/CD'],
      extractedExperience: '4+ years',
      extractedEducation: null,
      extractedJobLevel: 'Mid-level',
      extractedKeywords: ['Automation', 'Puppeteer'],
      extractedBenefits: ['401k match', 'Commuter benefits'],
      lastExtractedAt: now,
      extractionConfidence: 0.75,
      postedDate: now,
      expiresAt: null,
      lastChecked: now,
      isActive: true
    }
  ];
}

async function upsertSampleJobs(jobs) {
  for (const job of jobs) {
    await prisma.aggregatedJob.upsert({
      where: { externalId: job.externalId },
      update: job,
      create: job
    });
  }
}

async function upsertSampleRecipes() {
  const now = new Date();
  const recipes = [
    {
      id: 'sample-recipe-greenhouse',
      platform: 'greenhouse_generic',
      atsType: 'GREENHOUSE',
      version: 1,
      steps: [
        { action: 'type', selector: "input[name='first_name']", value: "{{personalInfo.firstName}}" },
        { action: 'type', selector: "input[name='last_name']", value: "{{personalInfo.lastName}}" },
        { action: 'type', selector: "input[name='email']", value: '{{personalInfo.email}}' }
      ],
      successRate: 1,
      timesUsed: 0,
      failureCount: 0,
      recordingCost: 0.8,
      replayCost: 0.05,
      totalSaved: 0,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
      lastFailure: null,
      recordedBy: 'system'
    }
  ];

  for (const recipe of recipes) {
    const { id, createdAt, ...updateData } = recipe;
    updateData.updatedAt = now;
    await prisma.applicationRecipe.upsert({
      where: { platform: recipe.platform },
      update: updateData,
      create: recipe
    });
  }
}

async function populateJobs() {
  await ensureTables();

  console.log('Attempting to sync jobs from external sources...');
  try {
    const syncResult = await jobSyncService.syncNow({});
    if (syncResult?.success) {
      console.log(`Job sync completed: ${syncResult.saved} new, ${syncResult.updated} updated.`);
    } else {
      console.log('Job sync did not complete successfully. Fallback to sample data.');
    }
  } catch (error) {
    console.log(`Job sync service encountered an error: ${error.message}. Falling back to sample data.`);
  }

  const jobCount = await prisma.aggregatedJob.count();
  if (jobCount === 0) {
    const jobs = buildSampleJobs();
    await upsertSampleJobs(jobs);
    await upsertSampleRecipes();
    console.log(`Seeded ${jobs.length} sample jobs and a sample application recipe.`);
  } else {
    console.log(`Database already contains ${jobCount} jobs. No sample data inserted.`);
  }
}

populateJobs()
  .then(() => {
    console.log('Job population complete.');
  })
  .catch(error => {
    console.error('Job population failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
