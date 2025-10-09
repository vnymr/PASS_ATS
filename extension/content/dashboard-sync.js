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
    console.log('Available cookies:', cookies.length);

    // Look for __session or __client cookies that Clerk uses
    const sessionCookie = cookies.find(c => c.startsWith('__session='));
    const clientCookie = cookies.find(c => c.startsWith('__client='));

    if (sessionCookie || clientCookie) {
      console.log('✅ Found Clerk cookies');
      return { foundCookies: true, sessionCookie, clientCookie };
    }

    return { foundCookies: false };
  } catch (error) {
    console.error('Cookie extraction error:', error);
    return { error: error.message };
  }
}

// Function to extract token using multiple methods
async function extractTokenFromPage() {
  console.log('🔍 Starting token extraction...');

  return new Promise((resolve) => {
    // Try Method 1: Direct window.Clerk access (if content script can see it)
    if (typeof window.Clerk !== 'undefined') {
      console.log('✅ Found Clerk directly in window');
      try {
        if (window.Clerk.session) {
          window.Clerk.session.getToken().then(token => {
            console.log('✅ Got token directly from window.Clerk');
            resolve({
              token: token,
              email: window.Clerk.user?.primaryEmailAddress?.emailAddress || '',
              method: 'direct'
            });
          }).catch(err => {
            console.error('Error getting token:', err);
            resolve({ error: err.message });
          });
          return;
        }
      } catch (e) {
        console.error('Direct Clerk access error:', e);
      }
    }

    // Try Method 2: Inject script into page context
    console.log('🔧 Injecting script into page context...');
    const script = document.createElement('script');
    script.textContent = `
      (async function() {
        console.log('[PAGE SCRIPT] Starting token extraction in page context...');
        console.log('[PAGE SCRIPT] window.Clerk exists?', typeof window.Clerk !== 'undefined');

        try {
          // Wait for Clerk with more aggressive checking
          let attempts = 0;
          let clerkFound = false;

          // Check multiple possible Clerk locations
          const checkClerk = () => {
            if (window.Clerk) return window.Clerk;
            if (window.__clerk) return window.__clerk;
            if (window.__CLERK__) return window.__CLERK__;

            // Check for Clerk in global scope
            const globalKeys = Object.keys(window);
            const clerkKey = globalKeys.find(key => key.toLowerCase().includes('clerk'));
            if (clerkKey) {
              console.log('[PAGE SCRIPT] Found Clerk-like key:', clerkKey);
              return window[clerkKey];
            }

            return null;
          };

          while (attempts < 60) { // Wait up to 30 seconds
            const clerk = checkClerk();
            if (clerk) {
              window.Clerk = clerk; // Normalize to window.Clerk
              clerkFound = true;
              console.log('[PAGE SCRIPT] ✅ Clerk found after', attempts * 500, 'ms');
              break;
            }
            await new Promise(r => setTimeout(r, 500));
            attempts++;

            // Log progress every 5 attempts
            if (attempts % 5 === 0) {
              console.log('[PAGE SCRIPT] Still waiting for Clerk...', attempts, 'attempts');
            }
          }

          if (!clerkFound) {
            console.log('[PAGE SCRIPT] ❌ Clerk not found after 30 seconds');
            window.postMessage({
              type: 'CLERK_TOKEN_RESULT',
              error: 'Clerk not found after 30 seconds',
              debug: {
                hasClerk: false,
                windowKeys: Object.keys(window).filter(k => k.includes('lerk')).slice(0, 10)
              }
            }, '*');
            return;
          }

          console.log('[PAGE SCRIPT] Checking Clerk session...');

          // Check if user is signed in
          if (!window.Clerk.session) {
            console.log('[PAGE SCRIPT] Waiting for session...');

            // Wait for session to be available
            let sessionAttempts = 0;
            while (!window.Clerk.session && sessionAttempts < 20) {
              await new Promise(r => setTimeout(r, 500));
              sessionAttempts++;
            }
          }

          if (!window.Clerk.session) {
            console.log('[PAGE SCRIPT] ❌ No active session after waiting');
            window.postMessage({
              type: 'CLERK_TOKEN_RESULT',
              error: 'No active session',
              debug: {
                hasClerk: true,
                hasSession: false,
                user: window.Clerk.user ? 'User exists' : 'No user'
              }
            }, '*');
            return;
          }

          console.log('[PAGE SCRIPT] ✅ Session found, getting token...');

          // Get the token
          const token = await window.Clerk.session.getToken();
          const user = window.Clerk.user;
          const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';

          console.log('[PAGE SCRIPT] ✅ Token retrieved successfully');
          console.log('[PAGE SCRIPT] User email:', email);

          // Send the token via postMessage
          window.postMessage({
            type: 'CLERK_TOKEN_RESULT',
            token: token,
            email: email,
            method: 'page-script',
            debug: {
              hasClerk: true,
              hasSession: true,
              hasToken: !!token,
              tokenLength: token ? token.length : 0
            }
          }, '*');

        } catch (error) {
          console.error('[PAGE SCRIPT] Error:', error);
          window.postMessage({
            type: 'CLERK_TOKEN_RESULT',
            error: error.message,
            stack: error.stack
          }, '*');
        }
      })();
    `;

    // Listen for the result
    let messageHandler;
    const cleanup = () => {
      if (messageHandler) {
        window.removeEventListener('message', messageHandler);
      }
      if (script && script.parentNode) {
        script.remove();
      }
    };

    messageHandler = (event) => {
      if (event.data && event.data.type === 'CLERK_TOKEN_RESULT') {
        console.log('📨 Received message from page script:', event.data);
        cleanup();
        resolve(event.data);
      }
    };

    window.addEventListener('message', messageHandler);
    document.body.appendChild(script);

    // Timeout after 35 seconds (giving page script 30 seconds to find Clerk)
    setTimeout(() => {
      cleanup();
      resolve({ error: 'Timeout waiting for token (35s)' });
    }, 35000);
  });
}

// Function to sync token to extension
async function syncTokenToExtension() {
  try {
    console.log('🔄 Starting token sync process...');
    console.log('Current URL:', window.location.href);
    console.log('Chrome extension ID:', chrome.runtime.id);

    // First check cookies
    const cookieResult = await extractTokenFromCookies();
    console.log('Cookie check result:', cookieResult);

    // Extract token from page
    const result = await extractTokenFromPage();
    console.log('Token extraction result:', result);

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

    console.log('✅ Token extracted successfully');
    console.log('Token length:', result.token.length);
    console.log('Email:', result.email);
    console.log('Method:', result.method);

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
        console.log('✅ Token synced successfully!', response);
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
  console.log('📨 Received message:', message);

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
