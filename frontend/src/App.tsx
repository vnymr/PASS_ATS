import { Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
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
import SettingsPage from './pages/Settings';

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
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthPage />} />
      {/* ONBOARDING DISABLED: Route temporarily commented out
          To re-enable: Uncomment this route and set ONBOARDING_ENABLED=true in ProtectedRoute.tsx
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingProvider>
            <OnboardingNew />
          </OnboardingProvider>
        </ProtectedRoute>
      } />
      */}
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
      <Route path="/settings" element={
        <ProtectedRoute>
          <ModernLayout>
            <SettingsPage />
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
    </Routes>
  );
}