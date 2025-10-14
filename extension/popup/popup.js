// API endpoints - used for data communication only, NOT for remote code execution
// All extension functionality is self-contained within this package
const API_BASE = 'https://api.happyresumes.com';
const WEB_BASE = 'https://happyresumes.com';
let currentJobs = new Map(); // jobId -> job data

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 HappyResumes popup loaded');

  // Add customize shortcut handler
  const customizeLink = document.getElementById('customize-shortcut');
  if (customizeLink) {
    customizeLink.onclick = (e) => {
      e.preventDefault();
      // Show user-friendly message instead of navigating to chrome:// URL
      alert('To customize keyboard shortcuts:\n\n1. Go to chrome://extensions/shortcuts\n2. Find "HappyResumes - AI Resume Builder"\n3. Set your preferred shortcut');
    };
  }

  // Check auth
  console.log('🔐 Checking for stored token...');
  const { clerk_session_token, user_email, clerk_token_updated_at } = await chrome.storage.local.get(['clerk_session_token', 'user_email', 'clerk_token_updated_at']);

  if (!clerk_session_token) {
    console.log('❌ No token found in storage');
    document.getElementById('auth-view').style.display = 'block';

    // Sign in button handler
    document.getElementById('signin-btn').onclick = () => {
      chrome.tabs.create({ url: `${WEB_BASE}/dashboard` });
      // Show instructions after clicking sign in
      document.getElementById('auth-instructions').style.display = 'block';
    };

    // Refresh button handler
    const refreshBtn = document.getElementById('refresh-auth');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        // Check again for token
        const { clerk_session_token: newToken } = await chrome.storage.local.get('clerk_session_token');
        if (newToken) {
          // Token found! Reload popup
          location.reload();
        } else {
          // Still no token
          refreshBtn.textContent = 'Still not connected - Try signing in again';
          refreshBtn.style.background = '#dc3545';
        }
      };
    }

    return;
  }

  document.getElementById('main-view').style.display = 'block';

  // Load usage and tier
  await loadUsageStats(clerk_session_token);

  // Check current page for job
  await checkCurrentPage(clerk_session_token);

  // Load recent jobs
  await loadRecentJobs(clerk_session_token);

  // Setup jobs list toggle
  document.getElementById('jobs-toggle').onclick = () => {
    const list = document.getElementById('jobs-list');
    list.classList.toggle('collapsed');
    document.querySelector('.toggle-icon').textContent =
      list.classList.contains('collapsed') ? '▼' : '▲';
  };

  // Check for active background jobs
  chrome.runtime.sendMessage({ action: 'GET_ACTIVE_JOBS' }, (response) => {
    if (response && response.jobs && response.jobs.length > 0) {
      // Expand jobs list if there are active jobs
      document.getElementById('jobs-list').classList.remove('collapsed');
      document.querySelector('.toggle-icon').textContent = '▲';
    }
  });
});

async function loadUsageStats(token) {
  try {
    const response = await fetch(`${API_BASE}/api/subscription`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    document.getElementById('tier-badge').textContent = data.tier || 'FREE';

    const usageResponse = await fetch(`${API_BASE}/api/usage`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const usage = await usageResponse.json();

    document.getElementById('usage-text').textContent =
      `${usage.resumesGenerated || 0}/${usage.dailyLimit}`;
  } catch (error) {
    console.error('Failed to load usage:', error);
  }
}

async function ensureScraperReady(tabId) {
  try {
    // Inject config first
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['utils/config.js']
    });

    // Wait a bit for config to load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Then inject API client
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['utils/api-client.js']
    });

    // Wait a bit for API client to load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Finally inject scraper
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/scraper.js']
    });

    // Wait for scraper to initialize
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('✅ All scripts injected and initialized');
    return true;
  } catch (error) {
    console.error('Failed to inject scraper scripts:', error);
    return false;
  }
}

async function checkCurrentPage(token) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    console.log('❌ No active tab found');
    showNoJob();
    return;
  }

  console.log('🔍 Checking page:', tab.url);

  // Ignore Chrome internal pages or extension pages where we can't scrape
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
    console.log('❌ Cannot run on Chrome internal pages');
    showNoJob();
    return;
  }

  const supportedSites = ['linkedin.com', 'indeed.com', 'glassdoor.com'];
  const isJobSite = supportedSites.some(site => tab.url.includes(site));

  console.log('🌐 Is job site?', isJobSite);

  if (isJobSite) {
    console.log('📝 Injecting scraper scripts...');
    const injected = await ensureScraperReady(tab.id);
    if (!injected) {
      console.error('❌ Failed to inject scripts');
      showNoJob();
      return;
    }

    // Try to scrape job info
    try {
      console.log('🔍 Attempting to extract job data...');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          console.log('📄 Checking for jobScraper...', typeof window.jobScraper);
          if (window.jobScraper) {
            console.log('✅ jobScraper found, extracting...');
            try {
              const jobData = window.jobScraper.extractJobContent();
              console.log('📦 Extracted data:', {
                hasMetadata: !!jobData.metadata,
                descriptionLength: jobData.fullDescription?.length,
                title: jobData.metadata?.title,
                company: jobData.metadata?.company
              });
              return {
                success: true,
                title: jobData.metadata?.title || 'Job Title',
                company: jobData.metadata?.company || 'Company',
                description: jobData.fullDescription,
                descriptionLength: jobData.fullDescription?.length || 0
              };
            } catch (err) {
              console.error('❌ Extraction error:', err);
              return { success: false, error: err.message };
            }
          }
          console.error('❌ jobScraper not found on window');
          return { success: false, error: 'jobScraper not initialized' };
        }
      });

      const result = results[0]?.result;
      console.log('📊 Scraping result:', result);

      if (result && result.success && result.description && result.descriptionLength > 100) {
        console.log('✅ Job detected:', result.title, '@', result.company);
        document.getElementById('job-detected').style.display = 'block';
        document.getElementById('no-job').style.display = 'none';
        document.getElementById('job-title').textContent = result.title;
        document.getElementById('job-company').textContent = result.company;

        document.getElementById('generate-btn').onclick = () => {
          generateResume(result, token);
        };
      } else {
        console.log('❌ No valid job found:', result?.error || 'No description or too short');
        showNoJob();
      }
    } catch (error) {
      console.error('❌ Failed to check page:', error);
      showNoJob();
    }
  } else {
    console.log('ℹ️ Not on a supported job site');
    showNoJob();
  }
}

function showNoJob() {
  document.getElementById('no-job').style.display = 'block';
  document.getElementById('job-detected').style.display = 'none';
}

async function generateResume(jobData, token) {
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Starting...';

  try {
    const response = await fetch(`${API_BASE}/api/process-job`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobDescription: jobData.description,
        profileId: 1
      })
    });

    const result = await response.json();

    if (response.ok) {
      // Tell background to track this job
      chrome.runtime.sendMessage({
        action: 'START_JOB',
        jobId: result.jobId,
        token: token,
        jobInfo: { company: jobData.company, title: jobData.title }
      });

      // Add to jobs list immediately
      addJobToList(result.jobId, jobData.company, jobData.title, 'PROCESSING');

      // Expand jobs list
      document.getElementById('jobs-list').classList.remove('collapsed');
      document.querySelector('.toggle-icon').textContent = '▲';

      btn.innerHTML = '<span class="icon">✓</span> Processing in background';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<span class="icon">⚡</span> Generate Resume';
      }, 2000);
    } else {
      btn.innerHTML = '<span class="icon">⚡</span> Generate Resume';
      btn.disabled = false;
      alert(result.error || 'Failed to start job');
    }
  } catch (error) {
    btn.innerHTML = '<span class="icon">⚡</span> Generate Resume';
    btn.disabled = false;
    alert('Error: ' + error.message);
  }
}

async function loadRecentJobs(token) {
  try {
    // Get active jobs from background
    chrome.runtime.sendMessage({ action: 'GET_ACTIVE_JOBS' }, async (response) => {
      const activeJobs = Array.isArray(response?.jobs) ? response.jobs : [];

      // Get completed jobs from API
      const apiResponse = await fetch(`${API_BASE}/api/resumes?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const completedJobs = await apiResponse.json();

      const container = document.getElementById('jobs-container');
      container.innerHTML = '';

      // Show active jobs first
      activeJobs.forEach(job => {
        addJobToList(job.id, job.company, job.title, job.status, job.progress);
      });

      // Then show completed jobs
      if (Array.isArray(completedJobs)) {
        completedJobs.slice(0, 5).forEach(job => {
          if (!activeJobs.find(aj => aj.id === job.id)) {
            addJobToList(job.id, job.company || 'Unknown', job.role || 'Position', job.status || 'COMPLETED', job.progress || 100, job.pdfUrl);
          }
        });
      }

      if (activeJobs.length === 0 && (!completedJobs || completedJobs.length === 0)) {
        document.getElementById('no-jobs').style.display = 'block';
      }
    });
  } catch (error) {
    console.error('Failed to load jobs:', error);
  }
}

function addJobToList(jobId, company, title, status, progress = 0, downloadUrl = null) {
  const container = document.getElementById('jobs-container');
  document.getElementById('no-jobs').style.display = 'none';

  // Remove existing if present
  const existing = document.getElementById(`job-${jobId}`);
  if (existing) existing.remove();

  const jobEl = document.createElement('div');
  jobEl.id = `job-${jobId}`;
  jobEl.className = `job-item ${status.toLowerCase()}`;

  const statusIcon = {
    'PROCESSING': '⏳',
    'RUNNING': '⚙️',
    'QUEUED': '⏳',
    'COMPLETED': '✓',
    'FAILED': '✗'
  }[status] || '•';

  jobEl.innerHTML = `
    <div class="job-info">
      <span class="status-icon">${statusIcon}</span>
      <div class="job-details">
        <div class="job-name">${company} - ${title}</div>
        <div class="job-status">${status === 'PROCESSING' || status === 'RUNNING' ? `${progress}%` : status}</div>
      </div>
    </div>
    ${downloadUrl ? `<button class="btn-download" data-url="${downloadUrl}">↓</button>` : ''}
    ${(status === 'PROCESSING' || status === 'RUNNING') ? `<div class="progress-bar"><div class="progress" style="width: ${progress}%"></div></div>` : ''}
  `;

  if (downloadUrl) {
    jobEl.querySelector('.btn-download').onclick = () => {
      chrome.tabs.create({ url: `${API_BASE}${downloadUrl}` });
    };
  }

  container.prepend(jobEl);
}

// Listen for job updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'JOB_UPDATE') {
    addJobToList(
      message.jobId,
      message.company,
      message.title,
      message.status,
      message.progress,
      message.downloadUrl
    );
  }
});
