let currentStep = 1;
let profileData = {
  resumeFile: null,
  resumeText: '',
  experience: '',
  tempId: null,
  name: '',
  email: '',
  phone: '',
  location: '',
  skills: [],
  roles: []
};

// Step navigation
function showStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}`).classList.add('active');
  currentStep = step;
}

// File upload handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');

uploadArea.addEventListener('click', () => fileInput.click());
// browseBtn is now a label for fileInput, so native click works; keep JS fallback for safety
const browseBtn = document.getElementById('browseBtn');
if (browseBtn) browseBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

async function handleFile(file) {
  const validTypes = ['application/pdf', 'application/msword', 
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                     'text/plain'];
  
  if (!validTypes.includes(file.type)) {
    alert('Please upload a PDF, DOC, DOCX, or TXT file');
    return;
  }
  
  profileData.resumeFile = file;
  
  // Read text content if possible
  if (file.type === 'text/plain') {
    const text = await file.text();
    profileData.resumeText = text;
    tryPrefillFromText(text);
    analyzeAndPreview();
  } else {
    // Delegate parsing to server for PDF/DOC/DOCX
    try {
      const fd = new FormData();
      fd.append('resume', file);
      let resp = null;
      const { serverUrl } = await chrome.storage.local.get('serverUrl');
      const API_BASE = (serverUrl || 'http://localhost:3000').replace(/\/$/, '');
      resp = await fetch(`${API_BASE}/onboarding/parse`, { method: 'POST', body: fd });
      if (resp.ok) {
        const data = await resp.json();
        profileData.resumeText = data.text || '';
        if (data.fields?.email) profileData.email = data.fields.email;
        if (data.fields?.phone) profileData.phone = data.fields.phone;
        if (data.fields?.name) profileData.name = data.fields.name;
        const emailInput = document.getElementById('emailInput');
        if (emailInput && profileData.email) emailInput.value = profileData.email;
        const phoneInput = document.getElementById('phoneInput');
        if (phoneInput && profileData.phone) phoneInput.value = profileData.phone;
        const nameInput = document.getElementById('nameInput');
        if (nameInput && profileData.name) nameInput.value = profileData.name;
        analyzeAndPreview();
      }
    } catch (e) {
      console.warn('Resume parse error:', e.message);
    }
  }
  
  fileInfo.style.display = 'block';
  fileInfo.innerHTML = `
    <strong>✓ File uploaded:</strong> ${file.name}<br>
    <small>Size: ${(file.size / 1024).toFixed(1)} KB</small>
  `;
  
  document.getElementById('nextStep1').disabled = false;
}

function tryPrefillFromText(text) {
  try {
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = text.match(/\+?\d[\d\s().-]{7,}\d/g);
    if (emailMatch) {
      profileData.email = emailMatch[0];
      const emailInput = document.getElementById('emailInput');
      if (emailInput) emailInput.value = profileData.email;
    }
    if (phoneMatch) {
      profileData.phone = phoneMatch[0];
      const phoneInput = document.getElementById('phoneInput');
      if (phoneInput) phoneInput.value = profileData.phone;
    }
  } catch {}
}

async function analyzeAndPreview() {
  // Call AI analyzer to structure and preview
  if (!profileData.resumeText || profileData.resumeText.length < 80) return;
  const loading = document.getElementById('previewLoading');
  const nextBtn = document.getElementById('nextStep2');
  try { if (loading) loading.style.display = 'block'; if (nextBtn) nextBtn.disabled = true; } catch {}
  try {
    const { serverUrl: serverUrl2 } = await chrome.storage.local.get('serverUrl');
    const API_BASE2 = (serverUrl2 || 'http://localhost:3000').replace(/\/$/, '');
    const resp = await fetch(`${API_BASE2}/onboarding/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: profileData.resumeText })
    });
    if (resp.ok) {
      const { structured } = await resp.json();
      if (structured?.summary) {
        document.getElementById('previewSummary').textContent = structured.summary;
      }
      if (Array.isArray(structured?.skills)) {
        const wrap = document.getElementById('previewSkills');
        wrap.innerHTML = '';
        structured.skills.slice(0, 24).forEach(s => {
          const chip = document.createElement('span');
          chip.textContent = s;
          chip.style.cssText = 'display:inline-block;background:#1b1b1b;border:1px solid #2a2a2a;border-radius:12px;padding:4px 8px;font-size:12px;';
          wrap.appendChild(chip);
        });
      }
      if (Array.isArray(structured?.experience)) {
        document.getElementById('previewExpCount').textContent = `${structured.experience.length} sections`;
      }
      // Detect links
      try {
        const links = Array.from(new Set((profileData.resumeText.match(/https?:\/\/\S+/g) || []).slice(0, 10)));
        document.getElementById('previewLinks').textContent = links.length ? links.join('  •  ') : '—';
      } catch {}
      // Merge into profileData for downstream usage
      if (structured?.summary) profileData.summary_narrative = structured.summary;
      if (Array.isArray(structured?.skills)) profileData.skills = Array.from(new Set([...(profileData.skills||[]), ...structured.skills])).slice(0,50);
      if (Array.isArray(structured?.experience)) profileData.experience = structured.experience;
      if (Array.isArray(structured?.projects)) profileData.projects = structured.projects;
      if (Array.isArray(structured?.education)) profileData.education = structured.education;
    }
  } catch (e) {
    console.warn('Analyze preview failed:', e.message);
  } finally {
    try { if (loading) loading.style.display = 'none'; if (nextBtn) nextBtn.disabled = false; } catch {}
  }
}

// Skip upload
document.getElementById('skipUpload').addEventListener('click', () => {
  showStep(2);
});

// Next from step 1
document.getElementById('nextStep1').addEventListener('click', () => {
  showStep(2);
});

// Voice recording removed

// Back from step 2
document.getElementById('backStep2').addEventListener('click', () => {
  showStep(1);
});

// Next from step 2
document.getElementById('nextStep2').addEventListener('click', async () => {
  const experienceText = document.getElementById('experienceText').value;
  const hasStructuredExp = Array.isArray(profileData.experience) && profileData.experience.length > 0;
  const hasResumeText = (profileData.resumeText || '').trim().length > 50;
  
  if (!experienceText.trim() && !hasStructuredExp && !hasResumeText) {
    alert('Please add some experience details (record, type, or upload resume)');
    return;
  }
  
  profileData.experience = experienceText;
  profileData.name = document.getElementById('nameInput').value.trim();
  profileData.email = document.getElementById('emailInput').value.trim();
  profileData.phone = document.getElementById('phoneInput').value.trim();
  profileData.location = document.getElementById('locationInput').value.trim();
  profileData.skills = (document.getElementById('skillsInput').value || '').split(',').map(s => s.trim()).filter(Boolean);
  profileData.roles = (document.getElementById('rolesInput').value || '').split(',').map(s => s.trim()).filter(Boolean);
  profileData.linkedin = document.getElementById('linkedinInput').value.trim();
  profileData.website = document.getElementById('websiteInput').value.trim();
  
  // Generate temporary ID
  profileData.tempId = 'TMP_' + Math.random().toString(36).substr(2, 9).toUpperCase();
  
  // Save locally immediately
  await chrome.storage.local.set({ profile: profileData, tempId: profileData.tempId });
  
  // Show success immediately
  document.getElementById('tempId').textContent = profileData.tempId;
  showStep(3);

  // Fire-and-forget: AI analysis to enrich structured fields if resume text present
  (async () => {
    if ((profileData.resumeText || '').length > 80) {
      try {
        const { serverUrl: serverUrl4 } = await chrome.storage.local.get('serverUrl');
        const API_BASE4 = (serverUrl4 || 'http://localhost:3000').replace(/\/$/, '');
        const resp = await fetch(`${API_BASE4}/onboarding/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: profileData.resumeText })
        });
        if (resp.ok) {
          const { structured } = await resp.json();
          if (structured?.summary) profileData.summary_narrative = structured.summary;
          if (Array.isArray(structured?.skills)) profileData.skills = Array.from(new Set([...(profileData.skills||[]), ...structured.skills])).slice(0,50);
          if (Array.isArray(structured?.experience)) profileData.experience = structured.experience;
          if (Array.isArray(structured?.projects)) profileData.projects = structured.projects;
          if (Array.isArray(structured?.education)) profileData.education = structured.education;
          await chrome.storage.local.set({ profile: profileData });
        }
      } catch {}
    }

    // Fire-and-forget sync to server
    if (profileData.email) {
      try {
        const result = await chrome.runtime.sendMessage({ action: 'saveProfile', profile: profileData });
        if (!result?.success) {
          console.warn('Profile sync failed:', result?.warning || 'unknown');
        }
      } catch (e) {
        console.warn('Profile sync error:', e.message);
      }
    }
  })();
});

// Create account
document.getElementById('createAccount').addEventListener('click', async () => {
  const email = document.getElementById('acctEmail').value.trim() || profileData.email;
  const password = document.getElementById('acctPassword').value.trim();
  if (!email || !password) {
    alert('Please enter email and password');
    return;
  }
  try {
    const auth = await chrome.runtime.sendMessage({ action: 'authenticate', credentials: { email, password } });
    if (auth?.token) {
      // Save profile to server
      const result = await chrome.runtime.sendMessage({ action: 'saveProfile', profile: { ...profileData, email } });
      if (!result?.success) {
        alert('Account created, but profile sync failed. You can try saving again from the side panel.');
      } else {
        // Open sidepanel dashboard
        try {
          await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
        } catch {}
        // Fallback: open sidepanel_new.html in a new tab if sidePanel API not available
        try { chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel_new.html') }); } catch {}
      }
    } else {
      alert('Account creation failed. Please try again.');
    }
  } catch (e) {
    alert('Error creating account: ' + e.message);
  }
});

// Start generating
document.getElementById('startGenerating').addEventListener('click', () => {
  window.close();
});
