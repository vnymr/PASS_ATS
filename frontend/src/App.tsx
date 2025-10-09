import { Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import './styles.css';
import './styles-modern.css';

// Page components
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import OnboardingNew from './pages/OnboardingNew';
import Dashboard from './pages/Dashboard';
import DashboardUnified from './pages/DashboardUnified';
import DashboardModern from './pages/DashboardModern';
import MemoryProfile from './pages/MemoryProfile';
import GenerateResume from './pages/GenerateResume';
import History from './pages/History';
import Extension from './pages/Extension';
import Billing from './pages/Billing';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import Support from './pages/Support';
import Privacy from './pages/Privacy';

// Layout components
import ProtectedRoute from './layouts/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import MainLayout from './layouts/MainLayout';
import ModernLayout from './layouts/ModernLayout';

// Context providers
import { OnboardingProvider } from './contexts/OnboardingContext';

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

  // Sync Clerk token to extension when user signs in
  useEffect(() => {
    async function syncTokenToExtension() {
      if (isSignedIn && user) {
        try {
          const token = await getToken();
          const extensionId = import.meta.env.VITE_EXTENSION_ID;

          if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime && extensionId) {
            console.log('🔄 Syncing token to extension:', extensionId);
            (window as any).chrome.runtime.sendMessage(
              extensionId,
              {
                type: 'CLERK_TOKEN_UPDATE',
                token: token,
                email: user.primaryEmailAddress?.emailAddress
              },
              (response: any) => {
                if ((window as any).chrome.runtime.lastError) {
                  console.log('⚠️ Extension not available:', (window as any).chrome.runtime.lastError.message);
                } else {
                  console.log('✅ Token synced to extension', response);
                }
              }
            );
          } else {
            console.log('ℹ️ Extension ID not configured or chrome runtime unavailable');
          }
        } catch (error) {
          console.error('❌ Failed to sync token:', error);
        }
      }
    }
    syncTokenToExtension();
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
      <Route path="/generate" element={
        <ProtectedRoute>
          <ModernLayout>
            <DashboardModern />
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
