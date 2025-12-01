import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, ClerkLoaded, ClerkLoading } from '@clerk/clerk-react';
import { ThemeProvider } from 'next-themes';
import App from './App';
import './index.css';
import logger from './utils/logger';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_placeholder';

// Only throw error if we're in production and still using placeholder
if (PUBLISHABLE_KEY === 'pk_test_placeholder' && import.meta.env.PROD) {
  logger.warn('Using placeholder Clerk key. Authentication may not work properly.');
}

function AppLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.2s]" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/80 animate-bounce" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0.2s]" />
      </div>
    </div>
  );
}

// Error boundary for Clerk loading issues
function ClerkErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('Clerk') || event.message?.includes('clerk')) {
        logger.error('Clerk loading error', { message: event.message });
        setHasError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-accent-600 p-5 font-sans">
        <div className="bg-white text-gray-800 rounded-2xl max-w-[600px] w-full shadow-2xl p-10">
          <h1 className="text-xl font-semibold mb-5">⚠️ Authentication Service Blocked</h1>
          <p className="text-gray-600 leading-relaxed mb-5">
            Our authentication service (Clerk) is being blocked. This is usually caused by:
          </p>
          <ul className="text-gray-600 list-disc pl-5 mb-5">
            <li>Ad blocker (uBlock Origin, AdBlock Plus, Brave Shields)</li>
            <li>Privacy extension blocking third-party scripts</li>
            <li>Browser privacy settings</li>
          </ul>
          <p className="text-gray-600 mb-7">
            <strong>Quick fix:</strong>
          </p>
          <ol className="text-gray-600 list-decimal pl-5 mb-8 leading-7">
            <li>Disable your ad blocker for happyresumes.com</li>
            <li>Or whitelist: *.clerk.accounts.dev</li>
            <li>Refresh the page</li>
          </ol>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-base font-semibold"
            >
              🔄 Retry
            </button>
            <a
              href="/debug.html"
              className="inline-block bg-gray-600 hover:bg-gray-700 text-white no-underline px-4 py-2 rounded-lg text-base font-semibold"
            >
              🔍 Run Diagnostics
            </a>
          </div>
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
          <ClerkLoading>
            <AppLoading />
          </ClerkLoading>
          <ClerkLoaded>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <App />
            </BrowserRouter>
          </ClerkLoaded>
        </ClerkProvider>
      </ThemeProvider>
    </ClerkErrorBoundary>
  </React.StrictMode>
);
