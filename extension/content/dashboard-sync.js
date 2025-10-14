// Dashboard Token Sync Script
// This runs only on the HappyResumes dashboard to sync authentication

console.log('🔐 HappyResumes Extension: Dashboard sync script STARTED');
console.log('📍 Running on:', window.location.href);
console.log('📍 Origin:', window.location.origin);

// Immediately show that the script is running
(function() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #3498db;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;
  indicator.textContent = '🔄 Extension: Checking authentication...';
  document.body.appendChild(indicator);

  setTimeout(() => {
    if (indicator && indicator.parentNode) {
      indicator.remove();
    }
  }, 3000);
})();

// Function to extract token directly from cookies
async function extractTokenFromCookies() {
  try {
    console.log('🍪 Attempting to extract token from cookies...');

    // Look for Clerk session cookies
    const cookies = document.cookie.split(';').map(c => c.trim());

    // Look for __session or __client cookies that Clerk uses
    const sessionCookie = cookies.find(c => c.startsWith('__session='));
    const clientCookie = cookies.find(c => c.startsWith('__client='));

    if (sessionCookie || clientCookie) {
      console.log('✅ Found Clerk cookies');
      return { foundCookies: true };
    }

    return { foundCookies: false };
  } catch (error) {
    console.error('Cookie extraction error:', error);
    return { error: error.message };
  }
}

// Request token extraction from background service worker
// (Service worker has chrome.tabs and chrome.scripting access)
async function extractTokenFromPage() {
  console.log('🔍 Requesting token extraction from background service worker...');

  try {
    // Ask service worker to extract token using chrome.scripting with world: 'MAIN'
    const response = await chrome.runtime.sendMessage({
      type: 'EXTRACT_CLERK_TOKEN',
      url: window.location.href
    });

    if (response && response.token) {
      console.log('✅ Token extracted via service worker');
      return {
        token: response.token,
        email: response.email,
        method: 'service-worker-scripting'
      };
    } else if (response && response.error) {
      console.error('❌ Token extraction failed:', response.error);
      return { error: response.error };
    } else {
      return { error: 'No response from service worker' };
    }

  } catch (error) {
    console.error('❌ Failed to communicate with service worker:', error);
    return { error: error.message || 'Service worker communication failed' };
  }
}

// Function to sync token to extension
async function syncTokenToExtension() {
  try {
    console.log('🔄 Starting token sync process...');
    console.log('Current URL:', window.location.href);
    console.log('Chrome extension ID detected');

    // First check cookies
    const cookieResult = await extractTokenFromCookies();
    console.log('Cookie check result:', { foundCookies: cookieResult.foundCookies, error: cookieResult.error });

    // Extract token from page
    const result = await extractTokenFromPage();
    console.log('Token extraction status:', {
      hasToken: !!result.token,
      method: result.method,
      error: result.error
    });

    if (result.error) {
      console.error('❌ Failed to extract token:', result.error);

      // Show error notification
      console.warn('Dashboard sync: token extraction failed', result.error);

      // Retry for "No session" errors
      if (result.error.includes('No') && result.error.includes('session')) {
        console.log('⏳ Will retry in 5 seconds...');
        setTimeout(syncTokenToExtension, 5000);
      }
      return;
    }

    if (!result.token) {
      console.log('❌ No token received');
      showNotification('⚠️ No authentication token found', 'error');
      return;
    }

    console.log('✅ Token extracted successfully via', result.method || 'unknown method');

    // Send to extension background script
    console.log('📤 Sending token to extension background...');

    chrome.runtime.sendMessage({
      type: 'CLERK_TOKEN_UPDATE',
      token: result.token,
      email: result.email,
      source: 'dashboard-sync',
      timestamp: new Date().toISOString()
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to send to background:', chrome.runtime.lastError);
        showNotification('❌ Failed to sync to extension', 'error');
      } else {
        console.log('✅ Token synced successfully!');
        showNotification('✅ Authentication synced to extension!', 'success');
      }
    });

  } catch (error) {
    console.error('❌ Error in sync process:', error);
    showNotification(`❌ Sync error: ${error.message}`, 'error');
  }
}

// Enhanced notification function
function showNotification(message, type = 'success') {
  // Remove any existing notification
  const existing = document.getElementById('happyresumes-sync-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'happyresumes-sync-notification';

  const bgColor = type === 'success' ? '#27ae60' :
                  type === 'error' ? '#e74c3c' : '#3498db';

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
  `;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  notification.innerHTML = `<span style="font-size: 18px;">${icon}</span> ${message}`;

  // Add animation styles if not already present
  if (!document.getElementById('happyresumes-sync-styles')) {
    const style = document.createElement('style');
    style.id = 'happyresumes-sync-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Listen for token refresh requests from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message?.type || message?.action || 'unknown');

  if (message.type === 'REQUEST_TOKEN_REFRESH') {
    console.log('📨 Extension requested token refresh');
    syncTokenToExtension();
    sendResponse({ status: 'refreshing' });
  }
  return true;
});

// Check if we're actually on the right domain
console.log('🌐 Checking domain...');
if (window.location.hostname === 'happyresumes.com' ||
    window.location.hostname === 'www.happyresumes.com') {
  console.log('✅ On HappyResumes domain, initiating sync...');

  // Start sync process after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('📄 DOM loaded, starting sync in 2 seconds...');
      setTimeout(syncTokenToExtension, 2000);
    });
  } else {
    console.log('📄 DOM already loaded, starting sync in 2 seconds...');
    setTimeout(syncTokenToExtension, 2000);
  }

  // Also try to sync when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('📱 Page became visible, checking auth...');
      setTimeout(syncTokenToExtension, 1500);
    }
  });

  // Sync periodically (every 2 minutes for debugging, can increase later)
  setInterval(() => {
    console.log('⏰ Periodic sync check...');
    syncTokenToExtension();
  }, 2 * 60 * 1000);
} else {
  console.log('❌ Not on HappyResumes domain:', window.location.hostname);
}

console.log('✅ Dashboard sync script fully loaded');
