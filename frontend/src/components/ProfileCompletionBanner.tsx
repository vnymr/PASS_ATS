import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icons from './ui/icons';

interface ProfileCompletionBannerProps {
  isComplete: boolean;
}

export default function ProfileCompletionBanner({ isComplete }: ProfileCompletionBannerProps) {
  const navigate = useNavigate();

  if (isComplete) {
    return null; // Don't show banner if profile is complete
  }

  return (
    <div className="profile-completion-banner">
      <div className="banner-content">
        <Icons.alertCircle size={20} />
        <span className="banner-text">Complete your profile to get started</span>
      </div>
      <button
        className="banner-button"
        onClick={() => navigate('/profile')}
      >
        <span>Complete Profile</span>
        <Icons.arrowRight size={16} />
      </button>
    </div>
  );
}
