import React from 'react';
import { Navigate } from 'react-router-dom';
// import { useLocation } from 'react-router-dom'; // ONBOARDING DISABLED: Not needed without profile-based redirects
import { useAuth } from '@clerk/clerk-react';
// import { api } from '../api-clerk'; // ONBOARDING DISABLED: API not needed without profile checks
import Icons from '../components/ui/icons';
import logger from '../utils/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isSignedIn, isLoaded } = useAuth();
  // const { getToken } = useAuth(); // ONBOARDING DISABLED: Not needed without API calls
  // const { user } = useUser(); // ONBOARDING DISABLED: Not currently used
  // const [hasProfile, setHasProfile] = React.useState<boolean | null>(null); // ONBOARDING DISABLED
  const [loading, setLoading] = React.useState(true);
  // const location = useLocation(); // ONBOARDING DISABLED: Not needed without redirects
  // const checkingRef = React.useRef(false); // ONBOARDING DISABLED: Not needed without profile checks

  // ONBOARDING DISABLED: Bypassing profile check - treating all authenticated users as having profiles
  // To re-enable: Uncomment the imports and restore the original profile check logic below

  React.useEffect(() => {
    // ONBOARDING DISABLED: Simply check auth status
    if (!isLoaded) {
      setLoading(true);
    } else {
      setLoading(false);
    }

    // Original profile check logic - preserved for re-enablement
    /*
    async function checkProfile() {
      // Skip profile check if onboarding is disabled
      if (!ONBOARDING_ENABLED) {
        setHasProfile(true);
        setLoading(false);
        return;
      }

      // Prevent multiple concurrent checks
      if (checkingRef.current || !isLoaded || !isSignedIn) {
        if (!isLoaded || !isSignedIn) {
          setLoading(false);
        }
        return;
      }

      checkingRef.current = true;

      // Check if user has completed onboarding (has profile)
      try {
        const token = await getToken();
        const profile = await api.getProfile(token || undefined);
        setHasProfile(!!profile);
      } catch (err: any) {
        // Distinguish between 404 (no profile) and other errors
        if (err?.response?.status === 404 || err?.status === 404) {
          // User hasn't completed onboarding
          setHasProfile(false);
        } else {
          // Other error - assume profile exists to avoid redirect loop
          logger.error('Profile check error', err);
          setHasProfile(true);
        }
      } finally {
        checkingRef.current = false;
        setLoading(false);
      }
    }

    checkProfile();
    */
  }, [isLoaded]);

  if (!isLoaded || loading) {
    return (
      <div className="loading-container">
        <Icons.loader className="animate-spin" size={48} />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth" />;
  }

  // ONBOARDING DISABLED: Skip profile-based redirects
  // Original logic: Redirect to /onboarding if hasProfile === false
  // To re-enable: Uncomment the block below and set ONBOARDING_ENABLED to true above
  /*
  if (hasProfile === false && location.pathname !== '/onboarding') {
    logger.info('User has no profile, redirecting to onboarding from:', { pathname: location.pathname });
    // Store the intended destination so we can redirect back after onboarding
    sessionStorage.setItem('intendedDestination', location.pathname);
    return <Navigate to="/onboarding" replace />;
  }
  */

  return <>{children}</>;
}