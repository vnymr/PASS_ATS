import { Routes, Route } from 'react-router-dom';
import { SignInButton, SignUpButton, useAuth, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { authLogger } from './utils/logger';
// Tailwind is loaded via index.css in main.tsx

// Page components
import Landing from './pages/Landing';
import DashboardModern from './pages/DashboardModern';
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

// Layout components
import ProtectedRoute from './layouts/ProtectedRoute';
import ModernLayout from './layouts/ModernLayout';

// Simple auth page component
function AuthPage() {
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
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <ModernLayout>
            <DashboardModern />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ModernLayout>
            <MemoryProfile />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/application-questions" element={
        <ProtectedRoute>
          <ModernLayout>
            <JobApplicationQuestions />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/generate" element={
        <ProtectedRoute>
          <ModernLayout>
            <GenerateResume />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <ModernLayout>
            <DashboardModern />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/find-jobs" element={
        <ProtectedRoute>
          <ModernLayout>
            <FindJob />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/extension" element={
        <ProtectedRoute>
          <ModernLayout>
            <DashboardModern />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/billing" element={
        <ProtectedRoute>
          <ModernLayout>
            <Billing />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/pricing" element={
        <ProtectedRoute>
          <ModernLayout>
            <Billing />
          </ModernLayout>
        </ProtectedRoute>
      } />
      <Route path="/checkout/success" element={
        <ProtectedRoute>
          <CheckoutSuccess />
        </ProtectedRoute>
      } />
      <Route path="/checkout/cancel" element={
        <ProtectedRoute>
          <CheckoutCancel />
        </ProtectedRoute>
      } />
      <Route path="/support" element={<Support />} />
      <Route path="/privacy" element={<Privacy />} />
    </Routes>
  );
}
