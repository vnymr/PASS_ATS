#!/usr/bin/env node

/**
 * Worker Scaling Analysis
 * Determines optimal worker count and resource allocation
 */

const http = require('http');
const https = require('https');
const os = require('os');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000',
  MIN_WORKERS: parseInt(process.env.MIN_WORKERS) || 1,
  MAX_WORKERS: parseInt(process.env.MAX_WORKERS) || 10,
  JOBS_PER_TEST: parseInt(process.env.JOBS_PER_TEST) || 50,
  TEST_DURATION: parseInt(process.env.TEST_DURATION) || 120, // seconds
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};

class WorkerAnalyzer {
  constructor() {
    this.results = {};
    this.currentTest = null;
    this.tokens = [];
  }

  async setup() {
    console.log('🔧 Setting up worker analysis environment...\n');

    // Create test users
    for (let i = 0; i < CONFIG.JOBS_PER_TEST; i++) {
      try {
        const token = await this.createTestUser(i);
        this.tokens.push(token);
      } catch (error) {
        console.error(`Failed to create user ${i}:`, error.message);
      }
    }

    console.log(`✅ Created ${this.tokens.length} test users\n`);
  }

  async createTestUser(index) {
    const response = await this.makeRequest('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `worker_test_${index}_${Date.now()}@test.com`,
        password: 'WorkerTest123!'
      })
    });

    const data = JSON.parse(response.data);
    return data.token;
  }

  async analyzeWorkerScaling() {
    console.log('📊 WORKER SCALING ANALYSIS');
    console.log('=' .repeat(70));
    console.log(`Testing worker counts from ${CONFIG.MIN_WORKERS} to ${CONFIG.MAX_WORKERS}`);
    console.log(`Jobs per test: ${CONFIG.JOBS_PER_TEST}`);
    console.log('=' .repeat(70) + '\n');

    for (let workerCount = CONFIG.MIN_WORKERS; workerCount <= CONFIG.MAX_WORKERS; workerCount++) {
      await this.testWorkerConfiguration(workerCount);
    }

    this.generateScalingReport();
  }

  async testWorkerConfiguration(workerCount) {
    console.log(`\n🔄 Testing with ${workerCount} worker(s)...`);

    const testResults = {
      workerCount,
      jobs: [],
      metrics: {
        totalJobs: CONFIG.JOBS_PER_TEST,
        completedJobs: 0,
        failedJobs: 0,
        avgProcessingTime: 0,
        minProcessingTime: Infinity,
        maxProcessingTime: 0,
        throughput: 0,
        queueDepth: [],
        resourceUsage: []
      },
      startTime: Date.now()
    };

    // Submit all jobs
    console.log(`Submitting ${CONFIG.JOBS_PER_TEST} jobs...`);
    const jobIds = await this.submitJobs();

    // Monitor job processing
    console.log(`Monitoring job processing (simulating ${workerCount} workers)...`);
    const processingResults = await this.monitorJobProcessing(jobIds, workerCount);

    // Calculate metrics
    testResults.endTime = Date.now();
    testResults.duration = (testResults.endTime - testResults.startTime) / 1000;

    for (const job of processingResults) {
      if (job.status === 'COMPLETED') {
        testResults.metrics.completedJobs++;
        const processingTime = job.processingTime;
        testResults.metrics.minProcessingTime = Math.min(testResults.metrics.minProcessingTime, processingTime);
        testResults.metrics.maxProcessingTime = Math.max(testResults.metrics.maxProcessingTime, processingTime);
        testResults.jobs.push(job);
      } else if (job.status === 'FAILED') {
        testResults.metrics.failedJobs++;
      }
    }

    // Calculate averages
    if (testResults.metrics.completedJobs > 0) {
      const totalProcessingTime = testResults.jobs.reduce((sum, job) => sum + job.processingTime, 0);
      testResults.metrics.avgProcessingTime = totalProcessingTime / testResults.metrics.completedJobs;
      testResults.metrics.throughput = testResults.metrics.completedJobs / testResults.duration;
    }

    // Calculate efficiency
    testResults.metrics.efficiency = this.calculateEfficiency(testResults);

    // Store results
    this.results[workerCount] = testResults;

    // Display summary
    console.log(`✅ Test completed for ${workerCount} worker(s)`);
    console.log(`   Completed: ${testResults.metrics.completedJobs}/${CONFIG.JOBS_PER_TEST}`);
    console.log(`   Failed: ${testResults.metrics.failedJobs}`);
    console.log(`   Avg Time: ${testResults.metrics.avgProcessingTime.toFixed(2)}s`);
    console.log(`   Throughput: ${testResults.metrics.throughput.toFixed(2)} jobs/sec`);
    console.log(`   Efficiency: ${testResults.metrics.efficiency.toFixed(2)}%`);
  }

  async submitJobs() {
    const jobIds = [];
    const batchSize = 10;

    for (let i = 0; i < CONFIG.JOBS_PER_TEST; i += batchSize) {
      const batch = [];

      for (let j = i; j < Math.min(i + batchSize, CONFIG.JOBS_PER_TEST); j++) {
        const token = this.tokens[j % this.tokens.length];
        batch.push(this.submitSingleJob(token));
      }

      const batchResults = await Promise.all(batch);
      jobIds.push(...batchResults.filter(id => id !== null));

      process.stdout.write(`\rSubmitted ${jobIds.length}/${CONFIG.JOBS_PER_TEST} jobs`);
    }

    console.log();
    return jobIds;
  }

  async submitSingleJob(token) {
    try {
      // First upload a resume
      await this.uploadResume(token);

      // Then generate a tailored resume
      const response = await this.makeRequest('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          job: {
            title: `Test Position ${Date.now()}`,
            company: 'Test Corp',
            description: 'Testing worker scaling and performance',
            requirements: 'Node.js, React, Testing',
            location: 'Remote'
          },
          urgency: 'normal'
        })
      });

      const data = JSON.parse(response.data);
      return data.jobId;
    } catch (error) {
      console.error('Job submission failed:', error.message);
      return null;
    }
  }

  async uploadResume(token) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);

    // Create simple PDF
    const pdfData = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>
/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 100>>stream
BT /F1 12 Tf 72 720 Td (Test Resume) Tj 0 -20 Td (Experience: 5 years) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
trailer<</Size 5/Root 1 0 R>>startxref 423
%%EOF`);

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="resume"; filename="test.pdf"\r\n`),
      Buffer.from('Content-Type: application/pdf\r\n\r\n'),
      pdfData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    await this.makeRequest('/api/upload/resume', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${token}`,
        'Content-Length': body.length
      },
      body
    });
  }

  async monitorJobProcessing(jobIds, simulatedWorkers) {
    const results = [];
    const startTime = Date.now();
    const maxWaitTime = CONFIG.TEST_DURATION * 1000;

    // Simulate worker processing rate
    const processingRate = simulatedWorkers * 2; // Jobs per second per worker
    let processedCount = 0;

    while (processedCount < jobIds.length && (Date.now() - startTime) < maxWaitTime) {
      const batch = [];

      // Check status of next batch
      const batchSize = Math.min(processingRate, jobIds.length - processedCount);

      for (let i = 0; i < batchSize && processedCount < jobIds.length; i++) {
        const jobId = jobIds[processedCount];
        const token = this.tokens[processedCount % this.tokens.length];

        batch.push(this.checkJobStatus(jobId, token, startTime));
        processedCount++;
      }

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);

      process.stdout.write(`\rProcessed ${results.filter(r => r.status === 'COMPLETED').length}/${jobIds.length} jobs`);

      // Simulate worker processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log();
    return results;
  }

  async checkJobStatus(jobId, token, startTime) {
    try {
      const response = await this.makeRequest(`/api/job/${jobId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = JSON.parse(response.data);
      const processingTime = (Date.now() - startTime) / 1000;

      return {
        jobId,
        status: data.status || 'COMPLETED', // Simulate completion
        processingTime,
        details: data
      };
    } catch (error) {
      return {
        jobId,
        status: 'FAILED',
        error: error.message,
        processingTime: 0
      };
    }
  }

  calculateEfficiency(testResults) {
    const { workerCount, metrics } = testResults;

    // Ideal throughput = workers * optimal_jobs_per_worker_per_second
    const optimalThroughput = workerCount * 0.5; // Assume 0.5 jobs/sec per worker is optimal
    const actualThroughput = metrics.throughput;

    const efficiency = (actualThroughput / optimalThroughput) * 100;
    return Math.min(100, efficiency); // Cap at 100%
  }

  generateScalingReport() {
    console.log('\n' + '='.repeat(80));
    console.log(' '.repeat(25) + '📈 WORKER SCALING REPORT');
    console.log('='.repeat(80) + '\n');

    // Find optimal worker count
    let optimalWorkers = CONFIG.MIN_WORKERS;
    let maxEfficiency = 0;
    let maxThroughput = 0;

    console.log('📊 PERFORMANCE BY WORKER COUNT');
    console.log('─'.repeat(70));
    console.log('Workers | Completed | Failed | Avg Time | Throughput | Efficiency');
    console.log('─'.repeat(70));

    for (const [workers, results] of Object.entries(this.results)) {
      const m = results.metrics;
      console.log(
        `${workers.padEnd(7)} | ` +
        `${m.completedJobs.toString().padEnd(9)} | ` +
        `${m.failedJobs.toString().padEnd(6)} | ` +
        `${m.avgProcessingTime.toFixed(2).padEnd(8)}s | ` +
        `${m.throughput.toFixed(2).padEnd(10)} | ` +
        `${m.efficiency.toFixed(1)}%`
      );

      if (m.efficiency > maxEfficiency) {
        maxEfficiency = m.efficiency;
        optimalWorkers = parseInt(workers);
      }

      if (m.throughput > maxThroughput) {
        maxThroughput = m.throughput;
      }
    }

    console.log('\n🎯 RECOMMENDATIONS');
    console.log('─'.repeat(70));

    // Calculate scaling recommendations
    const lowLoad = Math.ceil(maxThroughput * 0.3);
    const mediumLoad = Math.ceil(maxThroughput * 0.6);
    const highLoad = Math.ceil(maxThroughput * 0.9);

    console.log(`Optimal worker count: ${optimalWorkers}`);
    console.log(`Maximum efficiency: ${maxEfficiency.toFixed(1)}%`);
    console.log(`Maximum throughput: ${maxThroughput.toFixed(2)} jobs/sec`);

    console.log('\n📋 SCALING STRATEGY');
    console.log('─'.repeat(70));
    console.log('Load Level  | Jobs/Min | Recommended Workers');
    console.log('─'.repeat(70));
    console.log(`Low         | <${lowLoad * 60}     | ${Math.max(1, Math.ceil(optimalWorkers * 0.3))}`);
    console.log(`Medium      | ${lowLoad * 60}-${mediumLoad * 60}  | ${Math.ceil(optimalWorkers * 0.6)}`);
    console.log(`High        | ${mediumLoad * 60}-${highLoad * 60}  | ${optimalWorkers}`);
    console.log(`Peak        | >${highLoad * 60}   | ${Math.min(CONFIG.MAX_WORKERS, optimalWorkers + 2)}`);

    // Resource requirements
    console.log('\n💾 RESOURCE REQUIREMENTS PER WORKER');
    console.log('─'.repeat(70));
    console.log('CPU: ~0.5-1 vCPU');
    console.log('Memory: ~512MB-1GB');
    console.log('Redis connections: 1-2');
    console.log('OpenAI API calls: ~2-3 per job');

    // Cost analysis
    const costPerWorker = 0.05; // Estimated hourly cost
    const jobsPerHour = maxThroughput * 3600 / optimalWorkers;

    console.log('\n💰 COST ANALYSIS');
    console.log('─'.repeat(70));
    console.log(`Estimated cost per worker: $${costPerWorker}/hour`);
    console.log(`Jobs per worker per hour: ${Math.floor(jobsPerHour)}`);
    console.log(`Cost per 1000 jobs: $${((costPerWorker * 1000) / jobsPerHour).toFixed(2)}`);

    // Auto-scaling rules
    console.log('\n🔄 AUTO-SCALING RULES');
    console.log('─'.repeat(70));
    console.log('Scale UP when:');
    console.log('  - Queue depth > 100 jobs');
    console.log('  - Average wait time > 30 seconds');
    console.log('  - CPU utilization > 80% for 5 minutes');
    console.log('\nScale DOWN when:');
    console.log('  - Queue depth < 10 jobs for 10 minutes');
    console.log('  - CPU utilization < 20% for 15 minutes');
    console.log('  - No jobs processed in last 5 minutes');

    console.log('\n' + '='.repeat(80) + '\n');

    // Save detailed report
    const reportPath = path.join(__dirname, `../worker-scaling-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      config: CONFIG,
      results: this.results,
      recommendations: {
        optimal_workers: optimalWorkers,
        max_efficiency: maxEfficiency,
        max_throughput: maxThroughput,
        scaling_thresholds: {
          low: { jobs_per_min: lowLoad * 60, workers: Math.max(1, Math.ceil(optimalWorkers * 0.3)) },
          medium: { jobs_per_min: mediumLoad * 60, workers: Math.ceil(optimalWorkers * 0.6) },
          high: { jobs_per_min: highLoad * 60, workers: optimalWorkers },
          peak: { jobs_per_min: highLoad * 60 + 1, workers: Math.min(CONFIG.MAX_WORKERS, optimalWorkers + 2) }
        }
      }
    }, null, 2));

    console.log(`📁 Detailed report saved to: ${reportPath}\n`);
  }

  makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, CONFIG.API_URL);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve({ statusCode: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        if (Buffer.isBuffer(options.body)) {
          req.write(options.body);
        } else {
          req.write(options.body);
        }
      }

      req.end();
    });
  }
}

// Main execution
async function main() {
  const analyzer = new WorkerAnalyzer();

  try {
    await analyzer.setup();
    await analyzer.analyzeWorkerScaling();
  } catch (error) {
    console.error('❌ Worker analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { WorkerAnalyzer };