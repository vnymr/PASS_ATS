import { Routes, Route, useNavigate } from 'react-router-dom';
import { SignInButton, SignUpButton, useAuth, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { authLogger } from './utils/logger';
// Tailwind is loaded via index.css in main.tsx

// Page components
import Landing from './pages/Landing';
import Features from './pages/Features';
import Extension from './pages/Extension';
import Pricing from './pages/Pricing';
import MemoryProfile from './pages/MemoryProfile';
import GenerateResume from './pages/GenerateResume';
import History from './pages/History';
import Billing from './pages/Billing';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import Support from './pages/Support';
import Privacy from './pages/Privacy';
import FindJob from './pages/FindJob';
import JobApplicationQuestions from './components/JobApplicationQuestions';
import Happy from './pages/Happy';
import Applications from './pages/Applications';
import Onboarding from './pages/Onboarding';
import Templates from './pages/Templates';

// Layout components
import ProtectedRoute from './layouts/ProtectedRoute';
import ModernLayout from './layouts/ModernLayout';
import ErrorBoundary from './components/ErrorBoundary';

// Simple auth page component - redirects signed-in users
function AuthPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/happy', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  // If signed in, don't render (will redirect)
  if (isSignedIn) {
    return null;
  }

  return (
    <div className="auth-container">
      <div className="geometric-bg">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
        <div className="geometric-shape shape-3"></div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Welcome to Resume Tailor</h2>
          <p className="auth-subtitle">Sign in or create an account to continue</p>
        </div>
        <div className="auth-actions">
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-full">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="btn btn-secondary btn-full">Sign Up</button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // Sync Clerk token to localStorage and extension when user signs in
  useEffect(() => {
    async function syncToken() {
      if (isSignedIn && user) {
        try {
          const token = await getToken();

          // CRITICAL FIX: Store token in localStorage so API service can access it
          if (token) {
            localStorage.setItem('token', token);
            authLogger.success('Token synced to localStorage');
          }

          // Also sync to extension if available
          const extensionId = import.meta.env.VITE_EXTENSION_ID;
          if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime && extensionId) {
            authLogger.attempt('extension-sync');
            (window as any).chrome.runtime.sendMessage(
              extensionId,
              {
                type: 'CLERK_TOKEN_UPDATE',
                token: token,
                email: user.primaryEmailAddress?.emailAddress
              },
              (response: any) => {
                if ((window as any).chrome.runtime.lastError) {
                  authLogger.failure('Extension not available: ' + (window as any).chrome.runtime.lastError.message);
                } else {
                  authLogger.success('Token synced to extension');
                }
              }
            );
          }
        } catch (error) {
          authLogger.failure('Failed to sync token');
        }
      } else if (!isSignedIn) {
        // Clear token when user signs out
        localStorage.removeItem('token');
        authLogger.success('Token cleared from localStorage');
      }
    }

    // Sync immediately on auth state change
    syncToken();

    // Refresh token every 5 minutes to keep it fresh
    const intervalId = setInterval(() => {
      if (isSignedIn && user) {
        syncToken();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isSignedIn, user, getToken]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/features" element={<Features />} />
      <Route path="/extension" element={<Extension />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/support" element={<Support />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Onboarding - no layout, full screen experience */}
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <Onboarding />
          </ErrorBoundary>
        </ProtectedRoute>
      } />

      {/* Protected routes with layout and error boundary */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <MemoryProfile />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/application-questions" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <JobApplicationQuestions />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/generate" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <GenerateResume />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/templates" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <Templates />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <History />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/find-jobs" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <FindJob />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/applications" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <Applications />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/billing" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <Billing />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/checkout/success" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <CheckoutSuccess />
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/checkout/cancel" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <CheckoutCancel />
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/happy" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ModernLayout>
              <Happy />
            </ModernLayout>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
    </Routes>
  );
}
