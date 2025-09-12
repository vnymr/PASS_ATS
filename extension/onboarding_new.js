// Onboarding flow handler
const API_BASE = 'https://passats-production.up.railway.app';
let currentStep = 1;
let extractedProfile = null;
let authToken = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Get auth token
    const storage = await chrome.storage.local.get(['authToken']);
    authToken = storage.authToken;
    
    if (!authToken) {
        window.location.href = 'auth.html';
        return;
    }

    initializeUpload();
    initializeProfile();
    initializeNavigation();
});

function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('resumeFile');
    const skipButton = document.getElementById('skipUpload');

    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag and drop
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
            handleFileUpload(files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Skip upload
    skipButton.addEventListener('click', () => {
        moveToStep(2);
    });
}

async function handleFileUpload(file) {
    // Validate file
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a PDF or Word document');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }

    // Show upload progress
    const uploadArea = document.getElementById('uploadArea');
    const uploadProgress = document.getElementById('uploadProgress');
    const processingStatus = document.getElementById('processingStatus');
    
    uploadArea.classList.add('hidden');
    uploadProgress.classList.remove('hidden');

    // Update file info
    uploadProgress.querySelector('.file-name').textContent = file.name;
    uploadProgress.querySelector('.file-size').textContent = formatFileSize(file.size);

    // Simulate upload progress
    let progress = 0;
    const progressBar = uploadProgress.querySelector('.progress-bar-fill');
    const progressInterval = setInterval(() => {
        progress += 10;
        progressBar.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(progressInterval);
            uploadProgress.querySelector('.status-text').textContent = 'Upload complete';
            
            // Show processing status
            setTimeout(() => {
                uploadProgress.classList.add('hidden');
                processingStatus.classList.remove('hidden');
                processResume(file);
            }, 500);
        }
    }, 200);
}

async function processResume(file) {
    const formData = new FormData();
    formData.append('resume', file);

    try {
        // Step 1: Parse the resume
        const response = await fetch(`${API_BASE}/onboarding/parse`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (!response.ok) throw new Error('Failed to process resume');

        const parseData = await response.json();
        console.log('Parsed data:', parseData);

        // Step 2: Get AI analysis for better structure
        let aiProfile = null;
        if (parseData.text && parseData.text.length > 50) {
            try {
                const analyzeResponse = await fetch(`${API_BASE}/onboarding/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ 
                        text: parseData.text,
                        saveToProfile: true 
                    })
                });

                if (analyzeResponse.ok) {
                    const analyzeData = await analyzeResponse.json();
                    aiProfile = analyzeData.structured;
                    console.log('AI analysis:', aiProfile);
                }
            } catch (aiError) {
                console.warn('AI analysis failed, using basic parsing:', aiError);
            }
        }

        // Combine parsed data with AI analysis
        extractedProfile = {
            name: parseData.fields?.name || '',
            email: parseData.fields?.email || '',
            phone: parseData.fields?.phone || '',
            location: '', // Will be extracted from AI if available
            linkedin: parseData.urls?.find(url => url.includes('linkedin.com')) || '',
            summary: aiProfile?.summary || '',
            skills: aiProfile?.skills || parseData.skills || [],
            experience: aiProfile?.experience?.map(exp => ({
                title: exp.role || '',
                company: exp.company || '',
                startDate: exp.dates?.split('-')[0]?.trim() || '',
                endDate: exp.dates?.split('-')[1]?.trim() || '',
                description: exp.bullets?.join('\n') || ''
            })) || [],
            education: aiProfile?.education?.map(edu => ({
                degree: edu.degree || '',
                school: edu.institution || '',
                field: '', // Not in AI response
                graduationYear: edu.dates || ''
            })) || []
        };

        // Populate form with extracted data
        populateProfileForm(extractedProfile);

        // Move to step 2
        setTimeout(() => {
            moveToStep(2);
        }, 1500);
    } catch (error) {
        console.error('Error processing resume:', error);
        alert('Failed to process resume. Please try again or enter details manually.');
        
        // Reset to upload state
        document.getElementById('processingStatus').classList.add('hidden');
        document.getElementById('uploadArea').classList.remove('hidden');
    }
}

function populateProfileForm(profile) {
    if (!profile) return;

    // Personal Information
    setFieldValue('fullName', profile.name);
    setFieldValue('email', profile.email);
    setFieldValue('phone', profile.phone);
    setFieldValue('location', profile.location);
    setFieldValue('linkedin', profile.linkedin);

    // Professional Summary
    setFieldValue('summary', profile.summary);

    // Skills
    if (profile.skills && profile.skills.length > 0) {
        setFieldValue('skills', profile.skills.join(', '));
    }

    // Experience
    if (profile.experience && profile.experience.length > 0) {
        const experienceList = document.getElementById('experienceList');
        profile.experience.forEach(exp => {
            addExperienceItem(exp);
        });
    }

    // Education
    if (profile.education && profile.education.length > 0) {
        const educationList = document.getElementById('educationList');
        profile.education.forEach(edu => {
            addEducationItem(edu);
        });
    }
}

function setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field && value) {
        field.value = value;
    }
}

function initializeProfile() {
    const profileForm = document.getElementById('profileForm');
    const addExpButton = document.getElementById('addExperience');
    const addEduButton = document.getElementById('addEducation');
    const backButton = document.getElementById('backToUpload');

    // Add experience
    addExpButton.addEventListener('click', () => {
        addExperienceItem();
    });

    // Add education
    addEduButton.addEventListener('click', () => {
        addEducationItem();
    });

    // Back button
    backButton.addEventListener('click', () => {
        moveToStep(1);
    });

    // Form submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile();
    });
}

function addExperienceItem(data = {}) {
    const experienceList = document.getElementById('experienceList');
    const itemId = `exp_${Date.now()}`;
    
    const itemHtml = `
        <div class="list-item" id="${itemId}">
            <div class="list-item-header">
                <span class="list-item-title">${data.title || 'New Experience'}</span>
                <button type="button" class="btn-remove" onclick="removeItem('${itemId}')">Remove</button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <input type="text" name="exp_title" value="${data.title || ''}" placeholder=" " required>
                    <label>Job Title</label>
                </div>
                <div class="form-group">
                    <input type="text" name="exp_company" value="${data.company || ''}" placeholder=" " required>
                    <label>Company</label>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <input type="text" name="exp_start" value="${data.startDate || ''}" placeholder=" ">
                    <label>Start Date</label>
                </div>
                <div class="form-group">
                    <input type="text" name="exp_end" value="${data.endDate || ''}" placeholder=" ">
                    <label>End Date</label>
                </div>
            </div>
            <div class="form-group">
                <textarea name="exp_description" rows="3" placeholder=" ">${data.description || ''}</textarea>
                <label>Description</label>
            </div>
        </div>
    `;
    
    experienceList.insertAdjacentHTML('beforeend', itemHtml);
}

function addEducationItem(data = {}) {
    const educationList = document.getElementById('educationList');
    const itemId = `edu_${Date.now()}`;
    
    const itemHtml = `
        <div class="list-item" id="${itemId}">
            <div class="list-item-header">
                <span class="list-item-title">${data.degree || 'New Education'}</span>
                <button type="button" class="btn-remove" onclick="removeItem('${itemId}')">Remove</button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <input type="text" name="edu_degree" value="${data.degree || ''}" placeholder=" " required>
                    <label>Degree</label>
                </div>
                <div class="form-group">
                    <input type="text" name="edu_school" value="${data.school || ''}" placeholder=" " required>
                    <label>School</label>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <input type="text" name="edu_field" value="${data.field || ''}" placeholder=" ">
                    <label>Field of Study</label>
                </div>
                <div class="form-group">
                    <input type="text" name="edu_year" value="${data.graduationYear || ''}" placeholder=" ">
                    <label>Graduation Year</label>
                </div>
            </div>
        </div>
    `;
    
    educationList.insertAdjacentHTML('beforeend', itemHtml);
}

window.removeItem = function(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.remove();
    }
};

async function saveProfile() {
    const formData = new FormData(document.getElementById('profileForm'));
    
    // Collect profile data
    const profile = {
        name: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        location: formData.get('location'),
        linkedin: formData.get('linkedin'),
        summary: formData.get('summary'),
        skills: formData.get('skills') ? formData.get('skills').split(',').map(s => s.trim()).filter(s => s) : [],
        experience: collectExperience(),
        education: collectEducation()
    };

    console.log('Saving profile:', profile);

    try {
        const response = await fetch(`${API_BASE}/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(profile)
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('Server error:', errorData);
            throw new Error('Failed to save profile');
        }

        const data = await response.json();
        console.log('Profile saved:', data);

        // Mark onboarding as complete
        await chrome.storage.local.set({ 
            hasCompletedOnboarding: true,
            userProfile: profile 
        });

        // Move to completion step
        moveToStep(3);
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Failed to save profile. Please try again. Check console for details.');
    }
}

function collectExperience() {
    const items = document.querySelectorAll('#experienceList .list-item');
    return Array.from(items).map(item => ({
        title: item.querySelector('[name="exp_title"]').value,
        company: item.querySelector('[name="exp_company"]').value,
        startDate: item.querySelector('[name="exp_start"]').value,
        endDate: item.querySelector('[name="exp_end"]').value,
        description: item.querySelector('[name="exp_description"]').value
    }));
}

function collectEducation() {
    const items = document.querySelectorAll('#educationList .list-item');
    return Array.from(items).map(item => ({
        degree: item.querySelector('[name="edu_degree"]').value,
        school: item.querySelector('[name="edu_school"]').value,
        field: item.querySelector('[name="edu_field"]').value,
        graduationYear: item.querySelector('[name="edu_year"]').value
    }));
}

function initializeNavigation() {
    const completeButton = document.getElementById('completeSetup');
    
    completeButton.addEventListener('click', () => {
        window.location.href = 'sidepanel_new.html';
    });
}

function moveToStep(step) {
    // Update current step
    currentStep = step;
    
    // Update progress bar
    const progressFill = document.querySelector('.progress-fill');
    progressFill.style.width = `${(step / 3) * 100}%`;
    
    // Update step indicators
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index < step - 1) {
            el.classList.add('completed');
            el.classList.remove('active');
        } else if (index === step - 1) {
            el.classList.add('active');
            el.classList.remove('completed');
        } else {
            el.classList.remove('active', 'completed');
        }
    });
    
    // Show/hide step content
    document.querySelectorAll('.step-content').forEach((el, index) => {
        if (index === step - 1) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}