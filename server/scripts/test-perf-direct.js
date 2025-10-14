/**
 * Direct Performance Test - bypasses API auth
 * Tests the job processor directly
 */

import { processResumeJob } from '../lib/job-processor.js';
import { prisma } from '../lib/prisma-client.js';

const TEST_JOB_DESCRIPTION = `Senior Software Engineer - Backend Infrastructure
Google - Mountain View, CA

About the Role:
We're looking for an experienced Senior Software Engineer to join our Backend Infrastructure team.

Requirements:
- 5+ years of software development experience
- Strong proficiency in Python, Java, or Go
- Experience with distributed systems and microservices
- Knowledge of cloud platforms (GCP, AWS, Azure)
- Experience with Kubernetes, Docker, containers
- SQL and NoSQL databases (PostgreSQL, MongoDB, Redis)
- CI/CD pipelines and DevOps practices

Responsibilities:
- Design and implement highly scalable backend services
- Optimize system performance and reliability
- Collaborate with cross-functional teams
- Mentor junior engineers and conduct code reviews
- Participate in on-call rotation

Benefits:
- Competitive salary ($180k-$280k + equity)
- Comprehensive health benefits
- Unlimited PTO`;

async function directPerformanceTest() {
  console.log('⏱️  DIRECT PERFORMANCE TEST');
  console.log('Target: <40 seconds total processing time\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const overallStart = Date.now();

  try {
    // Get user profile from database (user ID 3 from previous tests)
    console.log('📝 Fetching user profile...');
    const profile = await prisma.profile.findUnique({
      where: { userId: 3 },
      include: {
        experience: true,
        education: true,
        skills: true,
        projects: true
      }
    });

    if (!profile) {
      throw new Error('Profile not found for user ID 3');
    }

    console.log(`   ✅ Profile loaded: ${profile.name || 'No name'}`);
    console.log(`   📊 Experience entries: ${profile.experience?.length || 0}`);
    console.log(`   📊 Skills: ${profile.skills?.length || 0}\n`);

    // Create job in database
    console.log('📝 Creating job record...');
    const job = await prisma.job.create({
      data: {
        userId: 3,
        status: 'PENDING',
        jobDescription: TEST_JOB_DESCRIPTION
      }
    });

    console.log(`   ✅ Job created: ${job.id}\n`);

    // Prepare profile data
    const profileData = {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin: profile.linkedinUrl,
      website: profile.websiteUrl,
      experience: profile.experience || [],
      education: profile.education || [],
      skills: profile.skills || [],
      projects: profile.projects || []
    };

    // Track progress
    let lastProgress = 0;
    const progressCallback = (progress) => {
      if (typeof progress === 'number' && progress > lastProgress) {
        process.stdout.write(`\r   Progress: ${progress}%`);
        lastProgress = progress;
      }
    };

    // Process the job
    console.log('⏳ Processing resume generation...');
    const processStart = Date.now();

    await processResumeJob({
      jobId: job.id,
      profileData,
      jobDescription: TEST_JOB_DESCRIPTION
    }, progressCallback);

    const processTime = Date.now() - processStart;
    process.stdout.write('\n');
    console.log(`   ✅ Processing complete!`);
    console.log(`   ⏱️  Processing time: ${(processTime / 1000).toFixed(2)}s\n`);

    // Fetch updated job
    const updatedJob = await prisma.job.findUnique({
      where: { id: job.id },
      include: { artifacts: true }
    });

    if (updatedJob.status === 'COMPLETED') {
      console.log('✅ Job completed successfully');
      console.log(`   📊 Company: ${updatedJob.company || 'N/A'}`);
      console.log(`   📊 Role: ${updatedJob.role || 'N/A'}`);

      // Check diagnostics
      if (updatedJob.diagnostics) {
        const diag = updatedJob.diagnostics;
        console.log('\n📊 Diagnostics:');
        console.log(`   - Model: ${diag.model || 'N/A'}`);
        console.log(`   - Attempts: ${diag.attempts || 1}`);
        console.log(`   - Page Count: ${diag.pageCount || 'N/A'}`);
        console.log(`   - Is One Page: ${diag.isOnePage ? '✅ YES' : '❌ NO'}`);
        console.log(`   - Trim Attempts: ${diag.trimAttempts || 0}`);
        console.log(`   - ATS Score: ${diag.atsOptimization?.atsScore || 'N/A'}`);

        if (diag.timings) {
          console.log('\n⏱️  Internal Timings:');
          console.log(`   - LaTeX Generation: ${diag.timings.latexGeneration || 'N/A'}ms`);
          console.log(`   - Compilation: ${diag.timings.compilation || 'N/A'}ms`);
          console.log(`   - Total: ${diag.totalTimeMs || 'N/A'}ms (${(diag.totalTimeMs / 1000).toFixed(2)}s)`);
        }
      }

      // Check artifacts
      const pdfArtifact = updatedJob.artifacts.find(a => a.type === 'PDF_OUTPUT');
      if (pdfArtifact) {
        const sizeKB = (pdfArtifact.content.length / 1024).toFixed(2);
        console.log(`\n📄 PDF Generated:`);
        console.log(`   - Size: ${sizeKB} KB`);
        console.log(`   - Filename: ${pdfArtifact.metadata?.filename || 'N/A'}`);
      }
    } else {
      throw new Error(`Job failed with status: ${updatedJob.status}`);
    }

    const totalTime = Date.now() - overallStart;

    // RESULTS
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 PERFORMANCE TEST RESULTS\n');
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Processing Time: ${(processTime / 1000).toFixed(2)}s\n`);

    // Check against 40-second target
    const targetSeconds = 40;
    const actualSeconds = totalTime / 1000;

    if (actualSeconds <= targetSeconds) {
      console.log(`✅ SUCCESS: Completed in ${actualSeconds.toFixed(2)}s (under ${targetSeconds}s target)`);
      console.log(`   Performance margin: ${(targetSeconds - actualSeconds).toFixed(2)}s to spare`);
    } else {
      console.log(`⚠️  WARNING: Completed in ${actualSeconds.toFixed(2)}s (exceeded ${targetSeconds}s target)`);
      console.log(`   Performance gap: ${(actualSeconds - targetSeconds).toFixed(2)}s over target`);

      if (updatedJob.diagnostics?.trimAttempts > 0) {
        console.log('\n   ⚠️  Resume required trimming - this adds extra time');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.artifact.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
    console.log('   ✅ Cleanup complete\n');

    process.exit(actualSeconds <= targetSeconds ? 0 : 1);

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack?.substring(0, 300)}`);
    console.error(`   Total time before failure: ${((Date.now() - overallStart) / 1000).toFixed(2)}s\n`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
directPerformanceTest();
