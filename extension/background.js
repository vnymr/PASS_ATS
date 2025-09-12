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
  // Ping check for context validation
  if (request.action === 'ping') {
    sendResponse({ status: 'alive' });
    return false;
  }
  
  if (request.action === 'generateResume') {
    const correlationId = crypto.randomUUID();
    
    handleResumeGeneration(request.jobData, sender.tab, correlationId)
      .then(() => {
        sendResponse({ success: true, correlationId });
      })
      .catch(err => {
        handleError(err, 'generateResume');
        sendResponse({ error: err.message, correlationId });
      });
    return true;
  }
  
  if (request.action === 'openGeneratingPage') {
    chrome.tabs.create({ url: chrome.runtime.getURL('generating.html') });
    sendResponse({ success: true });
    return false;
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

async function handleResumeGeneration(jobData, tab, correlationId = null) {
  try {
    // Validate input
    if (!jobData || !jobData.jdText) {
      throw new Error('Invalid job data: missing job description');
    }
    
    // Try to get profile from database first, fallback to local
    let profile = null;
    let tempId = null;
    
    try {
      // First try to get from database if authenticated
      const token = await ensureAuthToken();
      if (token) {
        const dbProfile = await getProfile();
        if (dbProfile && !dbProfile.error) {
          profile = dbProfile;
          tempId = profile.tempId || `DB_${profile.email.split('@')[0]}`;
          console.log('Using profile from database');
        }
      }
    } catch (error) {
      console.warn('Failed to fetch profile from database:', error);
    }
    
    // Fallback to local storage
    if (!profile) {
      const localData = await chrome.storage.local.get(['profile', 'tempId']);
      profile = localData.profile;
      tempId = localData.tempId;
      console.log('Using profile from local storage');
    }

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
  // Always persist locally first as backup
  await chrome.storage.local.set({ profile, lastSaved: Date.now() });

  // Try to sync to server
  let token = await ensureAuthToken();
  
  // If no token and we have email, try to create account or login
  if (!token && profile.email) {
    try {
      // First try to login with a generated password based on email
      const tempPassword = `${profile.email.split('@')[0]}_Resume2024!`;
      
      // Try login first
      let response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          password: tempPassword
        })
      });
      
      // If login fails, try to create account
      if (!response.ok) {
        response = await fetch(`${API_BASE}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profile.email,
            password: tempPassword
          })
        });
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          token = data.token;
          authToken = data.token;
          await chrome.storage.local.set({ authToken: data.token });
          console.log('Auto-authenticated user for database storage');
        }
      }
    } catch (error) {
      console.warn('Auto-auth failed:', error);
    }
  }
  
  // If still no token, save locally only
  if (!token) {
    return { success: true, warning: 'Saved locally. Create account to sync to cloud.' };
  }

  // Save to server database
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profile)
    });

    if (!response.ok) {
      console.error('Server save failed:', response.status);
      return { success: false, warning: 'Saved locally. Server sync failed.' };
    }
    
    // Mark as synced in local storage
    await chrome.storage.local.set({ 
      profile, 
      dbSynced: true,
      lastSyncTime: Date.now() 
    });
    
    console.log('Profile successfully saved to database');
    return { success: true, synced: true };
  } catch (error) {
    console.error('Database save error:', error);
    return { success: false, warning: 'Saved locally. Database error.' };
  }
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
  
  // Set up periodic sync every 5 minutes
  chrome.alarms.create('syncProfile', { periodInMinutes: 5 });
});

// Handle periodic sync
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncProfile') {
    try {
      const { profile, dbSynced, lastSyncTime } = await chrome.storage.local.get(['profile', 'dbSynced', 'lastSyncTime']);
      
      // Only sync if we have a profile and it hasn't been synced recently
      if (profile && (!dbSynced || !lastSyncTime || Date.now() - lastSyncTime > 300000)) {
        console.log('Running periodic profile sync to database');
        const result = await saveProfile(profile);
        if (result.synced) {
          console.log('Periodic sync successful');
        }
      }
    } catch (error) {
      console.error('Periodic sync failed:', error);
    }
  }
});
