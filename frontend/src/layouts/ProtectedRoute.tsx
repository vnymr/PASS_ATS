import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../auth';
import { api } from '../api-adapter';
import Icons from '../components/ui/icons';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [hasProfile, setHasProfile] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);
  const location = useLocation();

  React.useEffect(() => {
    async function checkAuthAndProfile() {
      const token = getToken();

      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);

      // Check if user has completed onboarding (has profile)
      try {
        const profile = await api.getProfile();
        setHasProfile(!!profile);
      } catch (err) {
        // If profile fetch fails (404), user hasn't completed onboarding
        setHasProfile(false);
      }

      setLoading(false);
    }

    checkAuthAndProfile();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <Icons.loader className="animate-spin" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // If authenticated but no profile, redirect to onboarding (unless already there)
  if (hasProfile === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" />;
  }

  return <>{children}</>;
}