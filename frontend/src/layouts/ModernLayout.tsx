import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import Icons from '../components/ui/icons';

interface ModernLayoutProps {
  children: React.ReactNode;
}

export default function ModernLayout({ children }: ModernLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const scrollToHistory = () => {
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
      setTimeout(() => {
        document.getElementById('history-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    } else {
      document.getElementById('history-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <div className="modern-app">
      {/* Top Navigation */}
      <nav className="modern-nav">
        <div className="modern-nav-container">
          <div className="modern-nav-brand">
            <div className="modern-nav-logo">R</div>
            <div className="modern-nav-title">ResumeGen</div>
          </div>

          <div className="modern-nav-menu">
            <button
              className={`modern-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
              aria-label="Generate"
            >
              <Icons.zap size={16} />
              <span>Generate</span>
            </button>

            <button
              className={`modern-nav-item ${location.pathname === '/history' ? 'active' : ''}`}
              onClick={() => (location.pathname === '/dashboard' ? scrollToHistory() : navigate('/history'))}
              aria-label="History"
            >
              <Icons.clock size={16} />
              <span>History</span>
            </button>

            <button
              className={`modern-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
              onClick={() => navigate('/settings')}
              aria-label="Settings"
            >
              <Icons.settings size={16} />
              <span>Settings</span>
            </button>

            <button
              className={`modern-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
              onClick={() => navigate('/profile')}
              aria-label="Profile"
            >
              <Icons.user size={16} />
              <span>Profile</span>
            </button>

            <div className="modern-nav-user">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: { avatarBox: 'w-8 h-8' }
                }}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {children}
    </div>
  );
}