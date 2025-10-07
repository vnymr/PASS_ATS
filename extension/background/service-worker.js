// Background service worker for Quick Resume AI extension

console.log('🚀 Quick Resume AI service worker loaded');

// Track active jobs
let activeJobs = new Map(); // jobId -> { status, progress, startTime }

// Handle service worker errors
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// ========================================
// CLERK TOKEN SYNC - NEW IMPLEMENTATION
// ========================================

// Listen for messages from web app (frontend) to sync Clerk tokens
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('📨 External message received from:', sender.url);
  
  if (message.type === 'CLERK_TOKEN_UPDATE') {
    if (message.token) {
      // Store token in chrome.storage.local
      chrome.storage.local.set({ 
        clerk_session_token: message.token,
        clerk_token_updated_at: Date.now()
      }, () => {
        console.log('✅ Clerk token stored in chrome.storage.local');
        sendResponse({ success: true });
      });
    } else {
      // Clear token (user logged out)
      chrome.storage.local.remove(['clerk_session_token', 'clerk_token_updated_at'], () => {
        console.log('🗑️ Clerk token cleared from chrome.storage.local');
        sendResponse({ success: true });
      });
    }
    return true; // Keep message channel open for async response
  }
});

// Also listen for messages from within the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Internal message received:', message);

  // Handle getConfig request from popup
  if (message.action === 'getConfig') {
    // Return CONFIG object
    const CONFIG = {
      API_BASE_URL: 'http://localhost:3000',
      WEB_APP_URL: 'http://localhost:5173'
    };
    sendResponse(CONFIG);
    return true;
  }

  // Handle START_JOB request
  if (message.action === 'START_JOB') {
    startJobProcessing(message.jobId, message.token, message.jobInfo);
    sendResponse({ success: true });
    return true;
  }

  // Handle GET_ACTIVE_JOB request (legacy)
  if (message.action === 'GET_ACTIVE_JOB') {
    const job = Array.from(activeJobs.values())[0]; // Get first active job
    sendResponse({ job: job || null });
    return true;
  }

  // Handle GET_ACTIVE_JOBS request (new - returns array)
  if (message.action === 'GET_ACTIVE_JOBS') {
    const jobs = Array.from(activeJobs.values());
    sendResponse({ jobs: jobs });
    return true;
  }

  // Handle token sync from web app if it comes through internal messaging
  if (message.type === 'CLERK_TOKEN_UPDATE') {
    if (message.token) {
      chrome.storage.local.set({ 
        clerk_session_token: message.token,
        clerk_token_updated_at: Date.now()
      }, () => {
        console.log('✅ Clerk token stored (internal message)');
        sendResponse({ success: true });
      });
    } else {
      chrome.storage.local.remove(['clerk_session_token', 'clerk_token_updated_at'], () => {
        console.log('🗑️ Clerk token cleared (internal message)');
        sendResponse({ success: true });
      });
    }
    return true;
  }

  if (message.action === 'jobPageDetected') {
    // Log job page detection
    console.log('🎯 Job page detected:', {
      url: message.url,
      confidence: message.confidence,
      metadata: message.metadata
    });

    // Update badge to show detection
    if (sender.tab?.id) {
      chrome.action.setBadgeText({
        text: '✓',
        tabId: sender.tab.id
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#059669',
        tabId: sender.tab.id
      });
    }
  }

  if (message.action === 'openPopup') {
    // Open extension popup
    chrome.action.openPopup();
  }

  if (message.action === 'generationComplete') {
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
      title: 'Resume Ready!',
      message: 'Your tailored resume has been generated successfully.',
      priority: 2
    });
  }

  return true; // Keep message channel open
});

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('📦 Extension installed/updated:', details.reason);

  // Set default API base URL for local development
  chrome.storage.local.set({
    apiBaseURL: 'http://localhost:3000'
  });

  if (details.reason === 'install') {
    // First time install - open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup/popup.html')
    });
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  console.log('⌨️ Command received:', command);

  if (command === 'generate-resume') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if on job site
    const supportedSites = ['linkedin.com', 'indeed.com', 'glassdoor.com'];
    const isJobSite = supportedSites.some(site => tab.url.includes(site));

    if (!isJobSite) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon-48.png'),
        title: 'Quick Resume AI',
        message: '⚠️ Please visit a job posting page and try again.\n\nSupported: LinkedIn, Indeed, Glassdoor'
      });
      return;
    }

    // Try to scrape and generate
    chrome.tabs.sendMessage(tab.id, { action: 'AUTO_GENERATE' });
  }

  // Legacy command support
  if (command === 'auto-generate') {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if on supported job site
    const supportedSites = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com'];
    const isSupportedSite = supportedSites.some(site => tab.url.includes(site));

    if (!isSupportedSite) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon-48.png'),
        title: 'Quick Resume AI',
        message: 'Please navigate to a job posting on LinkedIn, Indeed, Glassdoor, Monster, or ZipRecruiter',
        priority: 1
      });
      return;
    }

    // Send message to content script to start auto-scraping
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'auto-scrape-and-generate' });
    } catch (error) {
      console.error('Failed to send auto-generate message:', error);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon-48.png'),
        title: 'Quick Resume AI',
        message: 'Please refresh the page and try again',
        priority: 1
      });
    }
  }
});

// Listen for generate-resume messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generate-resume') {
    // Handle resume generation request from auto-scrape
    console.log('🚀 Auto-generate resume request:', message.jobData);

    // You can add additional logic here if needed
    // For now, the content script handles the API call directly

    sendResponse({ success: true });
    return true;
  }
});

// Clear badge when tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.action.setBadgeText({
    text: '',
    tabId: activeInfo.tabId
  });
});

// Handle download completion
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state?.current === 'complete') {
    console.log('✅ Download complete:', downloadDelta);
  }
});

// Periodic cleanup of old cache (every hour)
chrome.alarms.create('cleanupCache', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupCache') {
    chrome.storage.local.get(null, (items) => {
      const now = Date.now();
      const toRemove = [];

      for (const [key, value] of Object.entries(items)) {
        if (key.startsWith('cache_') && value.timestamp) {
          // Remove cache entries older than 24 hours
          if (now - value.timestamp > 86400000) {
            toRemove.push(key);
          }
        }
      }

      if (toRemove.length > 0) {
        chrome.storage.local.remove(toRemove);
        console.log('🧹 Cleaned up', toRemove.length, 'old cache entries');
      }
    });
  }
});

// ========================================
// BACKGROUND JOB PROCESSING
// ========================================

async function startJobProcessing(jobId, token, jobInfo = {}) {
  console.log('🚀 Starting background job processing:', jobId);

  // Store job info
  activeJobs.set(jobId, {
    id: jobId,
    company: jobInfo.company || 'Unknown',
    title: jobInfo.title || 'Position',
    status: 'PROCESSING',
    progress: 0,
    startTime: Date.now()
  });

  // Update badge to show processing
  chrome.action.setBadgeText({ text: '...' });
  chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });

  // Get API base URL from config
  const { apiBaseURL } = await chrome.storage.local.get('apiBaseURL');
  const API_BASE = apiBaseURL || 'https://happyresumes.com';

  // Poll job status in background
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/job/${jobId}/status`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) {
        console.error('Failed to fetch job status:', response.status);
        return;
      }

      const data = await response.json();

      // Calculate progress based on status
      let progress = 0;
      if (data.status === 'PROCESSING') {
        // Estimate progress: 0-50% for generation, 50-100% for compilation
        const elapsed = Date.now() - activeJobs.get(jobId).startTime;
        const estimatedTotal = 45000; // 45 seconds average
        progress = Math.min(90, Math.floor((elapsed / estimatedTotal) * 100));
      } else if (data.status === 'COMPLETED') {
        progress = 100;
      }

      // Update stored job info
      const job = activeJobs.get(jobId);
      activeJobs.set(jobId, {
        id: jobId,
        company: job.company,
        title: job.title,
        status: data.status,
        progress: progress,
        startTime: job.startTime,
        data: data
      });

      // Broadcast update to popup
      chrome.runtime.sendMessage({
        action: 'JOB_UPDATE',
        jobId: jobId,
        company: job.company,
        title: job.title,
        status: data.status,
        progress: progress
      }).catch(() => {}); // Ignore if popup is closed

      // Update badge with progress
      chrome.action.setBadgeText({ text: `${progress}%` });

      // Handle completion
      if (data.status === 'COMPLETED') {
        clearInterval(pollInterval);
        console.log('✅ Job completed successfully');

        // Update badge to show success
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

        // Broadcast final update with download URL
        chrome.runtime.sendMessage({
          action: 'JOB_UPDATE',
          jobId: jobId,
          company: job.company,
          title: job.title,
          status: 'COMPLETED',
          progress: 100,
          downloadUrl: `/api/job/${jobId}/download/pdf`
        }).catch(() => {});

        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
          title: 'Resume Ready!',
          message: 'Your tailored resume has been generated. Click to download.',
          requireInteraction: true,
          buttons: [
            { title: 'Download' },
            { title: 'View Dashboard' }
          ]
        });

        // Auto-download after 2 seconds
        setTimeout(() => {
          downloadResume(jobId, token, API_BASE);
        }, 2000);

        // Clear job from active list after download
        setTimeout(() => {
          activeJobs.delete(jobId);
          chrome.action.setBadgeText({ text: '' });
        }, 10000);

      } else if (data.status === 'FAILED') {
        clearInterval(pollInterval);
        activeJobs.delete(jobId);

        console.error('❌ Job failed:', data.error);

        chrome.action.setBadgeText({ text: '✗' });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
          title: 'Generation Failed',
          message: data.error || 'Resume generation failed. Check dashboard for details.',
          requireInteraction: false
        });

        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 5000);
      }

    } catch (error) {
      console.error('Background poll error:', error);
    }
  }, 2000);

  // Safety timeout after 2 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
    if (activeJobs.has(jobId)) {
      console.warn('⏱️ Job timeout, cleaning up');
      activeJobs.delete(jobId);
      chrome.action.setBadgeText({ text: '⏱' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
        title: 'Generation Timeout',
        message: 'Taking longer than expected. Check dashboard for your resume.',
        requireInteraction: false
      });

      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 5000);
    }
  }, 120000);
}

async function downloadResume(jobId, token, apiBase) {
  try {
    console.log('📥 Downloading resume for job:', jobId);

    const response = await fetch(
      `${apiBase}/api/job/${jobId}/download/pdf`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: `resume_${jobId}.pdf`,
      saveAs: true
    }, (downloadId) => {
      if (downloadId) {
        console.log('✅ Download started:', downloadId);
      } else {
        console.error('❌ Download failed');
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
          title: 'Download Failed',
          message: 'Could not download PDF. Opening dashboard...',
          requireInteraction: false
        });

        // Open dashboard
        const { apiBaseURL } = chrome.storage.local.get('apiBaseURL');
        const webUrl = apiBaseURL?.includes('localhost')
          ? 'http://localhost:5173/dashboard'
          : 'https://happyresumes.com/dashboard';
        chrome.tabs.create({ url: webUrl });
      }

      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  } catch (error) {
    console.error('Download error:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
      title: 'Download Error',
      message: 'Failed to download resume. Check dashboard.',
      requireInteraction: false
    });
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Download button clicked - already handled by auto-download
    console.log('Download button clicked');
  } else if (buttonIndex === 1) {
    // View Dashboard button clicked
    const { apiBaseURL } = chrome.storage.local.get('apiBaseURL');
    const webUrl = apiBaseURL?.includes('localhost')
      ? 'http://localhost:5173/dashboard'
      : 'https://happyresumes.com/dashboard';
    chrome.tabs.create({ url: webUrl });
  }
});
