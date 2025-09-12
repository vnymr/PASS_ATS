// Use global namespace modules
const { extractSignals, mapToResume } = window.ResumeModules?.Extract || {};
const { generateLatex } = window.ResumeModules?.Latex || {};
const { analyzeJobWithAI, generateOptimizedBullets, generateDynamicSummary } = window.ResumeModules?.AIAnalyzer || {};

let currentUser = null;
let currentProfile = null;
let tailoredDraft = null;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  setupEventListeners();
  loadStoredJD();
  loadApiKeyStatus();
  setupActivityTracking();
  detectCurrentJob();
});

async function checkAuthStatus() {
  const { authToken, profile, tempId } = await chrome.storage.local.get(['authToken', 'profile', 'tempId']);
  
  if (authToken) {
    try {
      const serverProfile = await chrome.runtime.sendMessage({ action: 'getProfile' });
      if (!serverProfile.error) {
        currentProfile = serverProfile;
        currentUser = { email: serverProfile.email };
        showProfileView();
        loadProfile();
        return;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  }
  
  // Check for local profile data (from onboarding)
  if (profile && tempId) {
    currentProfile = profile;
    currentUser = { email: profile.email };
    showProfileView();
    loadProfile();
  } else {
    // Show auth view if no profile data
    showAuthView();
  }
}

function setupEventListeners() {
  document.getElementById('authForm').addEventListener('submit', handleAuth);
  document.getElementById('signupBtn').addEventListener('click', handleSignup);
  document.getElementById('magicLinkBtn').addEventListener('click', handleMagicLink);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  
  // Navigation
  document.getElementById('homeBtn').addEventListener('click', () => switchTab('dashboard'));
  
  // Fix for "Generate First Resume" button
  const generateFirstResumeBtn = document.getElementById('generateFirstResumeBtn');
  if (generateFirstResumeBtn) {
    generateFirstResumeBtn.addEventListener('click', () => switchTab('dashboard'));
  }
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Dashboard events
  document.getElementById('generateResumeBtn').addEventListener('click', handleGenerateResume);
  document.getElementById('refreshActivityBtn').addEventListener('click', refreshActivity);
  
  // Settings events
  document.getElementById('upgradePlanBtn').addEventListener('click', handleUpgradePlan);
  document.getElementById('deleteAccountBtn').addEventListener('click', handleDeleteAccount);
  
  // History events
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => filterHistory(e.target.dataset.filter));
  });
  
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('addSkillBtn').addEventListener('click', addSkill);
  document.getElementById('skillInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  });
  
  document.getElementById('addExperienceBtn').addEventListener('click', addExperience);
  document.getElementById('addProjectBtn').addEventListener('click', addProject);
  document.getElementById('addEducationBtn').addEventListener('click', addEducation);
  
  document.getElementById('useSelectionBtn').addEventListener('click', useSelection);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeTailor);
  document.getElementById('generatePdfBtn').addEventListener('click', generatePDF);
  document.getElementById('downloadTexBtn').addEventListener('click', downloadTex);
  
  document.getElementById('exportProfileBtn').addEventListener('click', exportProfile);
  document.getElementById('deleteDataBtn').addEventListener('click', deleteData);
  document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  // Clear any previous error messages
  clearAuthError();
  
  if (!email || !password) {
    showAuthError('Please enter both email and password');
    return;
  }
  
  showLoading(true);
  const result = await chrome.runtime.sendMessage({
    action: 'authenticate',
    credentials: { email, password }
  });
  showLoading(false);
  
  if (!result.error) {
    currentUser = { email };
    await loadOrCreateProfile();
    showProfileView();
  } else {
    showAuthError(result.error);
  }
}

async function handleSignup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  clearAuthError();
  
  if (!email || !password) {
    showAuthError('Please enter both email and password');
    return;
  }
  
  // Use the same authentication endpoint - server creates account if user doesn't exist
  showLoading(true);
  const result = await chrome.runtime.sendMessage({
    action: 'authenticate',
    credentials: { email, password }
  });
  showLoading(false);
  
  if (!result.error) {
    currentUser = { email };
    await loadOrCreateProfile();
    showProfileView();
    if (result.isNew) {
      // Show a welcome message for new users
      const successDiv = document.createElement('div');
      successDiv.className = 'auth-success';
      successDiv.textContent = 'Welcome! Your account has been created successfully.';
      successDiv.style.cssText = 'background: #d1fae5; border: 1px solid #a7f3d0; color: #065f46; padding: 8px 12px; border-radius: 4px; margin: 12px 0; font-size: 13px;';
      document.querySelector('.auth-container').appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 3000);
    }
  } else {
    showAuthError(result.error);
  }
}

async function handleMagicLink() {
  const email = document.getElementById('email').value.trim();
  
  clearAuthError();
  
  if (!email) {
    showAuthError('Please enter your email address');
    return;
  }
  
  showAuthError('Magic link feature is coming soon. For now, please use the signup button to create an account.');
}

async function handleLogout() {
  await chrome.storage.local.remove(['authToken']);
  currentUser = null;
  currentProfile = null;
  showAuthView();
}

function showAuthView() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('profileView').classList.add('hidden');
  document.getElementById('userInfo').classList.add('hidden');
}

function showAuthView() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('profileView').classList.add('hidden');
  document.getElementById('userInfo').classList.add('hidden');
}

function showProfileView() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('profileView').classList.remove('hidden');
  document.getElementById('userInfo').classList.remove('hidden');
  if (currentUser) {
    document.getElementById('userEmail').textContent = currentUser.email;
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  document.getElementById(tabName + 'Tab').classList.remove('hidden');
}

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
      template: 'standard'
    };
  }
}

function loadProfile() {
  if (!currentProfile) return;
  
  document.getElementById('name').value = currentProfile.name || '';
  document.getElementById('phone').value = currentProfile.phone || '';
  document.getElementById('location').value = currentProfile.location || '';
  document.getElementById('headline').value = currentProfile.headline || '';
  document.getElementById('summaryNarrative').value = currentProfile.summary_narrative || '';
  
  const skillsList = document.getElementById('skillsList');
  skillsList.innerHTML = '';
  (currentProfile.skills || []).forEach(skill => {
    addSkillChip(skill);
  });
  
  const expContainer = document.getElementById('experienceContainer');
  expContainer.innerHTML = '';
  (currentProfile.experience || []).forEach((exp, idx) => {
    addExperienceItem(exp, idx);
  });
  
  const projContainer = document.getElementById('projectsContainer');
  projContainer.innerHTML = '';
  (currentProfile.projects || []).forEach((proj, idx) => {
    addProjectItem(proj, idx);
  });
  
  const eduContainer = document.getElementById('educationContainer');
  eduContainer.innerHTML = '';
  (currentProfile.education || []).forEach((edu, idx) => {
    addEducationItem(edu, idx);
  });
}

async function saveProfile(e) {
  e.preventDefault();
  
  currentProfile.name = document.getElementById('name').value;
  currentProfile.phone = document.getElementById('phone').value;
  currentProfile.location = document.getElementById('location').value;
  currentProfile.headline = document.getElementById('headline').value;
  currentProfile.summary_narrative = document.getElementById('summaryNarrative').value;
  
  showLoading(true);
  const result = await chrome.runtime.sendMessage({
    action: 'saveProfile',
    profile: currentProfile
  });
  showLoading(false);
  
  if (result.success && result.synced) {
    alert('Profile saved to cloud');
  } else if (result.success) {
    alert(result.warning || 'Saved locally. Please sign in to sync.');
  } else {
    alert(result.warning || 'Failed to save profile');
  }
}

function addSkill() {
  const input = document.getElementById('skillInput');
  const skill = input.value.trim();
  
  if (skill && !currentProfile.skills.includes(skill)) {
    currentProfile.skills.push(skill);
    addSkillChip(skill);
    input.value = '';
  }
}

function addSkillChip(skill) {
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.innerHTML = `
    ${skill}
    <button onclick="removeSkill('${skill}')">&times;</button>
  `;
  document.getElementById('skillsList').appendChild(chip);
}

window.removeSkill = function(skill) {
  currentProfile.skills = currentProfile.skills.filter(s => s !== skill);
  loadProfile();
};

function addExperience() {
  const exp = {
    company: '',
    role: '',
    start: '',
    end: '',
    bullets: ['']
  };
  currentProfile.experience.push(exp);
  addExperienceItem(exp, currentProfile.experience.length - 1);
}

function addExperienceItem(exp, idx) {
  const div = document.createElement('div');
  div.className = 'experience-item';
  div.innerHTML = `
    <input type="text" placeholder="Company" value="${exp.company}" 
           onchange="updateExperience(${idx}, 'company', this.value)">
    <input type="text" placeholder="Role" value="${exp.role}"
           onchange="updateExperience(${idx}, 'role', this.value)">
    <input type="text" placeholder="Start Date" value="${exp.start}"
           onchange="updateExperience(${idx}, 'start', this.value)">
    <input type="text" placeholder="End Date" value="${exp.end}"
           onchange="updateExperience(${idx}, 'end', this.value)">
    <div class="bullet-list" id="exp-bullets-${idx}">
      ${exp.bullets.map((b, bidx) => `
        <div class="bullet-item">
          <input type="text" placeholder="Achievement/Responsibility" value="${b}"
                 onchange="updateExperienceBullet(${idx}, ${bidx}, this.value)">
          <button onclick="removeExperienceBullet(${idx}, ${bidx})">&times;</button>
        </div>
      `).join('')}
    </div>
    <button onclick="addExperienceBullet(${idx})" class="btn-text">+ Add bullet</button>
    <button onclick="removeExperience(${idx})" class="btn-text">Remove</button>
  `;
  document.getElementById('experienceContainer').appendChild(div);
}

window.updateExperience = function(idx, field, value) {
  currentProfile.experience[idx][field] = value;
};

window.updateExperienceBullet = function(expIdx, bulletIdx, value) {
  currentProfile.experience[expIdx].bullets[bulletIdx] = value;
};

window.addExperienceBullet = function(idx) {
  currentProfile.experience[idx].bullets.push('');
  loadProfile();
};

window.removeExperienceBullet = function(expIdx, bulletIdx) {
  currentProfile.experience[expIdx].bullets.splice(bulletIdx, 1);
  loadProfile();
};

window.removeExperience = function(idx) {
  currentProfile.experience.splice(idx, 1);
  loadProfile();
};

function addProject() {
  const proj = {
    name: '',
    bullets: ['']
  };
  currentProfile.projects.push(proj);
  addProjectItem(proj, currentProfile.projects.length - 1);
}

function addProjectItem(proj, idx) {
  const div = document.createElement('div');
  div.className = 'project-item';
  div.innerHTML = `
    <input type="text" placeholder="Project Name" value="${proj.name}"
           onchange="updateProject(${idx}, 'name', this.value)">
    <div class="bullet-list">
      ${proj.bullets.map((b, bidx) => `
        <div class="bullet-item">
          <input type="text" placeholder="Description" value="${b}"
                 onchange="updateProjectBullet(${idx}, ${bidx}, this.value)">
          <button onclick="removeProjectBullet(${idx}, ${bidx})">&times;</button>
        </div>
      `).join('')}
    </div>
    <button onclick="addProjectBullet(${idx})" class="btn-text">+ Add bullet</button>
    <button onclick="removeProject(${idx})" class="btn-text">Remove</button>
  `;
  document.getElementById('projectsContainer').appendChild(div);
}

window.updateProject = function(idx, field, value) {
  currentProfile.projects[idx][field] = value;
};

window.updateProjectBullet = function(projIdx, bulletIdx, value) {
  currentProfile.projects[projIdx].bullets[bulletIdx] = value;
};

window.addProjectBullet = function(idx) {
  currentProfile.projects[idx].bullets.push('');
  loadProfile();
};

window.removeProjectBullet = function(projIdx, bulletIdx) {
  currentProfile.projects[projIdx].bullets.splice(bulletIdx, 1);
  loadProfile();
};

window.removeProject = function(idx) {
  currentProfile.projects.splice(idx, 1);
  loadProfile();
};

function addEducation() {
  const edu = {
    school: '',
    degree: '',
    period: '',
    bullets: []
  };
  currentProfile.education.push(edu);
  addEducationItem(edu, currentProfile.education.length - 1);
}

function addEducationItem(edu, idx) {
  const div = document.createElement('div');
  div.className = 'education-item';
  div.innerHTML = `
    <input type="text" placeholder="School" value="${edu.school}"
           onchange="updateEducation(${idx}, 'school', this.value)">
    <input type="text" placeholder="Degree" value="${edu.degree}"
           onchange="updateEducation(${idx}, 'degree', this.value)">
    <input type="text" placeholder="Period" value="${edu.period}"
           onchange="updateEducation(${idx}, 'period', this.value)">
    <button onclick="removeEducation(${idx})" class="btn-text">Remove</button>
  `;
  document.getElementById('educationContainer').appendChild(div);
}

window.updateEducation = function(idx, field, value) {
  currentProfile.education[idx][field] = value;
};

window.removeEducation = function(idx) {
  currentProfile.education.splice(idx, 1);
  loadProfile();
};

async function loadStoredJD() {
  const { jdText } = await chrome.storage.local.get('jdText');
  if (jdText) {
    document.getElementById('jdInput').value = jdText;
    chrome.storage.local.remove('jdText');
  }
}

async function useSelection() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' });
  
  if (response && response.selection) {
    document.getElementById('jdInput').value = response.selection;
  } else {
    alert('Please select text on the page first');
  }
}

let currentSignals = null;
let aiAnalysis = null;

async function analyzeTailor() {
  const jdText = document.getElementById('jdInput').value;
  if (!jdText || jdText.length < 200) {
    alert('Please provide a complete job description (at least 200 characters)');
    return;
  }
  
  if (!currentProfile || !currentProfile.name) {
    alert('Please complete your profile first');
    switchTab('profile');
    return;
  }
  
  showLoading(true);
  
  try {
    const useAI = await chrome.storage.local.get('openaiKey');
    
    if (useAI.openaiKey) {
      aiAnalysis = await analyzeJobWithAI(jdText, currentProfile);
      
      currentSignals = {
        roleGuess: aiAnalysis.jobTitle,
        topKeywords: aiAnalysis.criticalKeywords.concat(aiAnalysis.importantKeywords),
        mustHave: aiAnalysis.criticalKeywords,
        niceToHave: aiAnalysis.importantKeywords,
        domainHints: [],
        companyName: null,
        locationHints: null,
        jdText: jdText,
        atsScore: aiAnalysis.atsScore
      };
      
      const optimizedExperience = [];
      for (let i = 0; i < currentProfile.experience.length; i++) {
        const exp = currentProfile.experience[i];
        const optimized = await generateOptimizedBullets(
          exp,
          aiAnalysis.criticalKeywords,
          aiAnalysis.customizations.tone
        );
        optimizedExperience.push({
          jobIndex: i,
          newBullets: optimized
        });
      }
      
      const dynamicSummary = await generateDynamicSummary(currentProfile, aiAnalysis);
      
      tailoredDraft = {
        summary: dynamicSummary,
        skills: aiAnalysis.skillsPriority || currentProfile.skills,
        experienceBullets: optimizedExperience,
        projectsBullets: [],
        notes: aiAnalysis.warnings || [],
        template: currentProfile.template || 'standard'
      };
      
    } else {
      currentSignals = extractSignals(jdText);
      tailoredDraft = mapToResume(currentProfile, currentSignals);
    }
    
  } catch (error) {
    console.error('AI analysis failed, using fallback:', error);
    currentSignals = extractSignals(jdText);
    tailoredDraft = mapToResume(currentProfile, currentSignals);
  }
  
  showLoading(false);
  showPreview(currentSignals, tailoredDraft);
}

function showPreview(signals, draft) {
  if (signals.atsScore) {
    document.getElementById('atsScoreCard').classList.remove('hidden');
    document.getElementById('atsScore').textContent = signals.atsScore;
    document.getElementById('scoreProgress').style.width = `${signals.atsScore}%`;
  }
  
  document.getElementById('roleGuess').textContent = signals.roleGuess || 'Not detected';
  
  const keywordsDiv = document.getElementById('topKeywords');
  keywordsDiv.innerHTML = '';
  signals.topKeywords.slice(0, 10).forEach(keyword => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = keyword;
    keywordsDiv.appendChild(chip);
  });
  
  document.getElementById('proposedSummary').textContent = draft.summary;
  
  const skillsDiv = document.getElementById('skillsPreview');
  skillsDiv.innerHTML = '';
  draft.skills.forEach(skill => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = skill;
    skillsDiv.appendChild(chip);
  });
  
  const changesDiv = document.getElementById('bulletChanges');
  changesDiv.innerHTML = '';
  draft.experienceBullets.forEach(change => {
    const exp = currentProfile.experience[change.jobIndex];
    const changeDiv = document.createElement('div');
    changeDiv.className = 'preview-card';
    changeDiv.innerHTML = `
      <h4>${exp.role} at ${exp.company}</h4>
      ${change.newBullets.map((newBullet, idx) => {
        const oldBullet = exp.bullets[idx] || '';
        if (oldBullet !== newBullet) {
          return `
            <div class="toggle-item">
              <input type="checkbox" id="bullet-${change.jobIndex}-${idx}" checked>
              <label for="bullet-${change.jobIndex}-${idx}">
                <span class="diff-old">${oldBullet}</span>
                <span class="diff-new">${newBullet}</span>
              </label>
            </div>
          `;
        }
        return '';
      }).join('')}
    `;
    changesDiv.appendChild(changeDiv);
  });
  
  if (draft.notes && draft.notes.length > 0) {
    const warningsDiv = document.getElementById('warnings');
    warningsDiv.innerHTML = `
      <h4>Warnings</h4>
      <ul>
        ${draft.notes.map(note => `<li>${note}</li>`).join('')}
      </ul>
    `;
    warningsDiv.classList.remove('hidden');
  }
  
  document.getElementById('previewSection').classList.remove('hidden');
}

async function generatePDF() {
  if (!tailoredDraft || !currentSignals) return;
  
  const acceptedDraft = getAcceptedChanges();
  const template = document.querySelector('input[name="template"]:checked').value;
  
  showLoading(true);
  
  const latex = await generateLatex(currentProfile, acceptedDraft, template, currentSignals);
  
  const result = await chrome.runtime.sendMessage({
    action: 'compilePDF',
    latex: latex
  });
  
  showLoading(false);
  
  if (result.error) {
    alert('PDF generation failed. Downloading LaTeX file instead.');
    downloadTexFile(latex);
  } else {
    downloadPDF(result.dataUrl);
  }
}

function getAcceptedChanges() {
  const draft = { ...tailoredDraft };
  
  if (!document.getElementById('acceptSummary').checked) {
    draft.summary = currentProfile.headline || '';
  }
  
  draft.experienceBullets.forEach((change, idx) => {
    const checkboxes = document.querySelectorAll(`#bullet-${change.jobIndex}-${idx}`);
    checkboxes.forEach((cb, bulletIdx) => {
      if (!cb.checked) {
        change.newBullets[bulletIdx] = currentProfile.experience[change.jobIndex].bullets[bulletIdx];
      }
    });
  });
  
  return draft;
}

function downloadPDF(dataUrl) {
  const link = document.createElement('a');
  link.href = dataUrl;
  const filename = `${currentProfile.name.replace(/\s+/g, '_')}_Resume.pdf`;
  link.download = filename;
  link.click();
}

async function downloadTex() {
  if (!tailoredDraft || !currentSignals) return;
  
  const acceptedDraft = getAcceptedChanges();
  const template = document.querySelector('input[name="template"]:checked').value;
  const latex = await generateLatex(currentProfile, acceptedDraft, template, currentSignals);
  
  downloadTexFile(latex);
}

function downloadTexFile(latex) {
  const blob = new Blob([latex], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${currentProfile.name.replace(/\s+/g, '_')}_Resume.tex`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportProfile() {
  const blob = new Blob([JSON.stringify(currentProfile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'profile.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function deleteData() {
  if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
    await chrome.storage.local.clear();
    currentUser = null;
    currentProfile = null;
    showAuthView();
    alert('All data deleted');
  }
}

async function saveApiKey() {
  const apiKey = document.getElementById('openaiKey').value.trim();
  
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    alert('Invalid API key format. OpenAI keys start with "sk-"');
    return;
  }
  
  await chrome.storage.local.set({ openaiKey: apiKey });
  alert('API key saved successfully! AI-powered resume optimization is now enabled.');
  document.getElementById('openaiKey').value = '';
}

async function loadApiKeyStatus() {
  const { openaiKey } = await chrome.storage.local.get('openaiKey');
  if (openaiKey) {
    document.getElementById('openaiKey').placeholder = 'API key configured (sk-...)';
  }
}

function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

function showAuthError(message) {
  let errorDiv = document.getElementById('authError');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'authError';
    errorDiv.className = 'auth-error';
    const authForm = document.getElementById('authForm');
    authForm.parentNode.insertBefore(errorDiv, authForm.nextSibling);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function clearAuthError() {
  const errorDiv = document.getElementById('authError');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

// Activity tracking and job detection
async function setupActivityTracking() {
  // Listen for status updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'statusUpdate') {
      updateActivityBar(message.message, message.progress);
      // Also refresh history when status updates
      refreshHistory();
    }
  });
  
  // Load and display recent activity
  refreshActivity();
  refreshHistory();
}

async function detectCurrentJob() {
  try {
    // Get current tab to extract job information
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    // Try to extract job details from the page
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobData' });
    if (response && response.jobData) {
      showJobDetection(response.jobData);
    } else {
      hideJobDetection();
    }
  } catch (error) {
    console.log('No job detected on current page');
    hideJobDetection();
  }
}

function showJobDetection(jobData) {
  const card = document.getElementById('jobDetectionCard');
  const title = document.getElementById('detectedJobTitle');
  const details = document.getElementById('detectedJobDetails');
  const badge = document.getElementById('jobStatusBadge');
  
  title.textContent = jobData.role || 'Job Position';
  
  const detailParts = [];
  if (jobData.company) detailParts.push(jobData.company);
  if (jobData.location) detailParts.push(jobData.location);
  if (jobData.type) detailParts.push(jobData.type);
  
  details.textContent = detailParts.join(' • ') || 'Job details detected';
  badge.textContent = 'Ready';
  badge.className = 'status-badge';
  
  card.classList.remove('hidden');
  
  // Store job data for generation
  card.dataset.jobData = JSON.stringify(jobData);
}

function hideJobDetection() {
  document.getElementById('jobDetectionCard').classList.add('hidden');
}

async function handleGenerateResume() {
  const card = document.getElementById('jobDetectionCard');
  const jobData = JSON.parse(card.dataset.jobData || '{}');
  
  if (!jobData.jdText) {
    // Try to get job description from current page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobData' });
      if (response && response.jobData) {
        jobData.jdText = response.jobData.jdText;
      }
    } catch (error) {
      console.error('Could not extract job data:', error);
    }
  }
  
  if (!jobData.jdText) {
    alert('No job description found. Please navigate to a job posting page.');
    return;
  }
  
  // Update UI to show processing
  const badge = document.getElementById('jobStatusBadge');
  badge.textContent = 'Processing';
  badge.className = 'status-badge processing';
  
  const btn = document.getElementById('generateResumeBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-small"></div> Generating...';
  
  try {
    // Send to background script for processing
    const response = await chrome.runtime.sendMessage({
      action: 'generateResume',
      jobData: jobData
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Success - refresh activity to show new job
    refreshActivity();
    
  } catch (error) {
    console.error('Resume generation failed:', error);
    badge.textContent = 'Failed';
    badge.className = 'status-badge failed';
    alert(`Resume generation failed: ${error.message}`);
  } finally {
    // Reset button
    btn.disabled = false;
    btn.innerHTML = 'Generate Resume';
  }
}

async function refreshActivity() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getActiveJobs' });
    displayActivity(response);
  } catch (error) {
    console.error('Failed to refresh activity:', error);
  }
}

function displayActivity(data) {
  const container = document.getElementById('activityList');
  const { active = [], recent = [] } = data;
  
  // Clear existing content
  container.innerHTML = '';
  
  const allJobs = [...active, ...recent];
  
  if (allJobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        <p>No recent activity</p>
        <small>Generated resumes will appear here</small>
      </div>
    `;
    return;
  }
  
  allJobs.forEach(job => {
    const item = createActivityItem(job);
    container.appendChild(item);
  });
}

function createActivityItem(job) {
  const div = document.createElement('div');
  div.className = 'activity-item';
  
  const iconClass = job.status === 'completed' ? 'completed' : 
                   job.status === 'failed' ? 'failed' : 'processing';
  
  const iconSvg = job.status === 'completed' ? 
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' :
    job.status === 'failed' ?
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' :
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  
  const timeAgo = job.completedTime ? formatTimeAgo(job.completedTime) : 'In progress';
  const jobTitle = job.jobData?.role || 'Unknown Position';
  const company = job.jobData?.company || 'Unknown Company';
  
  div.innerHTML = `
    <div class="activity-item-icon ${iconClass}">
      ${iconSvg}
    </div>
    <div class="activity-item-content">
      <div class="activity-item-title">${jobTitle} @ ${company}</div>
      <div class="activity-item-details">${job.message} • ${timeAgo}</div>
    </div>
    <div class="activity-item-actions">
      ${job.status === 'completed' && job.result ? 
        `<button class="btn-small" onclick="downloadResume('${job.result.pdfUrl}')">Download</button>` : 
        ''
      }
    </div>
  `;
  
  return div;
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function updateActivityBar(message, progress) {
  const activityBar = document.getElementById('activityBar');
  const activityMessage = document.getElementById('activityMessage');
  const progressFill = document.getElementById('activityProgressFill');
  
  activityMessage.textContent = message;
  progressFill.style.width = `${progress || 0}%`;
  
  if (progress > 0) {
    activityBar.classList.remove('hidden');
  }
  
  if (progress >= 100) {
    setTimeout(() => {
      activityBar.classList.add('hidden');
      refreshActivity();
    }, 2000);
  }
}

function downloadResume(url) {
  if (url) {
    window.open(url, '_blank');
  }
}

// Settings handlers
async function handleUpgradePlan() {
  // For now, show coming soon message
  alert('Upgrade plans coming soon! Premium features will include unlimited resumes, priority AI processing, and advanced templates.');
}

async function handleDeleteAccount() {
  const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.');
  
  if (confirmed) {
    const doubleConfirm = confirm('This will permanently delete your account and all resume history. Type "DELETE" to confirm.');
    
    if (doubleConfirm) {
      try {
        // Clear all local data
        await chrome.storage.local.clear();
        
        // If authenticated, call server to delete account
        try {
          await chrome.runtime.sendMessage({ action: 'deleteAccount' });
        } catch (error) {
          console.warn('Server account deletion failed:', error);
        }
        
        // Reset UI
        currentProfile = null;
        currentUser = null;
        showAuthView();
        
        alert('Account deleted successfully.');
      } catch (error) {
        console.error('Account deletion failed:', error);
        alert('Failed to delete account. Please try again.');
      }
    }
  }
}

// History management
let historyFilter = 'all';

function filterHistory(filter) {
  historyFilter = filter;
  
  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  
  // Refresh history display
  refreshHistory();
}

async function refreshHistory() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getActiveJobs' });
    displayHistory(response);
  } catch (error) {
    console.error('Failed to refresh history:', error);
  }
}

function displayHistory(data) {
  const container = document.getElementById('historyList');
  const { active = [], recent = [] } = data;
  
  // Combine and filter jobs
  let allJobs = [...active, ...recent];
  
  if (historyFilter === 'completed') {
    allJobs = allJobs.filter(job => job.status === 'completed');
  } else if (historyFilter === 'failed') {
    allJobs = allJobs.filter(job => job.status === 'failed');
  }
  
  // Update stats
  const totalResumes = recent.filter(job => job.status === 'completed').length;
  const thisMonth = recent.filter(job => {
    if (job.status !== 'completed' || !job.completedTime) return false;
    const jobDate = new Date(job.completedTime);
    const now = new Date();
    return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
  }).length;
  
  document.getElementById('totalResumes').textContent = totalResumes;
  document.getElementById('thisMonth').textContent = thisMonth;
  
  // Clear and populate history
  container.innerHTML = '';
  
  if (allJobs.length === 0) {
    container.innerHTML = `
      <div class="empty-history">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        <h3>No Resume History</h3>
        <p>Your generated resumes will appear here</p>
        <button class="btn-primary" onclick="switchTab('dashboard')">Generate First Resume</button>
      </div>
    `;
    return;
  }
  
  allJobs.forEach(job => {
    const item = createHistoryItem(job);
    container.appendChild(item);
  });
}

function createHistoryItem(job) {
  const div = document.createElement('div');
  div.className = 'history-item';
  
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
  
  div.innerHTML = `
    <div class="history-item-icon ${statusClass}">
      ${statusIcon}
    </div>
    <div class="history-item-content">
      <div class="history-item-title">${jobTitle}</div>
      <div class="history-item-meta">${company} • ${timeAgo}</div>
      <div class="history-item-status ${statusClass}">${job.status === 'completed' ? 'Generated successfully' : job.status === 'failed' ? 'Generation failed' : 'Processing...'}</div>
    </div>
    <div class="history-item-actions">
      ${job.status === 'completed' && job.result ? 
        `<button class="btn-download" onclick="downloadResume('${job.result.pdfUrl}')">
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
  
  return div;
}
