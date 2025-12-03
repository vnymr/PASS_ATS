/**
 * Test script to verify Tier 1 ATS APIs
 * Tests: Greenhouse, Lever, Ashby, Workable, SmartRecruiters
 */

const testCompanies = {
  greenhouse: ['stripe', 'airbnb', 'coinbase', 'openai', 'notion'],
  lever: ['netflix', 'shopify', 'cloudflare', 'figma', 'discord'],
  ashby: ['linear', 'ramp', 'vanta', 'scale', 'anduril'],
  workable: ['spotify-jobs', 'zapier', 'automattic'],
  smartrecruiters: ['visa', 'linkedin', 'bosch']
};

async function testGreenhouseAPI(company) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { company, status: res.status, jobs: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    const jobs = data.jobs || [];

    // Check freshness - get newest job date
    let newestDate = null;
    if (jobs.length > 0 && jobs[0].updated_at) {
      newestDate = new Date(jobs[0].updated_at);
    }

    return {
      company,
      status: 200,
      jobs: jobs.length,
      newestJob: newestDate ? newestDate.toISOString() : 'N/A',
      sampleJob: jobs[0] ? { title: jobs[0].title, url: jobs[0].absolute_url } : null
    };
  } catch (e) {
    return { company, status: 'error', jobs: 0, error: e.message };
  }
}

async function testLeverAPI(company) {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { company, status: res.status, jobs: 0, error: `HTTP ${res.status}` };
    const jobs = await res.json();

    // Check freshness
    let newestDate = null;
    if (jobs.length > 0 && jobs[0].createdAt) {
      newestDate = new Date(jobs[0].createdAt);
    }

    return {
      company,
      status: 200,
      jobs: jobs.length,
      newestJob: newestDate ? newestDate.toISOString() : 'N/A',
      sampleJob: jobs[0] ? { title: jobs[0].text, url: jobs[0].hostedUrl } : null
    };
  } catch (e) {
    return { company, status: 'error', jobs: 0, error: e.message };
  }
}

async function testAshbyAPI(company) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { company, status: res.status, jobs: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    const jobs = data.jobs || [];

    return {
      company,
      status: 200,
      jobs: jobs.length,
      sampleJob: jobs[0] ? { title: jobs[0].title, url: `https://jobs.ashbyhq.com/${company}/${jobs[0].id}` } : null
    };
  } catch (e) {
    return { company, status: 'error', jobs: 0, error: e.message };
  }
}

async function testWorkableAPI(company) {
  const url = `https://apply.workable.com/api/v1/widget/accounts/${company}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { company, status: res.status, jobs: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    const jobs = data.jobs || [];

    return {
      company,
      status: 200,
      jobs: jobs.length,
      sampleJob: jobs[0] ? { title: jobs[0].title, url: jobs[0].url } : null
    };
  } catch (e) {
    return { company, status: 'error', jobs: 0, error: e.message };
  }
}

async function testSmartRecruitersAPI(company) {
  const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { company, status: res.status, jobs: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    const jobs = data.content || [];

    return {
      company,
      status: 200,
      jobs: jobs.length,
      sampleJob: jobs[0] ? { title: jobs[0].name, url: jobs[0].ref } : null
    };
  } catch (e) {
    return { company, status: 'error', jobs: 0, error: e.message };
  }
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('TIER 1 ATS API TEST');
  console.log('='.repeat(60));
  console.log('');

  // Test Greenhouse
  console.log('🌱 GREENHOUSE API');
  console.log('-'.repeat(40));
  for (const company of testCompanies.greenhouse) {
    const result = await testGreenhouseAPI(company);
    const status = result.status === 200 ? '✅' : '❌';
    console.log(`${status} ${company}: ${result.jobs} jobs`);
    if (result.sampleJob) console.log(`   └─ Sample: ${result.sampleJob.title}`);
    if (result.newestJob) console.log(`   └─ Newest: ${result.newestJob}`);
  }
  console.log('');

  // Test Lever
  console.log('🔧 LEVER API');
  console.log('-'.repeat(40));
  for (const company of testCompanies.lever) {
    const result = await testLeverAPI(company);
    const status = result.status === 200 ? '✅' : '❌';
    console.log(`${status} ${company}: ${result.jobs} jobs`);
    if (result.sampleJob) console.log(`   └─ Sample: ${result.sampleJob.title}`);
    if (result.newestJob) console.log(`   └─ Newest: ${result.newestJob}`);
  }
  console.log('');

  // Test Ashby
  console.log('🏢 ASHBY API');
  console.log('-'.repeat(40));
  for (const company of testCompanies.ashby) {
    const result = await testAshbyAPI(company);
    const status = result.status === 200 ? '✅' : '❌';
    console.log(`${status} ${company}: ${result.jobs} jobs`);
    if (result.sampleJob) console.log(`   └─ Sample: ${result.sampleJob.title}`);
  }
  console.log('');

  // Test Workable
  console.log('💼 WORKABLE API');
  console.log('-'.repeat(40));
  for (const company of testCompanies.workable) {
    const result = await testWorkableAPI(company);
    const status = result.status === 200 ? '✅' : '❌';
    console.log(`${status} ${company}: ${result.jobs} jobs`);
    if (result.sampleJob) console.log(`   └─ Sample: ${result.sampleJob.title}`);
  }
  console.log('');

  // Test SmartRecruiters
  console.log('🎯 SMARTRECRUITERS API');
  console.log('-'.repeat(40));
  for (const company of testCompanies.smartrecruiters) {
    const result = await testSmartRecruitersAPI(company);
    const status = result.status === 200 ? '✅' : '❌';
    console.log(`${status} ${company}: ${result.jobs} jobs`);
    if (result.sampleJob) console.log(`   └─ Sample: ${result.sampleJob.title}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

runAllTests();
