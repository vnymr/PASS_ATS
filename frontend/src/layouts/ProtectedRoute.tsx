import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Icons from '../components/ui/icons';
import logger from '../utils/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const location = useLocation();
  const [profileStatus, setProfileStatus] = React.useState<'loading' | 'none' | 'incomplete' | 'complete'>('loading');
  const checkingRef = React.useRef(false);

  React.useEffect(() => {
    async function checkProfile() {
      if (!isLoaded) return;

      if (!isSignedIn || !userId) {
        setProfileStatus('none');
        return;
      }

      // Check if THIS USER just completed onboarding (user-specific key)
      const justCompleted = sessionStorage.getItem(`onboarding_complete_${userId}`);
      if (justCompleted) {
        setProfileStatus('complete');
        return;
      }

      // Prevent multiple concurrent checks
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const token = await getToken();
        if (!token) {
          setProfileStatus('none');
          return;
        }

        const response = await fetch(`${API_URL}/api/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 404) {
          // User has no profile - needs onboarding
          setProfileStatus('none');
        } else if (response.ok) {
          const profile = await response.json();
          // Check if profile has minimum required fields
          const hasBasicInfo = profile.name && profile.email && profile.phone;
          setProfileStatus(hasBasicInfo ? 'complete' : 'incomplete');
        } else {
          // API error - assume complete to avoid blocking
          logger.error('Profile check failed', { status: response.status });
          setProfileStatus('complete');
        }
      } catch (err) {
        logger.error('Profile check error', err);
        // On error, assume complete to avoid blocking users
        setProfileStatus('complete');
      } finally {
        checkingRef.current = false;
      }
    }

    checkProfile();
  }, [isLoaded, isSignedIn, getToken, userId]);

  // Show loading while checking auth/profile
  if (!isLoaded || profileStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Icons.loader className="animate-spin text-[var(--primary)]" size={48} />
      </div>
    );
  }

  // Redirect to auth if not signed in
  if (!isSignedIn) {
    return <Navigate to="/auth" replace />;
  }

  // Check sessionStorage directly here (in render) to catch recent onboarding completion
  // This handles the case where navigate() was called but useEffect hasn't re-run yet
  const justCompletedOnboarding = userId && sessionStorage.getItem(`onboarding_complete_${userId}`);

  // Redirect to onboarding if no profile exists (new users)
  // But allow access to onboarding page itself, and skip if just completed
  if (profileStatus === 'none' && location.pathname !== '/onboarding' && !justCompletedOnboarding) {
    logger.info('New user without profile, redirecting to onboarding', { from: location.pathname });
    sessionStorage.setItem('intendedDestination', location.pathname);
    return <Navigate to="/onboarding" replace />;
  }

  // If user completed onboarding and tries to access /onboarding, redirect to happy
  if (profileStatus === 'complete' && location.pathname === '/onboarding') {
    return <Navigate to="/happy" replace />;
  }

  return <>{children}</>;
}
