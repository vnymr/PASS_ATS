// Background service worker for HappyResumes extension

console.log('🚀 HappyResumes service worker loaded');

// Track active jobs
let activeJobs = new Map(); // jobId -> { status, progress, startTime }

// ========================================
// KEYBOARD SHORTCUT HANDLER
// ========================================

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'generate-resume') {
    console.log('⌨️ Keyboard shortcut triggered:', command);
    handleGenerateResumeShortcut();
  }
});

async function handleGenerateResumeShortcut() {
  console.log('🎯 Generate resume shortcut triggered');

  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      console.error('No active tab found');
      showNotification('Error', 'No active tab found');
      return;
    }

    // Check if we're on a valid webpage
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showNotification('Not Available', 'Extension cannot run on this page. Please navigate to a job posting.');
      return;
    }

    console.log('📄 Current tab:', tab.url);

    // Inject CSS first
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['assets/styles.css']
    });

    // Inject scripts dynamically into current tab only
    await injectScriptsIntoTab(tab.id);

    // Wait a moment for scripts to load
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send message to tab to start job detection
    chrome.tabs.sendMessage(tab.id, {
      action: 'SHORTCUT_ACTIVATED',
      tabUrl: tab.url
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to communicate with content script:', chrome.runtime.lastError);
        showNotification('Error', 'Failed to activate extension. Please try again.');
      } else {
        console.log('✅ Shortcut activation successful:', response);
      }
    });

  } catch (error) {
    console.error('Error handling shortcut:', error);
    showNotification('Error', error.message || 'Failed to activate extension');
  }
}

async function injectScriptsIntoTab(tabId) {
  console.log('💉 Injecting scripts into tab:', tabId);

  try {
    // Inject scripts in order
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['utils/config.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['utils/api-client.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/detector.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/scraper.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/ui-injector.js']
    });

    console.log('✅ All scripts injected successfully');

  } catch (error) {
    console.error('❌ Failed to inject scripts:', error);
    throw new Error('Failed to load extension components');
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icons/icon-128.png',
    title: title,
    message: message,
    priority: 2
  });
}

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

// Also listen for messages from within the extension (including content scripts)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Internal message received:', message);

  // Handle token update from dashboard-sync content script
  if (message.type === 'CLERK_TOKEN_UPDATE' && message.source === 'dashboard-sync') {
    console.log('🔐 Token update from dashboard sync script');
    console.log('Token received:', message.token ? `${message.token.substring(0, 20)}...` : 'No token');
    console.log('Email:', message.email);
    console.log('Timestamp:', message.timestamp);

    if (message.token) {
      // Store token in chrome.storage.local
      chrome.storage.local.set({
        clerk_session_token: message.token,
        clerk_token_updated_at: Date.now(),
        user_email: message.email || ''
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Failed to save token:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('✅ Token from dashboard saved to storage');
          console.log('Storage update complete - token length:', message.token.length);

          // Update badge to show auth status
          chrome.action.setBadgeText({ text: '✓' });
          chrome.action.setBadgeBackgroundColor({ color: '#27ae60' });

          // Clear badge after 3 seconds
          setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
          }, 3000);

          sendResponse({ success: true, message: 'Token synced' });
        }
      });
    } else {
      console.log('❌ No token in message from dashboard');
      sendResponse({ success: false, message: 'No token provided' });
    }
    return true; // Keep channel open for async response
  }

  // Handle getConfig request from popup
  if (message.action === 'getConfig') {
    // Return CONFIG object
    const CONFIG = {
      API_BASE_URL: 'https://api.happyresumes.com',
      WEB_APP_URL: 'https://happyresumes.com'
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

  // Proxy API requests to bypass page-origin CORS restrictions
  if (message.action === 'API_REQUEST') {
    (async () => {
      try {
        const response = await fetch(message.url, message.options || {});
        const contentType = response.headers.get('content-type') || '';
        let payload;

        if (contentType.includes('application/json')) {
          payload = await response.json();
        } else {
          payload = await response.text();
        }

        sendResponse({
          ok: response.ok,
          status: response.status,
          data: payload,
          headers: Array.from(response.headers.entries())
        });
      } catch (error) {
        console.error('API proxy fetch failed:', error);
        sendResponse({ ok: false, error: error.message || 'Request failed' });
      }
    })();

    return true; // Keep channel open for async response
  }

  if (message.action === 'DOWNLOAD_RESUME') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get('apiBaseURL');
        const apiBase = message.baseURL || stored.apiBaseURL || 'https://api.happyresumes.com';
        await downloadResume(message.jobId, message.token, apiBase);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Download proxy error:', error);
        sendResponse({ success: false, error: error.message || 'Download failed' });
      }
    })();

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
    apiBaseURL: 'https://api.happyresumes.com'
  });

  if (details.reason === 'install') {
    // First time install - open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup/popup.html')
    });
  }
});

// (Keyboard shortcut handler moved to the top of the file)

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
  const API_BASE = apiBaseURL || 'https://api.happyresumes.com';

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
    const downloadUrl = await createDownloadUrl(blob);
    const filename = extractFilename(response.headers, jobId);

    console.log('📄 Download filename chosen:', filename);

    chrome.downloads.download({
      url: downloadUrl,
      filename,
      saveAs: false
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

        const webUrl = 'https://happyresumes.com/dashboard';
        chrome.tabs.create({ url: webUrl });
      }

      // Clean up blob URL or revoke data URL memory
      if (downloadUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
      }
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

async function createDownloadUrl(blob) {
  const urlFactory = (globalThis.URL && typeof globalThis.URL.createObjectURL === 'function')
    ? globalThis.URL
    : (typeof globalThis.webkitURL !== 'undefined' && typeof globalThis.webkitURL.createObjectURL === 'function')
      ? globalThis.webkitURL
      : null;

  if (urlFactory) {
    return urlFactory.createObjectURL(blob);
  }

  // Fallback to data URL via FileReader
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to create download URL'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to create download URL'));
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}

function extractFilename(headers, jobId) {
  const disposition = headers.get('content-disposition') || '';
  let filename = null;

  // RFC 5987 / standard filename parsing
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    filename = decodeURIComponent(utf8Match[1]);
  } else {
    const quotedMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (quotedMatch && quotedMatch[1]) {
      filename = quotedMatch[1];
    }
  }

  if (!filename) {
    filename = `Resume_${jobId.substring(0, 8)}.pdf`;
  }

  // Sanitize filename to avoid invalid characters / paths
  filename = filename.replace(/[\\/:*?"<>|]/g, '-');
  return filename;
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Download button clicked - already handled by auto-download
    console.log('Download button clicked');
  } else if (buttonIndex === 1) {
    // View Dashboard button clicked
    const { apiBaseURL } = chrome.storage.local.get('apiBaseURL');
    const webUrl = 'https://happyresumes.com/dashboard';
    chrome.tabs.create({ url: webUrl });
  }
});
