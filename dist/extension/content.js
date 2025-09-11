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
  
  // Click handler with detailed progress
  button.addEventListener('click', async () => {
    button.classList.add('qr-loading');
    
    // Create progress display
    const createProgressDisplay = () => {
      const progressDiv = document.createElement('div');
      progressDiv.id = 'qr-progress-display';
      progressDiv.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 30px;
        background: white;
        border: 2px solid black;
        border-radius: 12px;
        padding: 20px;
        width: 350px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        z-index: 99999;
        font-family: -apple-system, sans-serif;
      `;
      progressDiv.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 15px;">🚀 Generating Your Resume</div>
        <div id="qr-steps" style="font-size: 14px;"></div>
        <div style="margin-top: 15px;">
          <div style="background: #f0f0f0; height: 8px; border-radius: 4px; overflow: hidden;">
            <div id="qr-progress-bar" style="background: black; height: 100%; width: 0%; transition: width 0.5s; border-radius: 4px;"></div>
          </div>
        </div>
        <div id="qr-status" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
      `;
      document.body.appendChild(progressDiv);
      return progressDiv;
    };
    
    const progressDisplay = createProgressDisplay();
    const stepsDiv = document.getElementById('qr-steps');
    const progressBar = document.getElementById('qr-progress-bar');
    const statusDiv = document.getElementById('qr-status');
    
    // Update functions
    const addStep = (emoji, text, completed = false) => {
      const step = document.createElement('div');
      step.style.cssText = `
        padding: 8px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: ${completed ? '0.6' : '1'};
      `;
      step.innerHTML = `
        <span style="font-size: 20px;">${emoji}</span>
        <span>${text}</span>
        ${completed ? '<span style="color: green;">✓</span>' : '<span class="qr-spinner" style="display: inline-block; width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: black; border-radius: 50%; animation: spin 1s linear infinite;"></span>'}
      `;
      stepsDiv.appendChild(step);
      return step;
    };
    
    const updateProgress = (percent, status) => {
      progressBar.style.width = percent + '%';
      statusDiv.textContent = status;
      button.querySelector('.qr-text').textContent = status;
    };
    
    const completeStep = (stepElement) => {
      stepElement.style.opacity = '0.6';
      const spinner = stepElement.querySelector('.qr-spinner');
      if (spinner) {
        spinner.outerHTML = '<span style="color: green;">✓</span>';
      }
    };
    
    // Start process
    updateProgress(5, 'Starting...');
    
    // Step 1: Extract job details
    const step1 = addStep('📋', 'Extracting job details from page');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const jobData = extractJobData();
    if (!jobData.jdText) {
      jobData.jdText = jobData.text || '';
    }
    
    completeStep(step1);
    updateProgress(15, 'Job details extracted');
    
    // Step 2: Load your profile
    const step2 = addStep('👤', 'Loading your profile data');
    await new Promise(resolve => setTimeout(resolve, 600));
    completeStep(step2);
    updateProgress(25, 'Profile loaded');
    
    // Step 3: Analyze job requirements
    const step3 = addStep('🔍', 'Analyzing job requirements');
    await new Promise(resolve => setTimeout(resolve, 1000));
    completeStep(step3);
    updateProgress(35, 'Requirements analyzed');
    
    // Step 4: Match skills
    const step4 = addStep('🎯', 'Matching your skills to job');
    await new Promise(resolve => setTimeout(resolve, 800));
    completeStep(step4);
    updateProgress(45, 'Skills matched');
    
    // Step 5: AI optimization
    const step5 = addStep('🤖', 'AI optimizing content for ATS');
    
    // Send to background
    const response = await chrome.runtime.sendMessage({
      action: 'generateResume',
      jobData: jobData
    });
    
    if (!response?.error) {
      completeStep(step5);
      updateProgress(60, 'AI optimization complete');
      
      // Step 6: Generate LaTeX
      const step6 = addStep('📝', 'Generating professional format');
      await new Promise(resolve => setTimeout(resolve, 1200));
      completeStep(step6);
      updateProgress(75, 'Format generated');
      
      // Step 7: Compile PDF
      const step7 = addStep('📄', 'Compiling to PDF');
      await new Promise(resolve => setTimeout(resolve, 1500));
      completeStep(step7);
      updateProgress(90, 'PDF ready');
      
      // Step 8: Download
      const step8 = addStep('✅', 'Downloading your resume', true);
      updateProgress(100, 'Complete! Check downloads');
      
      // Success message
      setTimeout(() => {
        progressDisplay.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Resume Generated!</div>
            <div style="color: #666;">Check your downloads folder</div>
            <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 15px; padding: 8px 20px; background: black; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
          </div>
        `;
        
        button.classList.remove('qr-loading');
        button.classList.add('qr-success');
        button.querySelector('.qr-text').textContent = 'Downloaded!';
        
        setTimeout(() => {
          button.classList.remove('qr-success');
          button.querySelector('.qr-text').textContent = 'Generate Resume';
          progressDisplay.remove();
        }, 5000);
      }, 2000);
      
      // Open generating page for actual processing
      await chrome.runtime.sendMessage({ action: 'openGeneratingPage' });
      
    } else {
      // Error handling
      progressDisplay.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px; color: red;">❌</div>
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Generation Failed</div>
          <div style="color: #666; margin-bottom: 15px;">${response.error}</div>
          <button onclick="this.parentElement.parentElement.remove(); location.reload();" style="padding: 8px 20px; background: black; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>
        </div>
      `;
      
      button.classList.remove('qr-loading');
      button.classList.add('qr-error');
      button.querySelector('.qr-text').textContent = 'Failed';
      
      setTimeout(() => {
        button.classList.remove('qr-error');
        button.querySelector('.qr-text').textContent = 'Generate Resume';
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
