import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { ThemeProvider } from 'next-themes';
import App from './App';
import './styles.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

// Error boundary for Clerk loading issues
function ClerkErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('Clerk') || event.message?.includes('clerk')) {
        console.error('Clerk loading error:', event);
        setHasError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          maxWidth: '600px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <h1 style={{ color: '#333', marginBottom: '20px' }}>⚠️ Authentication Service Blocked</h1>
          <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '20px' }}>
            Our authentication service (Clerk) is being blocked. This is usually caused by:
          </p>
          <ul style={{ color: '#666', marginLeft: '20px', marginBottom: '20px' }}>
            <li>Ad blocker (uBlock Origin, AdBlock Plus, Brave Shields)</li>
            <li>Privacy extension blocking third-party scripts</li>
            <li>Browser privacy settings</li>
          </ul>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            <strong>Quick fix:</strong>
          </p>
          <ol style={{ color: '#666', marginLeft: '20px', marginBottom: '30px', lineHeight: '1.8' }}>
            <li>Disable your ad blocker for happyresumes.com</li>
            <li>Or whitelist: *.clerk.accounts.dev</li>
            <li>Refresh the page</li>
          </ol>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            🔄 Retry
          </button>
          <a
            href="/debug.html"
            style={{
              display: 'inline-block',
              background: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            🔍 Run Diagnostics
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light">
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      </ThemeProvider>
    </ClerkErrorBoundary>
  </React.StrictMode>
);
