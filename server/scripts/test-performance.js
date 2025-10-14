/**
 * Performance Test for Resume Generation
 * Target: Complete generation in under 40 seconds
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN;

// Test job description - realistic size
const TEST_JOB_DESCRIPTION = `Senior Software Engineer - Backend Infrastructure
Google - Mountain View, CA

About the Role:
We're looking for an experienced Senior Software Engineer to join our Backend Infrastructure team. You'll be working on systems that power products used by billions of users worldwide.

Requirements:
- 5+ years of software development experience
- Strong proficiency in Python, Java, or Go
- Experience with distributed systems and microservices architecture
- Knowledge of cloud platforms (GCP, AWS, or Azure)
- Experience with Kubernetes, Docker, and containerization
- Strong understanding of system design and scalability
- Experience with SQL and NoSQL databases (PostgreSQL, MongoDB, Redis)
- Proficiency in CI/CD pipelines and DevOps practices

Responsibilities:
- Design and implement highly scalable backend services
- Optimize system performance and reliability
- Collaborate with cross-functional teams on architecture decisions
- Mentor junior engineers and conduct code reviews
- Participate in on-call rotation for production systems
- Write comprehensive documentation and tests

Nice to Have:
- Experience with machine learning infrastructure
- Contributions to open-source projects
- Advanced degree in Computer Science
- Experience with gRPC and Protocol Buffers
- Knowledge of observability tools (Prometheus, Grafana)

Benefits:
- Competitive salary ($180k-$280k + equity)
- Comprehensive health, dental, and vision coverage
- 401(k) matching
- Unlimited PTO
- Learning and development budget
- Free meals and gym membership`;

async function performanceTest() {
  console.log('⏱️  PERFORMANCE TEST - Resume Generation');
  console.log('Target: Complete in under 40 seconds\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Verify token
  if (!TEST_TOKEN) {
    console.error('❌ ERROR: TEST_TOKEN environment variable not set');
    console.error('   Usage: TEST_TOKEN="your-token" node scripts/test-performance.js');
    process.exit(1);
  }

  const timings = {
    jobCreation: 0,
    jobProcessing: 0,
    pdfDownload: 0,
    total: 0
  };

  const overallStart = Date.now();

  try {
    // STEP 1: Create job
    console.log('📝 Step 1: Creating job...');
    const createStart = Date.now();

    const createResponse = await fetch(`${API_BASE}/api/process-job`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobDescription: TEST_JOB_DESCRIPTION,
        profileId: 1
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Job creation failed (${createResponse.status}): ${errorText}`);
    }

    const createData = await createResponse.json();
    timings.jobCreation = Date.now() - createStart;

    console.log(`   ✅ Job created: ${createData.jobId}`);
    console.log(`   ⏱️  Time: ${timings.jobCreation}ms\n`);

    const jobId = createData.jobId;

    // STEP 2: Poll for completion
    console.log('⏳ Step 2: Waiting for job completion...');
    const pollStart = Date.now();

    let attempts = 0;
    let completed = false;
    let lastStatus = null;
    const MAX_WAIT_TIME = 90000; // 90 seconds max
    const POLL_INTERVAL = 1000; // Poll every 1 second

    while (Date.now() - pollStart < MAX_WAIT_TIME && !completed) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

      const statusResponse = await fetch(`${API_BASE}/api/job/${jobId}/status`, {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      lastStatus = statusData;

      const elapsed = Math.round((Date.now() - pollStart) / 1000);
      process.stdout.write(`\r   [${attempts}] ${statusData.status} | Progress: ${statusData.progress || 0}% | Elapsed: ${elapsed}s`);

      if (statusData.status === 'COMPLETED') {
        completed = true;
        process.stdout.write('\n');
        console.log(`   ✅ Job completed!`);
        console.log(`   📊 Company: ${statusData.company || 'N/A'}`);
        console.log(`   📊 Role: ${statusData.role || 'N/A'}`);

        // Display diagnostics if available
        if (statusData.diagnostics) {
          const diag = statusData.diagnostics;
          console.log(`   📊 Diagnostics:`);
          console.log(`      - Model: ${diag.model || 'N/A'}`);
          console.log(`      - Attempts: ${diag.attempts || 1}`);
          console.log(`      - Page Count: ${diag.pageCount || 'N/A'}`);
          console.log(`      - Trim Attempts: ${diag.trimAttempts || 0}`);
          console.log(`      - Is One Page: ${diag.isOnePage ? '✅' : '❌'}`);
          console.log(`      - ATS Score: ${diag.atsOptimization?.atsScore || 'N/A'}`);

          if (diag.timings) {
            console.log(`      - LaTeX Gen: ${diag.timings.latexGeneration || 'N/A'}ms`);
            console.log(`      - Compilation: ${diag.timings.compilation || 'N/A'}ms`);
            console.log(`      - Total Processing: ${diag.totalTimeMs || 'N/A'}ms`);
          }
        }
      } else if (statusData.status === 'FAILED') {
        process.stdout.write('\n');
        throw new Error(`Job failed: ${statusData.error || 'Unknown error'}`);
      }
    }

    if (!completed) {
      throw new Error(`Job timeout - took longer than ${MAX_WAIT_TIME / 1000} seconds`);
    }

    timings.jobProcessing = Date.now() - pollStart;
    console.log(`   ⏱️  Processing Time: ${timings.jobProcessing}ms (${(timings.jobProcessing / 1000).toFixed(2)}s)\n`);

    // STEP 3: Download PDF
    console.log('📥 Step 3: Downloading PDF...');
    const downloadStart = Date.now();

    const pdfResponse = await fetch(`${API_BASE}/api/job/${jobId}/download/pdf`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    if (!pdfResponse.ok) {
      throw new Error(`PDF download failed: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.buffer();
    timings.pdfDownload = Date.now() - downloadStart;

    const isPdf = pdfBuffer.toString('ascii', 0, 4) === '%PDF';
    const sizeKB = (pdfBuffer.length / 1024).toFixed(2);

    console.log(`   ✅ PDF downloaded`);
    console.log(`   📊 Size: ${sizeKB} KB`);
    console.log(`   📊 Valid PDF: ${isPdf ? '✅' : '❌'}`);
    console.log(`   ⏱️  Download Time: ${timings.pdfDownload}ms\n`);

    // Calculate total time
    timings.total = Date.now() - overallStart;

    // RESULTS
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 PERFORMANCE TEST RESULTS\n');
    console.log(`Total Time: ${(timings.total / 1000).toFixed(2)}s`);
    console.log(`   - Job Creation: ${(timings.jobCreation / 1000).toFixed(2)}s`);
    console.log(`   - Job Processing: ${(timings.jobProcessing / 1000).toFixed(2)}s`);
    console.log(`   - PDF Download: ${(timings.pdfDownload / 1000).toFixed(2)}s\n`);

    // Check against 40-second target
    const targetSeconds = 40;
    const actualSeconds = timings.total / 1000;

    if (actualSeconds <= targetSeconds) {
      console.log(`✅ SUCCESS: Completed in ${actualSeconds.toFixed(2)}s (under ${targetSeconds}s target)`);
      console.log(`   Performance margin: ${(targetSeconds - actualSeconds).toFixed(2)}s to spare\n`);
    } else {
      console.log(`⚠️  WARNING: Completed in ${actualSeconds.toFixed(2)}s (exceeded ${targetSeconds}s target)`);
      console.log(`   Performance gap: ${(actualSeconds - targetSeconds).toFixed(2)}s over target\n`);
      console.log('   Recommendations:');

      if (timings.jobProcessing / timings.total > 0.8) {
        console.log('   - Job processing is the bottleneck (>80% of time)');
        console.log('   - Check AI provider latency (Gemini vs OpenAI)');
        console.log('   - Review LaTeX compilation time');
      }
      if (lastStatus?.diagnostics?.trimAttempts > 0) {
        console.log('   - Resume required trimming (adds extra compilation time)');
        console.log('   - Consider adjusting prompt to generate less content initially');
      }
      console.log('');
    }

    // Breakdown percentages
    console.log('Time Breakdown:');
    console.log(`   - Job Creation: ${((timings.jobCreation / timings.total) * 100).toFixed(1)}%`);
    console.log(`   - Job Processing: ${((timings.jobProcessing / timings.total) * 100).toFixed(1)}%`);
    console.log(`   - PDF Download: ${((timings.pdfDownload / timings.total) * 100).toFixed(1)}%\n`);

    console.log('═══════════════════════════════════════════════════════════');

    // Exit with appropriate code
    process.exit(actualSeconds <= targetSeconds ? 0 : 1);

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(`   Error: ${error.message}`);
    console.error(`   Total time before failure: ${((Date.now() - overallStart) / 1000).toFixed(2)}s\n`);
    process.exit(1);
  }
}

// Run test
performanceTest();
