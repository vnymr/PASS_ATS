import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Icons from './ui/icons';
import logger from '../utils/logger';

interface Profile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  summary?: string;
  skills?: string[];
  experiences?: any[];
  resumeText?: string;
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');

function calculateCompletion(profile: Profile | null): number {
  if (!profile) return 0;

  let score = 0;
  if (profile.name) score += 15;
  if (profile.email) score += 15;
  if (profile.phone) score += 15;
  if (profile.location) score += 5;
  if (profile.linkedin) score += 5;
  if (profile.summary) score += 15;
  if (profile.skills && profile.skills.length >= 3) score += 15;
  if (profile.experiences && profile.experiences.length >= 1) score += 10;
  if (profile.resumeText) score += 5;

  return Math.min(score, 100);
}

export default function ProfileCompletionBanner() {
  const navigate = useNavigate();
  const { getToken, isSignedIn } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if banner was dismissed this session
    const wasDismissed = sessionStorage.getItem('profile_banner_dismissed');
    if (wasDismissed) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    async function loadProfile() {
      if (!isSignedIn) {
        setLoading(false);
        return;
      }

      try {
        const token = await getToken();
        if (!token) return;

        const response = await fetch(`${API_URL}/api/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (err) {
        logger.error('Failed to load profile for banner', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [isSignedIn, getToken]);

  const handleDismiss = () => {
    sessionStorage.setItem('profile_banner_dismissed', 'true');
    setDismissed(true);
  };

  // Don't show while loading
  if (loading) return null;

  // Don't show if dismissed
  if (dismissed) return null;

  const completion = calculateCompletion(profile);

  // Don't show if profile is complete (100%)
  if (completion >= 100) return null;

  // Don't show if no profile at all (onboarding will handle it)
  if (!profile || completion === 0) return null;

  return (
    <div className="bg-gradient-to-r from-[var(--primary-50)] to-[var(--secondary-50)] border-b border-[var(--primary-200)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--primary-100)] flex items-center justify-center ring-2 ring-[var(--primary-200)]">
              <Icons.user className="w-5 h-5 text-[var(--primary-600)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-sm sm:text-base font-semibold text-[var(--text-900)]">
                  Complete your profile
                </span>
                <span className="text-sm font-bold text-[var(--primary-600)] whitespace-nowrap">
                  {completion}%
                </span>
              </div>
              <div className="h-2 bg-[var(--primary-200)] rounded-full overflow-hidden max-w-md">
                <div
                  className="h-full bg-gradient-to-r from-[var(--primary-500)] to-[var(--primary-600)] transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-600)] rounded-lg transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-95"
            >
              <span>Complete Now</span>
              <Icons.chevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-[var(--text-400)] hover:text-[var(--text-700)] hover:bg-[var(--text-100)] rounded-lg transition-colors duration-200"
              aria-label="Dismiss"
            >
              <Icons.x className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
