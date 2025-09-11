// Background service worker with error handling
console.log('Quick Resume: Background service worker started');

let API_BASE = 'https://passats-production.up.railway.app';
chrome.storage.local.get('serverUrl').then(({ serverUrl }) => { if (serverUrl) API_BASE = serverUrl.replace(/\/$/, ''); });
let authToken = null;

// Background job tracking
let activeJobs = new Map();
let recentJobs = [];

// Error handler
function handleError(error, context) {
  console.error(`[${context}] Error:`, error);
  chrome.storage.local.set({ 
    lastError: {
      message: error.message || 'Unknown error occurred',
      details: error.stack || error.toString(),
      context: context,
      timestamp: Date.now()
    }
  });
  return { error: error.message || 'Unknown error occurred' };
}

// Unified message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateResume') {
    handleResumeGeneration(request.jobData, sender.tab)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        handleError(err, 'generateResume');
        sendResponse({ error: err.message });
      });
    return true;
  }

  if (request.action === 'getJobStatus') {
    const jobId = request.jobId;
    const job = activeJobs.get(jobId) || recentJobs.find(j => j.id === jobId);
    sendResponse(job || { error: 'Job not found' });
    return false;
  }

  if (request.action === 'getActiveJobs') {
    sendResponse({
      active: Array.from(activeJobs.values()),
      recent: recentJobs.slice(0, 5) // Last 5 jobs
    });
    return false;
  }

  if (request.action === 'getJobDetails') {
    const jobDetails = request.jobData;
    sendResponse({ 
      detected: true,
      role: jobDetails.role || 'Unknown Role',
      company: jobDetails.company || 'Unknown Company',
      location: jobDetails.location || '',
      type: jobDetails.type || 'Full-time'
    });
    return false;
  }

  if (request.action === 'authenticate') {
    authenticateUser(request.credentials)
      .then(result => sendResponse(result))
      .catch(error => sendResponse(handleError(error, 'authenticate')));
    return true;
  }

  if (request.action === 'getProfile') {
    getProfile()
      .then(profile => sendResponse(profile))
      .catch(async error => {
        // Fallback to local storage profile
        const { profile } = await chrome.storage.local.get(['profile']);
        if (profile) return sendResponse(profile);
        return sendResponse({ error: error.message });
      });
    return true;
  }

  if (request.action === 'saveProfile') {
    saveProfile(request.profile)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'compilePDF') {
    compilePDF(request.latex)
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ dataUrl: reader.result });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

function broadcastStatus(tabId, message, progress) {
  const payload = { action: 'statusUpdate', message, progress };
  if (tabId) {
    try { chrome.tabs.sendMessage(tabId, payload); } catch (e) {}
  }
  chrome.runtime.sendMessage(payload);
}

async function handleResumeGeneration(jobData, tab) {
  try {
    // Validate input
    if (!jobData || !jobData.jdText) {
      throw new Error('Invalid job data: missing job description');
    }
    
    // Get user profile
    const { profile, tempId } = await chrome.storage.local.get(['profile', 'tempId']);

    if (!profile || !tempId) {
      // Open onboarding
      await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      return;
    }

    // Validate profile
    if (!profile.name || !profile.email) {
      throw new Error('Profile incomplete: missing name or email');
    }

    // Create job tracking entry
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id: jobId,
      status: 'starting',
      progress: 0,
      message: 'Initializing resume generation...',
      jobData: {
        role: jobData.role || 'Unknown Role',
        company: jobData.company || 'Unknown Company',
        location: jobData.location || '',
        type: jobData.type || 'Full-time'
      },
      startTime: Date.now(),
      tabId: tab?.id
    };
    
    activeJobs.set(jobId, job);
    broadcastStatus(tab?.id, 'Starting resume generation...', 0);

    // Persist job payload for generating page to start streaming job
    await chrome.storage.local.set({ 
      pendingJob: { profile, jobData, tempId, jobId },
      currentJobId: jobId
    });
    
    // Start background generation process
    startBackgroundGeneration(jobId, profile, jobData, tempId, tab?.id);
    
  } catch (error) {
    handleError(error, 'handleResumeGeneration');
    throw error;
  }
}

async function startBackgroundGeneration(jobId, profile, jobData, tempId, tabId) {
  try {
    const job = activeJobs.get(jobId);
    if (!job) return;

    // Update job status
    job.status = 'processing';
    job.progress = 10;
    job.message = 'Extracting job keywords...';
    broadcastStatus(tabId, job.message, job.progress);

    // Call server generation endpoint
    const payload = { profile, jobData, tempId };
    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      // Job completed successfully
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Resume generated successfully!';
      job.result = result;
      job.completedTime = Date.now();
      
      // Move to recent jobs
      activeJobs.delete(jobId);
      recentJobs.unshift(job);
      if (recentJobs.length > 10) recentJobs.pop();
      
      broadcastStatus(tabId, job.message, job.progress);
      
      // Store result for UI access
      await chrome.storage.local.set({ 
        [`job_result_${jobId}`]: result,
        lastGeneratedResume: result
      });
      
    } else {
      throw new Error(result.error || 'Generation failed');
    }
    
  } catch (error) {
    console.error('Background generation error:', error);
    const job = activeJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.progress = 0;
      job.message = `Error: ${error.message}`;
      job.error = error.message;
      job.completedTime = Date.now();
      
      // Move to recent jobs even if failed
      activeJobs.delete(jobId);
      recentJobs.unshift(job);
      if (recentJobs.length > 10) recentJobs.pop();
      
      broadcastStatus(tabId, job.message, job.progress);
    }
  }
}

async function authenticateUser(credentials) {
  try {
    // Validate credentials
    if (!credentials || !credentials.email || !credentials.password) {
      throw new Error('Please provide both email and password');
    }
    
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'Invalid credentials') {
          throw new Error('Incorrect email or password. Please check your credentials and try again.');
        }
        throw new Error('Authentication failed. Please check your credentials.');
      }
      
      if (response.status === 400) {
        throw new Error('Please provide both email and password');
      }
      
      const errorData = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server error (${response.status}): ${errorData}`);
    }
    
    const data = await response.json();
    if (!data.token) {
      throw new Error('Authentication failed: no token received');
    }
    
    authToken = data.token;
    await chrome.storage.local.set({ authToken });
    
    // If this is a new user, show welcome message
    if (data.isNew) {
      console.log('Welcome! New account created successfully.');
    }
    
    return data;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Unable to connect to server. Please check your internet connection and try again.');
    }
    throw error;
  }
}

async function ensureAuthToken() {
  if (!authToken) {
    const storage = await chrome.storage.local.get('authToken');
    authToken = storage.authToken;
  }
  return authToken;
}

async function getProfile() {
  const token = await ensureAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) throw new Error('Failed to fetch profile');
  const profile = await response.json();

  // Cache locally for offline use
  await chrome.storage.local.set({ profile });
  return profile;
}

async function saveProfile(profile) {
  // Persist locally first (so it “always saves”)
  await chrome.storage.local.set({ profile });

  // Try to sync to server if authenticated
  let token = await ensureAuthToken();
  if (!token) {
    // Skip auto-auth for now - user needs to manually authenticate
    // This prevents 401 errors when trying random passwords for existing users
    return { success: true, warning: 'Saved locally only. Please sign in to sync to server.' };
  }

  const response = await fetch(`${API_BASE}/me`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profile)
  });

  if (!response.ok) {
    return { success: false, warning: 'Saved locally. Server sync failed.' };
  }
  return { success: true, synced: true };
}

async function compilePDF(latex) {
  try {
    if (!latex || latex.trim().length === 0) {
      throw new Error('Invalid LaTeX: empty document');
    }
    
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tex: latex })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`PDF compilation failed: ${response.status} - ${errorData}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('PDF compilation failed: empty PDF received');
    }
    
    return blob;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Server unavailable. Please ensure the server is running.');
    }
    throw error;
  }
}

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Quick Resume: Extension installed');
});
