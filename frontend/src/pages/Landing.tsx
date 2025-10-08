import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';
// import { api } from '../api-clerk'; // ONBOARDING DISABLED: API not needed without profile check
import logoImg from '../logo.svg';
import { DottedSurface } from '@/components/ui/dotted-surface';

export default function Landing() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  // Redirect signed-in users directly to dashboard
  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);
  // ONBOARDING DISABLED: Profile check bypassed - all users go directly to dashboard
  // Original logic checked profile status to show different CTAs
  // To re-enable: Uncomment the profile check code below and update the SignedIn button logic
  /*
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    async function checkProfile() {
      if (!isSignedIn) {
        setHasProfile(null);
        return;
      }

      setLoading(true);
      try {
        const token = await getToken();
        const profile = await api.getProfile(token || undefined);
        setHasProfile(!!profile);
      } catch (err: any) {
        // 404 means no profile (onboarding not completed)
        if (err?.response?.status === 404 || err?.status === 404) {
          setHasProfile(false);
        } else {
          // Other error - assume profile exists
          console.error('Profile check error:', err);
          setHasProfile(true);
        }
      } finally {
        setLoading(false);
      }
    }

    checkProfile();
  }, [isSignedIn, getToken]);
  */

  return (
    <div className="landing-hero" style={{ background: '#0a0a0a', position: 'relative' }}>
      <DottedSurface />

      <nav className="landing-nav" style={{ position: 'relative', zIndex: 100 }}>
        <div className="nav-container">
          <div className="logo">
            <img src={logoImg} alt="HappyResume" className="logo-img" />
          </div>
          <div className="nav-buttons">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-ghost">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn btn-primary">Get Started</button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      <div className="hero-content" style={{ position: 'relative', zIndex: 100 }}>
        <h1 className="hero-title" style={{
          color: '#ffffff'
        }}>
          Make Every Application Count
        </h1>
        <p className="hero-subtitle" style={{ color: '#a0a0a0' }}>
          Turn your profile + any job post into a one-page, ATS-ready resume.
          Every time in under 20 seconds.
        </p>
        <div className="hero-buttons">
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="btn btn-primary btn-large">
                Start Building Your Resume
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            {/* ONBOARDING DISABLED: Always show dashboard button for signed-in users */}
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary btn-large">
              Go to Dashboard
            </button>
          </SignedIn>
          <button className="btn btn-outline btn-large">
            Download Extension
          </button>
        </div>
      </div>
    </div>
  );
}