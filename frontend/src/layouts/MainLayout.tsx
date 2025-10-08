import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import Icons from '../components/ui/icons';
import SettingsModal from '../components/SettingsModal';
import ProfileModal from '../components/ProfileModal';
import logoImg from '../logo.svg';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const scrollToHistory = () => {
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
      setTimeout(() => {
        document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="ai-app">
      {/* Top Navbar */}
      <nav className="ai-navbar">
        <div className="ai-navbar-left">
          <img src={logoImg} alt="HappyResume" className="ai-navbar-logo" />
        </div>
        <div className="ai-navbar-right">
          <button
            className={`ai-nav-btn ${location.pathname === '/dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
            aria-label="Generate"
          >
            <Icons.zap size={18} />
            <span>Generate</span>
          </button>
          <button
            className="ai-nav-btn"
            onClick={scrollToHistory}
            aria-label="History"
          >
            <Icons.clock size={18} />
            <span>History</span>
          </button>
          <button
            className="ai-nav-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
          >
            <Icons.settings size={18} />
            <span>Settings</span>
          </button>
          <button
            className="ai-nav-btn"
            onClick={() => setShowProfile(true)}
            aria-label="Profile"
          >
            <Icons.user size={18} />
            <span>Profile</span>
          </button>
          <div className="ai-navbar-user">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="ai-main">
        {children}
      </main>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}