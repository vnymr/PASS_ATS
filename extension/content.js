// Guard against double-injection
if (!window.__quick_resume_injected) {
  window.__quick_resume_injected = true;
  console.log('Quick Resume: Content script loaded');

  // Inject floating button on job pages
  let buttonInjected = false;

function injectGenerateButton() {
  if (buttonInjected) return;
  
  const button = document.createElement('div');
  button.id = 'quick-resume-btn';
  button.innerHTML = `
    <div class="qr-button">
      <div class="qr-icon">📄</div>
      <div class="qr-text">Generate Resume</div>
    </div>
  `;
  
  document.body.appendChild(button);
  buttonInjected = true;
  
  // Click handler
  button.addEventListener('click', async () => {
    button.classList.add('qr-loading');
    
    // Show progress updates
    const updateStatus = (text, progress) => {
      button.querySelector('.qr-text').textContent = text;
      if (progress) {
        button.style.background = `linear-gradient(90deg, rgba(76,175,80,0.3) ${progress}%, transparent ${progress}%)`;
      }
    };
    
    updateStatus('Extracting job details...', 10);
    
    const jobData = extractJobData();
    
    // Ensure jdText is set for the backend
    if (!jobData.jdText) {
      jobData.jdText = jobData.text || '';
    }
    
    updateStatus('Analyzing requirements...', 30);
    
    // Send to background and wait for response
    const response = await chrome.runtime.sendMessage({
      action: 'generateResume',
      jobData: jobData
    });
    
    // Open the generating page in a new tab
    if (!response?.error) {
      updateStatus('Opening generator...', 50);
      await chrome.runtime.sendMessage({ action: 'openGeneratingPage' });
      
      // Reset button after a delay
      setTimeout(() => {
        button.classList.remove('qr-loading');
        button.querySelector('.qr-text').textContent = 'Generate Resume';
        button.style.background = '';
      }, 2000);
    } else {
      updateStatus('Error: ' + response.error, 0);
      setTimeout(() => {
        button.classList.remove('qr-loading');
        button.querySelector('.qr-text').textContent = 'Generate Resume';
        button.style.background = '';
      }, 3000);
    }
  });
}

// Extract job data from page
function extractJobData() {
  const data = {
    url: window.location.href,
    title: document.title,
    text: '',
    company: '',
    role: ''
  };
  
  // LinkedIn specific - updated selectors for 2025
  if (window.location.hostname.includes('linkedin.com')) {
    // Try multiple selectors for job title
    const jobTitle = document.querySelector('h1.jobs-unified-top-card__job-title, h1.t-24, .jobs-unified-top-card__job-title, [data-test-job-title]');
    // Try multiple selectors for company
    const company = document.querySelector('.jobs-unified-top-card__company-name, .jobs-unified-top-card__primary-description a, [data-test-company-name]');
    // Try multiple selectors for description - LinkedIn often changes these
    const description = document.querySelector('.jobs-description__content, .jobs-description, .jobs-box__html-content, [data-test-job-description], .show-more-less-html__markup');
    
    if (jobTitle) data.role = jobTitle.textContent.trim();
    if (company) data.company = company.textContent.trim();
    if (description) {
      // Get all text including hidden sections
      const showMoreBtn = description.querySelector('button[aria-label*="more"], button.show-more-less-html__button');
      if (showMoreBtn) showMoreBtn.click();
      data.text = description.innerText || description.textContent.trim();
    }
    
    // If no description found, try to get from the entire job details section
    if (!data.text) {
      const jobDetails = document.querySelector('.jobs-description-content, .jobs-details, .job-view-layout');
      if (jobDetails) data.text = jobDetails.innerText || jobDetails.textContent.trim();
    }
  }
  
  // Indeed specific  
  else if (window.location.hostname.includes('indeed.com')) {
    const jobTitle = document.querySelector('[data-testid="job-title"]');
    const company = document.querySelector('[data-testid="company-name"]');
    const description = document.querySelector('#jobDescriptionText');
    
    if (jobTitle) data.role = jobTitle.textContent.trim();
    if (company) data.company = company.textContent.trim();
    if (description) data.text = description.textContent.trim();
  }
  
  // Glassdoor specific
  else if (window.location.hostname.includes('glassdoor.com')) {
    const jobTitle = document.querySelector('.css-17x2pwl');
    const company = document.querySelector('.css-87uc0g');
    const description = document.querySelector('.desc');
    
    if (jobTitle) data.role = jobTitle.textContent.trim();
    if (company) data.company = company.textContent.trim();
    if (description) data.text = description.textContent.trim();
  }
  
  // Fallback - get all text
  if (!data.text) {
    const selectors = ['main', 'article', '.job-description', '.description', '#content'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.text = element.textContent.trim();
        break;
      }
    }
  }
  
  // If still no text, get body text
  if (!data.text) {
    data.text = document.body.innerText.substring(0, 10000);
  }
  
  return data;
}

// Listen for status updates from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statusUpdate') {
    const button = document.getElementById('quick-resume-btn');
    if (button && button.classList.contains('qr-loading')) {
      button.querySelector('.qr-text').textContent = request.message || 'Processing...';
      if (request.progress) {
        button.style.background = `linear-gradient(90deg, rgba(76,175,80,0.3) ${request.progress}%, transparent ${request.progress}%)`;
      }
    }
  }
  
  if (request.action === 'extractJob' || request.action === 'extractJobData') {
    const jobData = extractJobData();
    console.log('Quick Resume: Extracted job data:', jobData);
    
    // Format the response properly
    const response = { 
      jobData: {
        ...jobData,
        jdText: jobData.text // Ensure jdText is set
      }
    };
    
    // If the requester wants a direct reply (popup path), reply with data
    if (request.reply) {
      sendResponse(response);
      return true;
    }
    
    // New sidepanel path: return formatted response
    sendResponse(response);
    return true;
  }
});

// Check if on job page and inject button
function checkJobPage() {
  const isJobPage = 
    window.location.pathname.includes('/jobs/') ||
    window.location.pathname.includes('/viewjob') ||
    window.location.pathname.includes('/job/') ||
    document.querySelector('.jobs-unified-top-card') || // LinkedIn
    document.querySelector('[data-testid="job-title"]') || // Indeed
    document.querySelector('.css-17x2pwl'); // Glassdoor
    
  if (isJobPage) {
    setTimeout(injectGenerateButton, 1000);
  }
}

  // Run on page load
  checkJobPage();

  // Run on navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      buttonInjected = false;
      checkJobPage();
    }
  }).observe(document, { subtree: true, childList: true });
}
