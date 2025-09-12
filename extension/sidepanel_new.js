// Use global namespace modules
const { extractSignals, mapToResume } = window.ResumeModules?.Extract || {};
const { generateLatex } = window.ResumeModules?.Latex || {};
const { analyzeJobWithAI, generateOptimizedBullets, generateDynamicSummary } = window.ResumeModules?.AIAnalyzer || {};

// State management
let currentUser = null;
let currentProfile = null;
let tailoredDraft = null;
let currentSignals = null;
let aiAnalysis = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  setupEventListeners();
  initializeUI();
});

// Check authentication status
async function checkAuthStatus() {
  const { authToken } = await chrome.storage.local.get('authToken');
  if (authToken) {
    try {
      const profile = await chrome.runtime.sendMessage({ action: 'getProfile' });
      if (!profile.error) {
        currentProfile = profile;
        currentUser = { email: profile.email };
        showMainView();
        loadProfile();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Auth
  document.getElementById('authForm').addEventListener('submit', handleAuth);
  document.getElementById('magicLinkBtn').addEventListener('click', handleSignup);
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Fix for "Create Resume" button in history tab
  const createFirstResumeBtn = document.getElementById('createFirstResumeBtn');
  if (createFirstResumeBtn) {
    createFirstResumeBtn.addEventListener('click', () => switchTab('generate'));
  }
  
  // Generate tab
  document.getElementById('jdInput').addEventListener('input', updateCharCount);
  document.getElementById('useSelectionBtn').addEventListener('click', useSelection);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeResume);
  document.getElementById('regenerateBtn').addEventListener('click', analyzeResume);
  document.getElementById('downloadBtn').addEventListener('click', downloadPDF);
  
  // History tab
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn && btn.dataset.tab === 'history') {
      loadHistory();
    }
    
    // Filter buttons
    const filterBtn = e.target.closest('.filter-btn');
    if (filterBtn) {
      setHistoryFilter(filterBtn.dataset.filter);
    }
  });
  
  // Profile tab
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('addSkillBtn').addEventListener('click', addSkill);
  document.getElementById('skillInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  });
  
  // Settings tab
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('deleteBtn').addEventListener('click', deleteAccount);
  document.getElementById('upgradePlanBtn').addEventListener('click', handleUpgrade);
  
  // Profile tab - add event listeners for new buttons
  document.getElementById('addExperienceBtn').addEventListener('click', addExperience);
  document.getElementById('addProjectBtn').addEventListener('click', addProject);
  document.getElementById('addEducationBtn').addEventListener('click', addEducation);
  document.getElementById('addCertificationBtn').addEventListener('click', addCertification);
}

// Initialize UI components
function initializeUI() {
  updateCharCount();
  loadApiKeyStatus();
  // Load server URL setting
  chrome.storage.local.get('serverUrl').then(({ serverUrl }) => {
    const input = document.getElementById('serverUrl');
    if (input) input.value = serverUrl || 'https://passats-production.up.railway.app';
  });
}

// Authentication handlers
async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  showLoading('Signing in...');
  
  const result = await chrome.runtime.sendMessage({
    action: 'authenticate',
    credentials: { email, password }
  });
  
  hideLoading();
  
  if (!result.error) {
    currentUser = { email };
    await loadOrCreateProfile();
    showMainView();
    showToast('Welcome back!', 'success');
  } else {
    showToast('Login failed. Please try again.', 'error');
  }
}

async function handleSignup() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    showToast('Please enter email and password', 'warning');
    return;
  }
  
  showLoading('Creating account...');
  
  // The server automatically creates account on first login
  const result = await chrome.runtime.sendMessage({
    action: 'authenticate',
    credentials: { email, password }
  });
  
  hideLoading();
  
  if (!result.error) {
    currentUser = { email };
    currentProfile = {
      email: email,
      name: '',
      phone: '',
      location: '',
      headline: '',
      summary_narrative: '',
      skills: [],
      experience: [],
      projects: [],
      education: [],
      template: 'modern'
    };
    showMainView();
    showToast('Account created successfully! Welcome!', 'success');
    switchTab('profile');
  } else {
    showToast('Signup failed. Please try again.', 'error');
  }
}

// View management
function showMainView() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
  document.getElementById('userMenu').classList.remove('hidden');
  
  if (currentUser && currentUser.email) {
    document.getElementById('userInitial').textContent = currentUser.email[0].toUpperCase();
  }
}

function showAuthView() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('mainView').classList.add('hidden');
  document.getElementById('userMenu').classList.add('hidden');
}

// Tab switching
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  document.getElementById(tabName + 'Tab').classList.remove('hidden');
  if (tabName === 'history') {
    loadHistory();
  }
}

async function loadHistory() {
  try {
    // Ensure auth token
    const { authToken } = await chrome.storage.local.get('authToken');
    if (!authToken) {
      // Try to get data from background script instead
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getActiveJobs' });
        displayBackgroundHistory(response);
        return;
      } catch (error) {
        showToast('Please sign in to view history', 'warning');
        return;
      }
    }
    
    // Fetch usage and resume list from server
    const { serverUrl } = await chrome.storage.local.get('serverUrl');
    const API_BASE = (serverUrl || 'https://passats-production.up.railway.app').replace(/\/$/, '');
    
    // Fetch resume list
    const resResp = await fetch(`${API_BASE}/me/resumes`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const list = resResp.ok ? await resResp.json() : [];
    
    // Update stats
    const totalCount = list.length;
    const thisMonth = list.filter(item => {
      const itemDate = new Date(item.createdAt);
      const now = new Date();
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('monthlyCount').textContent = thisMonth;
    
    // Display items
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    
    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:40px 20px;color:var(--gray-500);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px;opacity:0.5;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          <h3 style="font-size:var(--font-size-lg);font-weight:600;margin-bottom:8px;color:var(--gray-700);">No resumes yet</h3>
          <p style="margin-bottom:20px;">Generate your first resume to see it here</p>
          <button onclick="switchTab('generate')" class="btn-primary small">Create Resume</button>
        </div>
      `;
      return;
    }
    
    for (const item of list) {
      const div = document.createElement('div');
      div.style.cssText = `
        display:flex;
        align-items:center;
        gap:16px;
        padding:16px;
        background:var(--white);
        border:1px solid var(--gray-200);
        border-radius:var(--radius-lg);
        margin-bottom:12px;
        transition:var(--transition-fast);
      `;
      
      // Add hover effect
      div.addEventListener('mouseenter', () => {
        div.style.boxShadow = 'var(--shadow-md)';
        div.style.borderColor = 'var(--gray-300)';
      });
      
      div.addEventListener('mouseleave', () => {
        div.style.boxShadow = 'none';
        div.style.borderColor = 'var(--gray-200)';
      });
      
      const statusIcon = `
        <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--green-light);color:var(--green);flex-shrink:0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      `;
      
      const timeAgo = formatTimeAgo(new Date(item.createdAt).getTime());
      
      div.innerHTML = `
        ${statusIcon}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:var(--font-size-lg);margin-bottom:4px;color:var(--gray-900);">
            ${item.role || 'Resume'} ${item.company ? `• ${item.company}` : ''}
          </div>
          <div style="font-size:var(--font-size-sm);color:var(--gray-600);margin-bottom:4px;">
            Generated ${timeAgo}
          </div>
          <div style="font-size:var(--font-size-xs);font-weight:500;color:var(--green);">
            Generated successfully
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="downloadResume('${item.pdfUrl}')" class="btn-secondary small" style="display:flex;align-items:center;gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
        </div>
      `;
      
      container.appendChild(div);
    }
  } catch (e) {
    showToast('Failed to load history', 'error');
  }
}

// Display history from background script
function displayBackgroundHistory(data) {
  const { active = [], recent = [] } = data;
  const allJobs = [...active, ...recent];
  
  // Update stats
  const totalCompleted = recent.filter(job => job.status === 'completed').length;
  const thisMonth = recent.filter(job => {
    if (job.status !== 'completed' || !job.completedTime) return false;
    const jobDate = new Date(job.completedTime);
    const now = new Date();
    return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
  }).length;
  
  document.getElementById('totalCount').textContent = totalCompleted;
  document.getElementById('monthlyCount').textContent = thisMonth;
  
  // Display items
  const container = document.getElementById('historyList');
  container.innerHTML = '';
  
  if (allJobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:40px 20px;color:var(--gray-500);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px;opacity:0.5;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        <h3 style="font-size:var(--font-size-lg);font-weight:600;margin-bottom:8px;color:var(--gray-700);">No resumes yet</h3>
        <p style="margin-bottom:20px;">Generate your first resume to see it here</p>
        <button onclick="switchTab('generate')" class="btn-primary small">Create Resume</button>
      </div>
    `;
    return;
  }
  
  allJobs.forEach(job => {
    const div = document.createElement('div');
    div.style.cssText = `
      display:flex;
      align-items:center;
      gap:16px;
      padding:16px;
      background:var(--white);
      border:1px solid var(--gray-200);
      border-radius:var(--radius-lg);
      margin-bottom:12px;
      transition:var(--transition-fast);
    `;
    
    const statusClass = job.status === 'completed' ? 'completed' : 
                       job.status === 'failed' ? 'failed' : 'processing';
    
    const statusIcon = job.status === 'completed' ? 
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' :
      job.status === 'failed' ?
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' :
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    
    const timeAgo = job.completedTime ? formatTimeAgo(job.completedTime) : 'In progress';
    const jobTitle = job.jobData?.role || 'Unknown Position';
    const company = job.jobData?.company || 'Unknown Company';
    
    const statusColor = job.status === 'completed' ? 'var(--green)' : 
                       job.status === 'failed' ? 'var(--red)' : 'var(--blue)';
    
    const statusBg = job.status === 'completed' ? 'var(--green-light)' : 
                     job.status === 'failed' ? 'var(--red-light)' : 'var(--blue-light)';
    
    div.innerHTML = `
      <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${statusBg};color:${statusColor};flex-shrink:0;">
        ${statusIcon}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:var(--font-size-lg);margin-bottom:4px;color:var(--gray-900);">${jobTitle}</div>
        <div style="font-size:var(--font-size-sm);color:var(--gray-600);margin-bottom:4px;">${company} • ${timeAgo}</div>
        <div style="font-size:var(--font-size-xs);font-weight:500;color:${statusColor};">
          ${job.status === 'completed' ? 'Generated successfully' : job.status === 'failed' ? 'Generation failed' : 'Processing...'}
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        ${job.status === 'completed' && job.result ? 
          `<button onclick="downloadResume('${job.result.pdfUrl}')" class="btn-secondary small" style="display:flex;align-items:center;gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>` : 
          ''
        }
      </div>
    `;
    
    // Add hover effect
    div.addEventListener('mouseenter', () => {
      div.style.boxShadow = 'var(--shadow-md)';
      div.style.borderColor = 'var(--gray-300)';
    });
    
    div.addEventListener('mouseleave', () => {
      div.style.boxShadow = 'none';
      div.style.borderColor = 'var(--gray-200)';
    });
    
    container.appendChild(div);
  });
}

// History filter management
let currentHistoryFilter = 'all';

function setHistoryFilter(filter) {
  currentHistoryFilter = filter;
  
  // Update filter button states
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
    if (btn.dataset.filter === filter) {
      btn.style.background = 'var(--black)';
      btn.style.color = 'var(--white)';
    } else {
      btn.style.background = 'var(--gray-100)';
      btn.style.color = 'var(--gray-700)';
    }
  });
  
  // For now, just reload the history (can be enhanced later)
  loadHistory();
}

// Download resume function
function downloadResume(url) {
  if (url) {
    window.open(url, '_blank');
  }
}

// Format time ago helper
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Enhanced Profile Management Functions
function addExperience() {
  const container = document.getElementById('experienceContainer');
  const experienceItem = createExperienceItem();
  container.appendChild(experienceItem);
}

function addProject() {
  const container = document.getElementById('projectsContainer');
  const projectItem = createProjectItem();
  container.appendChild(projectItem);
}

function addEducation() {
  const container = document.getElementById('educationContainer');
  const educationItem = createEducationItem();
  container.appendChild(educationItem);
}

function addCertification() {
  const container = document.getElementById('certificationsContainer');
  const certificationItem = createCertificationItem();
  container.appendChild(certificationItem);
}

function createExperienceItem() {
  const div = document.createElement('div');
  div.className = 'form-item';
  div.innerHTML = `
    <div class="form-item-header">
      <h4>Work Experience</h4>
      <button type="button" class="btn-remove" onclick="this.closest('.form-item').remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="form-grid">
      <div class="input-group">
        <input type="text" placeholder=" " required>
        <label>Job title</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" " required>
        <label>Company</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" ">
        <label>Start date</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" ">
        <label>End date (or "Present")</label>
      </div>
    </div>
    <div class="input-group">
      <textarea placeholder=" " rows="3"></textarea>
      <label>Description</label>
    </div>
  `;
  return div;
}

function createProjectItem() {
  const div = document.createElement('div');
  div.className = 'form-item';
  div.innerHTML = `
    <div class="form-item-header">
      <h4>Project</h4>
      <button type="button" class="btn-remove" onclick="this.closest('.form-item').remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="form-grid">
      <div class="input-group">
        <input type="text" placeholder=" " required>
        <label>Project name</label>
      </div>
      <div class="input-group">
        <input type="url" placeholder=" ">
        <label>Project URL (optional)</label>
      </div>
    </div>
    <div class="input-group">
      <textarea placeholder=" " rows="3"></textarea>
      <label>Description</label>
    </div>
  `;
  return div;
}

function createEducationItem() {
  const div = document.createElement('div');
  div.className = 'form-item';
  div.innerHTML = `
    <div class="form-item-header">
      <h4>Education</h4>
      <button type="button" class="btn-remove" onclick="this.closest('.form-item').remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="form-grid">
      <div class="input-group">
        <input type="text" placeholder=" " required>
        <label>Degree</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" " required>
        <label>School</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" ">
        <label>Year</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" ">
        <label>GPA (optional)</label>
      </div>
    </div>
  `;
  return div;
}

function createCertificationItem() {
  const div = document.createElement('div');
  div.className = 'form-item';
  div.innerHTML = `
    <div class="form-item-header">
      <h4>Certification</h4>
      <button type="button" class="btn-remove" onclick="this.closest('.form-item').remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="form-grid">
      <div class="input-group">
        <input type="text" placeholder=" " required>
        <label>Certification name</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" " required>
        <label>Issuing organization</label>
      </div>
      <div class="input-group">
        <input type="text" placeholder=" ">
        <label>Date obtained</label>
      </div>
      <div class="input-group">
        <input type="url" placeholder=" ">
        <label>Credential URL (optional)</label>
      </div>
    </div>
  `;
  return div;
}

// Skills management
function displaySkills(skills) {
  const container = document.getElementById('skillsList');
  container.innerHTML = '';
  
  skills.forEach(skill => {
    const skillChip = document.createElement('span');
    skillChip.className = 'skill-chip';
    skillChip.innerHTML = `
      ${skill}
      <button onclick="this.parentElement.remove()" class="skill-remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    container.appendChild(skillChip);
  });
}

// Enhanced settings functions
function handleUpgrade() {
  showToast('Upgrade plans coming soon! Premium features will include unlimited resumes and advanced templates.', 'info');
}

// Enhanced profile loading to include all onboarding data
async function loadProfile() {
  try {
    // Load from local storage (onboarding data)
    const localData = await chrome.storage.local.get([
      'profile', 'tempId', 'name', 'email', 'phone', 'location', 
      'linkedinUrl', 'portfolioUrl', 'summary', 'skills', 
      'experience', 'projects', 'education', 'certifications'
    ]);
    
    // Populate basic information
    if (localData.name) document.getElementById('name').value = localData.name;
    if (localData.email) document.getElementById('profileEmail').value = localData.email;
    if (localData.phone) document.getElementById('phone').value = localData.phone;
    if (localData.location) document.getElementById('location').value = localData.location;
    if (localData.linkedinUrl) document.getElementById('linkedinUrl').value = localData.linkedinUrl;
    if (localData.portfolioUrl) document.getElementById('portfolioUrl').value = localData.portfolioUrl;
    if (localData.summary) document.getElementById('summary').value = localData.summary;
    
    // Load profile data if it exists
    if (localData.profile) {
      const profile = localData.profile;
      if (profile.name) document.getElementById('name').value = profile.name;
      if (profile.email) document.getElementById('profileEmail').value = profile.email;
      if (profile.phone) document.getElementById('phone').value = profile.phone;
      if (profile.location) document.getElementById('location').value = profile.location;
      if (profile.summary) document.getElementById('summary').value = profile.summary;
      
      // Load skills
      if (profile.skills && Array.isArray(profile.skills)) {
        displaySkills(profile.skills);
      }
      
      // Load experience
      if (profile.experience && Array.isArray(profile.experience)) {
        profile.experience.forEach(exp => {
          const item = createExperienceItem();
          const inputs = item.querySelectorAll('input, textarea');
          inputs[0].value = exp.role || exp.title || '';
          inputs[1].value = exp.company || '';
          inputs[2].value = exp.startDate || '';
          inputs[3].value = exp.endDate || '';
          inputs[4].value = exp.description || '';
          document.getElementById('experienceContainer').appendChild(item);
        });
      }
      
      // Load projects
      if (profile.projects && Array.isArray(profile.projects)) {
        profile.projects.forEach(proj => {
          const item = createProjectItem();
          const inputs = item.querySelectorAll('input, textarea');
          inputs[0].value = proj.name || '';
          inputs[1].value = proj.url || '';
          inputs[2].value = proj.description || '';
          document.getElementById('projectsContainer').appendChild(item);
        });
      }
      
      // Load education
      if (profile.education && Array.isArray(profile.education)) {
        profile.education.forEach(edu => {
          const item = createEducationItem();
          const inputs = item.querySelectorAll('input');
          inputs[0].value = edu.degree || '';
          inputs[1].value = edu.school || '';
          inputs[2].value = edu.year || '';
          inputs[3].value = edu.gpa || '';
          document.getElementById('educationContainer').appendChild(item);
        });
      }
    }
    
    showToast('Profile loaded successfully', 'success');
  } catch (error) {
    console.error('Failed to load profile:', error);
    showToast('Failed to load profile', 'error');
  }
}

// Generate tab functionality
function updateCharCount() {
  const text = document.getElementById('jdInput').value;
  document.getElementById('charCount').textContent = text.length;
}

async function useSelection() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' });
  
  if (response && response.selection) {
    document.getElementById('jdInput').value = response.selection;
    updateCharCount();
    showToast('Text imported successfully', 'success');
  } else {
    showToast('Please select text on the page first', 'warning');
  }
}

async function analyzeResume() {
  const jdText = document.getElementById('jdInput').value;
  
  if (!jdText || jdText.length < 200) {
    showToast('Please provide a complete job description (min 200 characters)', 'warning');
    return;
  }
  
  if (!currentProfile || !currentProfile.name) {
    showToast('Please complete your profile first', 'warning');
    switchTab('profile');
    return;
  }
  
  showLoading('Analyzing job description...');
  
  try {
    const useAI = await chrome.storage.local.get('openaiKey');
    
    if (useAI.openaiKey) {
      // AI-powered analysis
      showLoading('AI is optimizing your resume...');
      aiAnalysis = await analyzeJobWithAI(jdText, currentProfile);
      
      currentSignals = {
        roleGuess: aiAnalysis.jobTitle,
        topKeywords: aiAnalysis.criticalKeywords?.concat(aiAnalysis.importantKeywords || []) || [],
        mustHave: aiAnalysis.criticalKeywords || [],
        niceToHave: aiAnalysis.importantKeywords || [],
        domainHints: [],
        companyName: null,
        locationHints: null,
        jdText: jdText,
        atsScore: aiAnalysis.atsScore || 85
      };
      
      // Generate optimized content
      const optimizedExperience = [];
      for (let i = 0; i < currentProfile.experience.length; i++) {
        const exp = currentProfile.experience[i];
        const optimized = await generateOptimizedBullets(
          exp,
          aiAnalysis.criticalKeywords || [],
          aiAnalysis.customizations?.tone || 'professional'
        );
        optimizedExperience.push({
          jobIndex: i,
          newBullets: Array.isArray(optimized) ? optimized : exp.bullets
        });
      }
      
      const dynamicSummary = await generateDynamicSummary(currentProfile, aiAnalysis);
      
      tailoredDraft = {
        summary: dynamicSummary || currentProfile.headline,
        skills: aiAnalysis.skillsPriority || currentProfile.skills,
        experienceBullets: optimizedExperience,
        projectsBullets: [],
        notes: aiAnalysis.warnings || [],
        template: currentProfile.template || 'modern'
      };
      
    } else {
      // Fallback to basic analysis
      currentSignals = await extractSignals(jdText);
      tailoredDraft = await mapToResume(currentProfile, currentSignals);
      currentSignals.atsScore = calculateBasicScore(currentProfile, currentSignals);
    }
    
    hideLoading();
    showResults();
    
  } catch (error) {
    console.error('Analysis failed:', error);
    hideLoading();
    showToast('Analysis failed. Please try again.', 'error');
  }
}

function calculateBasicScore(profile, signals) {
  const profileSkills = new Set(profile.skills.map(s => s.toLowerCase()));
  const requiredKeywords = signals.topKeywords.slice(0, 10);
  const matched = requiredKeywords.filter(kw => profileSkills.has(kw.toLowerCase()));
  return Math.round((matched.length / requiredKeywords.length) * 100);
}

function showResults() {
  document.getElementById('resultsSection').classList.remove('hidden');
  
  // Animate score
  const score = currentSignals.atsScore || 75;
  animateScore(score);
  
  // Update insights
  const matchedSkills = currentSignals.topKeywords.filter(kw => 
    currentProfile.skills.some(s => s.toLowerCase().includes(kw.toLowerCase()))
  ).length;
  
  document.getElementById('matchedSkills').textContent = matchedSkills;
  document.getElementById('keywordsFound').textContent = currentSignals.topKeywords.length;
  document.getElementById('optimizations').textContent = tailoredDraft.experienceBullets.length;
  
  // Show changes
  displayChanges();
  
  // Scroll to results
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function animateScore(targetScore) {
  const scoreElement = document.getElementById('atsScore');
  const progressBar = document.getElementById('scoreProgress');
  const messageElement = document.getElementById('scoreMessage');
  
  let currentScore = 0;
  const increment = targetScore / 50;
  
  const timer = setInterval(() => {
    currentScore += increment;
    if (currentScore >= targetScore) {
      currentScore = targetScore;
      clearInterval(timer);
    }
    
    scoreElement.textContent = Math.round(currentScore);
    progressBar.style.width = currentScore + '%';
  }, 20);
  
  // Update message based on score
  if (targetScore >= 90) {
    messageElement.textContent = 'Excellent match! Your resume is highly optimized.';
  } else if (targetScore >= 75) {
    messageElement.textContent = 'Good match! A few tweaks will make it perfect.';
  } else if (targetScore >= 60) {
    messageElement.textContent = 'Fair match. Consider adding relevant skills.';
  } else {
    messageElement.textContent = 'Needs improvement. Review the suggestions below.';
  }
}

function displayChanges() {
  const container = document.getElementById('changesContainer');
  container.innerHTML = '';
  
  // Add summary change
  if (tailoredDraft.summary) {
    const changeCard = createChangeCard('Summary', currentProfile.headline, tailoredDraft.summary);
    container.appendChild(changeCard);
  }
  
  // Add bullet changes
  tailoredDraft.experienceBullets.forEach(change => {
    const exp = currentProfile.experience[change.jobIndex];
    if (exp) {
      change.newBullets.forEach((newBullet, idx) => {
        const oldBullet = exp.bullets[idx];
        if (oldBullet && oldBullet !== newBullet) {
          const changeCard = createChangeCard(
            `${exp.role} - Bullet ${idx + 1}`,
            oldBullet,
            newBullet
          );
          container.appendChild(changeCard);
        }
      });
    }
  });
}

function createChangeCard(title, oldText, newText) {
  const card = document.createElement('div');
  card.className = 'change-card';
  card.innerHTML = `
    <div class="change-header">
      <span class="change-title">${title}</span>
      <label class="toggle">
        <input type="checkbox" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="change-content">
      <div class="old-text">${oldText}</div>
      <div class="new-text">${newText}</div>
    </div>
  `;
  return card;
}

async function downloadPDF() {
  if (!tailoredDraft || !currentSignals) {
    showToast('Please analyze a job description first', 'warning');
    return;
  }
  
  showLoading('Generating PDF...');
  
  try {
    const latex = await generateLatex(currentProfile, tailoredDraft, 'modern', currentSignals);
    
    const result = await chrome.runtime.sendMessage({
      action: 'compilePDF',
      latex: latex
    });
    
    hideLoading();
    
    if (result.error) {
      // Fallback to LaTeX download
      downloadLatexFile(latex);
      showToast('PDF compilation unavailable. LaTeX file downloaded.', 'warning');
    } else {
      // Download PDF
      const link = document.createElement('a');
      link.href = result.dataUrl;
      link.download = `${currentProfile.name.replace(/\s+/g, '_')}_Resume.pdf`;
      link.click();
      showToast('Resume downloaded successfully!', 'success');
    }
  } catch (error) {
    hideLoading();
    showToast('Download failed. Please try again.', 'error');
  }
}

function downloadLatexFile(latex) {
  const blob = new Blob([latex], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${currentProfile.name.replace(/\s+/g, '_')}_Resume.tex`;
  link.click();
  URL.revokeObjectURL(url);
}

// Profile management
async function loadOrCreateProfile() {
  const profile = await chrome.runtime.sendMessage({ action: 'getProfile' });
  if (!profile.error) {
    currentProfile = profile;
    loadProfile();
  } else {
    currentProfile = {
      email: currentUser.email,
      name: '',
      phone: '',
      location: '',
      headline: '',
      summary_narrative: '',
      skills: [],
      experience: [],
      projects: [],
      education: [],
      template: 'modern'
    };
  }
}

function loadProfile() {
  if (!currentProfile) return;
  
  document.getElementById('name').value = currentProfile.name || '';
  document.getElementById('profileEmail').value = currentProfile.email || '';
  document.getElementById('phone').value = currentProfile.phone || '';
  document.getElementById('location').value = currentProfile.location || '';
  document.getElementById('summary').value = currentProfile.summary_narrative || '';
  
  // Load skills
  const skillsList = document.getElementById('skillsList');
  skillsList.innerHTML = '';
  (currentProfile.skills || []).forEach(skill => {
    addSkillChip(skill);
  });
}

async function saveProfile(e) {
  e.preventDefault();
  
  currentProfile.name = document.getElementById('name').value;
  currentProfile.email = document.getElementById('profileEmail').value;
  currentProfile.phone = document.getElementById('phone').value;
  currentProfile.location = document.getElementById('location').value;
  currentProfile.summary_narrative = document.getElementById('summary').value;
  
  showLoading('Saving profile...');
  
  const result = await chrome.runtime.sendMessage({
    action: 'saveProfile',
    profile: currentProfile
  });
  
  hideLoading();
  
  if (result.success && result.synced) {
    showToast('Profile saved to cloud', 'success');
  } else if (result.success) {
    showToast(result.warning || 'Saved locally. Sign in to sync.', 'warning');
  } else {
    showToast(result.warning || 'Failed to save profile', 'error');
  }
}

function addSkill() {
  const input = document.getElementById('skillInput');
  const skill = input.value.trim();
  
  if (skill && !currentProfile.skills.includes(skill)) {
    currentProfile.skills.push(skill);
    addSkillChip(skill);
    input.value = '';
    showToast(`Added skill: ${skill}`, 'success');
  }
}

function addSkillChip(skill) {
  const chip = document.createElement('div');
  chip.className = 'skill-chip';
  chip.innerHTML = `
    <span>${skill}</span>
    <button onclick="removeSkill('${skill}')">×</button>
  `;
  document.getElementById('skillsList').appendChild(chip);
}

window.removeSkill = function(skill) {
  currentProfile.skills = currentProfile.skills.filter(s => s !== skill);
  loadProfile();
};

// Settings management
async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    showToast('Please enter an API key', 'warning');
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    showToast('Invalid API key format', 'error');
    return;
  }
  
  await chrome.storage.local.set({ openaiKey: apiKey });
  document.getElementById('apiKey').value = '';
  showToast('API key saved successfully!', 'success');
}

async function loadApiKeyStatus() {
  const { openaiKey } = await chrome.storage.local.get('openaiKey');
  if (openaiKey) {
    document.getElementById('apiKey').placeholder = 'API key configured';
  }
}

async function exportData() {
  const data = {
    profile: currentProfile,
    exportDate: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'resume_pro_backup.json';
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Data exported successfully', 'success');
}

async function deleteAccount() {
  if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) {
    return;
  }
  
  await chrome.storage.local.clear();
  currentUser = null;
  currentProfile = null;
  showAuthView();
  showToast('Account deleted', 'success');
}

// UI utilities
function showLoading(message = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('hidden');
  overlay.querySelector('.loading-text').textContent = message;
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type} fade-in`;
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      ${type === 'success' ? '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
      ${type === 'error' ? '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : ''}
      ${type === 'warning' ? '<path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : ''}
    </svg>
    <span>${message}</span>
  `;
  
  const container = document.getElementById('toastContainer');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
