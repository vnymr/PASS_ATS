// Configuration
const APP_URL = 'https://passats.com'; // Update with your actual app URL

// DOM Elements
const statusSection = document.getElementById('status-section');
const pageStatus = document.getElementById('page-status');
const jobFoundSection = document.getElementById('job-found');
const noJobSection = document.getElementById('no-job');
const jobTitle = document.getElementById('job-title');
const jobCompany = document.getElementById('job-company');
const jobLocation = document.getElementById('job-location');
const extractBtn = document.getElementById('extract-btn');
const openAppLink = document.getElementById('open-app');

// State
let currentJobData = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Set app link
  openAppLink.href = APP_URL;
  openAppLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: APP_URL });
  });

  // Check current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
      await checkForJobPosting(tab);
    } else {
      showNoJob();
    }
  } catch (error) {
    console.error('Error checking tab:', error);
    showNoJob();
  }
});

// Check if current page has a job posting
async function checkForJobPosting(tab) {
  updateStatus('Scanning page...', 'loading');

  try {
    // Send message to content script to extract job data
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJob' });

    if (response && response.success && response.data) {
      currentJobData = response.data;
      showJobFound(response.data);
      updateStatus('Job posting detected', 'success');
    } else {
      showNoJob();
      updateStatus('No job posting found', 'error');
    }
  } catch (error) {
    console.log('Content script not available:', error);
    showNoJob();
    updateStatus('Navigate to a job posting', 'error');
  }
}

// Update status indicator
function updateStatus(text, type) {
  const statusText = pageStatus.querySelector('.status-text');
  statusText.textContent = text;

  pageStatus.classList.remove('success', 'error');
  if (type === 'success') {
    pageStatus.classList.add('success');
  } else if (type === 'error') {
    pageStatus.classList.add('error');
  }
}

// Show job found UI
function showJobFound(data) {
  jobTitle.textContent = data.title || 'Job Title';
  jobCompany.textContent = data.company || 'Company';
  jobLocation.textContent = data.location || 'Location';

  noJobSection.classList.add('hidden');
  jobFoundSection.classList.remove('hidden');
}

// Show no job UI
function showNoJob() {
  jobFoundSection.classList.add('hidden');
  noJobSection.classList.remove('hidden');
}

// Handle extract button click
extractBtn.addEventListener('click', async () => {
  if (!currentJobData) return;

  extractBtn.disabled = true;
  extractBtn.textContent = 'Opening...';

  try {
    // Store job data
    await chrome.storage.local.set({
      pendingJobDescription: {
        ...currentJobData,
        extractedAt: new Date().toISOString()
      }
    });

    // Open app with job data
    const generateUrl = `${APP_URL}/generate?source=extension`;
    chrome.tabs.create({ url: generateUrl });

    // Close popup
    window.close();
  } catch (error) {
    console.error('Error:', error);
    extractBtn.disabled = false;
    extractBtn.textContent = 'Generate Resume';
  }
});
