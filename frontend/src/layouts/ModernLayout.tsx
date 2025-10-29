import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/clerk-react';
import Icons from '../components/ui/icons';
import { api, type Quota } from '../api-clerk';
import logoImg from '../logo.svg';

interface ModernLayoutProps {
  children: React.ReactNode;
}

function UsageBadge() {
  const { getToken } = useAuth();
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    loadQuota();
    // Refresh quota every 30 seconds
    const interval = setInterval(loadQuota, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadQuota() {
    try {
      const token = await getToken();
      const data = await api.getQuota(token || undefined);
      setQuota(data);
    } catch (error) {
      console.error('Failed to load quota:', error);
    }
  }

  if (!quota) return null;

  const percentage = (quota.used / quota.limit) * 100;
  const isNearLimit = percentage >= 80;

  return (
    <div
      className={`px-2.5 py-1 rounded-md text-xs font-medium text-white ml-2 transition ${isNearLimit ? 'bg-[#cd0000]' : 'bg-black'}`}
    >
      {quota.used}/{quota.limit}
    </div>
  );
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
            <img src={logoImg} alt="HappyResume" className="modern-nav-logo-img" />
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
              className={`modern-nav-item ${location.pathname === '/find-jobs' ? 'active' : ''}`}
              onClick={() => navigate('/find-jobs')}
              aria-label="Find Jobs"
            >
              <Icons.briefcase size={16} />
              <span>Jobs</span>
            </button>

            <button
              className={`modern-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
              onClick={() => navigate('/profile')}
              aria-label="Profile"
            >
              <Icons.user size={16} />
              <span>Profile</span>
            </button>

            <button
              className={`modern-nav-item ${location.pathname === '/billing' || location.pathname === '/pricing' ? 'active' : ''}`}
              onClick={() => navigate('/billing')}
              aria-label="Billing"
            >
              <Icons.dollarSign size={16} />
              <span>Billing</span>
              <UsageBadge />
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